import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { JobStatus, Prisma } from "@prisma/client";
import { AnalysisQueueService } from "../analysis/analysis-queue.service";
import { PaginatedResult } from "../common/paginated-result";
import { PrismaService } from "../prisma/prisma.service";
import { SearchQueriesService } from "../search-queries/search-queries.service";
import type { CreateLeadHuntDto, LeadHuntListDto } from "./dto/lead-hunt.dto";

@Injectable()
export class LeadHuntsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AnalysisQueueService)
    private readonly analysisQueue: AnalysisQueueService,
    @Inject(SearchQueriesService)
    private readonly searchQueries: SearchQueriesService,
  ) {}

  async list(workspaceId: string, query: LeadHuntListDto) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const status =
      query.status && query.status in JobStatus
        ? (query.status as JobStatus)
        : undefined;
    const where: Prisma.DiscoveryRunWhereInput = {
      workspaceId,
      ...(status ? { status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.discoveryRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { queryRuns: true, leads: true, shortlists: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.discoveryRun.count({ where }),
    ]);
    return new PaginatedResult(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async get(workspaceId: string, id: string) {
    const run = await this.prisma.discoveryRun.findFirst({
      where: { id, workspaceId },
      include: {
        queryRuns: { orderBy: { createdAt: "asc" } },
        leads: {
          orderBy: { overallScore: "desc" },
          include: {
            company: true,
            contact: true,
            scores: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
        shortlists: {
          include: {
            items: {
              orderBy: { rank: "asc" },
              include: { lead: { include: { company: true, contact: true } } },
            },
          },
        },
      },
    });
    if (!run)
      throw new NotFoundException({
        code: "LEAD_HUNT_NOT_FOUND",
        message: "Lead hunt could not be found.",
      });
    return run;
  }

  async create(workspaceId: string, userId: string, input: CreateLeadHuntDto) {
    await this.searchQueries.ensureDefaults(workspaceId);
    const name =
      input.name ?? `Agency discovery ${new Date().toISOString().slice(0, 10)}`;
    const run = await this.prisma.discoveryRun.create({
      data: {
        workspaceId,
        name,
        sources: input.sources ?? ["WEB"],
        countries: input.countries ?? [],
        categories: input.categories ?? [],
        maxQueries:
          input.maxQueries ?? Number(process.env.MAX_QUERIES_PER_RUN ?? 8),
        maxDiscoveries:
          input.maxDiscoveries ??
          Number(process.env.MAX_COMPANIES_PER_RUN ?? 80),
        minimumScore: input.minimumScore ?? 82,
        shortlistLimit: input.shortlistLimit ?? 20,
      } as Prisma.DiscoveryRunUncheckedCreateInput,
    });
    const queued = await this.analysisQueue.enqueue(workspaceId, "LEAD_HUNT", {
      leadHuntId: run.id,
    });
    await this.prisma.$transaction([
      this.prisma.discoveryRun.update({
        where: { id: run.id },
        data: { systemJobId: queued.jobId },
      }),
      this.prisma.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "LEAD_HUNT_QUEUED",
          entityType: "DiscoveryRun",
          entityId: run.id,
          metadata: { jobId: queued.jobId },
        },
      }),
    ]);
    return { leadHuntId: run.id, ...queued };
  }

  async cancel(workspaceId: string, userId: string, id: string) {
    const run = await this.get(workspaceId, id);
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(run.status)) {
      return run;
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.discoveryRun.update({
        where: { id },
        data: { status: "CANCELLED", completedAt: new Date() },
      }),
      ...(run.systemJobId
        ? [
            this.prisma.systemJob.update({
              where: { id: run.systemJobId },
              data: { status: "CANCELLED", completedAt: new Date() },
            }),
          ]
        : []),
      this.prisma.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "LEAD_HUNT_CANCELLED",
          entityType: "DiscoveryRun",
          entityId: id,
        },
      }),
    ]);
    return updated;
  }
}
