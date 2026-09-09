import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
  AnalysisStatus,
  InvalidLeadReason,
  JobStatus,
  LeadStatus,
  LeadTemperature,
  LeadType,
  OutreachRecommendation,
  Prisma,
  RecommendedChannel,
  type PrismaClient,
  type Company,
  type Contact,
  type Lead,
} from "@prisma/client";
import {
  DEFAULT_SCORING_WEIGHTS,
  PROMPT_VERSIONS,
  calculateLeadScore,
  clampScore,
  scoreCountryPriority,
  scoreRecency,
  type ScoreFactors,
  type ScoringWeights,
} from "@scrapo/shared";
import type { Job } from "bullmq";
import { z } from "zod";

const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;
const MAX_PAGES_PER_DOMAIN = 5;
const usefulPaths = [
  "/",
  "/about",
  "/services",
  "/portfolio",
  "/work",
  "/team",
  "/contact",
];

const aiLeadSchema = z.object({
  leadType: z.nativeEnum(LeadType).optional(),
  invalidReason: z.nativeEnum(InvalidLeadReason).nullable().optional(),
  summary: z.string().optional(),
  explanation: z.string().optional(),
  reason: z.string().optional(),
  recommendedPitch: z.string().optional(),
  outreachRecommendation: z.nativeEnum(OutreachRecommendation).optional(),
  recommendedChannel: z.nativeEnum(RecommendedChannel).optional(),
  confidence: z.number().min(0).max(100).optional(),
  evidence: z.unknown().optional(),
  aiInterpretation: z.unknown().optional(),
  unknowns: z.array(z.string()).optional(),
  factors: z
    .object({
      buyingIntent: z.number().min(0).max(100),
      mobileRelevance: z.number().min(0).max(100),
      agencyFit: z.number().min(0).max(100),
      decisionMakerQuality: z.number().min(0).max(100),
      contactability: z.number().min(0).max(100),
      recency: z.number().min(0).max(100).optional(),
      companyQuality: z.number().min(0).max(100).optional(),
      countryPriority: z.number().min(0).max(100).optional(),
      spamProbability: z.number().min(0).max(100).optional(),
      competitorProbability: z.number().min(0).max(100).optional(),
    })
    .optional(),
});

type AnalysisJobPayload = {
  workspaceId: string;
  systemJobId: string;
  leadId?: string;
  companyId?: string;
  force?: boolean;
};

type CompanyAnalysis = ReturnType<typeof analyzeWebsiteText> & {
  contentHash?: string;
};
type LeadWithRelations = Lead & {
  company: Company | null;
  contact: Contact | null;
};

