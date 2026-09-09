import type { Job, Queue } from "bullmq";
import {
  EmailStatus,
  JobStatus,
  LeadStatus,
  OutreachApprovalStatus,
  OutreachChannel,
  OutreachStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import {
  generateDeterministicOutreach,
  nextDailyRun,
  nextWeeklyRun,
  rankingScoreForLead,
  scheduledPeriod,
  scoreRecency,
} from "@scrapo/shared";
import { processDiscoveryJob } from "../discovery/engine.js";
import { processOutreachJob } from "../outreach/engine.js";

type AutomationJobData = {
  workspaceId?: string;
  automationRunId?: string;
  outreachId?: string;
  systemJobId?: string;
};

type RuleConfig = Record<string, unknown>;

const DEFAULT_TIMEZONE = process.env.DEFAULT_WORKSPACE_TIMEZONE ?? "UTC";

export async function processAutomationJob(
  prisma: PrismaClient,
  job: Job<AutomationJobData>,
  queue: Queue,
) {
  if (job.name === "AUTOMATION_SCHEDULER_TICK") {
    return scheduleDueAutomationRuns(prisma, queue);
  }
  if (job.name === "AUTOMATION_RUN") {
    if (!job.data.automationRunId)
      throw new Error("automationRunId is required.");
    return runAutomation(prisma, queue, job.data.automationRunId);
  }
  if (job.name === "AUTO_SEND_OUTREACH") {
    if (!job.data.workspaceId || !job.data.outreachId) {
      throw new Error("workspaceId and outreachId are required.");
    }
    return autoSendOutreach(prisma, job.data.workspaceId, job.data.outreachId);
  }
  throw new Error(`Unsupported automation job: ${job.name}`);
}

async function scheduleDueAutomationRuns(prisma: PrismaClient, queue: Queue) {
  const now = new Date();
  const rules = await prisma.automationRule.findMany({
    where: { enabled: true, nextRunAt: { lte: now } },
    orderBy: { nextRunAt: "asc" },
    take: 50,
  });
  let scheduled = 0;
  let skipped = 0;
  for (const rule of rules) {
    const settings = await settingsFor(prisma, rule.workspaceId);
    const scheduledFor = rule.nextRunAt ?? now;
    const nextRunAt = nextRunFor(
      rule.type,
      record(rule.configuration),
      rule.timezone,
      new Date(scheduledFor.getTime() + 60_000),
    );
    await prisma.automationRule.update({
      where: { id: rule.id },
      data: { nextRunAt },
    });
    if (settings.automationKillSwitch || settings.automationPaused) {
      await prisma.automationRun.create({
        data: {
          workspaceId: rule.workspaceId,
          automationRuleId: rule.id,
          scheduledFor,
          scheduledPeriod: `${periodFor(rule.type, scheduledFor, rule.timezone)}-skipped-${Date.now()}`,
          status: "SKIPPED",
          summary: {
            reason: settings.automationKillSwitch
              ? "Automation kill switch is enabled."
              : "Automation is paused.",
          },
        },
      });
      await prisma.automationRule.update({
        where: { id: rule.id },
        data: { lastRunAt: now, lastRunStatus: "SKIPPED", lastError: null },
      });
      skipped += 1;
      continue;
    }
    const scheduledPeriodValue = periodFor(
      rule.type,
      scheduledFor,
      rule.timezone,
    );
    const existing = await prisma.automationRun.findUnique({
      where: {
        workspaceId_automationRuleId_scheduledPeriod: {
          workspaceId: rule.workspaceId,
          automationRuleId: rule.id,
          scheduledPeriod: scheduledPeriodValue,
        },
      },
    });
    if (existing) continue;
    const run = await prisma.automationRun.create({
      data: {
        workspaceId: rule.workspaceId,
        automationRuleId: rule.id,
        scheduledFor,
        scheduledPeriod: scheduledPeriodValue,
        status: "SCHEDULED",
      },
    });
    const queueJob = await queue.add(
      "AUTOMATION_RUN",
      { workspaceId: rule.workspaceId, automationRunId: run.id },
      { attempts: 1, removeOnComplete: 100, removeOnFail: 100 },
    );
    const systemJobId = await systemJobFor(
      prisma,
      rule.workspaceId,
      "AUTOMATION_RUN",
      queueJob.id ?? null,
      { automationRunId: run.id },
    );
    await prisma.automationRun.update({
      where: { id: run.id },
      data: { jobId: systemJobId },
    });
    scheduled += 1;
  }
  return { scheduled, skipped, checkedAt: now.toISOString() };
}

async function runAutomation(
  prisma: PrismaClient,
  queue: Queue,
  automationRunId: string,
) {
  const run = await prisma.automationRun.findUnique({
    where: { id: automationRunId },
    include: { automationRule: true },
  });
  if (!run) throw new Error(`Automation run ${automationRunId} was not found.`);
  if (!["SCHEDULED", "FAILED"].includes(run.status)) {
    return { automationRunId: run.id, status: run.status, skipped: true };
  }
  const settings = await settingsFor(prisma, run.workspaceId);
  if (settings.automationKillSwitch || settings.automationPaused) {
    return finishRun(prisma, run.id, run.automationRuleId, "SKIPPED", {
      reason: settings.automationKillSwitch
        ? "Automation kill switch is enabled."
        : "Automation is paused.",
    });
  }
  await prisma.automationRun.update({
    where: { id: run.id },
    data: { status: "RUNNING", startedAt: new Date(), error: null },
  });
  try {
    const configuration = record(run.automationRule.configuration);
    const summary =
      run.automationRule.type === "WEEKLY_LEAD_HUNT"
        ? await weeklyLeadHunt(prisma, queue, run.workspaceId, configuration)
        : run.automationRule.type === "GMAIL_REPLY_SYNC"
          ? await gmailReplySync(prisma, run.workspaceId)
          : run.automationRule.type === "FOLLOW_UP_SCAN"
            ? await followUpScan(prisma, run.workspaceId)
            : run.automationRule.type === "WEEKLY_REPORT"
              ? await weeklyReport(prisma, run.workspaceId)
              : await analyticsRefresh(prisma, run.workspaceId);
    await advanceRule(
      prisma,
      run.automationRule.id,
      run.automationRule.type,
      configuration,
      run.automationRule.timezone,
      "COMPLETED",
    );
    return finishRun(
      prisma,
      run.id,
      run.automationRuleId,
      "COMPLETED",
      summary,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown automation failure";
    await prisma.notification.create({
      data: {
        workspaceId: run.workspaceId,
        type:
          run.automationRule.type === "WEEKLY_LEAD_HUNT"
            ? "LEAD_HUNT_FAILED"
            : "AUTOMATION_FAILED",
        title: `${run.automationRule.name} failed`,
        message,
        entityType: "AutomationRun",
        entityId: run.id,
      },
    });
    await advanceRule(
      prisma,
      run.automationRule.id,
      run.automationRule.type,
      record(run.automationRule.configuration),
      run.automationRule.timezone,
      "FAILED",
      message,
    );
    await prisma.automationRun.update({
      where: { id: run.id },
      data: { status: "FAILED", completedAt: new Date(), error: message },
    });
    throw error;
  }
}

async function weeklyLeadHunt(
  prisma: PrismaClient,
  queue: Queue,
  workspaceId: string,
  config: RuleConfig,
) {
  const systemJobId = await systemJobFor(
    prisma,
    workspaceId,
    "LEAD_HUNT",
    null,
    {
      automation: true,
    },
  );
  const run = await prisma.discoveryRun.create({
    data: {
      workspaceId,
      systemJobId,
      name: `Automated weekly lead hunt ${new Date().toISOString().slice(0, 10)}`,
      sources: stringArray(config.sources, [
        "WEB",
        "X",
      ]) as Prisma.InputJsonValue,
      countries: stringArray(config.countries, [
        "United Kingdom",
        "United Arab Emirates",
        "United States",
      ]) as Prisma.InputJsonValue,
      categories: stringArray(config.categories, [
        "WEB_AGENCY",
        "FLUTTER_REQUIREMENT",
      ]) as Prisma.InputJsonValue,
      maxQueries: numberValue(config.maxQueries, 8),
      maxDiscoveries: numberValue(config.maxRawDiscoveries, 300),
      minimumScore: numberValue(config.minimumScore, 82),
      shortlistLimit: numberValue(config.shortlistLimit, 20),
    },
  });
  await processDiscoveryJob(prisma, {
    id: "automation-lead-hunt",
    name: "LEAD_HUNT",
    data: { workspaceId, systemJobId, leadHuntId: run.id },
  } as Job);
  const ranked = await rankWorkspaceLeads(prisma, workspaceId);
  const shortlist = await latestShortlistForRun(prisma, workspaceId, run.id);
  const shortlistSummary = shortlist
    ? await rerankShortlist(prisma, shortlist.id)
    : { shortlistId: null, itemCount: 0 };
  const drafts = await generateDraftsForShortlist(
    prisma,
    workspaceId,
    shortlistSummary.shortlistId,
    Boolean(config.autoGenerateOutreachDrafts ?? true),
  );
  const autoSends = await scheduleAutoSends(prisma, queue, workspaceId);
  await prisma.notification.create({
    data: {
      workspaceId,
      type: "WEEKLY_SHORTLIST_READY",
      title: "Weekly shortlist ready",
      message: `${shortlistSummary.itemCount} ranked leads are ready to review.`,
      entityType: "Shortlist",
      entityId: shortlistSummary.shortlistId,
    },
  });
  return {
    leadHuntId: run.id,
    shortlistId: shortlistSummary.shortlistId,
    ranked: ranked.length,
    shortlistItems: shortlistSummary.itemCount,
    draftsGenerated: drafts.generated,
    autoSendsScheduled: autoSends.scheduled,
  };
}

async function gmailReplySync(prisma: PrismaClient, workspaceId: string) {
  const before = new Date();
  const systemJobId = await systemJobFor(
    prisma,
    workspaceId,
    "SYNC_GMAIL",
    null,
    {
      automation: true,
    },
  );
  const result = await processOutreachJob(prisma, {
    id: "automation-gmail-sync",
    name: "SYNC_GMAIL",
    data: { workspaceId, systemJobId },
  } as Job);
  const importantReplies = await prisma.emailReply.findMany({
    where: {
      workspaceId,
      createdAt: { gte: before },
      classification: {
        in: [
          "INTERESTED",
          "MEETING_REQUESTED",
          "PORTFOLIO_REQUEST",
          "PRICING_REQUEST",
        ],
      },
    },
    take: 25,
  });
  for (const reply of importantReplies) {
    const type =
      reply.classification === "MEETING_REQUESTED"
        ? "MEETING_REQUESTED"
        : reply.classification === "PORTFOLIO_REQUEST"
          ? "PORTFOLIO_REQUEST"
          : reply.classification === "PRICING_REQUEST"
            ? "PRICING_REQUEST"
            : "INTERESTED_REPLY";
    await prisma.notification.create({
      data: {
        workspaceId,
        type,
        title: "Important reply received",
        message:
          reply.summary ?? `Reply classified as ${reply.classification}.`,
        entityType: "EmailReply",
        entityId: reply.id,
      },
    });
  }
  return { ...objectResult(result), importantReplies: importantReplies.length };
}

async function followUpScan(prisma: PrismaClient, workspaceId: string) {
  const systemJobId = await systemJobFor(
    prisma,
    workspaceId,
    "GENERATE_FOLLOW_UP",
    null,
    { automation: true },
  );
  const result = await processOutreachJob(prisma, {
    id: "automation-follow-up-scan",
    name: "GENERATE_FOLLOW_UP",
    data: { workspaceId, systemJobId },
  } as Job);
  return objectResult(result);
}

async function analyticsRefresh(prisma: PrismaClient, workspaceId: string) {
  const [ranked, stale, reactivated, recommendations] = await Promise.all([
    rankWorkspaceLeads(prisma, workspaceId),
    markStaleLeads(prisma, workspaceId),
    reactivateLeads(prisma, workspaceId),
    generateRecommendations(prisma, workspaceId),
  ]);
  return {
    ranked: ranked.length,
    staleMarked: stale.count,
    reactivated: reactivated.count,
    recommendationsCreated: recommendations.length,
  };
}

async function weeklyReport(prisma: PrismaClient, workspaceId: string) {
  const report = await generateWeeklyReport(prisma, workspaceId);
  return { weeklyReportId: report.id, weekStart: report.weekStart };
}

async function rankWorkspaceLeads(prisma: PrismaClient, workspaceId: string) {
  const performance = await performanceFor(prisma, workspaceId);
  const leads = await prisma.lead.findMany({
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
    include: { contact: true, signals: { take: 5 } },
    take: 500,
  });
  const ranked = [];
  for (const lead of leads) {
    const sourcePerformance =
      performance.sources.find((item) => item.source === lead.primarySource)
        ?.performanceScore ?? 50;
    const queryPerformance =
      performance.queries.find((item) => item.id === lead.primarySearchQueryId)
        ?.performanceScore ?? 50;
    const manualPreference = await manualPreferenceFor(
      prisma,
      workspaceId,
      lead.id,
    );
    const result = rankingScoreForLead({
      overallScore: lead.overallScore,
      contactQuality: contactQuality(lead.contact),
      emailVerified: lead.contact?.emailStatus === EmailStatus.VERIFIED,
      sourcePerformance,
      queryPerformance,
      recencyScore: scoreRecency(
        lead.publishedAt ?? lead.lastSignalAt,
        lead.leadType,
      ),
      multiSignalConfidence: Math.min(
        100,
        45 + lead.sourceCount * 15 + lead.signals.length * 5,
      ),
      manualPreference,
    });
    const reasons = rankReasons(
      lead.overallScore,
      result.score,
      lead.contact?.emailStatus,
      sourcePerformance,
      queryPerformance,
      manualPreference,
    );
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        rankingScore: result.score,
        rankReason: reasons as Prisma.InputJsonValue,
        rankBreakdown: result.breakdown as Prisma.InputJsonValue,
      },
    });
    ranked.push({
      leadId: lead.id,
      rankingScore: result.score,
      rankReason: reasons,
    });
  }
  return ranked.sort((a, b) => b.rankingScore - a.rankingScore);
}

