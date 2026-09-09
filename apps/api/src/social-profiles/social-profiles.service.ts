import { Inject, Injectable } from "@nestjs/common";
import { LeadSource, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SocialProfilesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list(workspaceId: string, platform?: string) {
    const source =
      platform && platform in LeadSource ? (platform as LeadSource) : undefined;
    const where: Prisma.SocialProfileWhereInput = {
      workspaceId,
      ...(source ? { platform: source } : {}),
    };
    return this.prisma.socialProfile.findMany({
      where,
      include: { contact: { include: { company: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  }
}
