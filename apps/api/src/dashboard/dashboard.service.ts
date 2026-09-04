import { Inject, Injectable } from "@nestjs/common";
import {
  AnalysisStatus,
  JobStatus,
  LeadStatus,
  LeadTemperature,
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
      recentLeads,
      activeJobs,
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
    ]);
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
      sourcePerformance: [],
      recentLeads,
      recentReplies: [],
      activeJobs,
    };
  }
}
