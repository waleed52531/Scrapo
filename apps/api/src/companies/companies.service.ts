import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AnalysisQueueService } from "../analysis/analysis-queue.service";
import type { AnalyzeLeadDto } from "../analysis/dto/analysis.dto";
import { PaginatedResult } from "../common/paginated-result";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CompanyQueryDto,
  CreateCompanyDto,
  UpdateCompanyDto,
} from "./dto/company.dto";

@Injectable()
export class CompaniesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AnalysisQueueService)
    private readonly analysisQueue: AnalysisQueueService,
  ) {}

  async list(workspaceId: string, query: CompanyQueryDto) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const where: Prisma.CompanyWhereInput = {
      workspaceId,
      ...(query.country ? { country: query.country } : {}),
      ...(query.hasMobileService === undefined
        ? {}
        : { hasMobileService: query.hasMobileService }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { domain: { contains: query.search, mode: "insensitive" } },
              { city: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        include: { _count: { select: { contacts: true, leads: true } } },
        orderBy: [{ partnershipFitScore: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.company.count({ where }),
    ]);
    return new PaginatedResult(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async get(workspaceId: string, id: string) {
    const company = await this.prisma.company.findFirst({
      where: { id, workspaceId },
      include: {
        contacts: { orderBy: { decisionMakerScore: "desc" } },
        leads: { orderBy: { overallScore: "desc" } },
      },
    });
    if (!company)
      throw new NotFoundException({
        code: "COMPANY_NOT_FOUND",
        message: "Company could not be found.",
      });
    return company;
  }

  async create(workspaceId: string, userId: string, input: CreateCompanyDto) {
    const data = this.toData(input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const company = await tx.company.create({
          data: { workspaceId, ...data } as Prisma.CompanyUncheckedCreateInput,
        });
        await tx.auditLog.create({
          data: {
            workspaceId,
            actorUserId: userId,
            action: "COMPANY_CREATED",
            entityType: "Company",
            entityId: company.id,
          },
        });
        return company;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException({
          code: "COMPANY_ALREADY_EXISTS",
          message: "A company with this domain already exists.",
        });
      }
      throw error;
    }
  }

  async update(
    workspaceId: string,
    userId: string,
    id: string,
    input: UpdateCompanyDto,
  ) {
    await this.get(workspaceId, id);
    const data = this.toData(input);
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.update({
        where: { id },
        data: data as Prisma.CompanyUpdateInput,
      });
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "COMPANY_UPDATED",
          entityType: "Company",
          entityId: id,
        },
      });
      return company;
    });
  }

  async delete(workspaceId: string, userId: string, id: string) {
    await this.get(workspaceId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "COMPANY_DELETED",
          entityType: "Company",
          entityId: id,
        },
      });
      await tx.company.delete({ where: { id } });
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
      await tx.company.update({
        where: { id },
        data: { analysisStatus: "QUEUED" },
      });
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "COMPANY_ANALYSIS_QUEUED",
          entityType: "Company",
          entityId: id,
        },
      });
      return this.analysisQueue.enqueue(workspaceId, "ANALYZE_COMPANY", {
        companyId: id,
        force: input.force === true,
      });
    });
  }

  private toData(input: CreateCompanyDto | UpdateCompanyDto) {
    const domain = input.domain
      ? normalizeDomain(input.domain)
      : input.website
        ? normalizeDomain(input.website)
        : undefined;
    return {
      ...input,
      ...(input.name
        ? {
            normalizedName: input.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, " ")
              .trim(),
          }
        : {}),
      ...(domain ? { domain } : {}),
      ...(input.services ? { services: input.services } : {}),
      ...(input.technologies ? { technologies: input.technologies } : {}),
      ...(input.industries ? { industries: input.industries } : {}),
    };
  }
}

function normalizeDomain(value: string) {
  const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  return url.hostname.toLowerCase().replace(/^www\./, "");
}
