import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type { Job } from "bullmq";
import {
  EmailStatus,
  JobStatus,
  LeadStatus,
  OutreachStatus,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";
import { classifyDeterministicReply } from "@scrapo/shared";

type OutreachJobData = {
  workspaceId: string;
  systemJobId?: string;
  outreachId?: string;
  replyId?: string;
};

type StoredCredentials = {
  provider: "mock" | "gmail";
  mockReplies?: Array<{
    outreachId: string;
    fromEmail: string;
    subject?: string;
    body: string;
    receivedAt: string;
  }>;
};

export async function processOutreachJob(
  prisma: PrismaClient,
  job: Job<OutreachJobData>,
) {
  const { workspaceId, systemJobId } = job.data;
  await markJob(prisma, workspaceId, systemJobId, "RUNNING", 10);
  try {
    if (job.name === "SYNC_GMAIL") {
      const result = await syncGmail(prisma, job.data);
      await markJob(prisma, workspaceId, systemJobId, "COMPLETED", 100);
      return result;
    }
    if (job.name === "CLASSIFY_REPLY") {
      const result = await classifyReply(prisma, job.data);
      await markJob(prisma, workspaceId, systemJobId, "COMPLETED", 100);
      return result;
    }
    if (job.name === "GENERATE_FOLLOW_UP") {
      const result = await markDueFollowUps(prisma, job.data);
      await markJob(prisma, workspaceId, systemJobId, "COMPLETED", 100);
      return result;
    }
    if (job.name === "CREATE_GMAIL_DRAFT") {
      const result = await createMockDraft(prisma, job.data);
      await markJob(prisma, workspaceId, systemJobId, "COMPLETED", 100);
      return result;
    }
    throw new Error(`Unsupported outreach job: ${job.name}`);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown outreach worker failure";
    await markJob(prisma, workspaceId, systemJobId, "FAILED", 100, message);
    throw error;
  }
}

async function syncGmail(prisma: PrismaClient, payload: OutreachJobData) {
  const connection = await prisma.integrationConnection.findUnique({
    where: {
      workspaceId_provider: {
        workspaceId: payload.workspaceId,
        provider: "GMAIL",
      },
    },
  });
  if (!connection || connection.status !== "CONNECTED") {
    throw new Error("Gmail is not connected for this workspace.");
  }
  const credentials = decryptCredentials(connection.encryptedCredentials);
  if (!credentials || credentials.provider !== "mock") {
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        lastGmailSyncAt: new Date(),
        lastSuccessfulAt: new Date(),
        lastSuccessfulRequest: new Date(),
        lastError: null,
        lastErrorAt: null,
      },
    });
    return {
      provider: credentials?.provider ?? "gmail",
      syncedReplies: 0,
      note: "Real Gmail sync is limited to tracked threads; no mock replies were pending.",
    };
  }

  const pending = credentials.mockReplies ?? [];
  let syncedReplies = 0;
  for (const item of pending) {
    const outreach = await prisma.outreachMessage.findFirst({
      where: { id: item.outreachId, workspaceId: payload.workspaceId },
      include: { contact: true },
    });
    if (!outreach) continue;
    const gmailMessageId = `mock-reply-${item.outreachId}-${new Date(item.receivedAt).getTime()}`;
    const existing = await prisma.emailReply.findFirst({
      where: { workspaceId: payload.workspaceId, gmailMessageId },
    });
    if (existing) continue;
    const classified = classifyDeterministicReply(item.body);
    await prisma.$transaction(async (tx) => {
      const reply = await tx.emailReply.create({
        data: {
          workspaceId: payload.workspaceId,
          outreachMessageId: outreach.id,
          leadId: outreach.leadId,
          contactId: outreach.contactId,
          gmailMessageId,
          gmailThreadId: outreach.gmailThreadId,
          fromEmail: item.fromEmail.toLowerCase(),
          toEmail: outreach.contact?.email?.toLowerCase() ?? null,
          subject:
            item.subject ??
            `Re: ${outreach.subject ?? "Mobile development support"}`,
          body: item.body,
          bodyText: item.body,
          classification: classified.classification,
          sentiment: classified.sentiment,
          summary: classified.summary,
          recommendedAction: classified.recommendedAction,
          requiresResponse: classified.requiresResponse,
          meetingRequested: classified.meetingRequested,
          aiConfidence: classified.confidence,
          receivedAt: new Date(item.receivedAt),
        },
      });
      await tx.outreachMessage.update({
        where: { id: outreach.id },
        data: { status: OutreachStatus.REPLIED, repliedAt: reply.receivedAt },
      });
      await applyReplyCrmUpdate(tx, payload.workspaceId, {
        leadId: outreach.leadId,
        contactId: outreach.contactId,
        classification: classified.classification,
      });
      await tx.outreachMessage.updateMany({
        where: {
          workspaceId: payload.workspaceId,
          followUpToId: outreach.id,
          status: {
            in: [
              OutreachStatus.GENERATED,
              OutreachStatus.FOLLOW_UP_DUE,
              OutreachStatus.DRAFT_CREATED,
            ],
          },
        },
        data: { status: OutreachStatus.CANCELLED },
      });
      await tx.activity.create({
        data: {
          workspaceId: payload.workspaceId,
          leadId: outreach.leadId,
          type: "EMAIL_REPLY_RECEIVED",
          description: `Reply classified as ${classified.classification}.`,
        },
      });
    });
    syncedReplies += 1;
  }

  await prisma.integrationConnection.update({
    where: { id: connection.id },
    data: {
      encryptedCredentials: encryptCredentials({
        ...credentials,
        mockReplies: [],
      }),
      lastGmailSyncAt: new Date(),
      lastSuccessfulAt: new Date(),
      lastSuccessfulRequest: new Date(),
      lastError: null,
      lastErrorAt: null,
    },
  });
  return { provider: "mock", syncedReplies };
}

