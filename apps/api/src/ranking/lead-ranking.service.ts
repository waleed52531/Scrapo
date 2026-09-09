import { Inject, Injectable } from "@nestjs/common";
import { EmailStatus, LeadStatus, Prisma } from "@prisma/client";
import { rankingScoreForLead, scoreRecency } from "@scrapo/shared";
import { PrismaService } from "../prisma/prisma.service";

const MIN_SOURCE_CONTACTED = 10;
const MIN_QUERY_CONTACTED = 5;

@Injectable()
export class LeadRankingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async performance(workspaceId: string) {
    const [sources, queries] = await Promise.all([
      this.sourcePerformance(workspaceId),
      this.queryPerformance(workspaceId),
    ]);
    return { sources, queries };
  }

  async sourcePerformance(workspaceId: string) {
    const sources = await this.prisma.lead.groupBy({
      by: ["primarySource"],
      where: { workspaceId },
      _count: { _all: true },
    });
    return Promise.all(
      sources.map(async (source) => {
        const where: Prisma.LeadWhereInput = {
          workspaceId,
          primarySource: source.primarySource,
        };
        const [qualified, contacted, replied, interested, meetings, won] =
          await Promise.all([
            this.prisma.lead.count({
              where: { ...where, overallScore: { gte: 82 } },
            }),
            this.prisma.outreachMessage.count({
              where: {
                workspaceId,
                lead: { primarySource: source.primarySource },
                sentAt: { not: null },
              },
            }),
            this.prisma.emailReply.count({
              where: {
                workspaceId,
                lead: { primarySource: source.primarySource },
              },
            }),
            this.prisma.lead.count({
              where: { ...where, status: LeadStatus.INTERESTED },
            }),
            this.prisma.lead.count({
              where: { ...where, status: LeadStatus.MEETING },
            }),
            this.prisma.lead.count({
              where: { ...where, status: LeadStatus.WON },
            }),
          ]);
        const rates = ratesFor({
          discovered: source._count._all,
          qualified,
          contacted,
          replied,
          interested,
          meetings,
          won,
        });
        return {
          source: source.primarySource,
          discovered: source._count._all,
          qualified,
          contacted,
          replies: replied,
          interested,
          meetings,
          won,
          ...rates,
          performanceScore:
            contacted >= MIN_SOURCE_CONTACTED ? performanceScore(rates) : 50,
          state:
            contacted < MIN_SOURCE_CONTACTED
              ? "INSUFFICIENT_DATA"
              : performanceState(performanceScore(rates)),
        };
      }),
    );
  }

  async queryPerformance(workspaceId: string) {
    const queries = await this.prisma.searchQuery.findMany({
      where: { workspaceId },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      take: 200,
    });
    return Promise.all(
      queries.map(async (query) => {
        const [qualified, contacted, replies, interested, meetings, won] =
          await Promise.all([
            this.prisma.lead.count({
              where: {
                workspaceId,
                primarySearchQueryId: query.id,
                overallScore: { gte: 82 },
              },
            }),
            this.prisma.outreachMessage.count({
              where: {
                workspaceId,
                lead: { primarySearchQueryId: query.id },
                sentAt: { not: null },
              },
            }),
            this.prisma.emailReply.count({
              where: { workspaceId, lead: { primarySearchQueryId: query.id } },
            }),
            this.prisma.lead.count({
              where: {
                workspaceId,
                primarySearchQueryId: query.id,
                status: LeadStatus.INTERESTED,
              },
            }),
            this.prisma.lead.count({
              where: {
                workspaceId,
                primarySearchQueryId: query.id,
                status: LeadStatus.MEETING,
              },
            }),
            this.prisma.lead.count({
              where: {
                workspaceId,
                primarySearchQueryId: query.id,
                status: LeadStatus.WON,
              },
            }),
          ]);
        const rates = ratesFor({
          discovered: query.resultsFound || query.totalResults,
          qualified,
          contacted,
          replied: replies,
          interested,
          meetings,
          won,
        });
        const score =
          contacted >= MIN_QUERY_CONTACTED ? performanceScore(rates) : 50;
        return {
          id: query.id,
          source: query.source,
          query: query.query,
          priority: query.priority,
          qualified,
          contacted,
          replies,
          interested,
          meetings,
          won,
          ...rates,
          performanceScore: score,
          state:
            contacted < MIN_QUERY_CONTACTED
              ? "INSUFFICIENT_DATA"
              : performanceState(score),
        };
      }),
    );
  }

  async rankLead(workspaceId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      include: {
        contact: true,
        scores: { orderBy: { createdAt: "desc" }, take: 1 },
        feedback: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!lead) return null;
    const [sourcePerformance, queryPerformance] = await Promise.all([
      this.sourcePerformance(workspaceId),
      this.queryPerformance(workspaceId),
    ]);
    const sourceScore =
      sourcePerformance.find((item) => item.source === lead.primarySource)
        ?.performanceScore ?? 50;
    const queryScore =
      queryPerformance.find((item) => item.id === lead.primarySearchQueryId)
        ?.performanceScore ?? 50;
    const feedback = manualPreference(lead.feedback.map((item) => item.rating));
    const latest = lead.scores[0];
    const ranked = rankingScoreForLead({
      overallScore: latest?.overall ?? lead.overallScore,
      contactQuality: lead.contact?.decisionMakerScore ?? 0,
      emailVerified: lead.contact?.emailStatus === EmailStatus.VERIFIED,
      sourcePerformance: sourceScore,
      queryPerformance: queryScore,
      recencyScore: scoreRecency(lead.lastSignalAt, lead.leadType),
      multiSignalConfidence: Math.min(100, 45 + lead.sourceCount * 15),
      manualPreference: feedback,
    });
    const reasons = rankReasons(lead, sourceScore, queryScore, feedback);
    await this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        rankingScore: ranked.score,
        rankBreakdown: ranked.breakdown as Prisma.InputJsonValue,
        rankReason: reasons as Prisma.InputJsonValue,
      },
    });
    return { leadId: lead.id, rankingScore: ranked.score, rankReason: reasons };
  }

  async rankWorkspaceLeads(workspaceId: string) {
    const leads = await this.prisma.lead.findMany({
      where: {
        workspaceId,
        status: {
          notIn: [
            LeadStatus.INVALID,
            LeadStatus.DO_NOT_CONTACT,
            LeadStatus.ARCHIVED,
            LeadStatus.STALE,
          ],
        },
      },
      select: { id: true },
      take: 500,
    });
    const ranked = [];
    for (const lead of leads) {
      const result = await this.rankLead(workspaceId, lead.id);
      if (result) ranked.push(result);
    }
    return ranked.sort((a, b) => b.rankingScore - a.rankingScore);
  }
}