export async function processAnalysisJob(
  prisma: PrismaClient,
  job: Job<AnalysisJobPayload>,
) {
  const payload = job.data;
  await prisma.systemJob.update({
    where: { id: payload.systemJobId },
    data: { status: JobStatus.RUNNING, startedAt: new Date(), progress: 10 },
  });
  try {
    if (job.name === "ANALYZE_COMPANY")
      await analyzeCompanyJob(prisma, payload);
    else if (job.name === "ANALYZE_LEAD")
      await analyzeLeadJob(prisma, payload, false);
    else if (job.name === "RESCORE_LEAD")
      await analyzeLeadJob(prisma, payload, true);
    else throw new Error(`Unsupported analysis job: ${job.name}`);
    await prisma.systemJob.update({
      where: { id: payload.systemJobId },
      data: {
        status: JobStatus.COMPLETED,
        progress: 100,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown analysis failure";
    await prisma.systemJob.update({
      where: { id: payload.systemJobId },
      data: {
        status: JobStatus.FAILED,
        error: message,
        completedAt: new Date(),
      },
    });
    if (payload.leadId)
      await prisma.lead.updateMany({
        where: { id: payload.leadId, workspaceId: payload.workspaceId },
        data: { analysisStatus: AnalysisStatus.FAILED, status: LeadStatus.NEW },
      });
    if (payload.companyId)
      await prisma.company.updateMany({
        where: { id: payload.companyId, workspaceId: payload.workspaceId },
        data: { analysisStatus: AnalysisStatus.FAILED },
      });
    throw error;
  }
}

async function analyzeCompanyJob(
  prisma: PrismaClient,
  payload: AnalysisJobPayload,
) {
  if (!payload.companyId) throw new Error("companyId is required");
  const company = await prisma.company.findFirst({
    where: { id: payload.companyId, workspaceId: payload.workspaceId },
  });
  if (!company) throw new Error("Company not found in workspace");
  if (!company.website)
    throw new Error("Company website is required for website analysis");
  await prisma.company.update({
    where: { id: company.id },
    data: { analysisStatus: AnalysisStatus.ANALYZING },
  });
  const analysis = await analyzeCompanyWebsite(company.website);
  await persistCompanyAnalysis(prisma, company.id, analysis, modelName());
}

async function analyzeLeadJob(
  prisma: PrismaClient,
  payload: AnalysisJobPayload,
  rescoreOnly: boolean,
) {
  if (!payload.leadId) throw new Error("leadId is required");
  const lead = await prisma.lead.findFirst({
    where: { id: payload.leadId, workspaceId: payload.workspaceId },
    include: { company: true, contact: true },
  });
  if (!lead) throw new Error("Lead not found in workspace");

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      analysisStatus: AnalysisStatus.ANALYZING,
      status: LeadStatus.ANALYZING,
    },
  });
  let companyAnalysis: CompanyAnalysis | null = null;
  if (lead.company?.website && (!lead.company.analyzedAt || payload.force)) {
    companyAnalysis = await analyzeCompanyWebsite(lead.company.website);
    await persistCompanyAnalysis(
      prisma,
      lead.company.id,
      companyAnalysis,
      modelName(),
    );
  } else if (lead.company) {
    companyAnalysis = companyAnalysisFromCompany(lead.company);
  }

  const result = await classifyLead(
    prisma,
    payload.workspaceId,
    lead,
    companyAnalysis,
    rescoreOnly,
  );
  await persistLeadAnalysis(prisma, payload.workspaceId, lead, result);
}

async function classifyLead(
  prisma: PrismaClient,
  workspaceId: string,
  lead: LeadWithRelations,
  companyAnalysis: CompanyAnalysis | null,
  rescoreOnly: boolean,
) {
  const context = [
    lead.title,
    lead.opportunitySummary ?? "",
    lead.sourceContent ?? "",
    companyAnalysis?.summary ?? "",
    lead.company?.description ?? "",
    lead.contact
      ? `${lead.contact.fullName} ${lead.contact.role ?? ""} ${lead.contact.email ?? ""}`
      : "",
  ].join("\n");
  const aiStarted = Date.now();
  const ai = process.env.OPENAI_API_KEY
    ? await tryOpenAiLeadAnalysis(workspaceId, context, prisma, aiStarted)
    : null;
  const heuristic = inferLead(context, lead, companyAnalysis);
  const chosen = ai ?? heuristic;
  const settings = await prisma.userSettings.findUnique({
    where: { workspaceId },
  });
  const weights = normalizeWeights(settings?.scoring);
  const chosenFactors = { ...heuristic.factors, ...(chosen.factors ?? {}) };
  const factors: ScoreFactors = {
    ...chosenFactors,
    recency: scoreRecency(lead.publishedAt, chosen.leadType),
    companyQuality:
      companyAnalysis?.companyQualityScore ??
      lead.company?.companyQualityScore ??
      chosenFactors.companyQuality,
    countryPriority: scoreCountryPriority(
      companyAnalysis?.country || lead.company?.country,
    ),
  };
  const score = calculateLeadScore(factors, weights);
  const invalidReason = chosen.invalidReason;
  const isValidLead = !invalidReason && score.overallScore >= 50;
  const overallScore = isValidLead
    ? score.overallScore
    : Math.min(score.overallScore, 49);
  const temperature = isValidLead ? score.temperature : "REJECT";
  return {
    ...chosen,
    isValidLead,
    leadType: isValidLead ? chosen.leadType : LeadType.INVALID,
    factors,
    score: { ...score, overallScore, temperature },
    aiModel: ai ? modelName() : "local-heuristic-v1",
    promptVersion: PROMPT_VERSIONS.leadAnalysis,
    rescoreOnly,
  };
}

