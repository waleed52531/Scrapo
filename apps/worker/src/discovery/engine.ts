import type { Job } from "bullmq";
import {
  EmailStatus,
  type JobStatus,
  type LeadType,
  LeadSource,
  type OpportunityUrgency,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import {
  DEFAULT_AGENCY_SEARCH_QUERIES,
  DEFAULT_SOCIAL_SEARCH_QUERIES,
  calculateLeadScore,
  classifySocialOpportunity,
  normalizeCompanyName,
  normalizeDomain,
  scoreCountryPriority,
  scoreRecency,
  scoreSocialRecency,
  type SocialPlatform,
} from "@scrapo/shared";

type DiscoveryJobData = {
  workspaceId: string;
  systemJobId?: string;
  leadHuntId?: string;
  companyId?: string;
  contactId?: string;
  platform?: SocialPlatform;
  content?: string;
  title?: string;
  sourceUrl?: string;
  profileUrl?: string;
  username?: string;
  displayName?: string;
  externalId?: string;
};

type MockResult = {
  title: string;
  url: string;
  description: string;
  domain: string;
  companyName: string;
  country: string;
  city?: string;
  category:
    "agency" | "directory" | "tutorial" | "job_board" | "large_mobile_shop";
};

const provider = process.env.WEB_SEARCH_API_KEY
  ? (process.env.WEB_SEARCH_PROVIDER ?? "web-search")
  : "mock";

const socialProviderBySource = {
  X: process.env.X_BEARER_TOKEN ? "x-api" : "mock",
  REDDIT:
    process.env.REDDIT_ENABLED === "true" && process.env.REDDIT_CLIENT_ID
      ? "reddit-api"
      : "approval-required",
  TELEGRAM:
    process.env.TELEGRAM_ENABLED === "true" && process.env.TELEGRAM_BOT_TOKEN
      ? "telegram-bot"
      : "mock-configured-sources",
} as const;

export async function processDiscoveryJob(
  prisma: PrismaClient,
  job: Job<DiscoveryJobData>,
) {
  if (job.name === "LEAD_HUNT") return processLeadHuntJob(prisma, job);
  if (job.name === "IMPORT_SOCIAL_SIGNAL")
    return processManualSocialImport(prisma, job);
  if (job.name === "FIND_CONTACTS") return processFindContactsJob(prisma, job);
  if (job.name === "VERIFY_EMAIL") return processVerifyEmailJob(prisma, job);
  throw new Error(`Unsupported discovery job: ${job.name}`);
}

async function processLeadHuntJob(
  prisma: PrismaClient,
  job: Job<DiscoveryJobData>,
) {
  const { workspaceId, systemJobId, leadHuntId } = job.data;
  if (!workspaceId || !leadHuntId)
    throw new Error("workspaceId and leadHuntId are required.");

  const run = await prisma.discoveryRun.findFirst({
    where: { id: leadHuntId, workspaceId },
  });
  if (!run) throw new Error(`Discovery run ${leadHuntId} was not found.`);
  if (run.status === "CANCELLED") return { cancelled: true };

  await markJob(prisma, workspaceId, systemJobId, "RUNNING", 5);
  await prisma.discoveryRun.update({
    where: { id: run.id },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  const queries = await selectQueries(prisma, workspaceId, run);
  const maxDiscoveries = Math.min(
    run.maxDiscoveries,
    Number(process.env.MAX_COMPANIES_PER_RUN ?? run.maxDiscoveries),
  );
  const minimumScore = run.minimumScore;

  let rawResults = 0;
  let relevantResults = 0;
  let duplicatesRemoved = 0;
  let contactsFound = 0;
  let emailsVerified = 0;
  let leadsScored = 0;
  const leadIds = new Set<string>();
  const companyIds = new Set<string>();
  const errors: string[] = [];

  for (const [queryIndex, query] of queries.entries()) {
    await ensureNotCancelled(prisma, workspaceId, run.id);
    const queryRun = await prisma.discoveryQueryRun.create({
      data: {
        workspaceId,
        leadHuntId: run.id,
        searchQueryId: query.id,
        query: query.query,
        country: query.country,
        category: query.category,
        provider:
          query.source === LeadSource.WEB
            ? provider
            : socialProviderBySource[query.source as SocialPlatform],
        status: "RUNNING",
        startedAt: new Date(),
      },
    });
    if (query.source !== LeadSource.WEB) {
      const socialResult = await processSocialQuery(
        prisma,
        workspaceId,
        run.id,
        queryRun.id,
        query,
        maxDiscoveries,
        minimumScore,
      );
      rawResults += socialResult.rawResults;
      relevantResults += socialResult.relevantResults;
      duplicatesRemoved += socialResult.duplicatesRemoved;
      contactsFound += socialResult.contactsFound;
      emailsVerified += socialResult.emailsVerified;
      leadsScored += socialResult.leadsScored;
      socialResult.companyIds.forEach((id) => companyIds.add(id));
      socialResult.leadIds.forEach((id) => leadIds.add(id));
      await markJob(
        prisma,
        workspaceId,
        systemJobId,
        "RUNNING",
        Math.min(95, 10 + Math.round(((queryIndex + 1) / queries.length) * 75)),
      );
      continue;
    }
    const results = mockWebSearch(
      query.query,
      query.country ?? undefined,
    ).slice(0, Number(process.env.MAX_SEARCH_RESULTS_PER_QUERY ?? 20));
    rawResults += results.length;
    let queryUnique = 0;
    let queryShortlisted = 0;

    for (const [resultIndex, result] of results.entries()) {
      if (companyIds.size >= maxDiscoveries) break;
      const rawLead = await prisma.rawLead.create({
        data: {
          workspaceId,
          source: LeadSource.WEB,
          searchQueryId: query.id,
          discoveryRunId: run.id,
          externalId: `${run.id}:${queryRun.id}:${resultIndex}:${result.domain}`,
          sourceUrl: result.url,
          title: result.title,
          description: result.description,
          domain: result.domain,
          content: `${result.title}\n${result.description}`,
          rawPayload: result,
          processingStatus: "DISCOVERED",
        },
      });

      const rejectionReason = rejectionReasonFor(result);
      if (rejectionReason) {
        await prisma.rawLead.update({
          where: { id: rawLead.id },
          data: { processingStatus: "REJECTED", rejectionReason },
        });
        continue;
      }

      relevantResults += 1;

      const existingCompany = await prisma.company.findFirst({
        where: {
          workspaceId,
          OR: [
            { domain: result.domain },
            { normalizedName: normalizeCompanyName(result.companyName) },
          ],
        },
      });

      if (existingCompany) duplicatesRemoved += 1;
      const company = await upsertCompany(
        prisma,
        workspaceId,
        result,
        existingCompany?.id,
      );
      companyIds.add(company.id);
      if (!existingCompany) queryUnique += 1;

      const lead = await upsertLead(
        prisma,
        workspaceId,
        run.id,
        query.id,
        rawLead.id,
        company.id,
        result,
      );
      leadIds.add(lead.id);

      await prisma.rawLead.update({
        where: { id: rawLead.id },
        data: { processingStatus: "COMPANY_CREATED" },
      });

      const contacts = await enrichCompanyContacts(
        prisma,
        workspaceId,
        company.id,
      );
      contactsFound += contacts.created;

      const primaryContact = contacts.primaryContactId
        ? await prisma.contact.findUnique({
            where: { id: contacts.primaryContactId },
          })
        : null;
      if (primaryContact?.email) {
        const verification = await verifyContactEmail(
          prisma,
          workspaceId,
          primaryContact.id,
        );
        emailsVerified += verification.verified ? 1 : 0;
        await prisma.lead.update({
          where: { id: lead.id },
          data: { contactId: primaryContact.id },
        });
      }

      const scored = await scoreLead(
        prisma,
        workspaceId,
        lead.id,
        company.id,
        primaryContact?.id,
        result,
      );
      leadsScored += 1;
      if (scored.overall >= minimumScore) queryShortlisted += 1;
    }

    await prisma.discoveryQueryRun.update({
      where: { id: queryRun.id },
      data: {
        status: "COMPLETED",
        resultsFound: results.length,
        uniqueCompanies: queryUnique,
        qualifiedCompanies: queryShortlisted,
        shortlistedCompanies: queryShortlisted,
        completedAt: new Date(),
      },
    });
    await prisma.searchQuery.update({
      where: { id: query.id },
      data: {
        lastRun: new Date(),
        lastRunAt: new Date(),
        lastResultCount: results.length,
        totalResults: { increment: results.length },
        resultsFound: { increment: results.length },
        uniqueCompanies: { increment: queryUnique },
        qualifiedResults: { increment: queryShortlisted },
        shortlisted: { increment: queryShortlisted },
        qualityScore: Math.min(
          100,
          Math.round((queryShortlisted / Math.max(1, results.length)) * 100),
        ),
        lowPerformance: queryShortlisted === 0,
      },
    });
    await markJob(
      prisma,
      workspaceId,
      systemJobId,
      "RUNNING",
      Math.min(95, 10 + Math.round(((queryIndex + 1) / queries.length) * 75)),
    );
  }

  const shortlist = await createShortlist(
    prisma,
    workspaceId,
    run.id,
    minimumScore,
    run.shortlistLimit,
  );
  const shortlisted = shortlist.itemCount;
  const qualified = await prisma.lead.count({
    where: {
      workspaceId,
      discoveryRunId: run.id,
      overallScore: { gte: minimumScore },
    },
  });

  await prisma.discoveryRun.update({
    where: { id: run.id },
    data: {
      status: errors.length > 0 ? "PARTIAL" : "COMPLETED",
      rawResults,
      relevantResults,
      uniqueCompanies: companyIds.size,
      duplicatesRemoved,
      companiesAnalyzed: companyIds.size,
      contactsFound,
      emailsVerified,
      leadsScored,
      qualified,
      shortlisted,
      errors,
      completedAt: new Date(),
    },
  });
  await markJob(
    prisma,
    workspaceId,
    systemJobId,
    errors.length ? "PARTIAL" : "COMPLETED",
    100,
    {
      recordsDiscovered: rawResults,
      recordsProcessed: leadsScored,
      recordsQualified: qualified,
      recordsRejected: rawResults - relevantResults,
      recordsFailed: errors.length,
    },
  );
  return {
    runId: run.id,
    rawResults,
    uniqueCompanies: companyIds.size,
    shortlisted,
  };
}

async function processFindContactsJob(
  prisma: PrismaClient,
  job: Job<DiscoveryJobData>,
) {
  const { workspaceId, companyId, systemJobId } = job.data;
  if (!workspaceId || !companyId)
    throw new Error("workspaceId and companyId are required.");
  await markJob(prisma, workspaceId, systemJobId, "RUNNING", 25);
  const result = await enrichCompanyContacts(prisma, workspaceId, companyId);
  await markJob(prisma, workspaceId, systemJobId, "COMPLETED", 100, {
    recordsProcessed: 1,
    recordsQualified: result.created,
  });
  return result;
}

async function processVerifyEmailJob(
  prisma: PrismaClient,
  job: Job<DiscoveryJobData>,
) {
  const { workspaceId, contactId, systemJobId } = job.data;
  if (!workspaceId || !contactId)
    throw new Error("workspaceId and contactId are required.");
  await markJob(prisma, workspaceId, systemJobId, "RUNNING", 25);
  const result = await verifyContactEmail(prisma, workspaceId, contactId);
  await markJob(prisma, workspaceId, systemJobId, "COMPLETED", 100, {
    recordsProcessed: 1,
    recordsQualified: result.verified ? 1 : 0,
  });
  return result;
}

async function processManualSocialImport(
  prisma: PrismaClient,
  job: Job<DiscoveryJobData>,
) {
  const {
    workspaceId,
    systemJobId,
    platform = "REDDIT",
    content,
    title,
    sourceUrl,
    profileUrl,
    username,
    displayName,
    externalId,
  } = job.data;
  if (!workspaceId || !content) {
    throw new Error("workspaceId and content are required.");
  }
  await markJob(prisma, workspaceId, systemJobId, "RUNNING", 25);
  const result = await processSocialRawLead(
    prisma,
    workspaceId,
    undefined,
    undefined,
    {
      source: platform,
      externalId:
        externalId ??
        `manual:${platform}:${Buffer.from(content).toString("base64url").slice(0, 36)}`,
      title,
      content,
      sourceUrl,
      profileUrl,
      username,
      displayName,
      publishedAt: new Date(),
      engagement: {},
      metadata: { manual: true },
    },
  );
  await markJob(prisma, workspaceId, systemJobId, "COMPLETED", 100, {
    recordsDiscovered: 1,
    recordsProcessed: result.scored ? 1 : 0,
    recordsQualified: result.qualified ? 1 : 0,
    recordsRejected: result.rejected ? 1 : 0,
  });
  return result;
}

type SocialRawLead = {
  source: SocialPlatform;
  externalId: string;
  authorExternalId?: string;
  username?: string;
  displayName?: string;
  profileUrl?: string;
  sourceUrl?: string;
  title?: string;
  content: string;
  publishedAt?: Date;
  engagement?: Record<string, number>;
  companyName?: string;
  companyDomain?: string;
  metadata?: Record<string, unknown>;
};

async function processSocialQuery(
  prisma: PrismaClient,
  workspaceId: string,
  discoveryRunId: string,
  queryRunId: string,
  query: {
    id: string;
    source: LeadSource;
    query: string;
    category: string | null;
  },
  maxDiscoveries: number,
  minimumScore: number,
) {
  const source = query.source as SocialPlatform;
  if (source === "REDDIT" && process.env.REDDIT_ENABLED !== "true") {
    await prisma.discoveryQueryRun.update({
      where: { id: queryRunId },
      data: {
        status: "CANCELLED",
        error: "Reddit discovery requires compliant API access.",
        completedAt: new Date(),
      },
    });
    return emptySocialQueryResult();
  }

  let rawPosts: SocialRawLead[];
  try {
    rawPosts =
      source === "TELEGRAM"
        ? await telegramMessagesForQuery(prisma, workspaceId, query.query)
        : source === "X"
          ? await xPostsForQuery(query.query)
          : mockSocialSearch(source, query.query);
  } catch (error) {
    await prisma.discoveryQueryRun.update({
      where: { id: queryRunId },
      data: {
        status: "FAILED",
        error:
          error instanceof Error ? error.message : "Social discovery failed.",
        completedAt: new Date(),
      },
    });
    return emptySocialQueryResult();
  }
  const limited = rawPosts.slice(
    0,
    source === "X"
      ? Number(process.env.MAX_X_RESULTS_PER_QUERY ?? 20)
      : source === "REDDIT"
        ? Number(process.env.MAX_REDDIT_RESULTS_PER_QUERY ?? 20)
        : Number(process.env.MAX_TELEGRAM_MESSAGES_PER_SYNC ?? 50),
  );

  let relevantResults = 0;
  let duplicatesRemoved = 0;
  let prequalifiedResults = 0;
  let enrichedResults = 0;
  let scoredResults = 0;
  let qualifiedResults = 0;
  let manualActions = 0;
  const leadIds = new Set<string>();
  const companyIds = new Set<string>();

  for (const raw of limited) {
    if (companyIds.size >= maxDiscoveries) break;
    const result = await processSocialRawLead(
      prisma,
      workspaceId,
      discoveryRunId,
      query.id,
      raw,
      minimumScore,
    );
    if (result.duplicate) duplicatesRemoved += 1;
    if (result.relevant) relevantResults += 1;
    if (result.prequalified) prequalifiedResults += 1;
    if (result.enriched) enrichedResults += 1;
    if (result.scored) scoredResults += 1;
    if (result.qualified) qualifiedResults += 1;
    if (result.manualAction) manualActions += 1;
    if (result.leadId) leadIds.add(result.leadId);
    if (result.companyId) companyIds.add(result.companyId);
  }

  await prisma.discoveryQueryRun.update({
    where: { id: queryRunId },
    data: {
      status: "COMPLETED",
      resultsFound: limited.length,
      relevantResults,
      duplicateResults: duplicatesRemoved,
      prequalifiedResults,
      enrichedResults,
      scoredResults,
      manualActions,
      uniqueCompanies: companyIds.size,
      qualifiedCompanies: qualifiedResults,
      shortlistedCompanies: qualifiedResults,
      completedAt: new Date(),
    },
  });
  await prisma.searchQuery.update({
    where: { id: query.id },
    data: {
      lastRun: new Date(),
      lastRunAt: new Date(),
      lastResultCount: limited.length,
      totalResults: { increment: limited.length },
      resultsFound: { increment: limited.length },
      relevantResults: { increment: relevantResults },
      prequalifiedResults: { increment: prequalifiedResults },
      uniqueCompanies: { increment: companyIds.size },
      qualifiedResults: { increment: qualifiedResults },
      shortlisted: { increment: qualifiedResults },
      manualActions: { increment: manualActions },
      qualityScore: Math.min(
        100,
        Math.round((qualifiedResults / Math.max(1, limited.length)) * 100),
      ),
      lowPerformance: qualifiedResults === 0,
    },
  });
  return {
    rawResults: limited.length,
    relevantResults,
    duplicatesRemoved,
    contactsFound: enrichedResults,
    emailsVerified: 0,
    leadsScored: scoredResults,
    leadIds,
    companyIds,
  };
}

async function processSocialRawLead(
  prisma: PrismaClient,
  workspaceId: string,
  discoveryRunId: string | undefined,
  searchQueryId: string | undefined,
  raw: SocialRawLead,
  minimumScore = 82,
) {
  const classification = classifySocialOpportunity(
    `${raw.title ?? ""}\n${raw.content}`,
    raw.source,
    raw.publishedAt ?? new Date(),
  );
  const existingRaw = await prisma.rawLead.findUnique({
    where: {
      workspaceId_source_externalId: {
        workspaceId,
        source: raw.source,
        externalId: raw.externalId,
      },
    },
  });
  if (existingRaw?.processingStatus === "PROCESSED") {
    return { duplicate: true, relevant: false, rejected: false };
  }
  const rawLead = await prisma.rawLead.upsert({
    where: {
      workspaceId_source_externalId: {
        workspaceId,
        source: raw.source,
        externalId: raw.externalId,
      },
    },
    update: {
      searchQueryId,
      discoveryRunId,
      title: raw.title,
      sourceUrl: raw.sourceUrl,
      profileUrl: raw.profileUrl,
      authorExternalId: raw.authorExternalId,
      username: raw.username,
      displayName: raw.displayName,
      author: raw.displayName ?? raw.username,
      content: raw.content,
      rawPayload: (raw.metadata ?? {}) as Prisma.InputJsonValue,
      engagement: (raw.engagement ?? {}) as Prisma.InputJsonValue,
      processingStatus: classification.valid ? "FILTERING" : "REJECTED",
      rejectionReason: classification.invalidReason,
      publishedAt: raw.publishedAt,
    },
    create: {
      workspaceId,
      source: raw.source,
      searchQueryId,
      discoveryRunId,
      externalId: raw.externalId,
      sourceUrl: raw.sourceUrl,
      profileUrl: raw.profileUrl,
      title: raw.title,
      description: raw.content.slice(0, 240),
      authorExternalId: raw.authorExternalId,
      username: raw.username,
      displayName: raw.displayName,
      author: raw.displayName ?? raw.username,
      content: raw.content,
      rawPayload: (raw.metadata ?? {}) as Prisma.InputJsonValue,
      engagement: (raw.engagement ?? {}) as Prisma.InputJsonValue,
      processingStatus: classification.valid ? "FILTERING" : "REJECTED",
      rejectionReason: classification.invalidReason,
      publishedAt: raw.publishedAt,
    },
  });

  if (!classification.valid) {
    return { relevant: false, rejected: true, rawLeadId: rawLead.id };
  }

  const threshold = Number(process.env.SOCIAL_PREQUALIFICATION_THRESHOLD ?? 55);
  if (classification.socialPreQualificationScore < threshold) {
    await prisma.rawLead.update({
      where: { id: rawLead.id },
      data: {
        processingStatus: "REJECTED",
        rejectionReason: "INSUFFICIENT_INFORMATION",
      },
    });
    return {
      relevant: true,
      prequalified: false,
      rejected: true,
      rawLeadId: rawLead.id,
    };
  }

  const company = await linkSocialCompany(prisma, workspaceId, raw);
  const contact = await linkSocialContact(
    prisma,
    workspaceId,
    company?.id,
    raw,
    classification,
  );
  const existingLead = company
    ? await prisma.lead.findFirst({
        where: {
          workspaceId,
          companyId: company.id,
          status: { not: "INVALID" },
        },
        orderBy: { overallScore: "desc" },
      })
    : null;
  const lead =
    existingLead ??
    (await prisma.lead.create({
      data: {
        workspaceId,
        companyId: company?.id,
        contactId: contact?.id,
        primarySearchQueryId: searchQueryId,
        discoveryRunId,
        primarySource: raw.source,
        leadType: classification.leadType as LeadType,
        title:
          raw.title ??
          `${raw.displayName ?? raw.username ?? raw.source} social opportunity`,
        opportunitySummary: raw.content,
        recommendedPitch: classification.suggestedText,
        sourceUrl: raw.sourceUrl,
        sourceContent: raw.content,
        publishedAt: raw.publishedAt,
        analysisStatus: "COMPLETED",
        analysisConfidence: classification.signalQualityScore,
        analysisSummary: classification.explanation,
        socialPreQualificationScore: classification.socialPreQualificationScore,
        opportunityUrgency: classification.urgency as OpportunityUrgency,
        buyerIntentScore: classification.buyerIntentScore,
        selfPromotionProbability: classification.selfPromotionProbability,
        socialSpamProbability: classification.spamProbability,
        evidence: socialEvidence(raw, classification),
        aiInterpretation: {
          classifier: "deterministic-phase-4",
          classification,
        },
        outreachRecommendation:
          classification.leadType === "MVP_STARTUP"
            ? "MVP_STARTUP"
            : classification.leadType === "EXISTING_APP_FIX"
              ? "EXISTING_APP_FIX"
              : classification.leadType === "FIREBASE_API_SUPPORT"
                ? "FIREBASE_API_SUPPORT"
                : classification.leadType === "APP_STORE_SUPPORT"
                  ? "APP_STORE_SUPPORT"
                  : "ACTIVE_REQUIREMENT",
        recommendedChannel: classification.recommendedChannel,
        status: "QUALIFIED",
        lastSignalAt: raw.publishedAt ?? new Date(),
      },
    }));

  const signal = await prisma.leadSignal.create({
    data: {
      workspaceId,
      leadId: lead.id,
      rawLeadId: rawLead.id,
      searchQueryId,
      discoveryRunId,
      source: raw.source,
      signalType: "SOCIAL_BUYER_SIGNAL",
      content: raw.content,
      sourceUrl: raw.sourceUrl,
      profileUrl: raw.profileUrl,
      authorExternalId: raw.authorExternalId,
      username: raw.username,
      displayName: raw.displayName,
      authorType: classification.authorType,
      authorTypeConfidence: classification.authorTypeConfidence,
      opportunityUrgency: classification.urgency as OpportunityUrgency,
      signalQualityScore: classification.signalQualityScore,
      socialPreQualificationScore: classification.socialPreQualificationScore,
      signalScore: classification.signalQualityScore,
      publishedAt: raw.publishedAt,
      metadata: {
        engagement: raw.engagement ?? {},
        companyDomain: raw.companyDomain,
        companyName: raw.companyName,
      },
    },
  });

  const sourceCount = await prisma.leadSignal.groupBy({
    by: ["source"],
    where: { workspaceId, leadId: lead.id },
  });
  const score = await scoreSocialLead(
    prisma,
    workspaceId,
    lead.id,
    company?.id,
    contact?.id,
    classification,
    sourceCount.length,
  );
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      contactId: contact?.id ?? lead.contactId,
      primarySignalId: signal.id,
      primarySource:
        lead.primarySource === LeadSource.WEB ? LeadSource.WEB : raw.source,
      discoveryRunId: discoveryRunId ?? lead.discoveryRunId,
      sourceCount: sourceCount.length,
      overallScore: score.overall,
      temperature: score.temperature,
      status: score.overall >= minimumScore ? "QUALIFIED" : "NEW",
      lastSignalAt: raw.publishedAt ?? new Date(),
      evidence: socialEvidence(raw, classification),
    },
  });
  await prisma.rawLead.update({
    where: { id: rawLead.id },
    data: { processingStatus: "PROCESSED" },
  });

  const action =
    score.overall >= minimumScore
      ? await createSocialAction(
          prisma,
          workspaceId,
          lead.id,
          contact?.id,
          raw,
          classification,
        )
      : null;

  return {
    relevant: true,
    prequalified: true,
    enriched: Boolean(contact),
    scored: true,
    qualified: score.overall >= minimumScore,
    manualAction: Boolean(action),
    leadId: lead.id,
    companyId: company?.id,
    rawLeadId: rawLead.id,
    signalId: signal.id,
  };
}