async function rerankShortlist(prisma: PrismaClient, shortlistId: string) {
  const items = await prisma.shortlistItem.findMany({
    where: { shortlistId },
    include: { lead: true },
  });
  const sorted = items.sort(
    (a, b) =>
      (b.lead.rankingScore || b.lead.overallScore) -
      (a.lead.rankingScore || a.lead.overallScore),
  );
  for (const [index, item] of sorted.entries()) {
    await prisma.shortlistItem.update({
      where: { id: item.id },
      data: {
        rank: index + 1,
        rankingScore: item.lead.rankingScore,
        rankReason: item.lead.rankReason as Prisma.InputJsonValue,
      },
    });
  }
  return { shortlistId, itemCount: sorted.length };
}

async function generateDraftsForShortlist(
  prisma: PrismaClient,
  workspaceId: string,
  shortlistId: string | null,
  enabled: boolean,
) {
  if (!enabled || !shortlistId) return { generated: 0 };
  const settings = await settingsFor(prisma, workspaceId);
  if (!settings.autoGenerateOutreachDrafts || settings.outreachPaused) {
    return { generated: 0 };
  }
  const items = await prisma.shortlistItem.findMany({
    where: { shortlistId },
    include: {
      lead: {
        include: { company: true, contact: true, signals: { take: 1 } },
      },
    },
    orderBy: { rank: "asc" },
    take: 30,
  });
  let generated = 0;
  for (const item of items) {
    const lead = item.lead;
    if (!lead.contactId || lead.recommendedChannel !== "EMAIL") continue;
    const existing = await prisma.outreachMessage.findFirst({
      where: {
        workspaceId,
        leadId: lead.id,
        messageType: "INITIAL",
        status: { notIn: [OutreachStatus.CANCELLED, OutreachStatus.FAILED] },
      },
    });
    if (existing) continue;
    const draft = generateDeterministicOutreach({
      developerProfile: record(settings.profile),
      signature: settings.emailSignature,
      lead: {
        title: lead.title,
        leadType: lead.leadType,
        primarySource: lead.primarySource,
        overallScore: lead.overallScore,
        opportunitySummary: lead.opportunitySummary,
        sourceContent: lead.sourceContent,
        recommendedPitch: lead.recommendedPitch,
      },
      contact: lead.contact,
      company: {
        name: lead.company?.name,
        country: lead.company?.country,
        city: lead.company?.city,
        description: lead.company?.description,
        services: arrayValue(lead.company?.services),
        technologies: arrayValue(lead.company?.technologies),
        hasMobileService: lead.company?.hasMobileService,
        hasFlutterService: lead.company?.hasFlutterService,
        partnershipFitScore: lead.company?.partnershipFitScore,
        companyAnalysisSummary: lead.company?.companyAnalysisSummary,
      },
      originalSignal: lead.signals[0]
        ? {
            content: lead.signals[0].content,
            source: lead.signals[0].source,
            sourceUrl: lead.signals[0].sourceUrl,
          }
        : null,
    });
    await prisma.outreachMessage.create({
      data: {
        workspaceId,
        leadId: lead.id,
        contactId: lead.contactId,
        channel: OutreachChannel.EMAIL,
        strategy: draft.strategy,
        messageType: "INITIAL",
        subject: draft.subject,
        body: withFooter(draft.body, settings.optOutFooter),
        originalGeneratedSubject: draft.subject,
        originalGeneratedBody: draft.body,
        personalizationPoints:
          draft.personalizationPoints as Prisma.InputJsonValue,
        confidence: draft.confidence,
        approvalStatus: OutreachApprovalStatus.PENDING,
        status: OutreachStatus.GENERATED,
        generatedByModel: "deterministic-phase-6",
        promptVersion: "automation-draft-v1",
        idempotencyKey: `automation-initial-${lead.id}`,
        generatedAt: new Date(),
      },
    });
    await prisma.lead.updateMany({
      where: { id: lead.id, workspaceId },
      data: { status: LeadStatus.DRAFTED },
    });
    generated += 1;
  }
  return { generated };
}

