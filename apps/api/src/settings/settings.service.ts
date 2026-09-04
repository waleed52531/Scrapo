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
      ...(input.followUpDelayDays !== undefined
        ? { followUpDelayDays: input.followUpDelayDays }
        : {}),
      ...(input.maxFollowUps !== undefined
        ? { maxFollowUps: input.maxFollowUps }
        : {}),
      ...(input.emailSignature !== undefined
        ? { emailSignature: input.emailSignature }
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