async function linkSocialCompany(
  prisma: PrismaClient,
  workspaceId: string,
  raw: SocialRawLead,
) {
  if (!raw.companyDomain && !raw.companyName) return null;
  const domain = raw.companyDomain ? normalizeDomain(raw.companyDomain) : null;
  const name =
    raw.companyName ??
    raw.displayName ??
    raw.username ??
    "Unknown social company";
  const existing = await prisma.company.findFirst({
    where: {
      workspaceId,
      OR: [
        ...(domain ? [{ domain }] : []),
        { normalizedName: normalizeCompanyName(name) },
      ],
    },
  });
  if (existing) {
    return prisma.company.update({
      where: { id: existing.id },
      data: {
        discoveryCount: { increment: 1 },
        lastDiscoveredAt: new Date(),
        duplicateConfidence: domain ? 95 : 60,
      },
    });
  }
  if (!domain) return null;
  return prisma.company.create({
    data: {
      workspaceId,
      name,
      normalizedName: normalizeCompanyName(name),
      domain,
      website: `https://${domain}`,
      description: `Social profile/post linked ${name} to a mobile-development opportunity.`,
      companyType: "SOCIAL_IDENTIFIED",
      services: [],
      technologies: [],
      industries: [],
      companyQualityScore: 65,
      partnershipFitScore: 60,
      analysisStatus: "COMPLETED",
      companyAnalysisConfidence: 55,
      companyAnalysisSummary:
        "Company inferred from social evidence. Manual review recommended before outreach.",
      discoveryCount: 1,
      lastDiscoveredAt: new Date(),
    },
  });
}