async function scheduleAutoSends(
  prisma: PrismaClient,
  queue: Queue,
  workspaceId: string,
) {
  const settings = await settingsFor(prisma, workspaceId);
  if (
    !settings.autoSendEnabled ||
    settings.outreachPaused ||
    settings.automationKillSwitch
  ) {
    return { scheduled: 0 };
  }
  const sentToday = await prisma.outreachMessage.count({
    where: {
      workspaceId,
      sentAt: { gte: startOfDay(new Date()) },
      status: {
        in: [
          OutreachStatus.SENT,
          OutreachStatus.DELIVERED,
          OutreachStatus.REPLIED,
        ],
      },
    },
  });
  const remaining = Math.max(0, settings.autoSendDailyLimit - sentToday);
  if (remaining === 0) return { scheduled: 0 };
  const messages = await prisma.outreachMessage.findMany({
    where: {
      workspaceId,
      status: OutreachStatus.GENERATED,
      lead: {
        rankingScore: { gte: settings.autoSendMinimumScore },
        overallScore: { gte: settings.autoSendMinimumScore },
        contact: { emailStatus: EmailStatus.VERIFIED },
      },
    },
    orderBy: [{ lead: { rankingScore: "desc" } }, { createdAt: "asc" }],
    take: remaining,
  });
  let scheduled = 0;
  for (const message of messages) {
    await queue.add(
      "AUTO_SEND_OUTREACH",
      { workspaceId, outreachId: message.id },
      {
        delay: delayUntilBusinessHours(settings),
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
    await prisma.outreachMessage.update({
      where: { id: message.id },
      data: {
        status: OutreachStatus.APPROVED,
        approvalStatus: OutreachApprovalStatus.NOT_REQUIRED,
        approvedAt: new Date(),
      },
    });
    scheduled += 1;
  }
  return { scheduled };
}

async function autoSendOutreach(
  prisma: PrismaClient,
  workspaceId: string,
  outreachId: string,
) {
  const settings = await settingsFor(prisma, workspaceId);
  if (
    !settings.autoSendEnabled ||
    settings.outreachPaused ||
    settings.automationKillSwitch
  ) {
    return {
      outreachId,
      skipped: true,
      reason: "Auto-send is disabled or paused.",
    };
  }
  const message = await prisma.outreachMessage.findFirst({
    where: { id: outreachId, workspaceId },
    include: { lead: { include: { contact: true } } },
  });
  if (!message || message.status !== OutreachStatus.APPROVED) {
    return {
      outreachId,
      skipped: true,
      reason: "Message is no longer eligible.",
    };
  }
  if (
    message.lead.rankingScore < settings.autoSendMinimumScore ||
    message.lead.overallScore < settings.autoSendMinimumScore ||
    message.lead.contact?.emailStatus !== EmailStatus.VERIFIED
  ) {
    await prisma.outreachMessage.update({
      where: { id: message.id },
      data: { status: OutreachStatus.GENERATED },
    });
    return {
      outreachId,
      skipped: true,
      reason: "Lead fell below auto-send threshold.",
    };
  }
  const sentToday = await prisma.outreachMessage.count({
    where: {
      workspaceId,
      sentAt: { gte: startOfDay(new Date()) },
      status: {
        in: [
          OutreachStatus.SENT,
          OutreachStatus.DELIVERED,
          OutreachStatus.REPLIED,
        ],
      },
    },
  });
  if (sentToday >= settings.autoSendDailyLimit) {
    return {
      outreachId,
      skipped: true,
      reason: "Daily auto-send limit reached.",
    };
  }
  const sentAt = new Date();
  const updated = await prisma.outreachMessage.update({
    where: { id: message.id },
    data: {
      status: OutreachStatus.SENT,
      sentAt,
      gmailMessageId:
        message.gmailMessageId ?? `mock-auto-message-${message.id}`,
      gmailThreadId: message.gmailThreadId ?? `mock-auto-thread-${message.id}`,
    },
  });
  await prisma.lead.updateMany({
    where: { id: message.leadId, workspaceId },
    data: { status: LeadStatus.CONTACTED },
  });
  await prisma.activity.create({
    data: {
      workspaceId,
      leadId: message.leadId,
      type: "AUTO_OUTREACH_SENT",
      description:
        "Automation sent a verified high-ranking lead email within limits.",
    },
  });
  return { outreachId: updated.id, status: updated.status, sentAt };
}

async function markStaleLeads(prisma: PrismaClient, workspaceId: string) {
  const settings = await settingsFor(prisma, workspaceId);
  const ttls = record(settings.staleLeadTtls);
  const cutoff = new Date(
    Date.now() - numberValue(ttls.defaultDays, 30) * 86_400_000,
  );
  return prisma.lead.updateMany({
    where: {
      workspaceId,
      status: {
        in: [
          LeadStatus.NEW,
          LeadStatus.QUALIFIED,
          LeadStatus.SHORTLISTED,
          LeadStatus.DRAFTED,
        ],
      },
      lastSignalAt: { lt: cutoff },
    },
    data: { status: LeadStatus.STALE, staleAt: new Date() },
  });
}

async function reactivateLeads(prisma: PrismaClient, workspaceId: string) {
  return prisma.lead.updateMany({
    where: {
      workspaceId,
      status: LeadStatus.STALE,
      staleAt: { not: null },
      lastSignalAt: { gt: prisma.lead.fields.staleAt },
    },
    data: {
      status: LeadStatus.QUALIFIED,
      reactivatedAt: new Date(),
      staleAt: null,
    },
  });
}

async function generateRecommendations(
  prisma: PrismaClient,
  workspaceId: string,
) {
  const performance = await performanceFor(prisma, workspaceId);
  const created = [];
  for (const query of performance.queries) {
    if (query.state === "EXCELLENT") {
      created.push(
        await createRecommendationOnce(
          prisma,
          workspaceId,
          "QUERY_PRIORITY_INCREASE",
          `Increase priority: ${query.query}`,
          `${query.replyRate}% reply rate across ${query.contacted} contacted leads.`,
          query,
        ),
      );
    }
    if (query.state === "LOW") {
      created.push(
        await createRecommendationOnce(
          prisma,
          workspaceId,
          "QUERY_PRIORITY_DECREASE",
          `Reduce priority: ${query.query}`,
          `${query.qualified} qualified and ${query.replies} replies from this query.`,
          query,
        ),
      );
    }
  }
  for (const source of performance.sources) {
    if (source.state === "EXCELLENT") {
      created.push(
        await createRecommendationOnce(
          prisma,
          workspaceId,
          "SOURCE_PRIORITY_INCREASE",
          `Increase ${source.source} discovery share`,
          `${source.meetings} meetings from ${source.contacted} contacted leads.`,
          source,
        ),
      );
    }
    if (source.state === "LOW") {
      created.push(
        await createRecommendationOnce(
          prisma,
          workspaceId,
          "SOURCE_PRIORITY_DECREASE",
          `Reduce ${source.source} discovery share`,
          `${source.averageScore}/100 average score and ${source.replies} replies from ${source.source}.`,
          source,
        ),
      );
    }
  }
  return created;
}

async function generateWeeklyReport(prisma: PrismaClient, workspaceId: string) {
  const { weekStart, weekEnd } = weekWindow(new Date());
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
  ] = await Promise.all([
    prisma.lead.count({
      where: { workspaceId, createdAt: { gte: weekStart, lte: weekEnd } },
    }),
    prisma.lead.count({
      where: {
        workspaceId,
        overallScore: { gte: 82 },
        createdAt: { gte: weekStart, lte: weekEnd },
      },
    }),
    prisma.shortlistItem.count({
      where: {
        shortlist: { workspaceId, weekStart: { gte: weekStart, lte: weekEnd } },
      },
    }),
    prisma.outreachMessage.count({
      where: { workspaceId, sentAt: { gte: weekStart, lte: weekEnd } },
    }),
    prisma.emailReply.count({
      where: { workspaceId, receivedAt: { gte: weekStart, lte: weekEnd } },
    }),
    prisma.lead.count({
      where: { workspaceId, status: LeadStatus.INTERESTED },
    }),
    prisma.lead.count({ where: { workspaceId, status: LeadStatus.MEETING } }),
    prisma.lead.count({ where: { workspaceId, status: LeadStatus.WON } }),
    prisma.systemJob.findMany({
      where: {
        workspaceId,
        status: JobStatus.FAILED,
        createdAt: { gte: weekStart, lte: weekEnd },
      },
      select: { type: true, error: true, createdAt: true },
      take: 20,
    }),
    performanceFor(prisma, workspaceId),
    prisma.optimizationRecommendation.findMany({
      where: { workspaceId, createdAt: { gte: weekStart, lte: weekEnd } },
      take: 20,
    }),
  ]);
  const report = await prisma.weeklyReport.upsert({
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
      } as Prisma.InputJsonValue,
      sourcePerformance: performance.sources as Prisma.InputJsonValue,
      queryPerformance: performance.queries as Prisma.InputJsonValue,
      recommendations: recommendations as Prisma.InputJsonValue,
      failures: failures as Prisma.InputJsonValue,
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
      } as Prisma.InputJsonValue,
      sourcePerformance: performance.sources as Prisma.InputJsonValue,
      queryPerformance: performance.queries as Prisma.InputJsonValue,
      recommendations: recommendations as Prisma.InputJsonValue,
      failures: failures as Prisma.InputJsonValue,
    },
  });
  await prisma.notification.create({
    data: {
      workspaceId,
      type: "WEEKLY_REPORT_READY",
      title: "Weekly report ready",
      message: `${qualified} qualified, ${shortlisted} shortlisted, ${replies} replies.`,
      entityType: "WeeklyReport",
      entityId: report.id,
    },
  });
  return report;
}

