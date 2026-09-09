import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DEFAULT_TELEGRAM_KEYWORDS } from "@scrapo/shared";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateTelegramSourceDto,
  UpdateTelegramSourceDto,
} from "./dto/telegram-source.dto";

@Injectable()
export class TelegramSourcesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list(workspaceId: string) {
    return this.prisma.telegramSource.findMany({
      where: { workspaceId },
      orderBy: [{ enabled: "desc" }, { createdAt: "desc" }],
    });
  }

  create(workspaceId: string, userId: string, input: CreateTelegramSourceDto) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.telegramSource.create({
        data: {
          workspaceId,
          name: input.name,
          username: input.username,
          externalId: input.externalId ?? input.username,
          type: input.type,
          enabled: input.enabled ?? true,
          keywords: input.keywords ?? [...DEFAULT_TELEGRAM_KEYWORDS],
          notes: input.notes,
          status: "CONFIGURED",
        },
      });
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "TELEGRAM_SOURCE_CREATED",
          entityType: "TelegramSource",
          entityId: item.id,
        },
      });
      return item;
    });
  }

  async update(
    workspaceId: string,
    userId: string,
    id: string,
    input: UpdateTelegramSourceDto,
  ) {
    await this.get(workspaceId, id);
    const item = await this.prisma.telegramSource.update({
      where: { id },
      data: {
        ...input,
        ...(input.keywords ? { keywords: input.keywords } : {}),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "TELEGRAM_SOURCE_UPDATED",
        entityType: "TelegramSource",
        entityId: id,
      },
    });
    return item;
  }

  async syncNow(workspaceId: string, userId: string, id: string) {
    const item = await this.get(workspaceId, id);
    const hasAccess =
      process.env.TELEGRAM_ENABLED === "true" &&
      Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
    const updated = await this.prisma.telegramSource.update({
      where: { id },
      data: {
        status: hasAccess ? "SYNCED" : "ACCESS_ERROR",
        lastSyncedAt: hasAccess ? new Date() : item.lastSyncedAt,
        lastError: hasAccess
          ? null
          : "Telegram bot/API configuration is required to sync this source outside mock lead hunts.",
      },
    });
    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "TELEGRAM_SOURCE_SYNC_REQUESTED",
        entityType: "TelegramSource",
        entityId: id,
      },
    });
    return updated;
  }

  async delete(workspaceId: string, userId: string, id: string) {
    await this.get(workspaceId, id);
    await this.prisma.$transaction([
      this.prisma.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "TELEGRAM_SOURCE_DELETED",
          entityType: "TelegramSource",
          entityId: id,
        },
      }),
      this.prisma.telegramSource.delete({ where: { id } }),
    ]);
    return { id, deleted: true };
  }

  private async get(workspaceId: string, id: string) {
    const item = await this.prisma.telegramSource.findFirst({
      where: { id, workspaceId },
    });
    if (!item)
      throw new NotFoundException({
        code: "TELEGRAM_SOURCE_NOT_FOUND",
        message: "Telegram source could not be found.",
      });
    return item;
  }
}