async function persistLeadAnalysis(
  prisma: PrismaClient,
  workspaceId: string,
  lead: LeadWithRelations,
  result: Awaited<ReturnType<typeof classifyLead>>,
) {
  const temperature = result.score.temperature as LeadTemperature;
  const status = result.isValidLead ? LeadStatus.QUALIFIED : LeadStatus.INVALID;
  const leadType = result.leadType as LeadType;
  await prisma.$transaction(async (tx) => {
    await tx.leadScore.create({
      data: {
        workspaceId,
        leadId: lead.id,
        buyingIntent: result.factors.buyingIntent,
        mobileRelevance: result.factors.mobileRelevance,
        agencyFit: result.factors.agencyFit,
        decisionMakerQuality: result.factors.decisionMakerQuality,
        contactability: result.factors.contactability,
        recency: result.factors.recency,
        companyQuality: result.factors.companyQuality,
        countryPriority: result.factors.countryPriority,
        spamProbability: result.factors.spamProbability ?? 0,
        competitorProbability: result.factors.competitorProbability ?? 0,
        baseScore: result.score.baseScore,
        penalty: result.score.penalty,
        overall: result.score.overallScore,
        temperature,
        confidence: result.confidence,
        reason: result.reason,
        explanation: result.explanation,
        recommendedChannel: result.recommendedChannel as RecommendedChannel,
        recommendedPitch: result.recommendedPitch,
        aiModel: result.aiModel,
        promptVersion: result.promptVersion,
      },
    });
    await tx.lead.update({
      where: { id: lead.id },
      data: {
        leadType,
        status,
        temperature,
        overallScore: result.score.overallScore,
        opportunitySummary: result.summary,
        recommendedPitch: result.recommendedPitch,
        analysisStatus: AnalysisStatus.COMPLETED,
        analysisConfidence: result.confidence,
        analysisSummary: result.explanation,
        evidence: result.evidence as Prisma.InputJsonValue,
        aiInterpretation: result.aiInterpretation as Prisma.InputJsonValue,
        unknowns: result.unknowns as Prisma.InputJsonValue,
        invalidReason: result.invalidReason,
        outreachRecommendation:
          result.outreachRecommendation as OutreachRecommendation,
        recommendedChannel: result.recommendedChannel as RecommendedChannel,
        aiModel: result.aiModel,
        promptVersion: result.promptVersion,
      },
    });
    await tx.activity.create({
      data: {
        workspaceId,
        leadId: lead.id,
        type: "LEAD_ANALYZED",
        description: result.explanation,
      },
    });
  });
}

async function persistCompanyAnalysis(
  prisma: PrismaClient,
  companyId: string,
  analysis: CompanyAnalysis,
  aiModel: string,
) {
  await prisma.company.update({
    where: { id: companyId },
    data: {
      name: analysis.companyName || undefined,
      normalizedName: analysis.companyName
        ? analysis.companyName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim()
        : undefined,
      country: analysis.country || undefined,
      city: analysis.city || undefined,
      companyType: analysis.companyType,
      agencyType: analysis.agencyType,
      description: analysis.description,
      services: analysis.services,
      technologies: analysis.technologies,
      industries: analysis.industries,
      hasWebService: analysis.hasWebDevelopment,
      hasBackendService: analysis.hasBackendDevelopment,
      hasMobileService: analysis.hasMobileDevelopment,
      hasFlutterService: analysis.hasFlutterDevelopment,
      hasAndroidService: analysis.hasAndroidDevelopment,
      hasIosService: analysis.hasIosDevelopment,
      mobileCapabilityConfidence: analysis.mobileCapabilityConfidence,
      companyQualityScore: analysis.companyQualityScore,
      partnershipFitScore: analysis.partnershipFitScore,
      companyAnalysisConfidence: analysis.analysisConfidence,
      companyAnalysisSummary: analysis.summary,
      analysisStatus: AnalysisStatus.COMPLETED,
      analyzedAt: new Date(),
      lastAnalyzedAt: new Date(),
      contentHash: analysis.contentHash ?? null,
      aiModel,
      promptVersion: PROMPT_VERSIONS.companyAnalysis,
    },
  });
}

