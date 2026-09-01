import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { LeadTemperature, Prisma } from '@prisma/client';
import { PaginatedResult } from '../common/paginated-result';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateLeadDto, LeadQueryDto, UpdateLeadDto } from './dto/lead.dto';

const listInclude = {
  company: { select: { id: true, name: true, country: true, city: true } },
  contact: { select: { id: true, fullName: true, role: true, email: true, emailStatus: true } },
} satisfies Prisma.LeadInclude;

@Injectable()
export class LeadsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
        ? { overallScore: { ...(query.minimumScore !== undefined ? { gte: query.minimumScore } : {}), ...(query.maximumScore !== undefined ? { lte: query.maximumScore } : {}) } }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? { createdAt: { ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}), ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}) } }
        : {}),
      ...(query.country ? { company: { country: query.country } } : {}),
      ...(query.company ? { company: { name: { contains: query.company, mode: 'insensitive' } } } : {}),
      ...(query.search ? { OR: [
        { title: { contains: query.search, mode: 'insensitive' } },
        { opportunitySummary: { contains: query.search, mode: 'insensitive' } },
        { company: { name: { contains: query.search, mode: 'insensitive' } } },
        { contact: { fullName: { contains: query.search, mode: 'insensitive' } } },
      ] } : {}),
    };
    const orderBy = this.orderBy(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({ where, include: listInclude, orderBy, skip: (page - 1) * limit, take: limit }),
      this.prisma.lead.count({ where }),
    ]);
    return new PaginatedResult(items, { page, limit, total, totalPages: Math.ceil(total / limit) });
  }

  async get(workspaceId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, workspaceId },
      include: {
        company: true,
        contact: true,
        signals: { orderBy: { createdAt: 'desc' }, include: { rawLead: true } },
        scores: { orderBy: { createdAt: 'desc' } },
        activities: { orderBy: { createdAt: 'desc' } },
        outreach: { orderBy: { createdAt: 'desc' }, include: { replies: true } },
      },
    });
    if (!lead) throw new NotFoundException({ code: 'LEAD_NOT_FOUND', message: 'Lead could not be found.' });
    return lead;
  }

  async create(workspaceId: string, userId: string, input: CreateLeadDto) {
    await this.assertRelations(workspaceId, input.companyId, input.contactId);
    const score = input.overallScore ?? 0;
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: { workspaceId, ...input, overallScore: score, temperature: temperatureFor(score) },
        include: listInclude,
      });
      await tx.activity.create({ data: { workspaceId, leadId: lead.id, type: 'LEAD_CREATED', description: 'Lead created manually.' } });
      await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: 'LEAD_CREATED', entityType: 'Lead', entityId: lead.id } });
      return lead;
    });
  }

  async update(workspaceId: string, userId: string, id: string, input: UpdateLeadDto) {
    await this.get(workspaceId, id);
    await this.assertRelations(workspaceId, input.companyId, input.contactId);
    const temperature = input.temperature ?? (input.overallScore === undefined ? undefined : temperatureFor(input.overallScore));
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.update({ where: { id }, data: { ...input, ...(temperature ? { temperature } : {}) }, include: listInclude });
      await tx.activity.create({ data: { workspaceId, leadId: id, type: 'LEAD_UPDATED', description: 'Lead details were updated.' } });
      await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: 'LEAD_UPDATED', entityType: 'Lead', entityId: id } });
      return lead;
    });
  }

  async delete(workspaceId: string, userId: string, id: string) {
    await this.get(workspaceId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: 'LEAD_DELETED', entityType: 'Lead', entityId: id } });
      await tx.lead.delete({ where: { id } });
    });
    return { id, deleted: true };
  }

  private async assertRelations(workspaceId: string, companyId?: string, contactId?: string) {
    const [company, contact] = await Promise.all([
      companyId ? this.prisma.company.findFirst({ where: { id: companyId, workspaceId }, select: { id: true } }) : null,
      contactId ? this.prisma.contact.findFirst({ where: { id: contactId, workspaceId }, select: { id: true } }) : null,
    ]);
    if (companyId && !company) throw new NotFoundException({ code: 'COMPANY_NOT_FOUND', message: 'Company could not be found in this workspace.' });
    if (contactId && !contact) throw new NotFoundException({ code: 'CONTACT_NOT_FOUND', message: 'Contact could not be found in this workspace.' });
  }

  private orderBy(query: LeadQueryDto): Prisma.LeadOrderByWithRelationInput {
    const direction = query.sortOrder ?? 'desc';
    if (query.sortBy === 'createdAt') return { createdAt: direction };
    if (query.sortBy === 'lastSignalAt') return { lastSignalAt: direction };
    if (query.sortBy === 'companyName') return { company: { name: direction } };
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