async function linkSocialContact(
  prisma: PrismaClient,
  workspaceId: string,
  companyId: string | undefined,
  raw: SocialRawLead,
  classification: ReturnType<typeof classifySocialOpportunity>,
) {
  const profileWhere = raw.authorExternalId
    ? {
        workspaceId_platform_externalId: {
          workspaceId,
          platform: raw.source,
          externalId: raw.authorExternalId,
        },
      }
    : null;
  if (profileWhere) {
    const existingProfile = await prisma.socialProfile.findUnique({
      where: profileWhere,
      include: { contact: true },
    });
    if (existingProfile?.contact) return existingProfile.contact;
  }
  const fullName =
    raw.displayName ??
    (raw.username ? `@${raw.username}` : `${raw.source} social author`);
  let contact = await prisma.contact.findFirst({
    where: {
      workspaceId,
      OR: [
        ...(companyId ? [{ companyId, fullName }] : []),
        ...(raw.profileUrl ? [{ profileUrl: raw.profileUrl }] : []),
      ],
    },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        workspaceId,
        companyId,
        fullName,
        role: readableAuthorType(classification.authorType),
        source: raw.source,
        profileUrl: raw.profileUrl,
        xUrl: raw.source === "X" ? raw.profileUrl : undefined,
        redditUsername: raw.source === "REDDIT" ? raw.username : undefined,
        telegramUsername: raw.source === "TELEGRAM" ? raw.username : undefined,
        decisionMakerScore: classification.authorTypeConfidence,
        contactConfidence: raw.authorExternalId ? 78 : 55,
      },
    });
  }
  if (profileWhere) {
    await prisma.socialProfile.upsert({
      where: profileWhere,
      update: {
        contactId: contact.id,
        username: raw.username,
        displayName: raw.displayName,
        profileUrl: raw.profileUrl,
        authorType: classification.authorType,
        authorTypeConfidence: classification.authorTypeConfidence,
        metadata: (raw.metadata ?? {}) as Prisma.InputJsonValue,
      },
      create: {
        workspaceId,
        contactId: contact.id,
        platform: raw.source,
        externalId: raw.authorExternalId,
        username: raw.username,
        displayName: raw.displayName,
        profileUrl: raw.profileUrl,
        authorType: classification.authorType,
        authorTypeConfidence: classification.authorTypeConfidence,
        metadata: (raw.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
  return contact;
}

async function scoreSocialLead(
  prisma: PrismaClient,
  workspaceId: string,
  leadId: string,
  companyId: string | undefined,
  contactId: string | undefined,
  classification: ReturnType<typeof classifySocialOpportunity>,
  sourceCount: number,
) {
  const company = companyId
    ? await prisma.company.findUnique({ where: { id: companyId } })
    : null;
  const contact = contactId
    ? await prisma.contact.findUnique({ where: { id: contactId } })
    : null;
  const multiSignalBoost = Math.min(8, Math.max(0, sourceCount - 1) * 4);
  const factors = {
    buyingIntent: Math.min(
      100,
      classification.buyerIntentScore + multiSignalBoost,
    ),
    mobileRelevance: classification.mobileRelevanceScore,
    agencyFit: company?.partnershipFitScore ?? 60,
    decisionMakerQuality:
      contact?.decisionMakerScore ?? classification.authorTypeConfidence,
    contactability: contact?.email ? 75 : contact?.profileUrl ? 52 : 35,
    recency: scoreSocialRecency(new Date()),
    companyQuality: company?.companyQualityScore ?? 55,
    countryPriority: scoreCountryPriority(company?.country),
    spamProbability: classification.spamProbability,
    competitorProbability: 0,
  };
  const calculation = calculateLeadScore(factors);
  return prisma.leadScore.create({
    data: {
      workspaceId,
      leadId,
      buyingIntent: factors.buyingIntent,
      mobileRelevance: factors.mobileRelevance,
      agencyFit: factors.agencyFit,
      decisionMakerQuality: factors.decisionMakerQuality,
      contactability: factors.contactability,
      recency: factors.recency,
      companyQuality: factors.companyQuality,
      countryPriority: factors.countryPriority,
      spamProbability: factors.spamProbability,
      competitorProbability: factors.competitorProbability,
      baseScore: calculation.baseScore,
      penalty: calculation.penalty,
      overall: calculation.overallScore,
      temperature: calculation.temperature,
      reason: classification.explanation,
      recommendedChannel: classification.recommendedChannel,
      recommendedPitch: classification.suggestedText,
      confidence: classification.signalQualityScore,
      explanation: JSON.stringify(calculation.breakdown),
      promptVersion: "phase-4-social-deterministic-v1",
    },
  });
}

async function createSocialAction(
  prisma: PrismaClient,
  workspaceId: string,
  leadId: string,
  contactId: string | undefined,
  raw: SocialRawLead,
  classification: ReturnType<typeof classifySocialOpportunity>,
) {
  const existing = await prisma.actionItem.findFirst({
    where: {
      workspaceId,
      leadId,
      platform: raw.source,
      sourceUrl: raw.sourceUrl,
      actionType: classification.recommendedChannel,
      status: "PENDING",
    },
  });
  if (existing) return null;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);
  return prisma.actionItem.create({
    data: {
      workspaceId,
      leadId,
      contactId,
      platform: raw.source,
      actionType: classification.recommendedChannel,
      type: classification.recommendedChannel,
      title: `${classification.recommendedChannel.replaceAll("_", " ")} for social lead`,
      content: classification.suggestedText,
      suggestedText: classification.suggestedText,
      sourceUrl: raw.sourceUrl,
      profileUrl: raw.profileUrl,
      dueAt: new Date(),
      expiresAt,
      status: "PENDING",
    },
  });
}

async function selectQueries(
  prisma: PrismaClient,
  workspaceId: string,
  run: {
    maxQueries: number;
    countries: unknown;
    categories: unknown;
    sources: unknown;
  },
) {
  for (const item of DEFAULT_AGENCY_SEARCH_QUERIES) {
    await prisma.searchQuery.upsert({
      where: {
        workspaceId_source_query: {
          workspaceId,
          source: LeadSource.WEB,
          query: item.query,
        },
      },
      update: {
        country: item.country,
        category: item.category,
        priority: item.priority,
      },
      create: {
        workspaceId,
        source: LeadSource.WEB,
        query: item.query,
        country: item.country,
        category: item.category,
        priority: item.priority,
      },
    });
  }
  for (const item of DEFAULT_SOCIAL_SEARCH_QUERIES) {
    await prisma.searchQuery.upsert({
      where: {
        workspaceId_source_query: {
          workspaceId,
          source: item.source as LeadSource,
          query: item.query,
        },
      },
      update: {
        category: item.category,
        priority: item.priority,
      },
      create: {
        workspaceId,
        source: item.source as LeadSource,
        query: item.query,
        category: item.category,
        priority: item.priority,
      },
    });
  }
  const countries = Array.isArray(run.countries)
    ? run.countries.map(String)
    : [];
  const categories = Array.isArray(run.categories)
    ? run.categories.map(String)
    : [];
  const requestedSources = Array.isArray(run.sources)
    ? run.sources.map(String)
    : [];
  const sources = requestedSources.length ? requestedSources : [LeadSource.WEB];
  const maxQueries = Math.min(
    run.maxQueries,
    Number(process.env.MAX_QUERIES_PER_RUN ?? run.maxQueries),
  );
  return prisma.searchQuery.findMany({
    where: {
      workspaceId,
      source: { in: sources as LeadSource[] },
      enabled: true,
      ...(countries.length ? { country: { in: countries } } : {}),
      ...(categories.length ? { category: { in: categories } } : {}),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: maxQueries,
  });
}

async function upsertCompany(
  prisma: PrismaClient,
  workspaceId: string,
  result: MockResult,
  companyId?: string,
) {
  const data = {
    name: result.companyName,
    normalizedName: normalizeCompanyName(result.companyName),
    domain: result.domain,
    website: `https://${result.domain}`,
    description: result.description,
    country: result.country,
    city: result.city,
    companyType: "Agency",
    agencyType:
      result.category === "large_mobile_shop"
        ? "Mobile agency"
        : "Web/Digital agency",
    services: ["Web development", "SaaS", "Backend", "Mobile app delivery"],
    technologies: ["React", "Node.js", "Flutter", "Firebase"],
    hasWebService: true,
    hasBackendService: true,
    hasMobileService:
      result.category !== "agency"
        ? true
        : result.description.toLowerCase().includes("mobile"),
    hasFlutterService: result.description.toLowerCase().includes("flutter"),
    hasAndroidService: true,
    hasIosService: true,
    mobileCapabilityConfidence:
      result.category === "large_mobile_shop" ? 95 : 70,
    companyQualityScore: result.category === "large_mobile_shop" ? 78 : 84,
    partnershipFitScore: result.category === "large_mobile_shop" ? 58 : 88,
    companyAnalysisConfidence: 78,
    companyAnalysisSummary:
      "Phase 3 mock analysis found a web/software agency with likely mobile outsourcing or partnership opportunity.",
    analysisStatus: "COMPLETED" as const,
    analyzedAt: new Date(),
    lastAnalyzedAt: new Date(),
    discoveryCount: { increment: 1 },
    lastDiscoveredAt: new Date(),
    duplicateConfidence: companyId ? 95 : 0,
    preQualificationScore: result.category === "large_mobile_shop" ? 74 : 88,
    mobileOutsourcingOpportunityConfidence:
      result.category === "large_mobile_shop" ? 45 : 82,
    enrichmentStatus: "READY",
  };
  if (companyId) {
    return prisma.company.update({
      where: { id: companyId },
      data,
    });
  }
  return prisma.company.create({
    data: { workspaceId, ...data, discoveryCount: 1 },
  });
}

async function upsertLead(
  prisma: PrismaClient,
  workspaceId: string,
  discoveryRunId: string,
  searchQueryId: string,
  rawLeadId: string,
  companyId: string,
  result: MockResult,
) {
  const existing = await prisma.lead.findFirst({
    where: {
      workspaceId,
      companyId,
      primarySource: LeadSource.WEB,
      leadType: "AGENCY_PARTNER",
    },
  });
  const leadData = {
    primarySearchQueryId: searchQueryId,
    discoveryRunId,
    primarySource: LeadSource.WEB,
    leadType: "AGENCY_PARTNER" as const,
    title: `${result.companyName} agency partnership opportunity`,
    opportunitySummary:
      "Discovered agency appears to sell web/software delivery and may need a trusted mobile/Flutter delivery partner.",
    recommendedPitch:
      "Offer a white-label Flutter/mobile delivery partnership for overflow client work.",
    sourceUrl: result.url,
    sourceContent: result.description,
    analysisStatus: "COMPLETED" as const,
    analysisConfidence: 80,
    analysisSummary:
      "Agency website/search result suggests a partnership-fit prospect.",
    evidence: {
      querySource: "web_search",
      mentionsMobile: result.description.toLowerCase().includes("mobile"),
      provider,
    },
    outreachRecommendation: "AGENCY_PARTNERSHIP" as const,
    recommendedChannel: "EMAIL" as const,
    lastSignalAt: new Date(),
  };
  const lead = existing
    ? await prisma.lead.update({
        where: { id: existing.id },
        data: leadData,
      })
    : await prisma.lead.create({
        data: { workspaceId, companyId, ...leadData },
      });
  await prisma.leadSignal.create({
    data: {
      workspaceId,
      leadId: lead.id,
      rawLeadId,
      searchQueryId,
      discoveryRunId,
      source: LeadSource.WEB,
      signalType: "AGENCY_DISCOVERY",
      content: result.description,
      sourceUrl: result.url,
      signalScore: result.category === "agency" ? 85 : 68,
    },
  });
  return lead;
}

async function enrichCompanyContacts(
  prisma: PrismaClient,
  workspaceId: string,
  companyId: string,
) {
  const company = await prisma.company.findFirst({
    where: { id: companyId, workspaceId },
  });
  if (!company) throw new Error(`Company ${companyId} not found.`);
  const local = (
    (company.domain ?? "example.com").split(".").at(0) ?? "example"
  ).replace(/[^a-z]/gi, "");
  const email = `hello@${company.domain ?? "example.com"}`.toLowerCase();
  const fullName = `${company.name.split(" ").at(0) ?? company.name} Partnerships`;
  let contact = await prisma.contact.findFirst({
    where: { workspaceId, OR: [{ email }, { companyId, fullName }] },
  });
  let created = 0;
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        workspaceId,
        companyId,
        fullName,
        role: "Founder / Partnerships",
        email,
        emailStatus: EmailStatus.UNVERIFIED,
        emailSource: "mock-public-website",
        source: "MOCK_ENRICHMENT",
        decisionMakerScore: 82,
        contactConfidence: local.length > 4 ? 74 : 60,
      },
    });
    created = 1;
  }
  await prisma.contactEnrichmentRecord.create({
    data: {
      workspaceId,
      companyId,
      provider: process.env.EMAIL_ENRICHMENT_API_KEY
        ? (process.env.EMAIL_ENRICHMENT_PROVIDER ?? "email-enrichment")
        : "mock",
      status: "COMPLETED",
      contactsFound: created,
      requestMetadata: { demoMode: !process.env.EMAIL_ENRICHMENT_API_KEY },
    },
  });
  await prisma.company.update({
    where: { id: companyId },
    data: { enrichmentStatus: "COMPLETED" },
  });
  return { created, primaryContactId: contact.id };
}