async function analyzeCompanyWebsite(website: string) {
  const url = normalizeAndValidateUrl(website);
  const pages: string[] = [];
  for (const path of usefulPaths) {
    if (pages.length >= MAX_PAGES_PER_DOMAIN) break;
    try {
      const html = await fetchHtml(new URL(path, url.origin).toString());
      const text = htmlToText(html).slice(0, 8_000);
      if (text.length > 80) pages.push(text);
    } catch {
      if (path === "/" && pages.length === 0)
        throw new Error("Could not fetch useful public website content.");
    }
  }
  const combinedText = pages.join("\n\n").slice(0, 24_000);
  return {
    ...analyzeWebsiteText(url.toString(), combinedText),
    contentHash: createHash("sha256").update(combinedText).digest("hex"),
  };
}

function inferLead(
  context: string,
  lead: LeadWithRelations,
  companyAnalysis: CompanyAnalysis | null,
) {
  const lower = context.toLowerCase();
  const invalidReason = inferInvalidReason(lower);
  const active =
    /looking for|need|hiring|finish|available immediately|this month|build.*app|flutter developer/.test(
      lower,
    );
  const agency =
    companyAnalysis?.companyType === "AGENCY" ||
    /agency|studio|software house|web development|laravel|react/.test(lower);
  const hasMobileNeed =
    /flutter|mobile app|android|ios|firebase|app store|play store|react native/.test(
      lower,
    );
  const decisionMaker = lead.contact
    ? /founder|ceo|cto|owner|director/i.test(`${lead.contact.role}`)
      ? 90
      : 70
    : active
      ? 80
      : 35;
  const contactability = lead.contact?.email
    ? lead.contact.emailStatus === "VERIFIED"
      ? 95
      : 70
    : active
      ? 80
      : /@|contact|email/.test(lower)
        ? 55
        : 25;
  const agencyFit =
    active && hasMobileNeed
      ? 90
      : agency
        ? companyAnalysis?.hasMobileDevelopment
          ? 55
          : 90
        : 35;
  const leadType = invalidReason
    ? LeadType.INVALID
    : active && hasMobileNeed
      ? LeadType.ACTIVE_REQUIREMENT
      : agency
        ? LeadType.AGENCY_PARTNER
        : LeadType.BUSINESS_OPPORTUNITY;
  const outreachRecommendation = invalidReason
    ? "DO_NOT_CONTACT"
    : leadType === LeadType.ACTIVE_REQUIREMENT
      ? "ACTIVE_REQUIREMENT"
      : agency
        ? "AGENCY_PARTNERSHIP"
        : "GENERAL_MOBILE_SUPPORT";
  return {
    leadType,
    invalidReason,
    summary: active
      ? "Detected an active mobile-development requirement."
      : "Potential agency or company fit for freelance mobile-development outreach.",
    explanation: invalidReason
      ? `Rejected because the content appears to match ${invalidReason.replaceAll("_", " ").toLowerCase()}.`
      : "Score is based on visible buying intent, mobile relevance, company fit, contactability, recency, and country priority.",
    reason: invalidReason
      ? "Invalid or low-value lead."
      : hasMobileNeed
        ? "Clear mobile-development relevance detected."
        : "Possible partnership fit based on company services.",
    recommendedPitch: invalidReason
      ? "Do not contact."
      : outreachRecommendation === "AGENCY_PARTNERSHIP"
        ? "Offer Flutter/mobile delivery support while the agency keeps the client relationship."
        : "Respond with availability, relevant Flutter/Firebase experience, and a focused next step.",
    outreachRecommendation,
    recommendedChannel:
      lead.primarySource === "X"
        ? "X_REPLY"
        : lead.primarySource === "REDDIT"
          ? "REDDIT_REPLY"
          : lead.primarySource === "TELEGRAM"
            ? "TELEGRAM_REPLY"
            : lead.contact?.email
              ? "EMAIL"
              : "MANUAL_RESEARCH",
    confidence: invalidReason ? 88 : lower.length > 200 ? 78 : 62,
    evidence: {
      facts: extractFacts(context),
      source: lead.primarySource,
      website: lead.company?.website ?? null,
    },
    aiInterpretation: {
      buyingIntent: active
        ? "High visible intent"
        : "No urgent buying request detected",
      fit: agency
        ? "Possible agency/mobile partnership fit"
        : "General business opportunity",
    },
    unknowns: [
      lead.contact ? null : "No decision-maker contact confirmed",
      companyAnalysis ? null : "Company website analysis unavailable",
    ].filter(Boolean),
    factors: {
      buyingIntent: invalidReason ? 10 : active ? 100 : agency ? 70 : 55,
      mobileRelevance: hasMobileNeed
        ? 100
        : companyAnalysis?.hasMobileDevelopment
          ? 70
          : agency
            ? 65
            : 45,
      agencyFit,
      decisionMakerQuality: decisionMaker,
      contactability,
      recency: 50,
      companyQuality:
        companyAnalysis?.companyQualityScore ??
        lead.company?.companyQualityScore ??
        (active ? 70 : 50),
      countryPriority: 40,
      spamProbability: /crypto|casino|guaranteed income|buy followers/.test(
        lower,
      )
        ? 80
        : 5,
      competitorProbability:
        invalidReason === InvalidLeadReason.OTHER_FREELANCER ||
        /mobile agency|flutter agency|app development company/.test(lower)
          ? 75
          : 10,
    },
  };
}

