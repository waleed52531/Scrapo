import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IntegrationStatus, Prisma } from "@prisma/client";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createHash,
  randomBytes,
} from "node:crypto";
import { AnalysisQueueService } from "../analysis/analysis-queue.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  GmailEmailProvider,
  MockEmailProvider,
  type EmailProvider,
} from "./gmail.provider";
import type { MockGmailReplyDto } from "./dto/gmail.dto";

const GMAIL_PROVIDER = "GMAIL";
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
] as const;

type StoredCredentials = {
  provider: "mock" | "gmail";
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  mockReplies?: Array<{
    outreachId: string;
    fromEmail: string;
    subject?: string;
    body: string;
    receivedAt: string;
  }>;
};

@Injectable()
export class GmailService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(AnalysisQueueService) private readonly queue: AnalysisQueueService,
  ) {}

  async status(workspaceId: string) {
    const connection = await this.prisma.integrationConnection.findUnique({
      where: {
        workspaceId_provider: { workspaceId, provider: GMAIL_PROVIDER },
      },
    });
    const configured = this.googleConfigured();
    const connected = connection?.status === IntegrationStatus.CONNECTED;
    return {
      provider: GMAIL_PROVIDER,
      status:
        connection?.status ??
        (configured
          ? IntegrationStatus.CONFIGURED
          : IntegrationStatus.NOT_CONFIGURED),
      connected,
      accountIdentifier: connection?.accountIdentifier ?? null,
      connectedAt: connection?.connectedAt ?? null,
      lastSuccessfulSync:
        connection?.lastGmailSyncAt ?? connection?.lastSuccessfulAt ?? null,
      lastErrorAt: connection?.lastErrorAt ?? null,
      lastError: connection?.lastError ?? null,
      scopes: jsonStringArray(connection?.scopes),
      capabilities: {
        createDrafts: connected,
        sendEmail: connected,
        readReplies: connected,
        threadTracking: connected,
      },
      mockMode: this.mockMode(),
      connectUrl: null,
    };
  }

  async connect(workspaceId: string, userId: string) {
    if (this.mockMode() || !this.googleConfigured()) {
      await this.upsertConnection(workspaceId, userId, {
        accountIdentifier: "mock.gmail@scrapo.local",
        status: IntegrationStatus.CONNECTED,
        credentials: { provider: "mock", mockReplies: [] },
      });
      return this.status(workspaceId);
    }
    return {
      ...(await this.status(workspaceId)),
      connectUrl: this.oauthUrl(workspaceId, userId),
    };
  }

  async callback(code: string, state: string) {
    const parsed = this.verifyState(state);
    const token = await this.exchangeCode(code);
    const profile = await this.fetchProfile(token.access_token);
    await this.upsertConnection(parsed.workspaceId, parsed.userId, {
      accountIdentifier: profile.emailAddress,
      status: IntegrationStatus.CONNECTED,
      credentials: {
        provider: "gmail",
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: Date.now() + Number(token.expires_in ?? 3600) * 1000,
        tokenType: token.token_type,
      },
    });
    return {
      connected: true,
      accountIdentifier: profile.emailAddress,
      workspaceId: parsed.workspaceId,
    };
  }

  async disconnect(workspaceId: string, userId: string) {
    const connection = await this.prisma.integrationConnection.findUnique({
      where: {
        workspaceId_provider: { workspaceId, provider: GMAIL_PROVIDER },
      },
    });
    const credentials = this.decryptCredentials(
      connection?.encryptedCredentials,
    );
    if (credentials?.provider === "gmail" && credentials.refreshToken) {
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: credentials.refreshToken }),
      }).catch(() => undefined);
    }
    const updated = await this.prisma.integrationConnection.upsert({
      where: {
        workspaceId_provider: { workspaceId, provider: GMAIL_PROVIDER },
      },
      update: {
        status: IntegrationStatus.DISCONNECTED,
        encryptedCredentials: null,
        encryptedCredentialsReference: null,
        lastError: null,
      },
      create: {
        workspaceId,
        provider: GMAIL_PROVIDER,
        status: IntegrationStatus.DISCONNECTED,
      },
    });
    await this.audit(workspaceId, userId, "GMAIL_DISCONNECTED", updated.id);
    return this.status(workspaceId);
  }

  async test(workspaceId: string) {
    const provider = await this.providerForWorkspace(workspaceId);
    const result = await provider.healthCheck();
    await this.prisma.integrationConnection.update({
      where: {
        workspaceId_provider: { workspaceId, provider: GMAIL_PROVIDER },
      },
      data: {
        accountIdentifier: result.accountIdentifier,
        lastSuccessfulAt: new Date(),
        lastSuccessfulRequest: new Date(),
        lastError: null,
        lastErrorAt: null,
      },
    });
    return { ok: true, accountIdentifier: result.accountIdentifier };
  }

  async sync(workspaceId: string) {
    return this.queue.enqueue(workspaceId, "SYNC_GMAIL", {});
  }

  async enqueueMockReply(
    workspaceId: string,
    userId: string,
    input: MockGmailReplyDto,
  ) {
    const connection = await this.requireConnection(workspaceId);
    const credentials = this.decryptCredentials(
      connection.encryptedCredentials,
    );
    if (!credentials || credentials.provider !== "mock") {
      throw new BadRequestException({
        code: "MOCK_GMAIL_NOT_ACTIVE",
        message: "Mock Gmail replies are only available in mock mode.",
      });
    }
    const outreach = await this.prisma.outreachMessage.findFirst({
      where: { id: input.outreachId, workspaceId },
    });
    if (!outreach) {
      throw new NotFoundException({
        code: "OUTREACH_NOT_FOUND",
        message: "Outreach message could not be found.",
      });
    }
    credentials.mockReplies = [
      ...(credentials.mockReplies ?? []),
      { ...input, receivedAt: new Date().toISOString() },
    ];
    await this.prisma.integrationConnection.update({
      where: { id: connection.id },
      data: { encryptedCredentials: this.encryptCredentials(credentials) },
    });
    await this.audit(
      workspaceId,
      userId,
      "GMAIL_MOCK_REPLY_QUEUED",
      outreach.id,
    );
    return { queued: true };
  }

  async providerForWorkspace(workspaceId: string): Promise<EmailProvider> {
    const connection = await this.requireConnection(workspaceId);
    const credentials = this.decryptCredentials(
      connection.encryptedCredentials,
    );
    if (!credentials) {
      throw new BadRequestException({
        code: "GMAIL_CREDENTIALS_MISSING",
        message: "Gmail credentials are missing.",
      });
    }
    if (credentials.provider === "mock") {
      return new MockEmailProvider(
        connection.accountIdentifier ?? "mock.gmail@scrapo.local",
      );
    }
    const accessToken = await this.validAccessToken(connection.id, credentials);
    return new GmailEmailProvider(accessToken);
  }

  async markReauthRequired(workspaceId: string, message: string) {
    await this.prisma.integrationConnection.updateMany({
      where: { workspaceId, provider: GMAIL_PROVIDER },
      data: {
        status: IntegrationStatus.REAUTH_REQUIRED,
        lastError: message,
        lastErrorAt: new Date(),
      },
    });
  }

  private async requireConnection(workspaceId: string) {
    const connection = await this.prisma.integrationConnection.findUnique({
      where: {
        workspaceId_provider: { workspaceId, provider: GMAIL_PROVIDER },
      },
    });
    if (!connection || connection.status !== IntegrationStatus.CONNECTED) {
      throw new BadRequestException({
        code: "GMAIL_NOT_CONNECTED",
        message: "Connect Gmail before creating drafts or sending email.",
      });
    }
    return connection;
  }

  private async validAccessToken(
    connectionId: string,
    credentials: StoredCredentials,
  ) {
    if (
      credentials.accessToken &&
      credentials.expiresAt &&
      credentials.expiresAt - Date.now() > 60_000
    ) {
      return credentials.accessToken;
    }
    if (!credentials.refreshToken) {
      throw new BadRequestException({
        code: "GMAIL_REAUTH_REQUIRED",
        message: "Gmail refresh token is missing. Reconnect Gmail.",
      });
    }
    const refreshed = await this.refreshToken(credentials.refreshToken);
    const next: StoredCredentials = {
      ...credentials,
      accessToken: refreshed.access_token,
      expiresAt: Date.now() + Number(refreshed.expires_in ?? 3600) * 1000,
      tokenType: refreshed.token_type,
    };
    await this.prisma.integrationConnection.update({
      where: { id: connectionId },
      data: { encryptedCredentials: this.encryptCredentials(next) },
    });
    return next.accessToken!;
  }

  private async upsertConnection(
    workspaceId: string,
    userId: string | null,
    input: {
      accountIdentifier: string;
      status: IntegrationStatus;
      credentials: StoredCredentials;
    },
  ) {
    const connection = await this.prisma.integrationConnection.upsert({
      where: {
        workspaceId_provider: { workspaceId, provider: GMAIL_PROVIDER },
      },
      update: {
        status: input.status,
        accountIdentifier: input.accountIdentifier,
        encryptedCredentials: this.encryptCredentials(input.credentials),
        encryptedCredentialsReference:
          "integration_connections.encrypted_credentials",
        scopes: [...GMAIL_SCOPES] as unknown as Prisma.InputJsonValue,
        connectedAt: new Date(),
        lastSuccessfulAt: new Date(),
        lastSuccessfulRequest: new Date(),
        lastError: null,
        lastErrorAt: null,
      },
      create: {
        workspaceId,
        provider: GMAIL_PROVIDER,
        status: input.status,
        accountIdentifier: input.accountIdentifier,
        encryptedCredentials: this.encryptCredentials(input.credentials),
        encryptedCredentialsReference:
          "integration_connections.encrypted_credentials",
        scopes: [...GMAIL_SCOPES] as unknown as Prisma.InputJsonValue,
        connectedAt: new Date(),
        lastSuccessfulAt: new Date(),
        lastSuccessfulRequest: new Date(),
      },
    });
    if (userId)
      await this.audit(workspaceId, userId, "GMAIL_CONNECTED", connection.id);
    return connection;
  }

  private oauthUrl(workspaceId: string, userId: string | null) {
    if (!this.googleConfigured()) return null;
    const redirectUri = this.redirectUri();
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set(
      "client_id",
      this.config.getOrThrow("GOOGLE_CLIENT_ID"),
    );
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("scope", GMAIL_SCOPES.join(" "));
    url.searchParams.set("state", this.signState(workspaceId, userId));
    return url.toString();
  }

  private signState(workspaceId: string, userId: string | null) {
    const payload = Buffer.from(
      JSON.stringify({
        workspaceId,
        userId,
        exp: Date.now() + 10 * 60_000,
        nonce: randomBytes(12).toString("hex"),
      }),
    ).toString("base64url");
    const sig = createHmac("sha256", this.stateSecret())
      .update(payload)
      .digest("base64url");
    return `${payload}.${sig}`;
  }

  private verifyState(state: string): { workspaceId: string; userId: string } {
    const [payload, sig] = state.split(".");
    if (!payload || !sig)
      throw new BadRequestException({
        code: "INVALID_OAUTH_STATE",
        message: "Invalid OAuth state.",
      });
    const expected = createHmac("sha256", this.stateSecret())
      .update(payload)
      .digest("base64url");
    if (sig !== expected)
      throw new BadRequestException({
        code: "INVALID_OAUTH_STATE",
        message: "Invalid OAuth state.",
      });
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as {
      workspaceId?: string;
      userId?: string;
      exp?: number;
    };
    if (
      !parsed.workspaceId ||
      !parsed.userId ||
      !parsed.exp ||
      parsed.exp < Date.now()
    ) {
      throw new BadRequestException({
        code: "INVALID_OAUTH_STATE",
        message: "OAuth state is expired or incomplete.",
      });
    }
    return { workspaceId: parsed.workspaceId, userId: parsed.userId };
  }

  private async exchangeCode(code: string) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.config.getOrThrow("GOOGLE_CLIENT_ID"),
        client_secret: this.config.getOrThrow("GOOGLE_CLIENT_SECRET"),
        redirect_uri: this.redirectUri(),
        grant_type: "authorization_code",
      }),
    });
    if (!response.ok) {
      throw new BadRequestException({
        code: "GMAIL_OAUTH_EXCHANGE_FAILED",
        message: "Google OAuth code exchange failed.",
      });
    }
    return response.json() as Promise<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
    }>;
  }

  private async refreshToken(refreshToken: string) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.config.getOrThrow("GOOGLE_CLIENT_ID"),
        client_secret: this.config.getOrThrow("GOOGLE_CLIENT_SECRET"),
        grant_type: "refresh_token",
      }),
    });
    if (!response.ok) {
      throw new BadRequestException({
        code: "GMAIL_REAUTH_REQUIRED",
        message: "Gmail authorization expired or was revoked. Reconnect Gmail.",
      });
    }
    return response.json() as Promise<{
      access_token: string;
      expires_in?: number;
      token_type?: string;
    }>;
  }

  private async fetchProfile(accessToken: string) {
    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!response.ok) {
      throw new BadRequestException({
        code: "GMAIL_PROFILE_FAILED",
        message: "Could not read the connected Gmail profile.",
      });
    }
    return response.json() as Promise<{
      emailAddress: string;
      historyId?: string;
    }>;
  }

  private encryptCredentials(value: StoredCredentials) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
  }

  private decryptCredentials(
    value: string | null | undefined,
  ): StoredCredentials | null {
    if (!value) return null;
    const [version, iv, tag, encrypted] = value.split(".");
    if (version !== "v1" || !iv || !tag || !encrypted) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.encryptionKey(),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString("utf8")) as StoredCredentials;
  }

  private encryptionKey() {
    return createHash("sha256").update(this.stateSecret()).digest();
  }

  private stateSecret() {
    return (
      this.config.get<string>("GMAIL_TOKEN_ENCRYPTION_KEY") ||
      this.config.get<string>("SUPABASE_JWT_SECRET") ||
      "scrapo-local-development-gmail-secret"
    );
  }

  private redirectUri() {
    const value = this.config.get<string>("GOOGLE_REDIRECT_URI");
    if (!value)
      throw new BadRequestException({
        code: "GOOGLE_REDIRECT_URI_MISSING",
        message: "GOOGLE_REDIRECT_URI is required.",
      });
    const url = new URL(value);
    if (url.protocol !== "https:" && url.hostname !== "localhost") {
      throw new BadRequestException({
        code: "INVALID_GOOGLE_REDIRECT_URI",
        message: "Google redirect URI must be HTTPS or localhost.",
      });
    }
    return url.toString();
  }

  private googleConfigured() {
    return Boolean(
      this.config.get<string>("GOOGLE_CLIENT_ID") &&
      this.config.get<string>("GOOGLE_CLIENT_SECRET") &&
      this.config.get<string>("GOOGLE_REDIRECT_URI"),
    );
  }

  private mockMode() {
    return this.config.get<string>("GMAIL_PROVIDER_MODE") !== "REAL";
  }

  private async audit(
    workspaceId: string,
    userId: string | null,
    action: string,
    entityId?: string,
  ) {
    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action,
        entityType: "IntegrationConnection",
        entityId,
      },
    });
  }
}

function jsonStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