async function verifyContactEmail(
  prisma: PrismaClient,
  workspaceId: string,
  contactId: string,
) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, workspaceId },
  });
  if (!contact?.email) return { verified: false, result: EmailStatus.UNKNOWN };
  const email = contact.email.toLowerCase();
  const result =
    email.includes("directory") || email.includes("tutorial")
      ? EmailStatus.INVALID
      : email.startsWith("hello@")
        ? EmailStatus.LIKELY_VALID
        : EmailStatus.VERIFIED;
  await prisma.emailVerificationRecord.create({
    data: {
      workspaceId,
      contactId,
      email,
      provider: process.env.EMAIL_VERIFICATION_API_KEY
        ? (process.env.EMAIL_VERIFICATION_PROVIDER ?? "email-verification")
        : "mock",
      result,
      confidence: result === EmailStatus.INVALID ? 20 : 78,
      metadata: { demoMode: !process.env.EMAIL_VERIFICATION_API_KEY },
    },
  });
  await prisma.contact.update({
    where: { id: contactId },
    data: {
      emailStatus: result,
      verifiedAt: new Date(),
      verificationProvider: process.env.EMAIL_VERIFICATION_PROVIDER ?? "mock",
      verificationResult: {
        result,
        confidence: result === EmailStatus.INVALID ? 20 : 78,
      },
    },
  });
  return { verified: result !== EmailStatus.INVALID, result };
}

