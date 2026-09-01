import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginatedResult } from '../common/paginated-result';
import { PrismaService } from '../prisma/prisma.service';
import type { ContactQueryDto, CreateContactDto, UpdateContactDto } from './dto/contact.dto';

@Injectable()
export class ContactsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(workspaceId: string, query: ContactQueryDto) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const where: Prisma.ContactWhereInput = {
      workspaceId,
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.emailStatus ? { emailStatus: query.emailStatus } : {}),
      ...(query.search ? { OR: [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { role: { contains: query.search, mode: 'insensitive' } },
        { company: { name: { contains: query.search, mode: 'insensitive' } } },
      ] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.contact.findMany({
        where,
        include: { company: { select: { id: true, name: true } }, _count: { select: { leads: true } } },
        orderBy: [{ decisionMakerScore: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.contact.count({ where }),
    ]);
    return new PaginatedResult(items, { page, limit, total, totalPages: Math.ceil(total / limit) });
  }

  async get(workspaceId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, workspaceId },
      include: { company: true, leads: { orderBy: { overallScore: 'desc' } } },
    });
    if (!contact) throw new NotFoundException({ code: 'CONTACT_NOT_FOUND', message: 'Contact could not be found.' });
    return contact;
  }

  async create(workspaceId: string, userId: string, input: CreateContactDto) {
    await this.assertCompany(workspaceId, input.companyId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const contact = await tx.contact.create({ data: { workspaceId, ...input, email: input.email?.toLowerCase() } });
        await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: 'CONTACT_CREATED', entityType: 'Contact', entityId: contact.id } });
        return contact;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'CONTACT_ALREADY_EXISTS', message: 'A contact with this email already exists.' });
      }
      throw error;
    }
  }

  async update(workspaceId: string, userId: string, id: string, input: UpdateContactDto) {
    await this.get(workspaceId, id);
    await this.assertCompany(workspaceId, input.companyId);
    return this.prisma.$transaction(async (tx) => {
      const contact = await tx.contact.update({ where: { id }, data: { ...input, email: input.email?.toLowerCase() } });
      await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: 'CONTACT_UPDATED', entityType: 'Contact', entityId: id } });
      return contact;
    });
  }

  async delete(workspaceId: string, userId: string, id: string) {
    await this.get(workspaceId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: 'CONTACT_DELETED', entityType: 'Contact', entityId: id } });
      await tx.contact.delete({ where: { id } });
    });
    return { id, deleted: true };
  }

  private async assertCompany(workspaceId: string, companyId?: string) {
    if (!companyId) return;
    const company = await this.prisma.company.findFirst({ where: { id: companyId, workspaceId }, select: { id: true } });
    if (!company) throw new NotFoundException({ code: 'COMPANY_NOT_FOUND', message: 'Company could not be found in this workspace.' });
  }
}