async function performanceFor(prisma: PrismaClient, workspaceId: string) {
  const [sourceGroups, queryGroups, queries] = await Promise.all([
    prisma.lead.groupBy({
      by: ["primarySource"],
      where: { workspaceId },
      _count: { _all: true },
      _avg: { overallScore: true },
    }),
    prisma.lead.groupBy({
      by: ["primarySearchQueryId"],
      where: { workspaceId, primarySearchQueryId: { not: null } },
      _count: { _all: true },
      _avg: { overallScore: true },
    }),
    prisma.searchQuery.findMany({ where: { workspaceId } }),
  ]);
  const sources = [];
  for (const source of sourceGroups) {
    const [contacted, replies, meetings] = await Promise.all([
      prisma.lead.count({
        where: {
          workspaceId,
          primarySource: source.primarySource,
          status: {
            in: [
              LeadStatus.CONTACTED,
              LeadStatus.REPLIED,
              LeadStatus.INTERESTED,
              LeadStatus.MEETING,
              LeadStatus.WON,
            ],
          },
        },
      }),
      prisma.emailReply.count({
        where: { workspaceId, lead: { primarySource: source.primarySource } },
      }),
      prisma.lead.count({
        where: {
          workspaceId,
          primarySource: source.primarySource,
          status: { in: [LeadStatus.MEETING, LeadStatus.WON] },
        },
      }),
    ]);
    const replyRate =
      contacted < 10
        ? null
        : Math.round((replies / Math.max(1, contacted)) * 1000) / 10;
    const performanceScore =
      contacted < 10
        ? 50
        : Math.min(
            100,
            Math.round(
              (source._avg.overallScore ?? 0) * 0.6 + (replyRate ?? 0) * 0.4,
            ),
          );
    sources.push({
      source: source.primarySource,
      total: source._count._all,
      averageScore: Math.round(source._avg.overallScore ?? 0),
      contacted,
      replies,
      meetings,
      replyRate,
      performanceScore,
      state:
        contacted < 10
          ? "INSUFFICIENT_DATA"
          : performanceScore >= 78
            ? "EXCELLENT"
            : performanceScore <= 45
              ? "LOW"
              : "NORMAL",
    });
  }
  const queryMap = new Map(queries.map((query) => [query.id, query]));
  const queryStats = [];
  for (const query of queryGroups) {
    if (!query.primarySearchQueryId) continue;
    const item = queryMap.get(query.primarySearchQueryId);
    const [contacted, replies] = await Promise.all([
      prisma.lead.count({
        where: {
          workspaceId,
          primarySearchQueryId: query.primarySearchQueryId,
          status: {
            in: [
              LeadStatus.CONTACTED,
              LeadStatus.REPLIED,
              LeadStatus.INTERESTED,
              LeadStatus.MEETING,
              LeadStatus.WON,
            ],
          },
        },
      }),
      prisma.emailReply.count({
        where: {
          workspaceId,
          lead: { primarySearchQueryId: query.primarySearchQueryId },
        },
      }),
    ]);
    const replyRate =
      contacted < 5
        ? null
        : Math.round((replies / Math.max(1, contacted)) * 1000) / 10;
    const qualified = await prisma.lead.count({
      where: {
        workspaceId,
        primarySearchQueryId: query.primarySearchQueryId,
        overallScore: { gte: 82 },
      },
    });
    const performanceScore =
      contacted < 5
        ? 50
        : Math.min(
            100,
            Math.round(
              (query._avg.overallScore ?? 0) * 0.65 + (replyRate ?? 0) * 0.35,
            ),
          );
    queryStats.push({
      id: query.primarySearchQueryId,
      query: item?.query ?? "Unknown query",
      source: item?.source ?? "OTHER",
      total: query._count._all,
      qualified,
      contacted,
      replies,
      replyRate,
      performanceScore,
      state:
        contacted < 5
          ? "INSUFFICIENT_DATA"
          : performanceScore >= 78
            ? "EXCELLENT"
            : performanceScore <= 45
              ? "LOW"
              : "NORMAL",
    });
  }
  return { sources, queries: queryStats };
}

