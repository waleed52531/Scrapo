import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { LeadSource, Prisma } from "@prisma/client";
import {
  DEFAULT_AGENCY_SEARCH_QUERIES,
  DEFAULT_SOCIAL_SEARCH_QUERIES,
} from "@scrapo/shared";
import { PaginatedResult } from "../common/paginated-result";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateSearchQueryDto,
  SearchQueryListDto,
  UpdateSearchQueryDto,
} from "./dto/search-query.dto";

@Injectable()
export class SearchQueriesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(workspaceId: string, query: SearchQueryListDto) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const where: Prisma.SearchQueryWhereInput = {
      workspaceId,
      ...(query.source ? { source: query.source } : {}),
      ...(query.country ? { country: query.country } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.enabled === undefined ? {} : { enabled: query.enabled }),
      ...(query.search
        ? { query: { contains: query.search, mode: "insensitive" } }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.searchQuery.findMany({
        where,
        orderBy: [
          { enabled: "desc" },
          { priority: "desc" },
          { createdAt: "desc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.searchQuery.count({ where }),
    ]);
    return new PaginatedResult(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async get(workspaceId: string, id: string) {
    const item = await this.prisma.searchQuery.findFirst({
      where: { id, workspaceId },
      include: {
        discoveryQueryRuns: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!item)
      throw new NotFoundException({
        code: "SEARCH_QUERY_NOT_FOUND",
        message: "Search query could not be found.",
      });
    return item;
  }

  async create(
    workspaceId: string,
    userId: string,
    input: CreateSearchQueryDto,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const item = await tx.searchQuery.create({
          data: {
            workspaceId,
            source: input.source ?? LeadSource.WEB,
            query: input.query,
            enabled: input.enabled ?? true,
            priority: input.priority ?? 0,
            country: input.country,
            category: input.category ?? "CUSTOM",
          },
        });
        await tx.auditLog.create({
          data: {
            workspaceId,
            actorUserId: userId,
            action: "SEARCH_QUERY_CREATED",
            entityType: "SearchQuery",
            entityId: item.id,
          },
        });
        return item;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException({
          code: "SEARCH_QUERY_ALREADY_EXISTS",
          message: "That search query already exists for this workspace.",
        });
      }
      throw error;
    }
  }

  async update(
    workspaceId: string,
    userId: string,
    id: string,
    input: UpdateSearchQueryDto,
  ) {
    await this.get(workspaceId, id);
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.searchQuery.update({
        where: { id },
        data: input,
      });
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "SEARCH_QUERY_UPDATED",
          entityType: "SearchQuery",
          entityId: id,
        },
      });
      return item;
    });
  }

  async clone(workspaceId: string, userId: string, id: string) {
    const existing = await this.get(workspaceId, id);
    return this.create(workspaceId, userId, {
      query: `${existing.query} copy`,
      source: existing.source,
      enabled: false,
      priority: Math.max(0, existing.priority - 5),
      country: existing.country ?? undefined,
      category: existing.category,
    });
  }

  async delete(workspaceId: string, userId: string, id: string) {
    await this.get(workspaceId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "SEARCH_QUERY_DELETED",
          entityType: "SearchQuery",
          entityId: id,
        },
      });
      await tx.searchQuery.delete({ where: { id } });
    });
    return { id, deleted: true };
  }

  async ensureDefaults(workspaceId: string) {
    for (const item of DEFAULT_AGENCY_SEARCH_QUERIES) {
      await this.prisma.searchQuery.upsert({
        where: {
          workspaceId_source_query: {
            workspaceId,
            source: LeadSource.WEB,
            query: item.query,
          },
        },
        update: {
          country: item.country,
          category: item.category,
          priority: item.priority,
        },
        create: {
          workspaceId,
          source: LeadSource.WEB,
          query: item.query,
          country: item.country,
          category: item.category,
          priority: item.priority,
        },
      });
    }
    for (const item of DEFAULT_SOCIAL_SEARCH_QUERIES) {
      await this.prisma.searchQuery.upsert({
        where: {
          workspaceId_source_query: {
            workspaceId,
            source: item.source as LeadSource,
            query: item.query,
          },
        },
        update: {
          category: item.category,
          priority: item.priority,
        },
        create: {
          workspaceId,
          source: item.source as LeadSource,
          query: item.query,
          category: item.category,
          priority: item.priority,
        },
      });
    }
    return this.prisma.searchQuery.findMany({
      where: { workspaceId },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
  }
}
