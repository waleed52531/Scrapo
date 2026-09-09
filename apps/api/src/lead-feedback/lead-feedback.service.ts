import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LeadRankingService } from "../ranking/lead-ranking.service";
import type { CreateLeadFeedbackDto } from "./lead-feedback.dto";

@Injectable()
export class LeadFeedbackService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LeadRankingService) private readonly ranking: LeadRankingService,
  ) {}

  async list(workspaceId: string, leadId: string) {
    await this.requireLead(workspaceId, leadId);
    return this.prisma.leadFeedback.findMany({
      where: { workspaceId, leadId },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(
    workspaceId: string,
    userId: string,
    leadId: string,
    input: CreateLeadFeedbackDto,
  ) {
    await this.requireLead(workspaceId, leadId);
    const feedback = await this.prisma.$transaction(async (tx) => {
      const item = await tx.leadFeedback.create({
        data: {
          workspaceId,
          leadId,
          rating: input.rating,
          reason: input.reason,
          notes: input.notes,
          createdBy: userId,
        },
      });
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "LEAD_FEEDBACK_CREATED",
          entityType: "Lead",
          entityId: leadId,
          metadata: {
            rating: input.rating,
            reason: input.reason,
          },
        },
      });
      return item;
    });
    await this.ranking.rankLead(workspaceId, leadId);
    return feedback;
  }

  private async requireLead(workspaceId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
    });
    if (!lead) {
      throw new NotFoundException({
        code: "LEAD_NOT_FOUND",
        message: "Lead could not be found.",
      });
    }
    return lead;
  }
}
