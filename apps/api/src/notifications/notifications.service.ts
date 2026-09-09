import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list(workspaceId: string) {
    return this.prisma.notification.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async markRead(workspaceId: string, id: string) {
    const item = await this.prisma.notification.findFirst({
      where: { id, workspaceId },
    });
    if (!item) {
      throw new NotFoundException({
        code: "NOTIFICATION_NOT_FOUND",
        message: "Notification could not be found.",
      });
    }
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: item.readAt ?? new Date() },
    });
  }

  async readAll(workspaceId: string) {
    await this.prisma.notification.updateMany({
      where: { workspaceId, readAt: null },
      data: { readAt: new Date() },
    });
    return { read: true };
  }
}
