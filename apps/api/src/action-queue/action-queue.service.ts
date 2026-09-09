import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type {
  ActionQueueListDto,
  UpdateActionItemDto,
} from "./dto/action-queue.dto";

@Injectable()
export class ActionQueueService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(workspaceId: string, query: ActionQueueListDto) {
    await this.expireStale(workspaceId);
    return this.prisma.actionItem.findMany({
      where: {
        workspaceId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.platform ? { platform: query.platform } : {}),
      },
      include: {
        lead: { include: { company: true, contact: true } },
        contact: true,
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
    });
  }

  async update(
    workspaceId: string,
    userId: string,
    id: string,
    input: UpdateActionItemDto,
  ) {
    const item = await this.prisma.actionItem.findFirst({
      where: { id, workspaceId },
    });
    if (!item)
      throw new NotFoundException({
        code: "ACTION_ITEM_NOT_FOUND",
        message: "Action item could not be found.",
      });
    const updated = await this.prisma.actionItem.update({
      where: { id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.status === "COMPLETED" ? { completedAt: new Date() } : {}),
        ...(input.status === "SKIPPED" ? { completedAt: new Date() } : {}),
      } satisfies Prisma.ActionItemUpdateInput,
    });
    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "ACTION_QUEUE_UPDATED",
        entityType: "ActionItem",
        entityId: id,
        metadata: { status: input.status },
      },
    });
    return updated;
  }

  private async expireStale(workspaceId: string) {
    await this.prisma.actionItem.updateMany({
      where: {
        workspaceId,
        status: "PENDING",
        expiresAt: { lt: new Date() },
      },
      data: { status: "EXPIRED", stale: true },
    });
  }
}