async function createRecommendationOnce(
  prisma: PrismaClient,
  workspaceId: string,
  type: string,
  title: string,
  description: string,
  evidence: Record<string, unknown>,
) {
  const existing = await prisma.optimizationRecommendation.findFirst({
    where: { workspaceId, type, title, status: "NEW" },
  });
  if (existing) return existing;
  return prisma.optimizationRecommendation.create({
    data: {
      workspaceId,
      type,
      title,
      description,
      evidence: evidence as Prisma.InputJsonValue,
    },
  });
}

async function latestShortlistForRun(
  prisma: PrismaClient,
  workspaceId: string,
  discoveryRunId: string,
) {
  return prisma.shortlist.findFirst({
    where: { workspaceId, discoveryRunId },
    orderBy: { createdAt: "desc" },
  });
}

async function manualPreferenceFor(
  prisma: PrismaClient,
  workspaceId: string,
  leadId: string,
) {
  const feedback = await prisma.leadFeedback.findMany({
    where: { workspaceId, leadId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  if (feedback.length === 0) return 50;
  const total = feedback.reduce((sum, item) => {
    if (item.rating === "LIKE") return sum + 100;
    if (item.rating === "DISLIKE") return sum + 0;
    return sum + 50;
  }, 0);
  return Math.round(total / feedback.length);
}

async function finishRun(
  prisma: PrismaClient,
  id: string,
  automationRuleId: string,
  status: "COMPLETED" | "FAILED" | "SKIPPED" | "PARTIAL",
  summary: Record<string, unknown>,
) {
  const completedAt = new Date();
  await prisma.automationRule.update({
    where: { id: automationRuleId },
    data: {
      lastRunAt: completedAt,
      lastRunStatus: status,
      lastError: status === "FAILED" ? String(summary.error ?? "Failed") : null,
    },
  });
  return prisma.automationRun.update({
    where: { id },
    data: {
      status,
      completedAt,
      summary: summary as Prisma.InputJsonValue,
      error: status === "FAILED" ? String(summary.error ?? "Failed") : null,
    },
  });
}

async function advanceRule(
  prisma: PrismaClient,
  id: string,
  type: string,
  config: RuleConfig,
  timezone: string,
  status: string,
  error?: string,
) {
  await prisma.automationRule.update({
    where: { id },
    data: {
      nextRunAt: nextRunFor(type, config, timezone, new Date()),
      lastRunStatus: status,
      lastError: error ?? null,
    },
  });
}

async function systemJobFor(
  prisma: PrismaClient,
  workspaceId: string,
  type: string,
  queueJobId: string | null,
  metadata: Record<string, unknown>,
) {
  const job = await prisma.systemJob.create({
    data: {
      workspaceId,
      type,
      status: "QUEUED",
      queueJobId,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
  return job.id;
}

async function settingsFor(prisma: PrismaClient, workspaceId: string) {
  return prisma.userSettings.upsert({
    where: { workspaceId },
    update: {},
    create: {
      workspaceId,
      timezone: DEFAULT_TIMEZONE,
      profile: {} as Prisma.InputJsonValue,
      targeting: {} as Prisma.InputJsonValue,
      scoring: {} as Prisma.InputJsonValue,
      discovery: {} as Prisma.InputJsonValue,
    },
  });
}

function nextRunFor(
  type: string,
  config: RuleConfig,
  timezone: string,
  from = new Date(),
) {
  if (type === "GMAIL_REPLY_SYNC") {
    return new Date(
      from.getTime() +
        numberValue(
          config.intervalMinutes,
          Number(process.env.GMAIL_SYNC_INTERVAL_MINUTES ?? 30),
        ) *
          60_000,
    );
  }
  if (type === "FOLLOW_UP_SCAN" || type === "ANALYTICS_REFRESH") {
    return nextDailyRun({
      time: String(config.time ?? "09:00"),
      timezone,
      from,
    });
  }
  return nextWeeklyRun({
    dayOfWeek: numberValue(config.dayOfWeek, type === "WEEKLY_REPORT" ? 5 : 1),
    time: String(config.time ?? (type === "WEEKLY_REPORT" ? "17:00" : "08:00")),
    timezone,
    from,
  });
}

function periodFor(ruleType: string, scheduledFor: Date, timezone: string) {
  if (ruleType === "GMAIL_REPLY_SYNC") {
    return `${scheduledPeriod(scheduledFor, timezone)}-${scheduledFor.getUTCHours()}-${Math.floor(scheduledFor.getUTCMinutes() / 30)}`;
  }
  return scheduledPeriod(scheduledFor, timezone);
}

function rankReasons(
  leadScore: number,
  rankingScore: number,
  emailStatus: EmailStatus | null | undefined,
  sourcePerformance: number,
  queryPerformance: number,
  manualPreference: number,
) {
  const reasons = [`Ranked ${rankingScore}/100 from lead score ${leadScore}.`];
  if (emailStatus === EmailStatus.VERIFIED)
    reasons.push("Verified contact email.");
  if (sourcePerformance >= 75) reasons.push("Strong source performance.");
  if (queryPerformance >= 75) reasons.push("Strong search query performance.");
  if (manualPreference > 60)
    reasons.push("Manual feedback boosted similar leads.");
  if (manualPreference < 40) reasons.push("Manual feedback reduced priority.");
  return reasons;
}

function contactQuality(
  contact: { email?: string | null; role?: string | null } | null,
) {
  if (!contact) return 10;
  let score = contact.email ? 45 : 15;
  const role = contact.role?.toLowerCase() ?? "";
  if (
    ["founder", "owner", "ceo", "director", "partner"].some((value) =>
      role.includes(value),
    )
  ) {
    score += 25;
  }
  return Math.min(100, score);
}

function delayUntilBusinessHours(settings: {
  outreachBusinessHoursStart: string;
  outreachBusinessHoursEnd: string;
  outreachBusinessDays: Prisma.JsonValue;
}) {
  const now = new Date();
  const days = arrayValue(settings.outreachBusinessDays);
  const currentDay = now.getDay();
  const [startHour = 9, startMinute = 0] = settings.outreachBusinessHoursStart
    .split(":")
    .map(Number);
  const [endHour = 17, endMinute = 0] = settings.outreachBusinessHoursEnd
    .split(":")
    .map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  if (
    days.includes(currentDay) &&
    currentMinutes >= startMinutes &&
    currentMinutes <= endMinutes
  ) {
    return 0;
  }
  const next = new Date(now);
  for (let offset = 0; offset < 8; offset += 1) {
    next.setDate(now.getDate() + offset);
    if (!days.includes(next.getDay())) continue;
    next.setHours(startHour, startMinute, 0, 0);
    if (next.getTime() > now.getTime()) return next.getTime() - now.getTime();
  }
  return 86_400_000;
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

function startOfDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function withFooter(body: string, footer: string | null) {
  return [body, footer?.trim()].filter(Boolean).join("\n\n");
}

function objectResult(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : { result: value };
}

function record(value: unknown): RuleConfig {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RuleConfig)
    : {};
}

function stringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : fallback;
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