async function scoreLead(
  prisma: PrismaClient,
  workspaceId: string,
  leadId: string,
  companyId: string,
  contactId: string | null | undefined,
  result: MockResult,
) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const contact = contactId
    ? await prisma.contact.findUnique({ where: { id: contactId } })
    : null;
  const factors = {
    buyingIntent: result.category === "large_mobile_shop" ? 62 : 86,
    mobileRelevance: company?.hasMobileService ? 90 : 76,
    agencyFit: result.category === "large_mobile_shop" ? 55 : 92,
    decisionMakerQuality: contact?.decisionMakerScore ?? 50,
    contactability: contact?.email ? 78 : 35,
    recency: scoreRecency(new Date(), "AGENCY_PARTNER"),
    companyQuality: company?.companyQualityScore ?? 70,
    countryPriority: scoreCountryPriority(result.country),
    competitorProbability: result.category === "large_mobile_shop" ? 60 : 15,
    spamProbability: 5,
  };
  const calculation = calculateLeadScore(factors);
  const score = await prisma.leadScore.create({
    data: {
      workspaceId,
      leadId,
      buyingIntent: factors.buyingIntent,
      mobileRelevance: factors.mobileRelevance,
      agencyFit: factors.agencyFit,
      decisionMakerQuality: factors.decisionMakerQuality,
      contactability: factors.contactability,
      recency: factors.recency,
      companyQuality: factors.companyQuality,
      countryPriority: factors.countryPriority,
      spamProbability: factors.spamProbability,
      competitorProbability: factors.competitorProbability,
      baseScore: calculation.baseScore,
      penalty: calculation.penalty,
      overall: calculation.overallScore,
      temperature: calculation.temperature,
      reason:
        "Phase 3 discovery score based on agency fit, mobile relevance, contactability and country priority.",
      recommendedChannel: "EMAIL",
      recommendedPitch: "White-label Flutter/mobile delivery partnership.",
      confidence: 78,
      explanation: JSON.stringify(calculation.breakdown),
      promptVersion: "phase-3-deterministic-discovery-v1",
    },
  });
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      overallScore: score.overall,
      temperature: score.temperature,
      status: score.overall >= 82 ? "QUALIFIED" : "NEW",
    },
  });
  return score;
}

