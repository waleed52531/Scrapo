export type EmailMessageInput = {
  to: string;
  from?: string | null;
  subject: string;
  bodyText: string;
  threadId?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
};

export type DraftResult = {
  draftId: string;
  messageId?: string | null;
  threadId?: string | null;
};

export type SendResult = {
  messageId: string;
  threadId: string;
  headerMessageId?: string | null;
};

export interface EmailProvider {
  createDraft(input: EmailMessageInput): Promise<DraftResult>;
  send(input: EmailMessageInput): Promise<SendResult>;
  sendDraft(draftId: string): Promise<SendResult>;
  healthCheck(): Promise<{ ok: boolean; accountIdentifier?: string | null }>;
}

export class MockEmailProvider implements EmailProvider {
  constructor(private readonly accountIdentifier: string) {}

  async createDraft(): Promise<DraftResult> {
    const id = randomProviderId("mock-draft");
    return {
      draftId: id,
      messageId: randomProviderId("mock-message"),
      threadId: randomProviderId("mock-thread"),
    };
  }

  async send(input: EmailMessageInput): Promise<SendResult> {
    return {
      messageId: randomProviderId("mock-message"),
      threadId: input.threadId ?? randomProviderId("mock-thread"),
      headerMessageId: `<${randomProviderId("scrapo")}@mock.gmail>`,
    };
  }

  async sendDraft(draftId: string): Promise<SendResult> {
    return {
      messageId: draftId.replace("mock-draft", "mock-sent"),
      threadId: randomProviderId("mock-thread"),
      headerMessageId: `<${randomProviderId("scrapo")}@mock.gmail>`,
    };
  }

  async healthCheck() {
    return { ok: true, accountIdentifier: this.accountIdentifier };
  }
}

export class GmailEmailProvider implements EmailProvider {
  constructor(private readonly accessToken: string) {}

  async createDraft(input: EmailMessageInput): Promise<DraftResult> {
    const response = await gmailFetch(
      "/gmail/v1/users/me/drafts",
      this.accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          message: {
            raw: buildMime(input),
            ...(input.threadId ? { threadId: input.threadId } : {}),
          },
        }),
      },
    );
    const payload = (await response.json()) as {
      id: string;
      message?: { id?: string; threadId?: string };
    };
    return {
      draftId: payload.id,
      messageId: payload.message?.id,
      threadId: payload.message?.threadId,
    };
  }

  async send(input: EmailMessageInput): Promise<SendResult> {
    const response = await gmailFetch(
      "/gmail/v1/users/me/messages/send",
      this.accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          raw: buildMime(input),
          ...(input.threadId ? { threadId: input.threadId } : {}),
        }),
      },
    );
    const payload = (await response.json()) as { id: string; threadId: string };
    return { messageId: payload.id, threadId: payload.threadId };
  }

  async sendDraft(draftId: string): Promise<SendResult> {
    const response = await gmailFetch(
      "/gmail/v1/users/me/drafts/send",
      this.accessToken,
      {
        method: "POST",
        body: JSON.stringify({ id: draftId }),
      },
    );
    const payload = (await response.json()) as { id: string; threadId: string };
    return { messageId: payload.id, threadId: payload.threadId };
  }

  async healthCheck() {
    const response = await gmailFetch(
      "/gmail/v1/users/me/profile",
      this.accessToken,
      { method: "GET" },
    );
    const payload = (await response.json()) as { emailAddress?: string };
    return { ok: true, accountIdentifier: payload.emailAddress };
  }
}

export function buildMime(input: EmailMessageInput) {
  const boundary = `scrapo_${Date.now().toString(36)}`;
  const html = input.bodyText
    .split("\n")
    .map((line) => escapeHtml(line))
    .join("<br>");
  const headers = [
    input.from ? `From: ${input.from}` : null,
    `To: ${input.to}`,
    `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    input.inReplyTo ? `In-Reply-To: ${input.inReplyTo}` : null,
    input.references ? `References: ${input.references}` : null,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);
  const raw = [
    ...headers,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    input.bodyText,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
    "",
    `--${boundary}--`,
  ].join("\r\n");
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function gmailFetch(
  path: string,
  accessToken: string,
  init: RequestInit,
) {
  const response = await fetch(`https://gmail.googleapis.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      error?.error?.message ?? `Gmail API HTTP ${response.status}`,
    );
  }
  return response;
}

function encodeHeader(value: string) {
  return hasNonAscii(value)
    ? `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`
    : value;
}

function hasNonAscii(value: string) {
  return [...value].some((char) => char.charCodeAt(0) > 127);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function randomProviderId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
