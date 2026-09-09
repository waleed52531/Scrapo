import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  LeadStatus,
  OutreachChannel,
  OutreachStatus,
  Prisma,
} from "@prisma/client";
import { generateDeterministicOutreach } from "@scrapo/shared";
import { PaginatedResult } from "../common/paginated-result";
import { GmailService } from "../gmail/gmail.service";
import { PrismaService } from "../prisma/prisma.service";
import type {
  GenerateOutreachDto,
  OutreachListDto,
  SendOutreachDto,
  UpdateOutreachDto,
} from "./dto/outreach.dto";
import { OutreachEligibilityService } from "./outreach-eligibility.service";

const outreachInclude = {
  lead: { include: { company: true, contact: true } },
  contact: true,
  campaign: true,
  replies: { orderBy: { receivedAt: "desc" } },
} satisfies Prisma.OutreachMessageInclude;

@Injectable()
export class OutreachService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GmailService) private readonly gmail: GmailService,
    @Inject(OutreachEligibilityService)
    private readonly eligibility: OutreachEligibilityService,
  ) {}

  async eligibilityForLead(workspaceId: string, leadId: string) {
    const {
      lead: _lead,
      contact: _contact,
      company: _company,
      settings: _settings,
      campaign: _campaign,
      ...safe
    } = await this.eligibility.check(workspaceId, leadId, { mode: "SEND" });
    return safe;
  }

  async generate(
    workspaceId: string,
    userId: string,
    leadId: string,
    input: GenerateOutreachDto,
  ) {
    const eligible = await this.eligibility.assertEligible(
      workspaceId,
      leadId,
      {
        mode: "GENERATE",
        campaignId: input.campaignId,
      },
    );
    const signal = await this.prisma.leadSignal.findFirst({
      where: { workspaceId, leadId },
      orderBy: { createdAt: "desc" },
    });
    const profile = safeRecord(eligible.settings.profile);
    const generated = generateDeterministicOutreach({
      developerProfile: profile,
      signature: eligible.settings.emailSignature,
      lead: eligible.lead,
      contact: eligible.contact,
      company: eligible.company
        ? {
            name: eligible.company.name,
            country: eligible.company.country,
            city: eligible.company.city,
            description: eligible.company.description,
            services: stringArray(eligible.company.services),
            technologies: stringArray(eligible.company.technologies),
            hasMobileService: eligible.company.hasMobileService,
            hasFlutterService: eligible.company.hasFlutterService,
            companyAnalysisSummary: eligible.company.companyAnalysisSummary,
          }
        : null,
      originalSignal: signal
        ? {
            content: signal.content,
            source: signal.source,
            sourceUrl: signal.sourceUrl,
          }
        : null,
      strategy: input.strategy ?? eligible.lead.outreachRecommendation,
      instruction: input.instruction,
    });
    const message = await this.prisma.$transaction(async (tx) => {
      const item = await tx.outreachMessage.create({
        data: {
          workspaceId,
          leadId,
          contactId: eligible.contact?.id,
          campaignId: input.campaignId,
          channel: OutreachChannel.EMAIL,
          strategy: generated.strategy,
          messageType: "INITIAL",
          subject: generated.subject,
          body: applyInstruction(generated.body, input.instruction),
          originalGeneratedSubject: generated.subject,
          originalGeneratedBody: generated.body,
          personalizationPoints:
            generated.personalizationPoints as unknown as Prisma.InputJsonValue,
          confidence: generated.confidence,
          status: OutreachStatus.GENERATED,
          approvalStatus: "PENDING",
          generatedByModel: process.env.OPENAI_API_KEY
            ? (process.env.OPENAI_MODEL ?? "openai")
            : "deterministic",
          promptVersion: "phase-5-outreach-v1",
          generatedAt: new Date(),
        },
        include: outreachInclude,
      });
      await tx.activity.create({
        data: {
          workspaceId,
          leadId,
          type: "OUTREACH_GENERATED",
          description: "Email outreach was generated for review.",
        },
      });
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "OUTREACH_GENERATED",
          entityType: "OutreachMessage",
          entityId: item.id,
        },
      });
      return item;
    });
    return message;
  }

  async list(workspaceId: string, query: OutreachListDto) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const where: Prisma.OutreachMessageWhereInput = {
      workspaceId,
      ...(query.status ? { status: query.status as OutreachStatus } : {}),
      ...(query.strategy ? { strategy: query.strategy } : {}),
      ...(query.leadId ? { leadId: query.leadId } : {}),
      ...(query.contactId ? { contactId: query.contactId } : {}),
      ...(query.replied === undefined
        ? {}
        : query.replied
          ? { repliedAt: { not: null } }
          : { repliedAt: null }),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.outreachMessage.findMany({
        where,
        include: outreachInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.outreachMessage.count({ where }),
    ]);
    return new PaginatedResult(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async get(workspaceId: string, id: string) {
    const item = await this.prisma.outreachMessage.findFirst({
      where: { id, workspaceId },
      include: outreachInclude,
    });
    if (!item) throw outreachNotFound();
    return item;
  }

  async update(
    workspaceId: string,
    userId: string,
    id: string,
    input: UpdateOutreachDto,
  ) {
    await this.get(workspaceId, id);
    const updated = await this.prisma.outreachMessage.update({
      where: { id },
      data: {
        ...(input.subject !== undefined ? { subject: input.subject } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        status: OutreachStatus.EDITED,
      },
      include: outreachInclude,
    });
    await this.audit(workspaceId, userId, "OUTREACH_EDITED", id);
    return updated;
  }

  async createDraft(workspaceId: string, userId: string, id: string) {
    const outreach = await this.get(workspaceId, id);
    const eligible = await this.eligibility.assertEligible(
      workspaceId,
      outreach.leadId,
      { mode: "DRAFT", outreachId: id, campaignId: outreach.campaignId },
    );
    if (!eligible.contact?.email) throw new BadRequestException();
    const delivery = deliveryTarget(
      eligible.contact.email,
      outreach.subject ?? "Mobile development support",
    );
    const provider = await this.gmail.providerForWorkspace(workspaceId);
    const draft = await provider.createDraft({
      to: delivery.to,
      subject: delivery.subject,
      bodyText: outreach.body,
      threadId: outreach.gmailThreadId,
      inReplyTo: outreach.gmailHeaderMessageId,
      references: outreach.gmailHeaderMessageId,
    });
    const updated = await this.prisma.outreachMessage.update({
      where: { id },
      data: {
        status: OutreachStatus.DRAFT_CREATED,
        gmailDraftId: draft.draftId,
        gmailMessageId: draft.messageId,
        gmailThreadId: draft.threadId,
      },
      include: outreachInclude,
    });
    await this.audit(
      workspaceId,
      userId,
      "GMAIL_DRAFT_CREATED",
      id,
      delivery.auditMetadata,
    );
    return updated;
  }

  async approve(workspaceId: string, userId: string, id: string) {
    const outreach = await this.get(workspaceId, id);
    const updated = await this.prisma.outreachMessage.update({
      where: { id: outreach.id },
      data: {
        approvalStatus: "APPROVED",
        status: OutreachStatus.APPROVED,
        approvedAt: new Date(),
      },
      include: outreachInclude,
    });
    await this.audit(workspaceId, userId, "OUTREACH_APPROVED", id);
    return updated;
  }

  async send(
    workspaceId: string,
    userId: string,
    id: string,
    input: SendOutreachDto,
  ) {
    const outreach = await this.get(workspaceId, id);
    if (
      outreach.status === OutreachStatus.SENT ||
      outreach.status === OutreachStatus.DELIVERED ||
      outreach.status === OutreachStatus.REPLIED ||
      outreach.status === OutreachStatus.FOLLOW_UP_SENT
    ) {
      return outreach;
    }
    if (outreach.approvalStatus !== "APPROVED") {
      throw new BadRequestException({
        code: "OUTREACH_APPROVAL_REQUIRED",
        message: "Approve this outreach before sending.",
      });
    }
    const idempotencyKey =
      input.idempotencyKey ?? `outreach-send:${workspaceId}:${id}`;
    const existing = await this.prisma.outreachMessage.findFirst({
      where: { workspaceId, idempotencyKey, id: { not: id } },
    });
    if (existing) return this.get(workspaceId, existing.id);

    const eligible = await this.eligibility.assertEligible(
      workspaceId,
      outreach.leadId,
      { mode: "SEND", outreachId: id, campaignId: outreach.campaignId },
    );
    if (!eligible.contact?.email) throw new BadRequestException();
    const delivery = deliveryTarget(
      eligible.contact.email,
      outreach.subject ?? "Mobile development support",
    );

    const locked = await this.prisma.outreachMessage.updateMany({
      where: {
        id,
        workspaceId,
        status: {
          in: [
            OutreachStatus.APPROVED,
            OutreachStatus.DRAFT_CREATED,
            OutreachStatus.EDITED,
            OutreachStatus.GENERATED,
          ],
        },
      },
      data: { status: OutreachStatus.SENDING, idempotencyKey },
    });
    if (locked.count === 0) {
      return this.get(workspaceId, id);
    }
    try {
      const provider = await this.gmail.providerForWorkspace(workspaceId);
      const sent = outreach.gmailDraftId
        ? await provider.sendDraft(outreach.gmailDraftId)
        : await provider.send({
            to: delivery.to,
            subject: delivery.subject,
            bodyText: outreach.body,
            threadId: outreach.gmailThreadId,
            inReplyTo: outreach.gmailHeaderMessageId,
            references: outreach.gmailHeaderMessageId,
          });
      const status =
        outreach.messageType === "FOLLOW_UP"
          ? OutreachStatus.FOLLOW_UP_SENT
          : OutreachStatus.SENT;
      const updated = await this.prisma.$transaction(async (tx) => {
        const item = await tx.outreachMessage.update({
          where: { id },
          data: {
            status,
            gmailMessageId: sent.messageId,
            gmailThreadId: sent.threadId,
            gmailHeaderMessageId: sent.headerMessageId,
            sentAt: new Date(),
          },
          include: outreachInclude,
        });
        await tx.lead.update({
          where: { id: outreach.leadId },
          data: {
            status:
              outreach.messageType === "FOLLOW_UP"
                ? LeadStatus.FOLLOW_UP
                : LeadStatus.CONTACTED,
          },
        });
        await tx.auditLog.create({
          data: {
            workspaceId,
            actorUserId: userId,
            action: "EMAIL_SENT",
            entityType: "OutreachMessage",
            entityId: id,
            metadata: delivery.auditMetadata as Prisma.InputJsonValue,
          },
        });
        return item;
      });
      return updated;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gmail send failed.";
      await this.prisma.outreachMessage.update({
        where: { id },
        data: { status: OutreachStatus.FAILED, failureReason: message },
      });
      if (message.toLowerCase().includes("invalid_grant")) {
        await this.gmail.markReauthRequired(workspaceId, message);
      }
      throw new BadRequestException({
        code: "EMAIL_SEND_FAILED",
        message,
      });
    }
  }

  async cancel(workspaceId: string, userId: string, id: string) {
    await this.get(workspaceId, id);
    const updated = await this.prisma.outreachMessage.update({
      where: { id },
      data: { status: OutreachStatus.CANCELLED },
      include: outreachInclude,
    });
    await this.audit(workspaceId, userId, "OUTREACH_CANCELLED", id);
    return updated;
  }

  async generateFollowUp(workspaceId: string, userId: string, id: string) {
    const original = await this.get(workspaceId, id);
    if (!original.sentAt) {
      throw new BadRequestException({
        code: "INITIAL_OUTREACH_NOT_SENT",
        message: "Follow-up requires a sent initial outreach.",
      });
    }
    const existingFollowUp = await this.prisma.outreachMessage.findFirst({
      where: {
        workspaceId,
        followUpToId: original.id,
        status: { not: OutreachStatus.CANCELLED },
      },
    });
    if (existingFollowUp) return this.get(workspaceId, existingFollowUp.id);
    const replies = await this.prisma.emailReply.count({
      where: { workspaceId, outreachMessageId: original.id },
    });
    if (replies > 0) {
      throw new BadRequestException({
        code: "FOLLOW_UP_BLOCKED_BY_REPLY",
        message: "A reply exists, so follow-up is blocked.",
      });
    }
    const eligible = await this.eligibility.assertEligible(
      workspaceId,
      original.leadId,
      { mode: "FOLLOW_UP", outreachId: id, campaignId: original.campaignId },
    );
    const name = firstName(eligible.contact?.fullName);
    const settings = eligible.settings;
    const signature =
      settings.emailSignature ||
      stringValue(safeRecord(settings.profile).name) ||
      "Best";
    const body = [
      name ? `Hi ${name},` : "Hi,",
      "",
      "Just following up on my previous message regarding mobile development support.",
      "",
      "If your team occasionally needs Flutter/Android/iOS capacity for client projects, I would be happy to share a few relevant examples of my work.",
      "",
      signature,
    ].join("\n");
    const followUp = await this.prisma.outreachMessage.create({
      data: {
        workspaceId,
        leadId: original.leadId,
        contactId: original.contactId,
        campaignId: original.campaignId,
        followUpToId: original.id,
        channel: OutreachChannel.EMAIL,
        strategy: original.strategy,
        messageType: "FOLLOW_UP",
        subject: original.subject?.startsWith("Re:")
          ? original.subject
          : `Re: ${original.subject ?? "Mobile development support"}`,
        body,
        originalGeneratedSubject: original.subject,
        originalGeneratedBody: body,
        personalizationPoints: [
          "Previous outreach thread",
        ] as unknown as Prisma.InputJsonValue,
        confidence: 80,
        approvalStatus: "PENDING",
        status: OutreachStatus.FOLLOW_UP_DUE,
        gmailThreadId: original.gmailThreadId,
        gmailHeaderMessageId: original.gmailHeaderMessageId,
        followUpNumber: original.followUpNumber + 1,
        generatedByModel: "deterministic",
        promptVersion: "phase-5-follow-up-v1",
        generatedAt: new Date(),
      },
      include: outreachInclude,
    });
    await this.audit(workspaceId, userId, "FOLLOW_UP_GENERATED", followUp.id);
    return followUp;
  }

  async createFollowUpDraft(workspaceId: string, userId: string, id: string) {
    const followUp = await this.generateFollowUp(workspaceId, userId, id);
    return this.createDraft(workspaceId, userId, followUp.id);
  }

  async dueFollowUps(workspaceId: string) {
    const settings = await this.prisma.userSettings.findUnique({
      where: { workspaceId },
    });
    const delayDays = Number(
      process.env.FOLLOW_UP_DELAY_DAYS ?? settings?.followUpDelayDays ?? 7,
    );
    const maxFollowUps = Number(
      process.env.MAX_FOLLOW_UPS ?? settings?.maxFollowUps ?? 1,
    );
    const dueBefore = new Date(Date.now() - delayDays * 86_400_000);
    return this.prisma.outreachMessage.findMany({
      where: {
        workspaceId,
        messageType: "INITIAL",
        sentAt: { lte: dueBefore },
        repliedAt: null,
        followUpNumber: { lt: maxFollowUps },
        status: { in: [OutreachStatus.SENT, OutreachStatus.DELIVERED] },
        followUps: { none: { status: { not: OutreachStatus.CANCELLED } } },
      },
      include: outreachInclude,
      orderBy: { sentAt: "asc" },
      take: 50,
    });
  }

  private async audit(
    workspaceId: string,
    userId: string,
    action: string,
    entityId: string,
    metadata: Record<string, unknown> = {},
  ) {
    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action,
        entityType: "OutreachMessage",
        entityId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }
}

function outreachNotFound() {
  return new NotFoundException({
    code: "OUTREACH_NOT_FOUND",
    message: "Outreach message could not be found.",
  });
}

function safeRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function firstName(value: string | null | undefined) {
  if (!value || value.startsWith("@")) return "";
  return value.split(/\s+/)[0] ?? "";
}

function applyInstruction(body: string, instruction: string | undefined) {
  if (!instruction) return body;
  if (instruction.toLowerCase().includes("shorter")) {
    return body
      .split("\n")
      .filter((line) => !line.toLowerCase().includes("my focus is"))
      .join("\n");
  }
  return body;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function deliveryTarget(intendedRecipient: string, subject: string) {
  if (process.env.OUTREACH_TEST_MODE !== "true") {
    return { to: intendedRecipient, subject, auditMetadata: {} };
  }
  const testRecipient = process.env.OUTREACH_TEST_RECIPIENT?.trim();
  if (!testRecipient) {
    throw new BadRequestException({
      code: "OUTREACH_TEST_RECIPIENT_MISSING",
      message:
        "OUTREACH_TEST_MODE is enabled, but OUTREACH_TEST_RECIPIENT is not configured.",
    });
  }
  return {
    to: testRecipient,
    subject: subject.startsWith("[TEST]") ? subject : `[TEST] ${subject}`,
    auditMetadata: {
      testMode: true,
      intendedRecipient,
      deliveredTo: testRecipient,
    },
  };
}