async function createShortlist(
  prisma: PrismaClient,
  workspaceId: string,
  discoveryRunId: string,
  minimumScore: number,
  shortlistLimit: number,
) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  const shortlist = await prisma.shortlist.create({
    data: {
      workspaceId,
      discoveryRunId,
      name: `Phase 3 shortlist ${now.toISOString().slice(0, 10)}`,
      weekStart,
      weekEnd,
      minimumScore,
      maximumItems: shortlistLimit,
    },
  });
  const leads = await prisma.lead.findMany({
    where: { workspaceId, discoveryRunId, overallScore: { gte: minimumScore } },
    orderBy: [{ overallScore: "desc" }, { createdAt: "desc" }],
    take: shortlistLimit,
  });
  for (const [index, lead] of leads.entries()) {
    await prisma.shortlistItem.create({
      data: {
        shortlistId: shortlist.id,
        leadId: lead.id,
        rank: index + 1,
        scoreAtSelection: lead.overallScore,
      },
    });
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: "SHORTLISTED" },
    });
  }
  return { shortlistId: shortlist.id, itemCount: leads.length };
}

async function markJob(
  prisma: PrismaClient,
  workspaceId: string,
  systemJobId: string | undefined,
  status: JobStatus,
  progress: number,
  counters: Partial<{
    recordsDiscovered: number;
    recordsProcessed: number;
    recordsQualified: number;
    recordsRejected: number;
    recordsFailed: number;
  }> = {},
) {
  if (!systemJobId) return;
  await prisma.systemJob.updateMany({
    where: { id: systemJobId, workspaceId },
    data: {
      status,
      progress,
      ...(status === "RUNNING" ? { startedAt: new Date() } : {}),
      ...(status === "COMPLETED" || status === "FAILED" || status === "PARTIAL"
        ? { completedAt: new Date() }
        : {}),
      ...counters,
    },
  });
}

