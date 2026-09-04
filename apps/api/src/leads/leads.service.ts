import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { LeadTemperature, Prisma } from "@prisma/client";
import { AnalysisQueueService } from "../analysis/analysis-queue.service";
import type {
  AnalyzeLeadDto,
  ScoreOverrideDto,
} from "../analysis/dto/analysis.dto";
import { PaginatedResult } from "../common/paginated-result";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateLeadDto,
  LeadQueryDto,
  UpdateLeadDto,
} from "./dto/lead.dto";

const listInclude = {
  company: { select: { id: true, name: true, country: true, city: true } },
  contact: {
    select: {
      id: true,
      fullName: true,
      role: true,
      email: true,
      emailStatus: true,
    },
  },
} satisfies Prisma.LeadInclude;

@Injectable()
export class LeadsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AnalysisQueueService)
    private readonly analysisQueue: AnalysisQueueService,
  ) {}

  async list(workspaceId: string, query: LeadQueryDto) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const where: Prisma.LeadWhereInput = {
      workspaceId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.temperature ? { temperature: query.temperature } : {}),
      ...(query.source ? { primarySource: query.source } : {}),
      ...(query.leadType ? { leadType: query.leadType } : {}),
      ...(query.minimumScore !== undefined || query.maximumScore !== undefined
        ? {
            overallScore: {
              ...(query.minimumScore !== undefined
                ? { gte: query.minimumScore }
                : {}),
              ...(query.maximumScore !== undefined
                ? { lte: query.maximumScore }
                : {}),
            },
          }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
      ...(query.country ? { company: { country: query.country } } : {}),
      ...(query.company
        ? {
            company: { name: { contains: query.company, mode: "insensitive" } },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              {
                opportunitySummary: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
              {
                company: {
                  name: { contains: query.search, mode: "insensitive" },
                },
              },
              {
                contact: {
                  fullName: { contains: query.search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    };
    const orderBy = this.orderBy(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        include: listInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.lead.count({ where }),
    ]);
    return new PaginatedResult(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async get(workspaceId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, workspaceId },
      include: {
        company: true,
        contact: true,
        signals: { orderBy: { createdAt: "desc" }, include: { rawLead: true } },
        scores: { orderBy: { createdAt: "desc" } },
        activities: { orderBy: { createdAt: "desc" } },
        outreach: {
          orderBy: { createdAt: "desc" },
          include: { replies: true },
        },
      },
    });
    if (!lead)
      throw new NotFoundException({
        code: "LEAD_NOT_FOUND",
        message: "Lead could not be found.",
      });
    return lead;
  }

  async create(workspaceId: string, userId: string, input: CreateLeadDto) {
    await this.assertRelations(workspaceId, input.companyId, input.contactId);
    const score = input.overallScore ?? 0;
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          workspaceId,
          ...this.toData(input),
          overallScore: score,
          temperature: temperatureFor(score),
        } as Prisma.LeadUncheckedCreateInput,
        include: listInclude,
      });
      await tx.activity.create({
        data: {
          workspaceId,
          leadId: lead.id,
          type: "LEAD_CREATED",
          description: "Lead created manually.",
        },
      });
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "LEAD_CREATED",
          entityType: "Lead",
          entityId: lead.id,
        },
      });
      return lead;
    });
  }

  async update(
    workspaceId: string,
    userId: string,
    id: string,
    input: UpdateLeadDto,
  ) {
    await this.get(workspaceId, id);
    await this.assertRelations(workspaceId, input.companyId, input.contactId);
    const temperature =
      input.temperature ??
      (input.overallScore === undefined
        ? undefined
        : temperatureFor(input.overallScore));
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.update({
        where: { id },
        data: {
          ...this.toData(input),
          ...(temperature ? { temperature } : {}),
        } as Prisma.LeadUncheckedUpdateInput,
        include: listInclude,
      });
      await tx.activity.create({
        data: {
          workspaceId,
          leadId: id,
          type: "LEAD_UPDATED",
          description: "Lead details were updated.",
        },
      });
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "LEAD_UPDATED",
          entityType: "Lead",
          entityId: id,
        },
      });
      return lead;
    });
  }

  async delete(workspaceId: string, userId: string, id: string) {
    await this.get(workspaceId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "LEAD_DELETED",
          entityType: "Lead",
          entityId: id,
        },
      });
      await tx.lead.delete({ where: { id } });
    });
    return { id, deleted: true };
  }

  async analyze(
    workspaceId: string,
    userId: string,
    id: string,
    input: AnalyzeLeadDto,
  ) {
    await this.get(workspaceId, id);
    return this.prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id },
        data: { analysisStatus: "QUEUED", status: "ANALYZING" },
      });
      await tx.activity.create({
        data: {
          workspaceId,
          leadId: id,
          type: "LEAD_ANALYSIS_QUEUED",
          description: "Lead analysis was queued.",
        },
      });
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "LEAD_ANALYSIS_QUEUED",
          entityType: "Lead",
          entityId: id,
        },
      });
      return this.analysisQueue.enqueue(workspaceId, "ANALYZE_LEAD", {
        leadId: id,
        force: input.force === true,
      });
    });
  }

  async rescore(workspaceId: string, userId: string, id: string) {
    await this.get(workspaceId, id);
    return this.prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id },
        data: { analysisStatus: "QUEUED" },
      });
      await tx.activity.create({
        data: {
          workspaceId,
          leadId: id,
          type: "LEAD_RESCORE_QUEUED",
          description: "Lead rescore was queued.",
        },
      });
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "LEAD_RESCORE_QUEUED",
          entityType: "Lead",
          entityId: id,
        },
      });
      return this.analysisQueue.enqueue(workspaceId, "RESCORE_LEAD", {
        leadId: id,
      });
    });
  }

  async scores(workspaceId: string, id: string) {
    await this.get(workspaceId, id);
    return this.prisma.leadScore.findMany({
      where: { workspaceId, leadId: id },
      orderBy: { createdAt: "desc" },
    });
  }

  async overrideScore(
    workspaceId: string,
    userId: string,
    id: string,
    input: ScoreOverrideDto,
  ) {
    const lead = await this.get(workspaceId, id);
    const originalScore = lead.scoreOverrideOriginal ?? lead.overallScore;
    const latestScore = lead.scores[0];
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id },
        data: {
          overallScore: input.score,
          temperature: temperatureFor(input.score),
          scoreOverrideOriginal: originalScore,
          scoreOverrideScore: input.score,
          scoreOverrideReason: input.reason,
          scoreOverriddenByUserId: userId,
          scoreOverriddenAt: new Date(),
        },
        include: { ...listInclude, scores: { orderBy: { createdAt: "desc" } } },
      });
      await tx.leadScore.create({
        data: {
          workspaceId,
          leadId: id,
          buyingIntent: latestScore?.buyingIntent ?? 0,
          mobileRelevance: latestScore?.mobileRelevance ?? 0,
          agencyFit: latestScore?.agencyFit ?? 0,
          decisionMakerQuality: latestScore?.decisionMakerQuality ?? 0,
          contactability: latestScore?.contactability ?? 0,
          recency: latestScore?.recency ?? 0,
          companyQuality: latestScore?.companyQuality ?? 0,
          countryPriority: latestScore?.countryPriority ?? 0,
          spamProbability: latestScore?.spamProbability ?? 0,
          competitorProbability: latestScore?.competitorProbability ?? 0,
          baseScore: latestScore?.baseScore ?? originalScore,
          penalty: latestScore?.penalty ?? 0,
          overall: input.score,
          temperature: temperatureFor(input.score),
          confidence: latestScore?.confidence ?? 100,
          explanation: `Manual override: ${input.reason}`,
          reason: input.reason,
          isManualOverride: true,
          overrideOriginalScore: originalScore,
          overrideScore: input.score,
          overrideReason: input.reason,
          overrideByUserId: userId,
          overriddenAt: new Date(),
        },
      });
      await tx.activity.create({
        data: {
          workspaceId,
          leadId: id,
          type: "LEAD_SCORE_OVERRIDDEN",
          description: input.reason,
        },
      });
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "LEAD_SCORE_OVERRIDDEN",
          entityType: "Lead",
          entityId: id,
        },
      });
      return updated;
    });
  }

  private async assertRelations(
    workspaceId: string,
    companyId?: string,
    contactId?: string,
  ) {
    const [company, contact] = await Promise.all([
      companyId
        ? this.prisma.company.findFirst({
            where: { id: companyId, workspaceId },
            select: { id: true },
          })
        : null,
      contactId
        ? this.prisma.contact.findFirst({
            where: { id: contactId, workspaceId },
            select: { id: true },
          })
        : null,
    ]);
    if (companyId && !company)
      throw new NotFoundException({
        code: "COMPANY_NOT_FOUND",
        message: "Company could not be found in this workspace.",
      });
    if (contactId && !contact)
      throw new NotFoundException({
        code: "CONTACT_NOT_FOUND",
        message: "Contact could not be found in this workspace.",
      });
  }

  private toData(
    input: CreateLeadDto | UpdateLeadDto,
  ): Record<string, unknown> {
    return {
      ...input,
      ...(input.publishedAt
        ? { publishedAt: new Date(input.publishedAt) }
        : {}),
    };
  }

  private orderBy(query: LeadQueryDto): Prisma.LeadOrderByWithRelationInput {
    const direction = query.sortOrder ?? "desc";
    if (query.sortBy === "createdAt") return { createdAt: direction };
    if (query.sortBy === "lastSignalAt") return { lastSignalAt: direction };
    if (query.sortBy === "companyName") return { company: { name: direction } };
    return { overallScore: direction };
  }
}

export function temperatureFor(score: number): LeadTemperature {
  if (score >= 90) return LeadTemperature.HOT;
  if (score >= 80) return LeadTemperature.STRONG;
  if (score >= 70) return LeadTemperature.REVIEW;
  if (score >= 50) return LeadTemperature.WEAK;
  return LeadTemperature.REJECT;
}