function inferInvalidReason(lower: string): InvalidLeadReason | undefined {
  if (
    /i'?m available|available for freelance|hire me|looking for freelance work/.test(
      lower,
    )
  )
    return InvalidLeadReason.OTHER_FREELANCER;
  if (
    /university assignment|student project|homework|college assignment/.test(
      lower,
    )
  )
    return InvalidLeadReason.STUDENT_PROJECT;
  if (/permanent|full-time only|full time only/.test(lower))
    return InvalidLeadReason.PERMANENT_JOB_ONLY;
  if (/tutorial|course|how to learn/.test(lower))
    return InvalidLeadReason.TUTORIAL;
  if (/job aggregator|indeed|glassdoor/.test(lower))
    return InvalidLeadReason.JOB_AGGREGATOR;
  if (/expired|closed/.test(lower)) return InvalidLeadReason.EXPIRED;
  return undefined;
}

function companyAnalysisFromCompany(company: Company) {
  return {
    companyName: company.name,
    website: company.website ?? "",
    country: company.country ?? "",
    city: company.city ?? "",
    companyType: company.companyType ?? "UNKNOWN",
    agencyType: company.agencyType ?? "UNKNOWN",
    description: company.description ?? "",
    services: jsonStringArray(company.services),
    technologies: jsonStringArray(company.technologies),
    industries: jsonStringArray(company.industries),
    hasWebDevelopment: company.hasWebService,
    hasBackendDevelopment: company.hasBackendService,
    hasMobileDevelopment: company.hasMobileService,
    hasFlutterDevelopment: company.hasFlutterService,
    hasAndroidDevelopment: company.hasAndroidService,
    hasIosDevelopment: company.hasIosService,
    commercialClientEvidence: company.companyQualityScore > 70,
    teamInformationFound: false,
    contactInformationFound: false,
    mobileCapabilityConfidence: company.mobileCapabilityConfidence,
    companyQualityScore: company.companyQualityScore,
    partnershipFitScore: company.partnershipFitScore,
    analysisConfidence: company.companyAnalysisConfidence || 60,
    summary: company.companyAnalysisSummary ?? "",
    contentHash: company.contentHash ?? "",
  };
}