async function ensureNotCancelled(
  prisma: PrismaClient,
  workspaceId: string,
  runId: string,
) {
  const run = await prisma.discoveryRun.findFirst({
    where: { id: runId, workspaceId },
    select: { status: true },
  });
  if (run?.status === "CANCELLED") throw new Error("Lead hunt was cancelled.");
}

function rejectionReasonFor(result: MockResult) {
  if (["directory", "tutorial", "job_board"].includes(result.category)) {
    return result.category.toUpperCase();
  }
  const blockedDomains = [
    "youtube.com",
    "linkedin.com",
    "facebook.com",
    "clutch.co",
  ];
  return blockedDomains.some((domain) => result.domain.endsWith(domain))
    ? "DIRECTORY_OR_SOCIAL_RESULT"
    : null;
}

function emptySocialQueryResult() {
  return {
    rawResults: 0,
    relevantResults: 0,
    duplicatesRemoved: 0,
    contactsFound: 0,
    emailsVerified: 0,
    leadsScored: 0,
    leadIds: new Set<string>(),
    companyIds: new Set<string>(),
  };
}

async function telegramMessagesForQuery(
  prisma: PrismaClient,
  workspaceId: string,
  query: string,
): Promise<SocialRawLead[]> {
  const sources = await prisma.telegramSource.findMany({
    where: { workspaceId, enabled: true },
    take: 5,
  });
  if (sources.length === 0) return [];
  return sources.flatMap((source, index) => [
    {
      source: "TELEGRAM" as const,
      externalId: `telegram:${source.id}:project:${index}`,
      authorExternalId: `telegram-author-${index}`,
      username: source.username ?? "startup_jobs",
      displayName: source.name,
      profileUrl: source.username
        ? `https://t.me/${source.username}`
        : undefined,
      sourceUrl: source.username
        ? `https://t.me/${source.username}/${index + 100}`
        : undefined,
      title: `Telegram project from ${source.name}`,
      content:
        "Need freelance Flutter developer for existing delivery app. API/backend already complete.",
      publishedAt: new Date(),
      engagement: {},
      companyName: `${source.name} Lead`,
      companyDomain:
        index === 0
          ? "northstardigital.demo"
          : `telegram-${source.id.slice(0, 8)}.example`,
      metadata: { sourceId: source.id, matchedKeyword: query },
    },
    {
      source: "TELEGRAM" as const,
      externalId: `telegram:${source.id}:course:${index}`,
      authorExternalId: `telegram-course-${index}`,
      username: source.username ?? "startup_jobs",
      displayName: source.name,
      profileUrl: source.username
        ? `https://t.me/${source.username}`
        : undefined,
      sourceUrl: source.username
        ? `https://t.me/${source.username}/${index + 101}`
        : undefined,
      title: "Flutter course promotion",
      content:
        "Join our Flutter course and learn mobile development from zero.",
      publishedAt: new Date(),
      engagement: {},
      metadata: { sourceId: source.id, matchedKeyword: query },
    },
  ]);
}

async function xPostsForQuery(query: string): Promise<SocialRawLead[]> {
  if (process.env.X_ENABLED !== "true" || !process.env.X_BEARER_TOKEN) {
    return mockSocialSearch("X", query);
  }
  const url = new URL("https://api.x.com/2/tweets/search/recent");
  url.searchParams.set("query", `${query} -is:retweet lang:en`);
  url.searchParams.set(
    "max_results",
    String(Number(process.env.MAX_X_RESULTS_PER_QUERY ?? 20)),
  );
  url.searchParams.set("tweet.fields", "created_at,public_metrics,author_id");
  url.searchParams.set("expansions", "author_id");
  url.searchParams.set("user.fields", "username,name,url");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.X_BEARER_TOKEN}` },
  });
  if (response.status === 429) {
    throw new Error(
      "X rate limit reached. Try again after the API window resets.",
    );
  }
  if (!response.ok) {
    throw new Error(`X API request failed with HTTP ${response.status}.`);
  }
  const payload = (await response.json()) as {
    data?: Array<{
      id: string;
      text: string;
      author_id?: string;
      created_at?: string;
      public_metrics?: {
        like_count?: number;
        reply_count?: number;
        retweet_count?: number;
        impression_count?: number;
      };
    }>;
    includes?: {
      users?: Array<{
        id: string;
        username?: string;
        name?: string;
        url?: string;
      }>;
    };
  };
  const users = new Map(
    (payload.includes?.users ?? []).map((user) => [user.id, user]),
  );
  return (payload.data ?? []).map((tweet) => {
    const user = tweet.author_id ? users.get(tweet.author_id) : undefined;
    const username = user?.username;
    return {
      source: "X" as const,
      externalId: tweet.id,
      authorExternalId: tweet.author_id,
      username,
      displayName: user?.name,
      profileUrl: username ? `https://x.com/${username}` : user?.url,
      sourceUrl: username
        ? `https://x.com/${username}/status/${tweet.id}`
        : undefined,
      content: tweet.text,
      publishedAt: tweet.created_at ? new Date(tweet.created_at) : new Date(),
      engagement: {
        likes: tweet.public_metrics?.like_count ?? 0,
        replies: tweet.public_metrics?.reply_count ?? 0,
        reposts: tweet.public_metrics?.retweet_count ?? 0,
        views: tweet.public_metrics?.impression_count ?? 0,
      },
      metadata: { provider: "x-api-v2", query },
    };
  });
}