function ratesFor(input: {
  discovered: number;
  qualified: number;
  contacted: number;
  replied: number;
  interested: number;
  meetings: number;
  won: number;
}) {
  return {
    qualifiedRate: pct(input.qualified, input.discovered),
    replyRate: pct(input.replied, input.contacted),
    interestRate: pct(input.interested, input.contacted),
    meetingRate: pct(input.meetings, input.contacted),
    winRate: pct(input.won, input.contacted),
  };
}

function performanceScore(rates: {
  qualifiedRate: number;
  replyRate: number;
  interestRate: number;
  meetingRate: number;
  winRate: number;
}) {
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        rates.qualifiedRate * 0.2 +
          rates.replyRate * 0.25 +
          rates.interestRate * 0.25 +
          rates.meetingRate * 0.2 +
          rates.winRate * 0.1,
      ),
    ),
  );
}

function performanceState(score: number) {
  if (score >= 75) return "EXCELLENT";
  if (score >= 60) return "GOOD";
  if (score >= 40) return "AVERAGE";
  return "LOW";
}

function pct(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function manualPreference(ratings: string[]) {
  if (ratings.includes("LIKE")) return 90;
  if (ratings.includes("DISLIKE")) return 20;
  return 50;
}

function rankReasons(
  lead: {
    overallScore: number;
    sourceCount: number;
    contact: { emailStatus: EmailStatus; decisionMakerScore: number } | null;
  },
  sourceScore: number,
  queryScore: number,
  manualPreferenceScore: number,
) {
  return [
    lead.overallScore >= 90 ? "Strong base lead score" : null,
    lead.contact?.emailStatus === EmailStatus.VERIFIED
      ? "Verified contact email"
      : "Contact quality reduces rank",
    (lead.contact?.decisionMakerScore ?? 0) >= 70
      ? "Decision-maker contact"
      : null,
    lead.sourceCount > 1 ? "Multiple supporting signals" : null,
    sourceScore > 60 ? "Source has positive historical performance" : null,
    queryScore > 60 ? "Search query has positive historical performance" : null,
    manualPreferenceScore > 70
      ? "Manual feedback boosted this type of lead"
      : null,
    manualPreferenceScore < 40
      ? "Manual feedback reduced this type of lead"
      : null,
  ].filter((item): item is string => Boolean(item));
}