async function classifyReply(prisma: PrismaClient, payload: OutreachJobData) {
  if (!payload.replyId) throw new Error("replyId is required");
  const reply = await prisma.emailReply.findFirst({
    where: { id: payload.replyId, workspaceId: payload.workspaceId },
  });
  if (!reply) throw new Error("Reply not found");
  const classified = classifyDeterministicReply(reply.bodyText ?? reply.body);
  await prisma.$transaction(async (tx) => {
    await tx.emailReply.update({
      where: { id: reply.id },
      data: {
        classification: classified.classification,
        sentiment: classified.sentiment,
        summary: classified.summary,
        recommendedAction: classified.recommendedAction,
        requiresResponse: classified.requiresResponse,
        meetingRequested: classified.meetingRequested,
        aiConfidence: classified.confidence,
      },
    });
    await applyReplyCrmUpdate(tx, payload.workspaceId, {
      leadId: reply.leadId,
      contactId: reply.contactId,
      classification: classified.classification,
    });
  });
  return { replyId: reply.id, classification: classified.classification };
}

async function markDueFollowUps(
  prisma: PrismaClient,
  payload: OutreachJobData,
) {
  const settings = await prisma.userSettings.findUnique({
    where: { workspaceId: payload.workspaceId },
  });
  if (settings?.followUpMode === "OFF" || (settings?.maxFollowUps ?? 1) < 1) {
    return { marked: 0 };
  }
  const dueBefore = new Date(
    Date.now() -
      Number(
        process.env.FOLLOW_UP_DELAY_DAYS ?? settings?.followUpDelayDays ?? 7,
      ) *
        86_400_000,
  );
  const messages = await prisma.outreachMessage.findMany({
    where: {
      workspaceId: payload.workspaceId,
      messageType: "INITIAL",
      sentAt: { lte: dueBefore },
      repliedAt: null,
      followUpNumber: { lt: Number(settings?.maxFollowUps ?? 1) },
      status: { in: [OutreachStatus.SENT, OutreachStatus.DELIVERED] },
      followUps: { none: { status: { not: OutreachStatus.CANCELLED } } },
    },
    take: 100,
  });
  return { marked: messages.length };
}

