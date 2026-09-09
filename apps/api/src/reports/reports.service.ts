import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { JobStatus, LeadStatus, OutreachStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LeadRankingService } from "../ranking/lead-ranking.service";

@Injectable()
export class ReportsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LeadRankingService) private readonly ranking: LeadRankingService,
  ) {}

  async listWeekly(workspaceId: string) {
    return this.prisma.weeklyReport.findMany({
      where: { workspaceId },
      orderBy: { weekStart: "desc" },
      take: 52,
    });
  }

  async getWeekly(workspaceId: string, id: string) {
    const report = await this.prisma.weeklyReport.findFirst({
      where: { id, workspaceId },
    });
    if (!report) {
      throw new NotFoundException({
        code: "WEEKLY_REPORT_NOT_FOUND",
        message: "Weekly report could not be found.",
      });
    }
    return report;
  }

  async generateWeekly(workspaceId: string, date = new Date()) {
    const { weekStart, weekEnd } = weekWindow(date);
    const [
      discovered,
      qualified,
      shortlisted,
      contacted,
      replies,
      interested,
      meetings,
      won,
      failures,
      performance,
      recommendations,
      bestLeads,
    ] = await Promise.all([
      this.prisma.lead.count({
        where: { workspaceId, createdAt: { gte: weekStart, lte: weekEnd } },
      }),
      this.prisma.lead.count({
        where: {
          workspaceId,
          overallScore: { gte: 82 },
          createdAt: { gte: weekStart, lte: weekEnd },
        },
      }),
      this.prisma.shortlistItem.count({
        where: {
          shortlist: {
            workspaceId,
            weekStart: { gte: weekStart, lte: weekEnd },
          },
        },
      }),
      this.prisma.outreachMessage.count({
        where: { workspaceId, sentAt: { gte: weekStart, lte: weekEnd } },
      }),
      this.prisma.emailReply.count({
        where: { workspaceId, receivedAt: { gte: weekStart, lte: weekEnd } },
      }),
      this.prisma.lead.count({
        where: { workspaceId, status: LeadStatus.INTERESTED },
      }),
      this.prisma.lead.count({
        where: { workspaceId, status: LeadStatus.MEETING },
      }),
      this.prisma.lead.count({
        where: { workspaceId, status: LeadStatus.WON },
      }),
      this.prisma.systemJob.findMany({
        where: {
          workspaceId,
          status: JobStatus.FAILED,
          createdAt: { gte: weekStart, lte: weekEnd },
        },
        select: { type: true, error: true, createdAt: true },
        take: 20,
      }),
      this.ranking.performance(workspaceId),
      this.prisma.optimizationRecommendation.findMany({
        where: { workspaceId, createdAt: { gte: weekStart, lte: weekEnd } },
        take: 20,
      }),
      this.prisma.lead.findMany({
        where: { workspaceId, createdAt: { gte: weekStart, lte: weekEnd } },
        include: { company: true, contact: true },
        orderBy: [{ rankingScore: "desc" }, { overallScore: "desc" }],
        take: 10,
      }),
    ]);
    const report = await this.prisma.weeklyReport.upsert({
      where: { workspaceId_weekStart: { workspaceId, weekStart } },
      update: {
        weekEnd,
        metrics: {
          discovered,
          qualified,
          shortlisted,
          contacted,
          replies,
          interested,
          meetings,
          won,
        },
        sourcePerformance: performance.sources,
        queryPerformance: performance.queries,
        recommendations,
        failures,
        generatedAt: new Date(),
      },
      create: {
        workspaceId,
        weekStart,
        weekEnd,
        metrics: {
          discovered,
          qualified,
          shortlisted,
          contacted,
          replies,
          interested,
          meetings,
          won,
          emailsSent: contacted,
          repliesReceived: replies,
        },
        sourcePerformance: performance.sources,
        queryPerformance: performance.queries,
        recommendations,
        failures,
      },
    });
    await this.prisma.notification.create({
      data: {
        workspaceId,
        type: "WEEKLY_REPORT_READY",
        title: "Weekly report ready",
        message: `${qualified} qualified, ${shortlisted} shortlisted, ${replies} replies.`,
        entityType: "WeeklyReport",
        entityId: report.id,
      },
    });
    return { ...report, bestLeads };
  }

  async outreachCounts(workspaceId: string) {
    return this.prisma.outreachMessage.groupBy({
      by: ["status"],
      where: {
        workspaceId,
        status: { in: [OutreachStatus.SENT, OutreachStatus.REPLIED] },
      },
      _count: { _all: true },
    });
  }
}

function weekWindow(date: Date) {
  const weekStart = new Date(date);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}
