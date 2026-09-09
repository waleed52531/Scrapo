import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { WorkspaceRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WorkspaceContextService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolve(
    identity: { externalAuthId: string; email: string },
    requestedWorkspaceId?: string,
  ) {
    let user = await this.prisma.user.findUnique({
      where: { externalAuthId: identity.externalAuthId },
      include: { memberships: { orderBy: { createdAt: "asc" } } },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          externalAuthId: identity.externalAuthId,
          email: identity.email,
          displayName: identity.email.split("@")[0],
          memberships: {
            create: {
              role: WorkspaceRole.OWNER,
              workspace: {
                create: {
                  name: `${identity.email.split("@")[0]}'s Workspace`,
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
      ? user.memberships.find(
          (item) => item.workspaceId === requestedWorkspaceId,
        )
      : user.memberships[0];
    if (!membership) {
      throw new ForbiddenException({
        code: "WORKSPACE_ACCESS_DENIED",
        message: "You do not have access to this workspace.",
      });
    }
    return {
      userId: user.id,
      workspaceId: membership.workspaceId,
      workspaceRole: membership.role,
    };
  }
}

export function defaultSettings() {
  return {
    profile: {
      name: "",
      title: "Mobile Application Developer",
      skills: [
        "Flutter development",
        "Android development",
        "iOS development",
        "Firebase integration",
        "REST API integration",
      ],
      experience: "",
      portfolio: "",
      github: "",
      linkedin: "",
      availability: "",
      projectPreferences: [
        "Existing application development",
        "Flutter bug fixing",
        "Agency outsourcing partnerships",
      ],
    },
    targeting: {
      countries: [
        "United States",
        "United Kingdom",
        "United Arab Emirates",
        "Saudi Arabia",
        "Australia",
        "Canada",
      ],
      companySizes: ["2-10", "11-50", "51-100"],
      industries: [],
      leadTypes: ["AGENCY_PARTNER", "ACTIVE_REQUIREMENT"],
      technologies: ["Flutter", "Firebase"],
      minimumBudget: 0,
    },
    scoring: {
      buyingIntent: 25,
      mobileRelevance: 20,
      agencyFit: 15,
      decisionMakerQuality: 10,
      contactability: 10,
      recency: 10,
      companyQuality: 5,
      countryPriority: 5,
    },
    discovery: { target: 300, minimumScore: 82, shortlistLimit: 20 },
    outreachPaused:
      process.env.NODE_ENV === "production"
        ? process.env.OUTREACH_PAUSED !== "false"
        : process.env.OUTREACH_PAUSED === "true",
    emailMode: "DRAFT_FIRST",
    weeklyEmailLimit: 20,
    autoSendEnabled: false,
    autoSendMinimumScore: 92,
    autoSendDailyLimit: 5,
    autoGenerateOutreachDrafts: true,
    automationPaused: false,
    automationKillSwitch: false,
    timezone: process.env.DEFAULT_WORKSPACE_TIMEZONE || "Asia/Karachi",
    outreachBusinessHoursStart: "09:00",
    outreachBusinessHoursEnd: "17:00",
    outreachBusinessDays: [1, 2, 3, 4, 5],
    sourcePriorities: {
      WEB: "HIGH",
      X: "NORMAL",
      REDDIT: "LOW",
      TELEGRAM: "LOW",
    },
    discoveryBudgetAllocation: { WEB: 50, X: 30, TELEGRAM: 20 },
    optimizationSettings: {
      minimumContactedForSourceRecommendation: 10,
      minimumContactedForQueryRecommendation: 5,
    },
    staleLeadTtls: {
      ACTIVE_REQUIREMENT: 14,
      MVP_STARTUP: 30,
      AGENCY_PARTNER: 90,
    },
    sendOwnerEmailAlerts: false,
    dailyDigestEnabled: true,
    scoreJumpThreshold: 10,
    followUpDelayDays: 7,
    followUpMode: "DRAFT",
    maxFollowUps: 1,
    coldOutreachCooldownDays: 90,
    maxNewContactsPerCompanyPer30Days: 1,
    emailSignature: "",
    optOutFooter:
      "If this is not relevant, reply unsubscribe and I will not contact you again.",
  };
}
