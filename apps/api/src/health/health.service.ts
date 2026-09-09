import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import Redis from "ioredis";
import { QUEUE_NAMES } from "@scrapo/shared";
import { providerHealth, socialProviderHealth } from "../discovery/providers";
import { PrismaService } from "../prisma/prisma.service";

type ComponentStatus =
  "HEALTHY" | "DEGRADED" | "FAILED" | "DISABLED" | "NOT_CONFIGURED";

@Injectable()
export class HealthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async publicHealth() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: "ok",
      service: "api",
      version: this.version(),
      database: "connected",
      timestamp: new Date().toISOString(),
    };
  }

  async systemHealth(workspaceId: string) {
    const [database, redis, worker, gmailConnection, usageToday] =
      await Promise.all([
        this.databaseHealth(),
        this.redisHealth(),
        this.workerHealth(),
        this.prisma.integrationConnection.findUnique({
          where: { workspaceId_provider: { workspaceId, provider: "GMAIL" } },
        }),
        this.usageSummary(workspaceId, 1),
      ]);
    const providers = {
      openai: this.openAiStatus(),
      gmail: {
        status: mapIntegrationStatus(
          gmailConnection?.status ?? null,
          this.config.get("GMAIL_PROVIDER_MODE") === "REAL",
        ),
        configured: this.config.get("GMAIL_PROVIDER_MODE") === "REAL",
        accountIdentifier: gmailConnection?.accountIdentifier ?? null,
        lastSuccessfulAt: gmailConnection?.lastSuccessfulAt ?? null,
        lastErrorAt: gmailConnection?.lastErrorAt ?? null,
      },
      webSearch: mapProvider(
        providerHealth(
          this.config.get("WEB_SEARCH_PROVIDER"),
          this.config.get("WEB_SEARCH_API_KEY"),
          "web-search",
        ),
      ),
      emailEnrichment: mapProvider(
        providerHealth(
          this.config.get("EMAIL_ENRICHMENT_PROVIDER"),
          this.config.get("EMAIL_ENRICHMENT_API_KEY"),
          "email-enrichment",
        ),
      ),
      emailVerification: mapProvider(
        providerHealth(
          this.config.get("EMAIL_VERIFICATION_PROVIDER"),
          this.config.get("EMAIL_VERIFICATION_API_KEY"),
          "email-verification",
        ),
      ),
      x: mapProvider(socialProviderHealth("x")),
      reddit: mapProvider(socialProviderHealth("reddit")),
      telegram: mapProvider(socialProviderHealth("telegram")),
    };
    const status = overallStatus([
      database.status,
      redis.status,
      worker.status,
      providers.openai.status,
      providers.gmail.status,
      providers.webSearch.status,
      providers.emailEnrichment.status,
      providers.emailVerification.status,
      providers.x.status,
      providers.reddit.status,
      providers.telegram.status,
    ]);
    return {
      status,
      service: "system",
      versions: {
        web: this.config.get("WEB_VERSION") ?? this.version(),
        api: this.version(),
        worker:
          worker.version ?? this.config.get("WORKER_VERSION") ?? this.version(),
      },
      generatedAt: new Date().toISOString(),
      components: {
        api: { status: "HEALTHY" as const, version: this.version() },
        database,
        redis,
        worker,
      },
      providers,
      safety: {
        demoAuthEnabled:
          this.config.get("DEMO_AUTH_ENABLED") === "true" &&
          this.config.get("NODE_ENV") !== "production",
        outreachPausedDefault: this.config.get("OUTREACH_PAUSED") !== "false",
        autoSendEnabled: this.config.get("AUTO_SEND_ENABLED") === "true",
        mockProvidersAllowedInProduction:
          this.config.get("ALLOW_MOCK_PROVIDERS_IN_PRODUCTION") === "true",
      },
      usageToday,
    };
  }

  async usage(workspaceId: string) {
    const [today, week, month] = await Promise.all([
      this.usageSummary(workspaceId, 1),
      this.usageSummary(workspaceId, 7),
      this.usageSummary(workspaceId, 30),
    ]);
    return {
      limits: {
        maxAiCallsPerDay: numberOrNull(this.config.get("MAX_AI_CALLS_PER_DAY")),
        maxAiCallsPerWeek: numberOrNull(
          this.config.get("MAX_AI_CALLS_PER_WEEK"),
        ),
        maxSearchRequestsPerWeek: numberOrNull(
          this.config.get("MAX_SEARCH_REQUESTS_PER_WEEK"),
        ),
        maxEnrichmentRequestsPerWeek: numberOrNull(
          this.config.get("MAX_ENRICHMENT_REQUESTS_PER_WEEK"),
        ),
        maxEmailVerificationsPerWeek: numberOrNull(
          this.config.get("MAX_EMAIL_VERIFICATIONS_PER_WEEK"),
        ),
        weeklyColdEmailLimit: Number(
          this.config.get("COLD_OUTREACH_WEEKLY_LIMIT") ?? 20,
        ),
      },
      periods: { today, week, month },
    };
  }

  private async databaseHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "HEALTHY" as const };
    } catch {
      return { status: "FAILED" as const };
    }
  }

  private async redisHealth() {
    const redisUrl = this.config.get<string>("REDIS_URL");
    if (!redisUrl) return { status: "NOT_CONFIGURED" as const };
    const redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    try {
      await redis.connect();
      const pong = await redis.ping();
      return {
        status: pong === "PONG" ? ("HEALTHY" as const) : ("DEGRADED" as const),
        queues: Object.values(QUEUE_NAMES),
      };
    } catch {
      return { status: "FAILED" as const };
    } finally {
      redis.disconnect();
    }
  }

  private async workerHealth() {
    const heartbeat = await this.prisma.workerHeartbeat.findFirst({
      orderBy: { lastHeartbeatAt: "desc" },
    });
    if (!heartbeat) {
      return {
        status: "NOT_CONFIGURED" as const,
        stale: true,
        lastHeartbeatAt: null,
      };
    }
    const staleMs = Number(
      this.config.get("WORKER_HEARTBEAT_STALE_MS") ?? 120_000,
    );
    const ageMs = Date.now() - heartbeat.lastHeartbeatAt.getTime();
    const stale = ageMs > staleMs;
    return {
      status: stale ? ("FAILED" as const) : ("HEALTHY" as const),
      stale,
      workerId: heartbeat.workerId,
      version: heartbeat.version,
      queues: heartbeat.queues,
      lastHeartbeatAt: heartbeat.lastHeartbeatAt,
      ageMs,
    };
  }

  private openAiStatus() {
    const configured = Boolean(this.config.get<string>("OPENAI_API_KEY"));
    const enabled = this.config.get("OPENAI_ENABLED") === "true" || configured;
    return {
      status: !enabled
        ? ("DISABLED" as const)
        : configured
          ? ("HEALTHY" as const)
          : ("NOT_CONFIGURED" as const),
      model: this.config.get("OPENAI_MODEL") ?? "gpt-4o-mini",
      configured,
    };
  }

  private async usageSummary(workspaceId: string, days: number) {
    const since = new Date(Date.now() - days * 86_400_000);
    const [ai, searches, enrichment, verification, coldEmails] =
      await Promise.all([
        this.prisma.aiUsageLog.aggregate({
          where: { workspaceId, createdAt: { gte: since } },
          _count: { _all: true },
          _sum: { inputTokens: true, outputTokens: true, estimatedCost: true },
        }),
        this.prisma.discoveryQueryRun.count({
          where: { workspaceId, createdAt: { gte: since } },
        }),
        this.prisma.contactEnrichmentRecord.count({
          where: { workspaceId, createdAt: { gte: since } },
        }),
        this.prisma.emailVerificationRecord.count({
          where: { workspaceId, verifiedAt: { gte: since } },
        }),
        this.prisma.outreachMessage.count({
          where: {
            workspaceId,
            sentAt: { gte: since },
            messageType: "INITIAL",
          },
        }),
      ]);
    return {
      days,
      aiRequests: ai._count._all,
      aiInputTokens: ai._sum.inputTokens ?? 0,
      aiOutputTokens: ai._sum.outputTokens ?? 0,
      aiEstimatedCost: decimalToString(ai._sum.estimatedCost),
      searchRequests: searches,
      enrichmentRequests: enrichment,
      emailVerificationRequests: verification,
      coldEmailsSent: coldEmails,
    };
  }

  private version() {
    return this.config.get("APP_VERSION") ?? "0.1.0";
  }
}

