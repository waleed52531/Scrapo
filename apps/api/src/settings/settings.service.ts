import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { defaultSettings } from "../auth/workspace-context.service";
import { PrismaService } from "../prisma/prisma.service";
import type { UpdateSettingsDto } from "./dto/update-settings.dto";

const DEFAULT_SCORING_WEIGHTS = {
  buyingIntent: 25,
  mobileRelevance: 20,
  agencyFit: 15,
  decisionMakerQuality: 10,
  contactability: 10,
  recency: 10,
  companyQuality: 5,
  countryPriority: 5,
};

@Injectable()
export class SettingsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(workspaceId: string) {
    return this.prisma.userSettings.upsert({
      where: { workspaceId },
      update: {},
      create: { workspaceId, ...defaultSettings() },
    });
  }

  async getScoring(workspaceId: string) {
    const settings = await this.get(workspaceId);
    return settings.scoring &&
      Object.keys(settings.scoring as Record<string, number>).length
      ? settings.scoring
      : DEFAULT_SCORING_WEIGHTS;
  }

  async updateScoring(
    workspaceId: string,
    userId: string,
    scoring: Record<string, number>,
  ) {
    if (!isValidScoring(scoring)) {
      throw new BadRequestException({
        code: "INVALID_SCORING_WEIGHTS",
        message:
          "All eight scoring weights are required, must be non-negative, and must total 100.",
      });
    }
    return this.update(workspaceId, userId, { scoring });
  }

  aiStatus() {
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    return {
      provider: "OpenAI",
      model,
      configured: Boolean(process.env.OPENAI_API_KEY),
      status: process.env.OPENAI_API_KEY ? "Configured" : "Missing API Key",
    };
  }

  async update(workspaceId: string, userId: string, input: UpdateSettingsDto) {
    if (input.scoring) {
      if (!isValidScoring(input.scoring)) {
        throw new BadRequestException({
          code: "INVALID_SCORING_WEIGHTS",
          message:
            "All eight scoring weights are required, must be non-negative, and must total 100.",
        });
      }
    }
    const data: Prisma.UserSettingsUpdateInput = {
      ...(input.profile
        ? { profile: input.profile as unknown as Prisma.InputJsonValue }
        : {}),
      ...(input.targeting
        ? { targeting: input.targeting as unknown as Prisma.InputJsonValue }
        : {}),
      ...(input.scoring
        ? { scoring: input.scoring as Prisma.InputJsonValue }
        : {}),
      ...(input.discovery
        ? { discovery: input.discovery as unknown as Prisma.InputJsonValue }
        : {}),
      ...(input.outreachPaused !== undefined
        ? { outreachPaused: input.outreachPaused }
        : {}),
      ...(input.emailMode !== undefined ? { emailMode: input.emailMode } : {}),
      ...(input.weeklyEmailLimit !== undefined
        ? { weeklyEmailLimit: input.weeklyEmailLimit }
        : {}),
      ...(input.autoSendEnabled !== undefined
        ? { autoSendEnabled: input.autoSendEnabled }
        : {}),
      ...(input.autoSendMinimumScore !== undefined
        ? { autoSendMinimumScore: input.autoSendMinimumScore }
        : {}),
      ...(input.autoSendDailyLimit !== undefined
        ? { autoSendDailyLimit: input.autoSendDailyLimit }
        : {}),
      ...(input.autoGenerateOutreachDrafts !== undefined
        ? { autoGenerateOutreachDrafts: input.autoGenerateOutreachDrafts }
        : {}),
      ...(input.automationPaused !== undefined
        ? { automationPaused: input.automationPaused }
        : {}),
      ...(input.automationKillSwitch !== undefined
        ? { automationKillSwitch: input.automationKillSwitch }
        : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.outreachBusinessHoursStart !== undefined
        ? { outreachBusinessHoursStart: input.outreachBusinessHoursStart }
        : {}),
      ...(input.outreachBusinessHoursEnd !== undefined
        ? { outreachBusinessHoursEnd: input.outreachBusinessHoursEnd }
        : {}),
      ...(input.outreachBusinessDays !== undefined
        ? {
            outreachBusinessDays:
              input.outreachBusinessDays as Prisma.InputJsonValue,
          }
        : {}),
      ...(input.sourcePriorities !== undefined
        ? { sourcePriorities: input.sourcePriorities as Prisma.InputJsonValue }
        : {}),
      ...(input.discoveryBudgetAllocation !== undefined
        ? {
            discoveryBudgetAllocation:
              input.discoveryBudgetAllocation as Prisma.InputJsonValue,
          }
        : {}),
      ...(input.optimizationSettings !== undefined
        ? {
            optimizationSettings:
              input.optimizationSettings as Prisma.InputJsonValue,
          }
        : {}),
      ...(input.staleLeadTtls !== undefined
        ? { staleLeadTtls: input.staleLeadTtls as Prisma.InputJsonValue }
        : {}),
      ...(input.sendOwnerEmailAlerts !== undefined
        ? { sendOwnerEmailAlerts: input.sendOwnerEmailAlerts }
        : {}),
      ...(input.dailyDigestEnabled !== undefined
        ? { dailyDigestEnabled: input.dailyDigestEnabled }
        : {}),
      ...(input.scoreJumpThreshold !== undefined
        ? { scoreJumpThreshold: input.scoreJumpThreshold }
        : {}),
      ...(input.followUpDelayDays !== undefined
        ? { followUpDelayDays: input.followUpDelayDays }
        : {}),
      ...(input.followUpMode !== undefined
        ? { followUpMode: input.followUpMode }
        : {}),
      ...(input.maxFollowUps !== undefined
        ? { maxFollowUps: input.maxFollowUps }
        : {}),
      ...(input.coldOutreachCooldownDays !== undefined
        ? { coldOutreachCooldownDays: input.coldOutreachCooldownDays }
        : {}),
      ...(input.maxNewContactsPerCompanyPer30Days !== undefined
        ? {
            maxNewContactsPerCompanyPer30Days:
              input.maxNewContactsPerCompanyPer30Days,
          }
        : {}),
      ...(input.emailSignature !== undefined
        ? { emailSignature: input.emailSignature }
        : {}),
      ...(input.optOutFooter !== undefined
        ? { optOutFooter: input.optOutFooter }
        : {}),
    };
    return this.prisma.$transaction(async (tx) => {
      const settings = await tx.userSettings.upsert({
        where: { workspaceId },
        update: data,
        create: {
          workspaceId,
          ...defaultSettings(),
          ...data,
        } as Prisma.UserSettingsUncheckedCreateInput,
      });
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "SETTINGS_CHANGED",
          entityType: "UserSettings",
          entityId: settings.id,
        },
      });
      return settings;
    });
  }
}

function isValidScoring(scoring: Record<string, number>) {
  const keys = Object.keys(DEFAULT_SCORING_WEIGHTS);
  const values = keys.map((key) => scoring[key]);
  return (
    values.every(
      (value) =>
        value !== undefined &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 100,
    ) && values.reduce<number>((sum, value) => sum + (value ?? 0), 0) === 100
  );
}