function mockSocialSearch(
  source: SocialPlatform,
  query: string,
): SocialRawLead[] {
  if (source === "REDDIT") {
    return [
      {
        source,
        externalId: "reddit-founder-mvp",
        authorExternalId: "reddit-user-founder",
        username: "saas_founder",
        displayName: "SaaS Founder",
        profileUrl: "https://reddit.com/u/saas_founder",
        sourceUrl: "https://reddit.com/r/startups/comments/mock_founder_mvp",
        title: "Need Flutter help for MVP",
        content:
          "I'm building an MVP and need an experienced Flutter developer to help complete the mobile app.",
        publishedAt: new Date(),
        engagement: { replies: 8 },
        companyName: "Founder MVP Co",
        companyDomain: "founder-mvp.example",
        metadata: { subreddit: "startups", query },
      },
    ];
  }
  return [
    {
      source,
      externalId: "x-buyer-firebase-finish",
      authorExternalId: "x-founder-100",
      username: "northstarfounder",
      displayName: "Northstar Founder",
      profileUrl: "https://x.com/northstarfounder",
      sourceUrl: "https://x.com/northstarfounder/status/100",
      title: "Looking for Flutter developer",
      content:
        "We're looking for a Flutter developer to finish our Firebase application this month.",
      publishedAt: new Date(),
      engagement: { likes: 12, replies: 3, reposts: 1, views: 1400 },
      companyName: "Northstar Digital",
      companyDomain: "northstardigital.demo",
      metadata: { query },
    },
    {
      source,
      externalId: "x-freelancer-self-promo",
      authorExternalId: "x-dev-200",
      username: "flutterdev",
      displayName: "Flutter Dev",
      profileUrl: "https://x.com/flutterdev",
      sourceUrl: "https://x.com/flutterdev/status/200",
      title: "Flutter freelancer",
      content: "Flutter developer available for freelance projects. DM me.",
      publishedAt: new Date(),
      engagement: { likes: 2 },
      metadata: { query },
    },
    {
      source,
      externalId: "x-tutorial-noise",
      authorExternalId: "x-tutorial-300",
      username: "learntocode",
      displayName: "Learn To Code",
      profileUrl: "https://x.com/learntocode",
      sourceUrl: "https://x.com/learntocode/status/300",
      title: "Flutter tutorial",
      content: "My new Flutter Firebase tutorial is live.",
      publishedAt: new Date(),
      engagement: { likes: 20 },
      metadata: { query },
    },
    {
      source,
      externalId: "x-new-company-app-store",
      authorExternalId: "x-founder-400",
      username: "deliveryfounder",
      displayName: "Delivery Founder",
      profileUrl: "https://x.com/deliveryfounder",
      sourceUrl: "https://x.com/deliveryfounder/status/400",
      title: "App Store issue",
      content:
        "Our startup needs someone this week to fix an App Store rejection for our mobile app.",
      publishedAt: new Date(),
      engagement: { likes: 5, replies: 2, views: 640 },
      companyName: "Delivery Sprint",
      companyDomain: "deliverysprint.example",
      metadata: { query },
    },
  ];
}

function socialEvidence(
  raw: SocialRawLead,
  classification: ReturnType<typeof classifySocialOpportunity>,
) {
  return {
    platform: raw.source,
    originalSignal: {
      title: raw.title,
      content: raw.content,
      sourceUrl: raw.sourceUrl,
      profileUrl: raw.profileUrl,
      author: raw.displayName ?? raw.username,
      publishedAt: raw.publishedAt?.toISOString(),
      engagement: raw.engagement ?? {},
    },
    interpretation: {
      buyerIntent: classification.buyerIntentScore,
      leadType: classification.leadType,
      urgency: classification.urgency,
      signalQualityScore: classification.signalQualityScore,
      socialPreQualificationScore: classification.socialPreQualificationScore,
      authorType: classification.authorType,
    },
  };
}

function readableAuthorType(authorType: string) {
  return authorType
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function mockWebSearch(query: string, countryHint?: string): MockResult[] {
  const country = countryHint ?? countryForQuery(query);
  const city = cityForCountry(country);
  const seed = normalizeCompanyName(query).split(" ").slice(-2).join("-");
  return [
    agencyResult(
      "Northstar Digital",
      "northstar-digital.example",
      country,
      city,
      query,
      "agency",
    ),
    agencyResult(
      "Pixel Palm Studio",
      "pixelpalm.agency.example",
      country,
      city,
      query,
      "agency",
    ),
    agencyResult(
      "LaunchBridge Web",
      `launchbridge-${seed}.example`,
      country,
      city,
      query,
      "agency",
    ),
    agencyResult(
      "Enterprise Apps Co",
      "enterpriseapps.example",
      country,
      city,
      query,
      "large_mobile_shop",
    ),
    agencyResult(
      "Northstar Digital",
      "northstar-digital.example",
      country,
      city,
      query,
      "agency",
    ),
    {
      title: "Top mobile app agencies directory",
      url: "https://directory-listings.example/mobile-app-agencies",
      description: `Directory listing for agencies matching ${query}.`,
      domain: normalizeDomain("directory-listings.example"),
      companyName: "Directory Listings",
      country,
      city,
      category: "directory",
    },
    {
      title: "How to hire Flutter freelancers tutorial",
      url: "https://freelancer-tutorials.example/flutter-guide",
      description: "Tutorial content, not a target company.",
      domain: normalizeDomain("freelancer-tutorials.example"),
      companyName: "Freelancer Tutorials",
      country,
      city,
      category: "tutorial",
    },
  ];
}

function agencyResult(
  name: string,
  domain: string,
  country: string,
  city: string,
  query: string,
  category: MockResult["category"],
): MockResult {
  return {
    title: `${name} - web, SaaS and mobile delivery partner`,
    url: `https://${domain}/services/mobile-app-development`,
    description: `${name} serves ${city} clients with web apps, SaaS platforms, backend systems and mobile app delivery. Query match: ${query}.`,
    domain: normalizeDomain(domain),
    companyName: name,
    country,
    city,
    category,
  };
}

function countryForQuery(query: string) {
  const lowered = query.toLowerCase();
  if (lowered.includes("uae") || lowered.includes("dubai"))
    return "United Arab Emirates";
  if (lowered.includes("saudi") || lowered.includes("riyadh"))
    return "Saudi Arabia";
  if (lowered.includes("canada")) return "Canada";
  if (lowered.includes("australia")) return "Australia";
  if (lowered.includes("uk") || lowered.includes("united kingdom"))
    return "United Kingdom";
  return "United States";
}

function cityForCountry(country: string) {
  if (country === "United Arab Emirates") return "Dubai";
  if (country === "Saudi Arabia") return "Riyadh";
  if (country === "Canada") return "Toronto";
  if (country === "Australia") return "Sydney";
  if (country === "United Kingdom") return "London";
  return "Austin";
}
