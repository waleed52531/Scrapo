import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ShortlistsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(workspaceId: string) {
    return this.prisma.shortlist.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { items: true } } },
      take: 50,
    });
  }

  async current(workspaceId: string) {
    const shortlist = await this.prisma.shortlist.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      include: {
        discoveryRun: true,
        items: {
          orderBy: { rank: "asc" },
          include: {
            lead: {
              include: {
                company: true,
                contact: true,
                scores: { orderBy: { createdAt: "desc" }, take: 1 },
              },
            },
          },
        },
      },
    });
    return (
      shortlist ?? { items: [], message: "No shortlist has been created yet." }
    );
  }

  async get(workspaceId: string, id: string) {
    const shortlist = await this.prisma.shortlist.findFirst({
      where: { id, workspaceId },
      include: {
        discoveryRun: true,
        items: {
          orderBy: { rank: "asc" },
          include: {
            lead: {
              include: {
                company: true,
                contact: true,
                scores: { orderBy: { createdAt: "desc" }, take: 1 },
              },
            },
          },
        },
      },
    });
    if (!shortlist)
      throw new NotFoundException({
        code: "SHORTLIST_NOT_FOUND",
        message: "Shortlist could not be found.",
      });
    return shortlist;
  }
}