async function tryOpenAiLeadAnalysis(
  workspaceId: string,
  context: string,
  prisma: PrismaClient,
  startedAt: number,
) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName(),
        messages: [
          {
            role: "system",
            content:
              "Return JSON only. Classify freelance mobile-development leads. Include concise evidence, interpretations, unknowns, recommendedChannel, outreachRecommendation, confidence, and factor scores from 0-100. Do not fabricate missing contact/company facts.",
          },
          { role: "user", content: context.slice(0, 16_000) },
        ],
        response_format: { type: "json_object" },
      }),
    });
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      error?: { message?: string };
    };
    const parsed = parseAiPayload(payload.choices?.[0]?.message?.content);
    await prisma.aiUsageLog.create({
      data: {
        workspaceId,
        feature: "lead-analysis",
        model: modelName(),
        promptVersion: PROMPT_VERSIONS.leadAnalysis,
        success: response.ok && parsed.success,
        latencyMs: Date.now() - startedAt,
        inputTokens: payload.usage?.prompt_tokens,
        outputTokens: payload.usage?.completion_tokens,
        error:
          payload.error?.message ??
          (parsed.success
            ? undefined
            : `Malformed AI response on attempt ${attempt}`),
      },
    });
    if (response.ok && parsed.success)
      return {
        ...inferLead(context, {} as LeadWithRelations, null),
        ...parsed.data,
      };
  }
  return null;
}

function parseAiPayload(content: string | undefined) {
  try {
    return aiLeadSchema.safeParse(JSON.parse(content ?? "{}"));
  } catch {
    return { success: false } as const;
  }
}

function normalizeWeights(value: unknown): ScoringWeights {
  if (!value || typeof value !== "object") return DEFAULT_SCORING_WEIGHTS;
  return { ...DEFAULT_SCORING_WEIGHTS, ...(value as Record<string, number>) };
}

async function fetchHtml(input: string, redirectCount = 0): Promise<string> {
  const url = normalizeAndValidateUrl(input);
  await assertPublicHostname(url.hostname);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "manual",
      headers: { "User-Agent": "ScrapoPhase2WebsiteAnalyzer/1.0" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirectCount >= MAX_REDIRECTS)
        throw new Error("Website redirected too many times.");
      const location = response.headers.get("location");
      if (!location) throw new Error("Website returned an empty redirect.");
      return fetchHtml(new URL(location, url).toString(), redirectCount + 1);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("text/html"))
      throw new Error("Only public HTML pages can be analyzed.");
    return readLimitedText(response);
  } finally {
    clearTimeout(timeout);
  }
}