function mapProvider(input: {
  status: string;
  provider: string;
  demoMode: boolean;
  message: string;
}) {
  const status: ComponentStatus =
    input.status === "CONNECTED" ||
    input.status === "ACTIVE" ||
    input.status === "CONFIGURED"
      ? "HEALTHY"
      : input.status === "DISABLED" || input.status === "APPROVAL_REQUIRED"
        ? "DISABLED"
        : input.status === "NOT_CONFIGURED"
          ? "NOT_CONFIGURED"
          : "FAILED";
  return {
    status,
    provider: input.provider,
    demoMode: input.demoMode,
    message: input.message,
  };
}

function mapIntegrationStatus(
  status: string | null,
  configured: boolean,
): ComponentStatus {
  if (status === "CONNECTED" || status === "ACTIVE") return "HEALTHY";
  if (status === "ERROR" || status === "REAUTH_REQUIRED") return "FAILED";
  if (status === "DISABLED" || status === "DISCONNECTED") return "DISABLED";
  return configured ? "NOT_CONFIGURED" : "DISABLED";
}

function overallStatus(statuses: ComponentStatus[]) {
  if (statuses.includes("FAILED")) return "FAILED";
  if (statuses.includes("DEGRADED") || statuses.includes("NOT_CONFIGURED")) {
    return "DEGRADED";
  }
  return "HEALTHY";
}

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function decimalToString(value: Prisma.Decimal | null) {
  return value ? value.toString() : "0";
}
