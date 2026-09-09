import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateCampaignDto, UpdateCampaignDto } from "./dto/campaign.dto";

const campaignInclude = {
  _count: { select: { outreach: true } },
} satisfies Prisma.CampaignInclude;

@Injectable()
export class CampaignsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(workspaceId: string) {
    const campaigns = await this.prisma.campaign.findMany({
      where: { workspaceId },
      include: campaignInclude,
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(
      campaigns.map(async (campaign) => ({
        ...campaign,
        analytics: await this.analytics(workspaceId, campaign.id),
      })),
    );
  }

  async get(workspaceId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, workspaceId },
      include: {
        outreach: { include: { lead: { include: { company: true } } } },
      },
    });
    if (!campaign) throw notFound();
    return { ...campaign, analytics: await this.analytics(workspaceId, id) };
  }

  async create(workspaceId: string, userId: string, input: CreateCampaignDto) {
    const campaign = await this.prisma.campaign.create({
      data: {
        workspaceId,
        name:
          stringValue(input.name) || "Agency Mobile Development Partnerships",
        strategy: stringValue(input.strategy) || "AGENCY_PARTNERSHIP",
        status: stringValue(input.status) || "DRAFT",
        minimumScore: numberValue(input.minimumScore, 82),
        weeklyLimit: numberValue(input.weeklyLimit, 20),
        autoSendEnabled: Boolean(input.autoSendEnabled ?? false),
        autoSendThreshold: numberValue(input.autoSendThreshold, 92),
        followUpDays: numberValue(input.followUpDays, 7),
        followUpMode: stringValue(input.followUpMode) || "DRAFT",
        maxFollowUps: numberValue(input.maxFollowUps, 1),
        targeting: (input.targeting ?? {}) as Prisma.InputJsonValue,
      },
    });
    await this.audit(workspaceId, userId, "CAMPAIGN_CREATED", campaign.id);
    return campaign;
  }

  async update(
    workspaceId: string,
    userId: string,
    id: string,
    input: UpdateCampaignDto,
  ) {
    await this.get(workspaceId, id);
    const campaign = await this.prisma.campaign.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: stringValue(input.name) } : {}),
        ...(input.strategy !== undefined
          ? { strategy: stringValue(input.strategy) }
          : {}),
        ...(input.status !== undefined
          ? { status: stringValue(input.status) }
          : {}),
        ...(input.minimumScore !== undefined
          ? { minimumScore: numberValue(input.minimumScore, 82) }
          : {}),
        ...(input.weeklyLimit !== undefined
          ? { weeklyLimit: numberValue(input.weeklyLimit, 20) }
          : {}),
        ...(input.autoSendEnabled !== undefined
          ? { autoSendEnabled: Boolean(input.autoSendEnabled) }
          : {}),
        ...(input.autoSendThreshold !== undefined
          ? { autoSendThreshold: numberValue(input.autoSendThreshold, 92) }
          : {}),
        ...(input.followUpDays !== undefined
          ? { followUpDays: numberValue(input.followUpDays, 7) }
          : {}),
        ...(input.followUpMode !== undefined
          ? { followUpMode: stringValue(input.followUpMode) }
          : {}),
        ...(input.maxFollowUps !== undefined
          ? { maxFollowUps: numberValue(input.maxFollowUps, 1) }
          : {}),
        ...(input.targeting !== undefined
          ? { targeting: input.targeting as Prisma.InputJsonValue }
          : {}),
      },
    });
    await this.audit(workspaceId, userId, "CAMPAIGN_UPDATED", id);
    return campaign;
  }

  activate(workspaceId: string, userId: string, id: string) {
    return this.update(workspaceId, userId, id, { status: "ACTIVE" });
  }

  pause(workspaceId: string, userId: string, id: string) {
    return this.update(workspaceId, userId, id, { status: "PAUSED" });
  }

  private async analytics(workspaceId: string, campaignId: string) {
    const [leads, sent, replies, interested, meetings, won] = await Promise.all(
      [
        this.prisma.outreachMessage.count({
          where: { workspaceId, campaignId },
        }),
        this.prisma.outreachMessage.count({
          where: { workspaceId, campaignId, sentAt: { not: null } },
        }),
        this.prisma.emailReply.count({
          where: { workspaceId, outreachMessage: { campaignId } },
        }),
        this.prisma.lead.count({
          where: {
            workspaceId,
            status: "INTERESTED",
            outreach: { some: { campaignId } },
          },
        }),
        this.prisma.lead.count({
          where: {
            workspaceId,
            status: "MEETING",
            outreach: { some: { campaignId } },
          },
        }),
        this.prisma.lead.count({
          where: {
            workspaceId,
            status: "WON",
            outreach: { some: { campaignId } },
          },
        }),
      ],
    );
    return {
      leads,
      sent,
      replies,
      interested,
      meetings,
      won,
      replyRate: sent ? Math.round((replies / sent) * 100) : 0,
    };
  }

  private async audit(
    workspaceId: string,
    userId: string,
    action: string,
    entityId: string,
  ) {
    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action,
        entityType: "Campaign",
        entityId,
      },
    });
  }
}

function notFound() {
  return new NotFoundException({
    code: "CAMPAIGN_NOT_FOUND",
    message: "Campaign could not be found.",
  });
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