async function createMockDraft(prisma: PrismaClient, payload: OutreachJobData) {
  if (!payload.outreachId) throw new Error("outreachId is required");
  const outreach = await prisma.outreachMessage.findFirst({
    where: { id: payload.outreachId, workspaceId: payload.workspaceId },
  });
  if (!outreach) throw new Error("Outreach not found");
  const updated = await prisma.outreachMessage.update({
    where: { id: outreach.id },
    data: {
      status: OutreachStatus.DRAFT_CREATED,
      gmailDraftId: outreach.gmailDraftId ?? `mock-draft-${outreach.id}`,
      gmailMessageId: outreach.gmailMessageId ?? `mock-message-${outreach.id}`,
      gmailThreadId: outreach.gmailThreadId ?? `mock-thread-${outreach.id}`,
    },
  });
  return { outreachId: updated.id, status: updated.status };
}

async function applyReplyCrmUpdate(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  reply: {
    leadId: string | null;
    contactId: string | null;
    classification: string | null;
  },
) {
  if (!reply.leadId) return;
  const status =
    reply.classification === "INTERESTED" ||
    reply.classification === "PORTFOLIO_REQUEST" ||
    reply.classification === "PRICING_REQUEST"
      ? LeadStatus.INTERESTED
      : reply.classification === "MEETING_REQUESTED"
        ? LeadStatus.MEETING
        : reply.classification === "NOT_INTERESTED"
          ? LeadStatus.NOT_INTERESTED
          : reply.classification === "UNSUBSCRIBE" ||
              reply.classification === "BOUNCE"
            ? LeadStatus.DO_NOT_CONTACT
            : LeadStatus.REPLIED;
  await tx.lead.updateMany({
    where: { id: reply.leadId, workspaceId },
    data: { status },
  });
  if (reply.classification === "BOUNCE" && reply.contactId) {
    await tx.contact.updateMany({
      where: { id: reply.contactId, workspaceId },
      data: { emailStatus: EmailStatus.BOUNCED },
    });
  }
  if (
    reply.classification === "UNSUBSCRIBE" ||
    reply.classification === "BOUNCE"
  ) {
    const contact = reply.contactId
      ? await tx.contact.findFirst({
          where: { id: reply.contactId, workspaceId },
        })
      : null;
    await tx.suppressionEntry.create({
      data: {
        workspaceId,
        contactId: reply.contactId,
        email: contact?.email?.toLowerCase(),
        domain: contact?.email?.split("@").at(1)?.toLowerCase(),
        reason:
          reply.classification === "BOUNCE"
            ? "Email bounced."
            : "Recipient requested no further contact.",
        source: reply.classification,
      },
    });
  }
}

async function markJob(
  prisma: PrismaClient,
  workspaceId: string,
  systemJobId: string | undefined,
  status: keyof typeof JobStatus,
  progress: number,
  error?: string,
) {
  if (!systemJobId) return;
  await prisma.systemJob.updateMany({
    where: { id: systemJobId, workspaceId },
    data: {
      status,
      progress,
      ...(status === "RUNNING" ? { startedAt: new Date() } : {}),
      ...(status === "COMPLETED" || status === "FAILED"
        ? { completedAt: new Date() }
        : {}),
      ...(error ? { error } : {}),
    },
  });
}

function decryptCredentials(
  value: string | null | undefined,
): StoredCredentials | null {
  if (!value) return null;
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) return null;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8")) as StoredCredentials;
}

function encryptCredentials(value: StoredCredentials) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function encryptionKey() {
  return createHash("sha256")
    .update(
      process.env.GMAIL_TOKEN_ENCRYPTION_KEY ??
        process.env.SUPABASE_JWT_SECRET ??
        "scrapo-local-development-gmail-secret",
    )
    .digest();
}
