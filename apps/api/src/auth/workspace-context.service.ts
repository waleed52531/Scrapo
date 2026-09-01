import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkspaceContextService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolve(identity: { externalAuthId: string; email: string }, requestedWorkspaceId?: string) {
    let user = await this.prisma.user.findUnique({
      where: { externalAuthId: identity.externalAuthId },
      include: { memberships: { orderBy: { createdAt: 'asc' } } },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          externalAuthId: identity.externalAuthId,
          email: identity.email,
          displayName: identity.email.split('@')[0],
          memberships: {
            create: {
              role: WorkspaceRole.OWNER,
              workspace: {
                create: {
                  name: `${identity.email.split('@')[0]}'s Workspace`,
                  slug: `personal-${identity.externalAuthId.slice(0, 8)}-${Date.now().toString(36)}`,
                  settings: { create: defaultSettings() },
                },
              },
            },
          },
        },
        include: { memberships: true },
      });
    }

    const membership = requestedWorkspaceId
      ? user.memberships.find((item) => item.workspaceId === requestedWorkspaceId)
      : user.memberships[0];
    if (!membership) {
      throw new ForbiddenException({ code: 'WORKSPACE_ACCESS_DENIED', message: 'You do not have access to this workspace.' });
    }
    return { userId: user.id, workspaceId: membership.workspaceId, workspaceRole: membership.role };
  }
}

export function defaultSettings() {
  return {
    profile: {
      name: '', title: 'Mobile Application Developer', skills: ['Flutter development', 'Android development', 'iOS development', 'Firebase integration', 'REST API integration'],
      experience: '', portfolio: '', github: '', linkedin: '', availability: '', projectPreferences: ['Existing application development', 'Flutter bug fixing', 'Agency outsourcing partnerships'],
    },
    targeting: {
      countries: ['United States', 'United Kingdom', 'United Arab Emirates', 'Saudi Arabia', 'Australia', 'Canada'],
      companySizes: ['2-10', '11-50', '51-100'], industries: [], leadTypes: ['AGENCY_PARTNER', 'ACTIVE_REQUIREMENT'], technologies: ['Flutter', 'Firebase'], minimumBudget: 0,
    },
    scoring: { buyingIntent: 25, mobileRelevance: 20, agencyFit: 15, decisionMakerQuality: 10, contactability: 10, recency: 10, companyQuality: 5, countryPriority: 5 },
    discovery: { target: 300, minimumScore: 82, shortlistLimit: 20 },
    emailMode: 'DRAFT_FIRST', weeklyEmailLimit: 20, followUpDelayDays: 7, maxFollowUps: 1,
  };
}