function analyzeWebsiteText(website: string, text: string) {
  const lower = text.toLowerCase();
  const companyName =
    new URL(website).hostname.replace(/^www\./, "").split(".")[0] ?? "";
  const technologies = matchKeywords(lower, [
    "Laravel",
    "React",
    "Node.js",
    "TypeScript",
    "Next.js",
    "PHP",
    "WordPress",
    "Flutter",
    "Firebase",
    "Android",
    "iOS",
  ]);
  const services = matchKeywords(lower, [
    "Web development",
    "Backend development",
    "Mobile development",
    "App development",
    "Product design",
    "E-commerce",
    "API development",
  ]);
  const industries = matchKeywords(lower, [
    "SaaS",
    "E-commerce",
    "Healthcare",
    "Fintech",
    "Education",
    "Real estate",
    "Logistics",
  ]);
  const hasMobile =
    /mobile|android|ios|iphone|flutter|react native|app development/.test(
      lower,
    );
  const hasWeb =
    /web development|website|react|next\.js|wordpress|laravel/.test(lower);
  const hasBackend = /backend|api|laravel|node\.js|database|server/.test(lower);
  const portfolio = /portfolio|case stud|our work|clients|brands|projects/.test(
    lower,
  );
  const contact = /contact|email|@|book a call|let's talk/.test(lower);
  const team = /team|founder|ceo|cto|director/.test(lower);
  const companyQualityScore = clampScore(
    (portfolio ? 30 : 0) +
      (contact ? 20 : 0) +
      (services.length ? 25 : 0) +
      (team ? 15 : 0) +
      10,
  );
  return {
    companyName,
    website,
    country: inferCountry(lower),
    city: "",
    companyType: /agency|studio|digital|software house/.test(lower)
      ? "AGENCY"
      : "UNKNOWN",
    agencyType: hasWeb || hasBackend ? "WEB_AND_BACKEND" : "UNKNOWN",
    description: text.slice(0, 260),
    services,
    technologies,
    industries,
    hasWebDevelopment: hasWeb,
    hasBackendDevelopment: hasBackend,
    hasMobileDevelopment: hasMobile,
    hasFlutterDevelopment: /flutter/.test(lower),
    hasAndroidDevelopment: /android/.test(lower),
    hasIosDevelopment: /ios|iphone|app store/.test(lower),
    commercialClientEvidence: portfolio,
    teamInformationFound: team,
    contactInformationFound: contact,
    mobileCapabilityConfidence: hasMobile ? 80 : 45,
    companyQualityScore,
    partnershipFitScore: clampScore(
      (hasWeb ? 35 : 10) +
        (hasBackend ? 25 : 5) +
        (portfolio ? 20 : 0) +
        (hasMobile ? -20 : 25),
    ),
    analysisConfidence: text.length > 1_000 ? 78 : 58,
    summary: hasMobile
      ? "Public pages show some mobile capability; partnership fit should be reviewed carefully."
      : "No clear mobile specialization detected on the analyzed public pages.",
  };
}

function normalizeAndValidateUrl(input: string) {
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Only http and https URLs are allowed.");
  assertPublicHostValue(url.hostname);
  return url;
}

async function assertPublicHostname(hostname: string) {
  assertPublicHostValue(hostname);
  const records = await lookup(hostname, { all: true, verbatim: true });
  records.forEach((record) => assertPublicHostValue(record.address));
}

function assertPublicHostValue(value: string) {
  const host = value.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "metadata.google.internal"
  )
    throw new Error("Private/internal hosts cannot be analyzed.");
  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    const [first = 0, second = 0] = host.split(".").map(Number);
    if (
      first === 10 ||
      first === 127 ||
      first === 0 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 169 && second === 254)
    ) {
      throw new Error("Private/internal URLs cannot be analyzed.");
    }
  }
  if (
    ipVersion === 6 &&
    (host === "::1" ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      host.startsWith("fe80"))
  )
    throw new Error("Private/internal URLs cannot be analyzed.");
}

async function readLimitedText(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return response.text();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_BYTES)
      throw new Error("Website response exceeded the analysis size limit.");
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferCountry(text: string) {
  const countries = [
    "United States",
    "United Kingdom",
    "United Arab Emirates",
    "Saudi Arabia",
    "Australia",
    "Canada",
    "Germany",
    "Netherlands",
    "Ireland",
    "Singapore",
    "Qatar",
    "Bahrain",
    "Kuwait",
    "New Zealand",
  ];
  return (
    countries.find((country) => text.includes(country.toLowerCase())) ?? ""
  );
}

function matchKeywords(text: string, keywords: string[]) {
  return keywords.filter((keyword) => text.includes(keyword.toLowerCase()));
}

function jsonStringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function extractFacts(context: string) {
  return context
    .split(/[.!?]\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 12)
    .slice(0, 5);
}

function modelName() {
  return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}
