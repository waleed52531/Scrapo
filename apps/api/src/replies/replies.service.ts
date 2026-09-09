import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { LeadStatus, Prisma } from "@prisma/client";
import { classifyDeterministicReply } from "@scrapo/shared";
import { PaginatedResult } from "../common/paginated-result";
import { PrismaService } from "../prisma/prisma.service";

type ReplyListQuery = {
  classification?: string;
  needsResponse?: boolean;
  page?: number;
  limit?: number;
};

const replyInclude = {
  lead: { include: { company: true } },
  contact: true,
  outreachMessage: { include: { lead: { include: { company: true } } } },
} satisfies Prisma.EmailReplyInclude;

@Injectable()
export class RepliesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(workspaceId: string, query: ReplyListQuery) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const where: Prisma.EmailReplyWhereInput = {
      workspaceId,
      ...(query.classification ? { classification: query.classification } : {}),
      ...(query.needsResponse === undefined
        ? {}
        : { requiresResponse: query.needsResponse }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.emailReply.findMany({
        where,
        include: replyInclude,
        orderBy: { receivedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.emailReply.count({ where }),
    ]);
    return new PaginatedResult(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async get(workspaceId: string, id: string) {
    const reply = await this.prisma.emailReply.findFirst({
      where: { id, workspaceId },
      include: replyInclude,
    });
    if (!reply) throw replyNotFound();
    return reply;
  }

  async reclassify(workspaceId: string, userId: string, id: string) {
    const reply = await this.get(workspaceId, id);
    const classified = classifyDeterministicReply(reply.bodyText ?? reply.body);
    const updated = await this.prisma.$transaction(async (tx) => {
      const item = await tx.emailReply.update({
        where: { id },
        data: {
          classification: classified.classification,
          sentiment: classified.sentiment,
          summary: classified.summary,
          recommendedAction: classified.recommendedAction,
          requiresResponse: classified.requiresResponse,
          meetingRequested: classified.meetingRequested,
          aiConfidence: classified.confidence,
        },
        include: replyInclude,
      });
      await applyReplyCrmUpdate(tx, workspaceId, item);
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "REPLY_CLASSIFIED",
          entityType: "EmailReply",
          entityId: id,
        },
      });
      return item;
    });
    return updated;
  }
}

export async function applyReplyCrmUpdate(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  reply: {
    id: string;
    leadId: string | null;
    contactId: string | null;
    classification: string | null;
  },
) {
  if (!reply.leadId) return;
  const classification = reply.classification;
  const status =
    classification === "INTERESTED" ||
    classification === "PORTFOLIO_REQUEST" ||
    classification === "PRICING_REQUEST"
      ? LeadStatus.INTERESTED
      : classification === "MEETING_REQUESTED"
        ? LeadStatus.MEETING
        : classification === "NOT_INTERESTED"
          ? LeadStatus.NOT_INTERESTED
          : classification === "UNSUBSCRIBE"
            ? LeadStatus.DO_NOT_CONTACT
            : classification === "BOUNCE"
              ? LeadStatus.DO_NOT_CONTACT
              : LeadStatus.REPLIED;
  await tx.lead.updateMany({
    where: { id: reply.leadId, workspaceId },
    data: { status },
  });
  if (classification === "BOUNCE" && reply.contactId) {
    await tx.contact.updateMany({
      where: { id: reply.contactId, workspaceId },
      data: { emailStatus: "BOUNCED" },
    });
  }
  if (classification === "UNSUBSCRIBE" || classification === "BOUNCE") {
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
          classification === "BOUNCE"
            ? "Email bounced."
            : "Recipient requested no further contact.",
        source: classification,
      },
    });
  }
}

function replyNotFound() {
  return new NotFoundException({
    code: "REPLY_NOT_FOUND",
    message: "Reply could not be found.",
  });
}
