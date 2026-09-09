import { Inject, Injectable } from "@nestjs/common";
import {
  AnalysisStatus,
  JobStatus,
  LeadSource,
  LeadStatus,
  LeadTemperature,
  OutreachStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(workspaceId: string) {
    const [
      leadsDiscovered,
      qualified,
      shortlisted,
      contacted,
      replies,
      interested,
      meetings,
      won,
      analyzedLeads,
      hotLeads,
      strongLeads,
      reviewLeads,
      rejectedLeads,
      aiAnalysisFailures,
      emailsSentThisWeek,
      generatedOutreach,
      draftedOutreach,
      sentOutreach,
      repliedOutreach,
      bouncedReplies,
      followUpsDue,
      gmailConnection,
      recentLeads,
      activeJobs,
      enabledAutomationRules,
      failedAutomationRuns,
      unreadNotifications,
      newOptimizationRecommendations,
    ] = await this.prisma.$transaction([
      this.prisma.lead.count({ where: { workspaceId } }),
      this.prisma.lead.count({
        where: {
          workspaceId,
          status: {
            in: [
              LeadStatus.QUALIFIED,
              LeadStatus.SHORTLISTED,
              LeadStatus.INTERESTED,
              LeadStatus.CONTACTED,
              LeadStatus.REPLIED,
              LeadStatus.MEETING,
              LeadStatus.PROPOSAL,
              LeadStatus.WON,
            ],
          },
        },
      }),
      this.prisma.lead.count({
        where: { workspaceId, overallScore: { gte: 82 } },
      }),
      this.prisma.lead.count({
        where: {
          workspaceId,
          status: {
            in: [
              LeadStatus.CONTACTED,
              LeadStatus.REPLIED,
              LeadStatus.INTERESTED,
              LeadStatus.MEETING,
              LeadStatus.PROPOSAL,
              LeadStatus.WON,
            ],
          },
        },
      }),
      this.prisma.emailReply.count({ where: { workspaceId } }),
      this.prisma.lead.count({
        where: { workspaceId, status: LeadStatus.INTERESTED },
      }),
      this.prisma.lead.count({
        where: { workspaceId, status: LeadStatus.MEETING },
      }),
      this.prisma.lead.count({
        where: { workspaceId, status: LeadStatus.WON },
      }),
      this.prisma.lead.count({
        where: { workspaceId, analysisStatus: AnalysisStatus.COMPLETED },
      }),
      this.prisma.lead.count({
        where: { workspaceId, temperature: LeadTemperature.HOT },
      }),
      this.prisma.lead.count({
        where: { workspaceId, temperature: LeadTemperature.STRONG },
      }),
      this.prisma.lead.count({
        where: { workspaceId, temperature: LeadTemperature.REVIEW },
      }),
      this.prisma.lead.count({
        where: {
          workspaceId,
          OR: [
            { temperature: LeadTemperature.REJECT },
            { status: LeadStatus.INVALID },
          ],
        },
      }),
      this.prisma.lead.count({
        where: { workspaceId, analysisStatus: AnalysisStatus.FAILED },
      }),
      this.prisma.outreachMessage.count({
        where: {
          workspaceId,
          sentAt: { gte: startOfWeek(new Date()) },
          status: {
            in: [
              OutreachStatus.SENT,
              OutreachStatus.DELIVERED,
              OutreachStatus.REPLIED,
              OutreachStatus.FOLLOW_UP_SENT,
            ],
          },
        },
      }),
      this.prisma.outreachMessage.count({
        where: { workspaceId, status: OutreachStatus.GENERATED },
      }),
      this.prisma.outreachMessage.count({
        where: { workspaceId, status: OutreachStatus.DRAFT_CREATED },
      }),
      this.prisma.outreachMessage.count({
        where: {
          workspaceId,
          status: {
            in: [
              OutreachStatus.SENT,
              OutreachStatus.DELIVERED,
              OutreachStatus.FOLLOW_UP_SENT,
            ],
          },
        },
      }),
      this.prisma.outreachMessage.count({
        where: { workspaceId, status: OutreachStatus.REPLIED },
      }),
      this.prisma.emailReply.count({
        where: { workspaceId, classification: "BOUNCE" },
      }),
      this.prisma.outreachMessage.count({
        where: { workspaceId, status: OutreachStatus.FOLLOW_UP_DUE },
      }),
      this.prisma.integrationConnection.findUnique({
        where: { workspaceId_provider: { workspaceId, provider: "GMAIL" } },
      }),
      this.prisma.lead.findMany({
        where: { workspaceId },
        include: {
          company: {
            select: { id: true, name: true, country: true, city: true },
          },
          contact: {
            select: {
              id: true,
              fullName: true,
              role: true,
              email: true,
              emailStatus: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      this.prisma.systemJob.findMany({
        where: {
          workspaceId,
          status: { in: [JobStatus.QUEUED, JobStatus.RUNNING] },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      this.prisma.automationRule.count({
        where: { workspaceId, enabled: true },
      }),
      this.prisma.automationRun.count({
        where: { workspaceId, status: "FAILED" },
      }),
      this.prisma.notification.count({ where: { workspaceId, readAt: null } }),
      this.prisma.optimizationRecommendation.count({
        where: { workspaceId, status: "NEW" },
      }),
    ]);
    const socialSources = [
      LeadSource.X,
      LeadSource.REDDIT,
      LeadSource.TELEGRAM,
    ];
    const [
      hotSocialLeads,
      socialRaw,
      socialQualified,
      socialShortlisted,
      socialActions,
    ] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where: {
          workspaceId,
          OR: [
            { primarySource: { in: socialSources } },
            { signals: { some: { source: { in: socialSources } } } },
          ],
          overallScore: { gte: 82 },
        },
        include: {
          company: {
            select: { id: true, name: true, country: true, city: true },
          },
          contact: {
            select: {
              id: true,
              fullName: true,
              role: true,
              email: true,
              emailStatus: true,
            },
          },
          signals: {
            where: { source: { in: socialSources } },
            orderBy: { signalQualityScore: "desc" },
            take: 1,
          },
          actions: {
            where: { platform: { in: socialSources }, status: "PENDING" },
            take: 1,
          },
        },
        orderBy: [{ overallScore: "desc" }, { lastSignalAt: "desc" }],
        take: 5,
      }),
      this.prisma.rawLead.groupBy({
        by: ["source"],
        where: { workspaceId, source: { in: socialSources } },
        _count: { _all: true },
      }),
      this.prisma.lead.groupBy({
        by: ["primarySource"],
        where: {
          workspaceId,
          primarySource: { in: socialSources },
          overallScore: { gte: 82 },
        },
        _count: { _all: true },
      }),
      this.prisma.lead.groupBy({
        by: ["primarySource"],
        where: {
          workspaceId,
          primarySource: { in: socialSources },
          status: "SHORTLISTED",
        },
        _count: { _all: true },
      }),
      this.prisma.actionItem.groupBy({
        by: ["platform"],
        where: { workspaceId, platform: { in: socialSources } },
        _count: { _all: true },
      }),
    ]);
    const socialFunnel = socialSources.map((source) => ({
      source,
      found: socialRaw.find((item) => item.source === source)?._count._all ?? 0,
      qualified:
        socialQualified.find((item) => item.primarySource === source)?._count
          ._all ?? 0,
      shortlisted:
        socialShortlisted.find((item) => item.primarySource === source)?._count
          ._all ?? 0,
      manualActions:
        socialActions.find((item) => item.platform === source)?._count._all ??
        0,
    }));
    const replyRate = sentOutreach
      ? Math.round((repliedOutreach / sentOutreach) * 100)
      : 0;
    return {
      leadsDiscovered,
      qualified,
      shortlisted,
      contacted,
      replies,
      interested,
      meetings,
      won,
      analyzedLeads,
      hotLeads,
      strongLeads,
      reviewLeads,
      rejectedLeads,
      aiAnalysisFailures,
      emailsSentThisWeek,
      replyRate,
      followUpsDue,
      enabledAutomationRules,
      failedAutomationRuns,
      unreadNotifications,
      newOptimizationRecommendations,
      gmailStatus: gmailConnection?.status ?? "NOT_CONFIGURED",
      outreachAnalytics: {
        generated: generatedOutreach,
        drafted: draftedOutreach,
        sent: sentOutreach,
        replied: repliedOutreach,
        interested,
        meetings,
        proposals: 0,
        won,
        notInterested: await this.prisma.lead.count({
          where: { workspaceId, status: LeadStatus.NOT_INTERESTED },
        }),
        bounced: bouncedReplies,
      },
      sourcePerformance: socialFunnel,
      socialFunnel,
      hotSocialLeads,
      recentLeads,
      recentReplies: [],
      activeJobs,
    };
  }
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  result.setDate(result.getDate() - result.getDay());
  result.setHours(0, 0, 0, 0);
  return result;
}
