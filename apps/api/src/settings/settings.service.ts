import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { defaultSettings } from '../auth/workspace-context.service';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateSettingsDto } from './dto/update-settings.dto';

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

  async update(workspaceId: string, userId: string, input: UpdateSettingsDto) {
    if (input.scoring) {
      const keys = ['buyingIntent', 'mobileRelevance', 'agencyFit', 'decisionMakerQuality', 'contactability', 'recency', 'companyQuality', 'countryPriority'];
      if (keys.some((key) => typeof input.scoring?.[key] !== 'number') || Object.values(input.scoring).some((value) => value < 0) || Object.values(input.scoring).reduce((sum, value) => sum + value, 0) !== 100) {
        throw new BadRequestException({ code: 'INVALID_SCORING_WEIGHTS', message: 'All eight scoring weights are required, must be non-negative, and must total 100.' });
      }
    }
    const data: Prisma.UserSettingsUpdateInput = {
      ...(input.profile ? { profile: input.profile as unknown as Prisma.InputJsonValue } : {}),
      ...(input.targeting ? { targeting: input.targeting as unknown as Prisma.InputJsonValue } : {}),
      ...(input.scoring ? { scoring: input.scoring as Prisma.InputJsonValue } : {}),
      ...(input.discovery ? { discovery: input.discovery as unknown as Prisma.InputJsonValue } : {}),
      ...(input.outreachPaused !== undefined ? { outreachPaused: input.outreachPaused } : {}),
      ...(input.emailMode !== undefined ? { emailMode: input.emailMode } : {}),
      ...(input.weeklyEmailLimit !== undefined ? { weeklyEmailLimit: input.weeklyEmailLimit } : {}),
      ...(input.followUpDelayDays !== undefined ? { followUpDelayDays: input.followUpDelayDays } : {}),
      ...(input.maxFollowUps !== undefined ? { maxFollowUps: input.maxFollowUps } : {}),
      ...(input.emailSignature !== undefined ? { emailSignature: input.emailSignature } : {}),
    };
    return this.prisma.$transaction(async (tx) => {
      const settings = await tx.userSettings.upsert({ where: { workspaceId }, update: data, create: { workspaceId, ...defaultSettings(), ...data } as Prisma.UserSettingsUncheckedCreateInput });
      await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: 'SETTINGS_CHANGED', entityType: 'UserSettings', entityId: settings.id } });
      return settings;
    });
  }
}
