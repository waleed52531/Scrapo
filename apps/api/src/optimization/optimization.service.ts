import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LeadRankingService } from "../ranking/lead-ranking.service";

@Injectable()
export class OptimizationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LeadRankingService) private readonly ranking: LeadRankingService,
  ) {}

  async list(workspaceId: string) {
    return this.prisma.optimizationRecommendation.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async generate(workspaceId: string) {
    const { sources, queries } = await this.ranking.performance(workspaceId);
    const created = [];
    for (const query of queries) {
      if (query.state === "EXCELLENT") {
        created.push(
          await this.createOnce(workspaceId, {
            type: "QUERY_PRIORITY_INCREASE",
            title: `Increase priority: ${query.query}`,
            description: `${query.replyRate}% reply rate across ${query.contacted} contacted leads.`,
            evidence: query,
          }),
        );
      }
      if (query.state === "LOW") {
        created.push(
          await this.createOnce(workspaceId, {
            type: "QUERY_PRIORITY_DECREASE",
            title: `Reduce priority: ${query.query}`,
            description: `${query.qualified} qualified and ${query.replies} replies from this query.`,
            evidence: query,
          }),
        );
      }
    }
    for (const source of sources) {
      if (source.state === "EXCELLENT") {
        created.push(
          await this.createOnce(workspaceId, {
            type: "SOURCE_PRIORITY_INCREASE",
            title: `Increase ${source.source} discovery share`,
            description: `${source.meetings} meetings from ${source.contacted} contacted leads.`,
            evidence: source,
          }),
        );
      }
    }
    return created;
  }

  async accept(workspaceId: string, userId: string, id: string) {
    const recommendation = await this.get(workspaceId, id);
    const evidence = record(recommendation.evidence);
    if (
      recommendation.type === "QUERY_PRIORITY_INCREASE" ||
      recommendation.type === "QUERY_PRIORITY_DECREASE"
    ) {
      const searchQueryId = stringValue(evidence.id);
      if (!searchQueryId) {
        throw new BadRequestException({
          code: "RECOMMENDATION_NOT_APPLICABLE",
          message: "This recommendation does not identify a search query.",
        });
      }
      const delta =
        recommendation.type === "QUERY_PRIORITY_INCREASE" ? 10 : -10;
      await this.prisma.searchQuery.updateMany({
        where: { id: searchQueryId, workspaceId },
        data: { priority: { increment: delta } },
      });
    }
    const updated = await this.resolve(workspaceId, id, "ACCEPTED");
    await this.audit(
      workspaceId,
      userId,
      "OPTIMIZATION_RECOMMENDATION_ACCEPTED",
      id,
    );
    return updated;
  }

  reject(workspaceId: string, userId: string, id: string) {
    return this.resolveWithAudit(workspaceId, userId, id, "REJECTED");
  }

  dismiss(workspaceId: string, userId: string, id: string) {
    return this.resolveWithAudit(workspaceId, userId, id, "DISMISSED");
  }

  private async createOnce(
    workspaceId: string,
    input: {
      type: string;
      title: string;
      description: string;
      evidence: Record<string, unknown>;
    },
  ) {
    const existing = await this.prisma.optimizationRecommendation.findFirst({
      where: {
        workspaceId,
        type: input.type,
        title: input.title,
        status: "NEW",
      },
    });
    if (existing) return existing;
    return this.prisma.optimizationRecommendation.create({
      data: {
        workspaceId,
        type: input.type,
        title: input.title,
        description: input.description,
        evidence: input.evidence as Prisma.InputJsonValue,
      },
    });
  }

  private async get(workspaceId: string, id: string) {
    const recommendation =
      await this.prisma.optimizationRecommendation.findFirst({
        where: { id, workspaceId },
      });
    if (!recommendation) {
      throw new NotFoundException({
        code: "RECOMMENDATION_NOT_FOUND",
        message: "Optimization recommendation could not be found.",
      });
    }
    return recommendation;
  }

  private async resolveWithAudit(
    workspaceId: string,
    userId: string,
    id: string,
    status: "REJECTED" | "DISMISSED",
  ) {
    const updated = await this.resolve(workspaceId, id, status);
    await this.audit(
      workspaceId,
      userId,
      `OPTIMIZATION_RECOMMENDATION_${status}`,
      id,
    );
    return updated;
  }

  private async resolve(workspaceId: string, id: string, status: string) {
    await this.get(workspaceId, id);
    return this.prisma.optimizationRecommendation.update({
      where: { id },
      data: { status, resolvedAt: new Date() },
    });
  }

  private async audit(
    workspaceId: string,
    userId: string,
    action: string,
    id: string,
  ) {
    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action,
        entityType: "OptimizationRecommendation",
        entityId: id,
      },
    });
  }
}

function record(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}
