import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateSuppressionDto } from "../outreach/dto/outreach.dto";

@Injectable()
export class SuppressionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list(workspaceId: string) {
    return this.prisma.suppressionEntry.findMany({
      where: { workspaceId },
      include: { contact: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async create(
    workspaceId: string,
    userId: string,
    input: CreateSuppressionDto,
  ) {
    const email = input.email?.toLowerCase();
    const domain = normalizeDomain(input.domain ?? email?.split("@").at(1));
    if (!email && !domain && !input.contactId) {
      throw new BadRequestException({
        code: "SUPPRESSION_TARGET_REQUIRED",
        message: "Provide an email, domain, or contact to suppress.",
      });
    }
    if (input.contactId) {
      const contact = await this.prisma.contact.findFirst({
        where: { id: input.contactId, workspaceId },
      });
      if (!contact) {
        throw new BadRequestException({
          code: "CONTACT_NOT_FOUND",
          message: "Contact could not be found in this workspace.",
        });
      }
    }
    const item = await this.prisma.suppressionEntry.create({
      data: {
        workspaceId,
        email,
        domain,
        contactId: input.contactId,
        reason: input.reason,
        source: "MANUAL",
      } satisfies Prisma.SuppressionEntryUncheckedCreateInput,
      include: { contact: true },
    });
    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "SUPPRESSION_ADDED",
        entityType: "SuppressionEntry",
        entityId: item.id,
      },
    });
    return item;
  }

  async delete(workspaceId: string, userId: string, id: string) {
    const item = await this.prisma.suppressionEntry.findFirst({
      where: { id, workspaceId },
    });
    if (!item) {
      throw new NotFoundException({
        code: "SUPPRESSION_NOT_FOUND",
        message: "Suppression entry could not be found.",
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.suppressionEntry.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "SUPPRESSION_REMOVED",
          entityType: "SuppressionEntry",
          entityId: id,
        },
      });
    });
    return { id, deleted: true };
  }
}

function normalizeDomain(value: string | undefined) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}
