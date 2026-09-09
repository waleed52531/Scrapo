export const API_PREFIX = "api/v1";
export const QUEUE_NAMES = {
  maintenance: "maintenance",
  leadAnalysis: "lead-analysis",
} as const;

export const AUTOMATION_RULE_TYPES = [
  "WEEKLY_LEAD_HUNT",
  "GMAIL_REPLY_SYNC",
  "FOLLOW_UP_SCAN",
  "ANALYTICS_REFRESH",
  "WEEKLY_REPORT",
] as const;

export type AutomationRuleType = (typeof AUTOMATION_RULE_TYPES)[number];

export const AUTOMATION_RUN_STATUSES = [
  "SCHEDULED",
  "RUNNING",
  "COMPLETED",
  "PARTIAL",
  "FAILED",
  "SKIPPED",
  "CANCELLED",
] as const;

export type AutomationRunStatus = (typeof AUTOMATION_RUN_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "HOT_LEAD_DISCOVERED",
  "WEEKLY_SHORTLIST_READY",
  "INTERESTED_REPLY",
  "MEETING_REQUESTED",
  "PORTFOLIO_REQUEST",
  "PRICING_REQUEST",
  "LEAD_SCORE_JUMP",
  "LEAD_HUNT_FAILED",
  "GMAIL_REAUTH_REQUIRED",
  "AUTOMATION_FAILED",
  "WEEKLY_REPORT_READY",
  "DAILY_DIGEST",
] as const;

export const OPTIMIZATION_RECOMMENDATION_TYPES = [
  "QUERY_PRIORITY_INCREASE",
  "QUERY_PRIORITY_DECREASE",
  "SOURCE_PRIORITY_INCREASE",
  "SOURCE_PRIORITY_DECREASE",
  "COUNTRY_OPPORTUNITY",
  "SCORING_ADJUSTMENT",
  "CAMPAIGN_ADJUSTMENT",
] as const;

export const LEAD_FEEDBACK_RATINGS = ["LIKE", "NEUTRAL", "DISLIKE"] as const;

export type LeadFeedbackRating = (typeof LEAD_FEEDBACK_RATINGS)[number];

export const DISCOVERY_JOB_TYPES = {
  leadHunt: "LEAD_HUNT",
  findContacts: "FIND_CONTACTS",
  verifyEmail: "VERIFY_EMAIL",
} as const;

export const PROMPT_VERSIONS = {
  companyAnalysis: "company-analysis-v1",
  leadAnalysis: "lead-analysis-v1",
} as const;

export const DEFAULT_SCORING_WEIGHTS = {
  buyingIntent: 25,
  mobileRelevance: 20,
  agencyFit: 15,
  decisionMakerQuality: 10,
  contactability: 10,
  recency: 10,
  companyQuality: 5,
  countryPriority: 5,
} as const;

export const TIER_ONE_COUNTRIES = [
  "United States",
  "United Kingdom",
  "UAE",
  "United Arab Emirates",
  "Saudi Arabia",
  "Australia",
  "Canada",
] as const;
export const TIER_TWO_COUNTRIES = [
  "Germany",
  "Netherlands",
  "Ireland",
  "Singapore",
  "Qatar",
  "Bahrain",
  "Kuwait",
  "New Zealand",
] as const;

export const DEFAULT_AGENCY_SEARCH_QUERIES = [
  {
    country: "United Kingdom",
    category: "WEB_AGENCY",
    query: '"web design agency" "mobile app development partner" UK',
    priority: 100,
  },
  {
    country: "United Kingdom",
    category: "SOFTWARE_AGENCY",
    query: '"software agency" "Flutter" "white label" UK',
    priority: 95,
  },
  {
    country: "United Arab Emirates",
    category: "WEB_AGENCY",
    query: '"web development agency" "mobile app development" Dubai',
    priority: 100,
  },
  {
    country: "United Arab Emirates",
    category: "DIGITAL_AGENCY",
    query: '"digital agency" "app development partner" UAE',
    priority: 90,
  },
  {
    country: "Saudi Arabia",
    category: "WEB_AGENCY",
    query: '"web agency" "mobile app development" Riyadh',
    priority: 95,
  },
  {
    country: "United States",
    category: "WEB_AGENCY",
    query: '"web design agency" "mobile app development partner" USA',
    priority: 90,
  },
  {
    country: "Canada",
    category: "SOFTWARE_AGENCY",
    query: '"software agency" "Flutter developer partner" Canada',
    priority: 85,
  },
  {
    country: "Australia",
    category: "WEB_AGENCY",
    query: '"web development agency" "outsource mobile app" Australia',
    priority: 85,
  },
] as const;

export const DEFAULT_SOCIAL_SEARCH_QUERIES = [
  {
    source: "X",
    category: "FLUTTER_REQUIREMENT",
    query: '"looking for flutter developer"',
    priority: 100,
  },
  {
    source: "X",
    category: "FLUTTER_REQUIREMENT",
    query: '"need flutter developer"',
    priority: 98,
  },
  {
    source: "X",
    category: "FLUTTER_REQUIREMENT",
    query: '"flutter developer needed"',
    priority: 94,
  },
  {
    source: "X",
    category: "MOBILE_REQUIREMENT",
    query: '"looking for mobile developer"',
    priority: 92,
  },
  {
    source: "X",
    category: "MOBILE_REQUIREMENT",
    query: '"need mobile developer"',
    priority: 90,
  },
  {
    source: "X",
    category: "ACTIVE_REQUIREMENT",
    query: '"need someone to finish our app"',
    priority: 88,
  },
  {
    source: "X",
    category: "APP_PROBLEM",
    query: '"developer left" app',
    priority: 86,
  },
  {
    source: "X",
    category: "FIREBASE",
    query: '"need firebase developer"',
    priority: 84,
  },
  {
    source: "X",
    category: "APP_STORE",
    query: '"app store rejected" developer',
    priority: 82,
  },
  {
    source: "REDDIT",
    category: "FLUTTER_REQUIREMENT",
    query: "flutter developer",
    priority: 80,
  },
  {
    source: "REDDIT",
    category: "ACTIVE_REQUIREMENT",
    query: "need developer mobile app",
    priority: 78,
  },
  {
    source: "REDDIT",
    category: "MVP",
    query: "mobile app MVP",
    priority: 76,
  },
  {
    source: "TELEGRAM",
    category: "FLUTTER_REQUIREMENT",
    query: "flutter",
    priority: 80,
  },
  {
    source: "TELEGRAM",
    category: "MOBILE_REQUIREMENT",
    query: "mobile developer",
    priority: 78,
  },
  {
    source: "TELEGRAM",
    category: "ACTIVE_REQUIREMENT",
    query: "developer needed",
    priority: 76,
  },
] as const;

export const DEFAULT_REDDIT_SUBREDDITS = [
  "forhire",
  "hiring",
  "startups",
  "Entrepreneur",
  "smallbusiness",
  "SaaS",
  "EntrepreneurRideAlong",
  "webdev",
  "FlutterDev",
  "freelance_forhire",
] as const;

export const DEFAULT_TELEGRAM_KEYWORDS = [
  "flutter",
  "mobile developer",
  "android",
  "ios",
  "firebase",
  "mobile app",
  "app developer",
  "developer needed",
  "developer required",
  "freelance",
  "project",
  "MVP",
] as const;

export type SocialPlatform = "X" | "REDDIT" | "TELEGRAM";
export type OpportunityUrgency =
  "IMMEDIATE" | "THIS_WEEK" | "THIS_MONTH" | "FLEXIBLE" | "UNKNOWN";
export type SocialAuthorType =
  | "FOUNDER"
  | "BUSINESS_OWNER"
  | "CTO"
  | "PRODUCT_MANAGER"
  | "AGENCY_OWNER"
  | "RECRUITER"
  | "DEVELOPER"
  | "FREELANCER"
  | "STUDENT"
  | "UNKNOWN";

export type SocialClassification = {
  valid: boolean;
  leadType:
    | "ACTIVE_REQUIREMENT"
    | "MVP_STARTUP"
    | "EXISTING_APP_FIX"
    | "FIREBASE_API_SUPPORT"
    | "APP_STORE_SUPPORT"
    | "GENERAL_MOBILE_SUPPORT"
    | "PERMANENT_JOB"
    | "INVALID"
    | "OTHER";
  invalidReason?:
    | "OTHER_FREELANCER"
    | "SELF_PROMOTION"
    | "SPAM"
    | "BOT"
    | "STUDENT_PROJECT"
    | "TUTORIAL"
    | "NEWS"
    | "PERMANENT_JOB_ONLY"
    | "JOB_AGGREGATOR"
    | "IRRELEVANT"
    | "EXPIRED"
    | "DUPLICATE"
    | "INSUFFICIENT_INFORMATION";
  authorType: SocialAuthorType;
  authorTypeConfidence: number;
  buyerIntentScore: number;
  mobileRelevanceScore: number;
  selfPromotionProbability: number;
  spamProbability: number;
  socialPreQualificationScore: number;
  signalQualityScore: number;
  urgency: OpportunityUrgency;
  recommendedChannel:
    "X_REPLY" | "REDDIT_REPLY" | "TELEGRAM_REPLY" | "MANUAL_RESEARCH" | "NONE";
  suggestedText: string;
  explanation: string;
};

export function classifySocialOpportunity(
  content: string,
  platform: SocialPlatform = "X",
  publishedAt: Date | string | null = new Date(),
): SocialClassification {
  const text = content.toLowerCase();
  const selfPromotion = scorePatterns(text, [
    "i am available",
    "i'm available",
    "available for work",
    "available for freelance",
    "hire me",
    "dm me",
    "my portfolio",
    "flutter developer with",
    "app developer with",
  ]);
  const tutorial = scorePatterns(text, [
    "tutorial",
    "course",
    "learn flutter",
    "state management",
    "my new flutter firebase tutorial",
    "youtube",
  ]);
  const student = scorePatterns(text, [
    "university assignment",
    "student project",
    "homework",
    "college assignment",
    "assignment",
  ]);
  const news = scorePatterns(text, [
    "released today",
    "launches",
    "version",
    "news",
  ]);
  const spam = scorePatterns(text, [
    "crypto",
    "airdrop",
    "nft",
    "casino",
    "guaranteed profit",
  ]);
  const permanent = scorePatterns(text, [
    "full-time",
    "full time",
    "permanent role",
    "salary",
    "onsite only",
  ]);
  let buyerIntent = scorePatterns(text, [
    "we need",
    "i need",
    "looking for",
    "hiring freelance",
    "need someone",
    "our app",
    "our startup",
    "our company",
    "our client",
    "project",
    "budget",
    "deadline",
    "start immediately",
    "finish app",
    "complete the mobile app",
    "previous developer",
    "developer left",
    "developer disappeared",
  ]);
  const mobileRelevance = scorePatterns(text, [
    "flutter",
    "mobile",
    "app developer",
    "mobile app",
    "android",
    "ios",
    "firebase",
    "push notification",
    "app store",
    "play store",
    "api integration",
  ]);
  const recency = scoreSocialRecency(publishedAt);
  const author = inferAuthorType(text);
  const urgency = inferUrgency(text);
  if (
    (text.includes("looking for") ||
      text.includes("need") ||
      text.includes("hiring")) &&
    (text.includes("flutter") ||
      text.includes("mobile app") ||
      text.includes("app developer"))
  ) {
    buyerIntent = Math.max(buyerIntent, 86);
  }
  const selfPromotionProbability = clampScore(selfPromotion);
  const spamProbability = clampScore(Math.max(spam, tutorial > 65 ? 40 : 0));

  if (selfPromotionProbability >= 65) {
    return socialReject(
      "OTHER_FREELANCER",
      platform,
      author.type === "UNKNOWN" ? "FREELANCER" : author.type,
      Math.max(author.confidence, 80),
      selfPromotionProbability,
      spamProbability,
      "Rejected self-promotion/developer availability post.",
    );
  }
  if (tutorial >= 65) {
    return socialReject(
      "TUTORIAL",
      platform,
      author.type,
      author.confidence,
      selfPromotionProbability,
      spamProbability,
      "Rejected tutorial or educational content.",
    );
  }
  if (student >= 65) {
    return socialReject(
      "STUDENT_PROJECT",
      platform,
      "STUDENT",
      90,
      selfPromotionProbability,
      spamProbability,
      "Rejected student assignment/project request.",
    );
  }
  if (news >= 70 || spam >= 70) {
    return socialReject(
      spam >= 70 ? "SPAM" : "NEWS",
      platform,
      author.type,
      author.confidence,
      selfPromotionProbability,
      Math.max(spamProbability, news),
      "Rejected low buyer-intent news/spam content.",
    );
  }

  const leadType = inferLeadType(text, permanent);
  const signalQualityScore = clampScore(
    buyerIntent * 0.38 +
      mobileRelevance * 0.26 +
      recency * 0.16 +
      author.confidence * 0.12 -
      selfPromotionProbability * 0.24 -
      spamProbability * 0.18,
  );
  const socialPreQualificationScore = clampScore(
    buyerIntent * 0.36 +
      mobileRelevance * 0.26 +
      recency * 0.16 +
      author.confidence * 0.12 -
      selfPromotionProbability * 0.22 -
      spamProbability * 0.18,
  );
  const valid =
    buyerIntent >= 45 &&
    mobileRelevance >= 45 &&
    socialPreQualificationScore >= 40 &&
    leadType !== "PERMANENT_JOB";
  if (!valid) {
    return socialReject(
      leadType === "PERMANENT_JOB" ? "PERMANENT_JOB_ONLY" : "IRRELEVANT",
      platform,
      author.type,
      author.confidence,
      selfPromotionProbability,
      spamProbability,
      "Rejected because buyer intent or mobile relevance was too weak.",
    );
  }

  return {
    valid: true,
    leadType,
    authorType: author.type,
    authorTypeConfidence: author.confidence,
    buyerIntentScore: clampScore(buyerIntent),
    mobileRelevanceScore: clampScore(mobileRelevance),
    selfPromotionProbability,
    spamProbability,
    socialPreQualificationScore,
    signalQualityScore,
    urgency,
    recommendedChannel: socialChannel(platform),
    suggestedText: suggestedSocialReply(content, platform),
    explanation:
      "High-intent social post with buyer language and mobile-development relevance.",
  };
}

export function scoreSocialRecency(publishedAt?: Date | string | null): number {
  if (!publishedAt) return 60;
  const timestamp =
    typeof publishedAt === "string"
      ? new Date(publishedAt).getTime()
      : publishedAt.getTime();
  const ageDays = Math.max(0, (Date.now() - timestamp) / 86_400_000);
  if (ageDays < 1) return 100;
  if (ageDays <= 2) return 95;
  if (ageDays <= 4) return 85;
  if (ageDays <= 7) return 70;
  if (ageDays <= 14) return 45;
  if (ageDays <= 30) return 20;
  return 5;
}

function scorePatterns(text: string, patterns: string[]) {
  const matches = patterns.filter((pattern) => text.includes(pattern)).length;
  return clampScore(matches * 28 + (matches > 0 ? 35 : 0));
}

function inferAuthorType(text: string): {
  type: SocialAuthorType;
  confidence: number;
} {
  if (text.includes("our startup") || text.includes("founder")) {
    return { type: "FOUNDER", confidence: 88 };
  }
  if (text.includes("our client") || text.includes("agency")) {
    return { type: "AGENCY_OWNER", confidence: 78 };
  }
  if (text.includes("cto")) return { type: "CTO", confidence: 85 };
  if (text.includes("product manager")) {
    return { type: "PRODUCT_MANAGER", confidence: 82 };
  }
  if (text.includes("recruiter")) return { type: "RECRUITER", confidence: 80 };
  if (text.includes("student") || text.includes("assignment")) {
    return { type: "STUDENT", confidence: 90 };
  }
  if (text.includes("i am available") || text.includes("hire me")) {
    return { type: "FREELANCER", confidence: 88 };
  }
  if (text.includes("we need") || text.includes("our app")) {
    return { type: "BUSINESS_OWNER", confidence: 72 };
  }
  return { type: "UNKNOWN", confidence: 45 };
}

function inferLeadType(
  text: string,
  permanent: number,
): SocialClassification["leadType"] {
  if (permanent >= 65) return "PERMANENT_JOB";
  if (text.includes("mvp")) return "MVP_STARTUP";
  if (
    (text.includes("looking for") ||
      text.includes("need") ||
      text.includes("hiring")) &&
    (text.includes("mobile") ||
      text.includes("flutter") ||
      text.includes("app developer"))
  ) {
    return "ACTIVE_REQUIREMENT";
  }
  if (
    text.includes("previous developer") ||
    text.includes("developer left") ||
    text.includes("developer disappeared") ||
    text.includes("bug")
  ) {
    return "EXISTING_APP_FIX";
  }
  if (text.includes("firebase") || text.includes("api integration")) {
    return "FIREBASE_API_SUPPORT";
  }
  if (text.includes("app store") || text.includes("play store")) {
    return "APP_STORE_SUPPORT";
  }
  if (
    text.includes("mobile") ||
    text.includes("flutter") ||
    text.includes("app developer")
  ) {
    return "ACTIVE_REQUIREMENT";
  }
  return "OTHER";
}

function inferUrgency(text: string): OpportunityUrgency {
  if (
    text.includes("today") ||
    text.includes("immediately") ||
    text.includes("asap")
  ) {
    return "IMMEDIATE";
  }
  if (text.includes("this week") || text.includes("before friday")) {
    return "THIS_WEEK";
  }
  if (text.includes("this month")) return "THIS_MONTH";
  if (text.includes("eventually") || text.includes("flexible"))
    return "FLEXIBLE";
  return "UNKNOWN";
}

function socialReject(
  invalidReason: NonNullable<SocialClassification["invalidReason"]>,
  platform: SocialPlatform,
  authorType: SocialAuthorType,
  authorTypeConfidence: number,
  selfPromotionProbability: number,
  spamProbability: number,
  explanation: string,
): SocialClassification {
  return {
    valid: false,
    leadType: "INVALID",
    invalidReason,
    authorType,
    authorTypeConfidence,
    buyerIntentScore: 0,
    mobileRelevanceScore: 0,
    selfPromotionProbability,
    spamProbability,
    socialPreQualificationScore: 0,
    signalQualityScore: 0,
    urgency: "UNKNOWN",
    recommendedChannel: socialChannel(platform),
    suggestedText: "",
    explanation,
  };
}

function socialChannel(platform: SocialPlatform) {
  if (platform === "REDDIT") return "REDDIT_REPLY";
  if (platform === "TELEGRAM") return "TELEGRAM_REPLY";
  return "X_REPLY";
}

function suggestedSocialReply(content: string, platform: SocialPlatform) {
  const prefix =
    platform === "X"
      ? "I work with Flutter/Firebase and existing app fixes."
      : platform === "REDDIT"
        ? "I handle Flutter/Firebase mobile app work."
        : "I work on Flutter/mobile app projects.";
  const detail = content.toLowerCase().includes("firebase")
    ? " If the remaining work is around Firebase/API integration, I can help with that specifically."
    : " This sounds close to projects I usually handle.";
  return `${prefix}${detail} Happy to take a look if you are still looking.`;
}

export const PHASE_3_PROVIDER_ENV = {
  webSearchProvider: "WEB_SEARCH_PROVIDER",
  webSearchApiKey: "WEB_SEARCH_API_KEY",
  emailEnrichmentProvider: "EMAIL_ENRICHMENT_PROVIDER",
  emailEnrichmentApiKey: "EMAIL_ENRICHMENT_API_KEY",
  emailVerificationProvider: "EMAIL_VERIFICATION_PROVIDER",
  emailVerificationApiKey: "EMAIL_VERIFICATION_API_KEY",
} as const;

export function normalizeDomain(value: string): string {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, "");
}

export function normalizeCompanyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type ScoringWeights = Record<
  keyof typeof DEFAULT_SCORING_WEIGHTS,
  number
>;

export type ScoreFactors = {
  buyingIntent: number;
  mobileRelevance: number;
  agencyFit: number;
  decisionMakerQuality: number;
  contactability: number;
  recency: number;
  companyQuality: number;
  countryPriority: number;
  spamProbability?: number;
  competitorProbability?: number;
};

export type ScoreCalculation = {
  baseScore: number;
  penalty: number;
  overallScore: number;
  temperature: "HOT" | "STRONG" | "REVIEW" | "WEAK" | "REJECT";
  breakdown: Record<
    keyof ScoringWeights,
    { score: number; weight: number; contribution: number }
  >;
};

export function assertValidScoringWeights(
  input: Record<string, number>,
): ScoringWeights {
  const required = Object.keys(DEFAULT_SCORING_WEIGHTS) as Array<
    keyof ScoringWeights
  >;
  const values = required.map((key) => input[key]);
  const hasInvalid = values.some(
    (value) =>
      !Number.isFinite(value) ||
      value === undefined ||
      value < 0 ||
      value > 100,
  );
  const total = values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  if (hasInvalid || total !== 100) {
    throw new Error(
      "Scoring weights must include all eight factors, each 0-100, and total 100.",
    );
  }
  return Object.fromEntries(
    required.map((key) => [key, input[key]]),
  ) as ScoringWeights;
}

export function calculateLeadScore(
  factors: ScoreFactors,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
): ScoreCalculation {
  const normalizedWeights = assertValidScoringWeights(weights);
  const breakdown = Object.fromEntries(
    (Object.keys(normalizedWeights) as Array<keyof ScoringWeights>).map(
      (key) => {
        const score = clampScore(factors[key]);
        const weight = normalizedWeights[key];
        return [
          key,
          { score, weight, contribution: roundToOne((score * weight) / 100) },
        ];
      },
    ),
  ) as ScoreCalculation["breakdown"];
  const baseScore = Math.round(
    Object.values(breakdown).reduce((sum, item) => sum + item.contribution, 0),
  );
  const penalty = calculatePenalty(factors);
  const overallScore = clampScore(baseScore - penalty);
  return {
    baseScore,
    penalty,
    overallScore,
    temperature: temperatureForScore(overallScore),
    breakdown,
  };
}

export function temperatureForScore(
  score: number,
): ScoreCalculation["temperature"] {
  if (score >= 90) return "HOT";
  if (score >= 80) return "STRONG";
  if (score >= 70) return "REVIEW";
  if (score >= 50) return "WEAK";
  return "REJECT";
}

export function calculatePenalty(factors: ScoreFactors): number {
  let penalty = 0;
  if ((factors.spamProbability ?? 0) >= 80) penalty += 35;
  else if ((factors.spamProbability ?? 0) >= 60) penalty += 20;
  if ((factors.competitorProbability ?? 0) >= 80) penalty += 30;
  else if ((factors.competitorProbability ?? 0) >= 60) penalty += 15;
  return penalty;
}

export function scoreCountryPriority(country?: string | null): number {
  if (!country) return 40;
  const normalized = country.toLowerCase();
  if (TIER_ONE_COUNTRIES.some((item) => item.toLowerCase() === normalized))
    return 100;
  if (TIER_TWO_COUNTRIES.some((item) => item.toLowerCase() === normalized))
    return 75;
  return 45;
}

export function scoreRecency(
  publishedAt?: Date | string | null,
  leadType?: string,
): number {
  if (!publishedAt) return leadType === "AGENCY_PARTNER" ? 70 : 50;
  const timestamp =
    typeof publishedAt === "string"
      ? new Date(publishedAt).getTime()
      : publishedAt.getTime();
  const ageDays = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 86_400_000),
  );
  if (leadType === "AGENCY_PARTNER") {
    if (ageDays <= 30) return 85;
    if (ageDays <= 90) return 70;
    return 55;
  }
  if (ageDays <= 2) return 100;
  if (ageDays <= 7) return 85;
  if (ageDays <= 14) return 65;
  if (ageDays <= 30) return 45;
  return 20;
}

export function clampScore(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

export const OUTREACH_STRATEGIES = [
  "AGENCY_PARTNERSHIP",
  "ACTIVE_REQUIREMENT",
  "MVP_STARTUP",
  "EXISTING_APP_FIX",
  "FIREBASE_API_SUPPORT",
  "APP_STORE_SUPPORT",
  "GENERAL_MOBILE_SUPPORT",
  "CUSTOM",
] as const;

export type OutreachStrategy = (typeof OUTREACH_STRATEGIES)[number];

export type OutreachGenerationInput = {
  developerProfile?: Record<string, unknown> | null;
  signature?: string | null;
  lead: {
    title: string;
    leadType?: string | null;
    primarySource?: string | null;
    overallScore?: number | null;
    opportunitySummary?: string | null;
    sourceContent?: string | null;
    recommendedPitch?: string | null;
  };
  contact?: {
    fullName?: string | null;
    role?: string | null;
    email?: string | null;
  } | null;
  company?: {
    name?: string | null;
    country?: string | null;
    city?: string | null;
    description?: string | null;
    services?: string[] | null;
    technologies?: string[] | null;
    hasMobileService?: boolean | null;
    hasFlutterService?: boolean | null;
    partnershipFitScore?: number | null;
    companyAnalysisSummary?: string | null;
  } | null;
  originalSignal?: {
    content?: string | null;
    source?: string | null;
    sourceUrl?: string | null;
  } | null;
  strategy?: OutreachStrategy | string | null;
  instruction?: string | null;
};

export type OutreachGenerationResult = {
  subject: string;
  body: string;
  strategy: OutreachStrategy;
  personalizationPoints: string[];
  confidence: number;
  alternativeSubjects: string[];
};

export const REPLY_CLASSIFICATIONS = [
  "INTERESTED",
  "MAYBE_LATER",
  "QUESTION",
  "PORTFOLIO_REQUEST",
  "PRICING_REQUEST",
  "MEETING_REQUESTED",
  "REFERRAL",
  "NOT_INTERESTED",
  "UNSUBSCRIBE",
  "OUT_OF_OFFICE",
  "BOUNCE",
  "WRONG_PERSON",
  "UNCLEAR",
] as const;

export type ReplyClassification = (typeof REPLY_CLASSIFICATIONS)[number];

export type ReplyClassificationResult = {
  classification: ReplyClassification;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  summary: string;
  requiresResponse: boolean;
  meetingRequested: boolean;
  recommendedAction: string;
  confidence: number;
};

export function generateDeterministicOutreach(
  input: OutreachGenerationInput,
): OutreachGenerationResult {
  const strategy = normalizeOutreachStrategy(
    input.strategy ?? strategyFromLeadType(input.lead.leadType),
  );
  const profile = input.developerProfile ?? {};
  const developerName = stringValue(profile.name) || "there";
  const title = stringValue(profile.title) || "mobile application developer";
  const skills = stringArray(profile.skills);
  const portfolio = stringValue(profile.portfolio);
  const linkedin = stringValue(profile.linkedin);
  const companyName = input.company?.name ?? "your team";
  const firstName = firstNameFrom(input.contact?.fullName);
  const evidence = personalizationEvidence(input);
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const sourceLine = sourceOpening(input, strategy);
  const valueLine = valueLineFor(strategy);
  const credibility = credibilityLine(title, skills);
  const cta = ctaFor(strategy);
  const signature =
    input.signature?.trim() ||
    [developerName === "there" ? "" : developerName, portfolio, linkedin]
      .filter(Boolean)
      .join("\n");
  const body = [
    greeting,
    "",
    sourceLine,
    "",
    valueLine,
    "",
    credibility,
    "",
    cta,
    "",
    signature || "Best,",
  ]
    .filter((part, index, parts) => part || parts[index - 1] !== "")
    .join("\n");

  return {
    subject: subjectFor(strategy, companyName, input.lead.title),
    body,
    strategy,
    personalizationPoints: evidence,
    confidence: Math.min(95, 72 + evidence.length * 6),
    alternativeSubjects: alternativeSubjects(strategy, companyName),
  };
}

export function classifyDeterministicReply(
  body: string,
): ReplyClassificationResult {
  const text = body.toLowerCase();
  if (
    containsAny(text, [
      "do not contact",
      "don't contact",
      "unsubscribe",
      "remove me",
      "stop emailing",
    ])
  ) {
    return reply(
      "UNSUBSCRIBE",
      "NEGATIVE",
      "Recipient asked not to be contacted again.",
      false,
      false,
      "SUPPRESS_CONTACT",
      96,
    );
  }
  if (
    containsAny(text, [
      "delivery has failed",
      "undeliverable",
      "mail delivery subsystem",
      "address not found",
      "message not delivered",
    ])
  ) {
    return reply(
      "BOUNCE",
      "NEGATIVE",
      "Message appears to have bounced.",
      false,
      false,
      "SUPPRESS_EMAIL",
      94,
    );
  }
  if (
    containsAny(text, [
      "out of office",
      "away from office",
      "automatic reply",
      "on vacation",
    ])
  ) {
    return reply(
      "OUT_OF_OFFICE",
      "NEUTRAL",
      "Automatic out-of-office reply detected.",
      false,
      false,
      "WAIT_OR_REVIEW",
      88,
    );
  }
  if (
    containsAny(text, [
      "not the right person",
      "wrong person",
      "contact ",
      "reach out to",
    ])
  ) {
    return reply(
      "WRONG_PERSON",
      "NEUTRAL",
      "Recipient says another person may be more appropriate.",
      true,
      false,
      "RESEARCH_REFERRAL",
      82,
    );
  }
  if (
    containsAny(text, [
      "portfolio",
      "examples",
      "case studies",
      "previous work",
    ])
  ) {
    return reply(
      "PORTFOLIO_REQUEST",
      "POSITIVE",
      "Recipient asked for portfolio or work examples.",
      true,
      false,
      "SEND_PORTFOLIO",
      92,
    );
  }
  if (containsAny(text, ["price", "pricing", "rate", "budget", "cost"])) {
    return reply(
      "PRICING_REQUEST",
      "POSITIVE",
      "Recipient asked about pricing or budget.",
      true,
      false,
      "REVIEW_PRICING_REQUEST",
      86,
    );
  }
  if (containsAny(text, ["meeting", "call", "zoom", "meet", "calendar"])) {
    return reply(
      "MEETING_REQUESTED",
      "POSITIVE",
      "Recipient appears open to a meeting or call.",
      true,
      true,
      "MANUAL_MEETING_REPLY",
      90,
    );
  }
  if (
    containsAny(text, [
      "not interested",
      "no thanks",
      "not looking",
      "we're covered",
      "we are covered",
    ])
  ) {
    return reply(
      "NOT_INTERESTED",
      "NEGATIVE",
      "Recipient declined the outreach.",
      false,
      false,
      "STOP_FOLLOW_UP",
      92,
    );
  }
  if (
    containsAny(text, [
      "maybe later",
      "next quarter",
      "later this year",
      "not right now",
    ])
  ) {
    return reply(
      "MAYBE_LATER",
      "NEUTRAL",
      "Recipient may be open later but not immediately.",
      true,
      false,
      "SCHEDULE_MANUAL_REVIEW",
      82,
    );
  }
  if (
    containsAny(text, [
      "yes",
      "interested",
      "sounds good",
      "send over",
      "tell me more",
      "let's talk",
    ])
  ) {
    return reply(
      "INTERESTED",
      "POSITIVE",
      "Recipient showed interest and may require a response.",
      true,
      false,
      "RESPOND_MANUALLY",
      88,
    );
  }
  if (text.includes("?")) {
    return reply(
      "QUESTION",
      "NEUTRAL",
      "Recipient asked a question.",
      true,
      false,
      "ANSWER_QUESTION",
      76,
    );
  }
  return reply(
    "UNCLEAR",
    "NEUTRAL",
    "Reply needs manual review.",
    true,
    false,
    "MANUAL_REVIEW",
    60,
  );
}

function roundToOne(value: number) {
  return Math.round(value * 10) / 10;
}

function normalizeOutreachStrategy(
  value: string | null | undefined,
): OutreachStrategy {
  return OUTREACH_STRATEGIES.includes(value as OutreachStrategy)
    ? (value as OutreachStrategy)
    : "AGENCY_PARTNERSHIP";
}

function strategyFromLeadType(value: string | null | undefined) {
  if (value === "MVP_STARTUP") return "MVP_STARTUP";
  if (value === "EXISTING_APP_FIX") return "EXISTING_APP_FIX";
  if (value === "FIREBASE_API_SUPPORT") return "FIREBASE_API_SUPPORT";
  if (value === "APP_STORE_SUPPORT") return "APP_STORE_SUPPORT";
  if (value === "GENERAL_MOBILE_SUPPORT") return "GENERAL_MOBILE_SUPPORT";
  if (value === "ACTIVE_REQUIREMENT") return "ACTIVE_REQUIREMENT";
  return "AGENCY_PARTNERSHIP";
}

function personalizationEvidence(input: OutreachGenerationInput) {
  const points: string[] = [];
  if (input.company?.name)
    points.push(`Company identified as ${input.company.name}`);
  const services = input.company?.services ?? [];
  if (services.length)
    points.push(
      `Public service focus includes ${services.slice(0, 3).join(", ")}`,
    );
  const technologies = input.company?.technologies ?? [];
  if (technologies.length)
    points.push(
      `Technology signals include ${technologies.slice(0, 3).join(", ")}`,
    );
  if (input.contact?.role) points.push(`Contact role: ${input.contact.role}`);
  if (input.company?.country)
    points.push(`Location signal: ${input.company.country}`);
  if (input.originalSignal?.content)
    points.push("Original lead signal is available");
  if (input.company?.hasMobileService === false)
    points.push("Mobile service was not clearly positioned in analyzed data");
  return points.slice(0, 6);
}

function sourceOpening(
  input: OutreachGenerationInput,
  strategy: OutreachStrategy,
) {
  const company = input.company?.name ?? "your team";
  const signal =
    input.originalSignal?.content ??
    input.lead.sourceContent ??
    input.lead.opportunitySummary;
  if (strategy === "ACTIVE_REQUIREMENT" && signal) {
    return `I came across your requirement around ${shortPhrase(signal)}.`;
  }
  if (strategy === "MVP_STARTUP") {
    return `I noticed the MVP/mobile app requirement connected to ${company}.`;
  }
  if (strategy === "EXISTING_APP_FIX") {
    return `I noticed there may be an existing mobile app that needs practical help or handover support.`;
  }
  if (strategy === "FIREBASE_API_SUPPORT") {
    return `I noticed the requirement mentions Firebase/API work around a mobile app.`;
  }
  if (strategy === "APP_STORE_SUPPORT") {
    return `I noticed the requirement relates to an app release or store submission issue.`;
  }
  return `I noticed ${company}'s public work appears focused around web, backend, or client delivery.`;
}

function valueLineFor(strategy: OutreachStrategy) {
  if (strategy === "AGENCY_PARTNERSHIP") {
    return "I am looking to build a few reliable agency partnerships where I can handle the Flutter/Android/iOS side of client projects while your team keeps the client relationship.";
  }
  if (strategy === "MVP_STARTUP") {
    return "I help founders turn a clear backend/API or product scope into a practical Flutter MVP without overbuilding the first version.";
  }
  if (strategy === "EXISTING_APP_FIX") {
    return "I can help stabilize, debug, and take over existing Flutter/mobile apps, including build, Firebase, API, and release issues.";
  }
  if (strategy === "APP_STORE_SUPPORT") {
    return "I can help review the release path, fix the mobile-side issues, and work through App Store or Play Store submission problems.";
  }
  return "I work primarily on Flutter/mobile applications, including existing app development, Firebase/API integrations, bug fixing, and store deployment.";
}

function credibilityLine(title: string, skills: string[]) {
  const compactSkills = skills
    .filter((skill) => /flutter|android|ios|firebase|api|mobile/i.test(skill))
    .slice(0, 4);
  return compactSkills.length
    ? `My focus is ${title}, especially ${compactSkills.join(", ")}.`
    : `My focus is ${title}, especially practical mobile delivery and existing-app support.`;
}

function ctaFor(strategy: OutreachStrategy) {
  if (strategy === "AGENCY_PARTNERSHIP") {
    return "If this kind of overflow mobile capacity would be useful, would it make sense to have a quick conversation?";
  }
  return "If you are still looking, I would be happy to take a look at what remains and suggest the quickest sensible path forward.";
}

function subjectFor(
  strategy: OutreachStrategy,
  companyName: string,
  leadTitle: string,
) {
  if (strategy === "ACTIVE_REQUIREMENT")
    return "Regarding your Flutter requirement";
  if (strategy === "MVP_STARTUP") return "Flutter support for your MVP";
  if (strategy === "EXISTING_APP_FIX") return "Help finishing your mobile app";
  if (strategy === "FIREBASE_API_SUPPORT") return "Flutter/Firebase support";
  if (strategy === "APP_STORE_SUPPORT") return "App release support";
  if (strategy === "GENERAL_MOBILE_SUPPORT")
    return "Mobile development support";
  if (strategy === "CUSTOM")
    return leadTitle.slice(0, 70) || "Mobile development support";
  return `Mobile development support for ${companyName}`;
}

function alternativeSubjects(strategy: OutreachStrategy, companyName: string) {
  if (strategy === "AGENCY_PARTNERSHIP") {
    return [
      `Flutter support for ${companyName}`,
      "Mobile capacity for client projects",
    ];
  }
  return ["Flutter/mobile app support", "Quick note on your mobile app"];
}

function shortPhrase(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
    .replace(/[.?!,;:]+$/, "");
}

function firstNameFrom(value: string | null | undefined) {
  if (!value || value.startsWith("@")) return "";
  return value.split(/\s+/)[0] ?? "";
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function containsAny(text: string, patterns: string[]) {
  return patterns.some((pattern) => text.includes(pattern));
}

function reply(
  classification: ReplyClassification,
  sentiment: ReplyClassificationResult["sentiment"],
  summary: string,
  requiresResponse: boolean,
  meetingRequested: boolean,
  recommendedAction: string,
  confidence: number,
): ReplyClassificationResult {
  return {
    classification,
    sentiment,
    summary,
    requiresResponse,
    meetingRequested,
    recommendedAction,
    confidence,
  };
}

export type WeeklyScheduleInput = {
  dayOfWeek: number;
  time: string;
  timezone: string;
  from?: Date;
};

export function nextWeeklyRun(input: WeeklyScheduleInput) {
  const from = input.from ?? new Date();
  const [hour = 8, minute = 0] = input.time.split(":").map(Number);
  const local = zonedParts(from, input.timezone);
  const currentMinutes = local.hour * 60 + local.minute;
  const targetMinutes = hour * 60 + minute;
  let daysUntil = (input.dayOfWeek - local.weekday + 7) % 7;
  if (daysUntil === 0 && currentMinutes >= targetMinutes) daysUntil = 7;
  const targetLocal = addLocalDays(
    {
      year: local.year,
      month: local.month,
      day: local.day,
      hour,
      minute,
    },
    daysUntil,
  );
  return localTimeToUtc(targetLocal, input.timezone);
}

export function nextDailyRun(input: {
  time: string;
  timezone: string;
  from?: Date;
}) {
  const from = input.from ?? new Date();
  const [hour = 8, minute = 0] = input.time.split(":").map(Number);
  const local = zonedParts(from, input.timezone);
  const currentMinutes = local.hour * 60 + local.minute;
  const targetMinutes = hour * 60 + minute;
  const targetLocal = addLocalDays(
    {
      year: local.year,
      month: local.month,
      day: local.day,
      hour,
      minute,
    },
    currentMinutes >= targetMinutes ? 1 : 0,
  );
  return localTimeToUtc(targetLocal, input.timezone);
}

export function scheduledPeriod(date: Date, timezone: string) {
  const parts = zonedParts(date, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function rankingScoreForLead(input: {
  overallScore: number;
  contactQuality?: number | null;
  emailVerified?: boolean;
  sourcePerformance?: number | null;
  queryPerformance?: number | null;
  recencyScore?: number | null;
  multiSignalConfidence?: number | null;
  manualPreference?: number | null;
}) {
  const breakdown = {
    baseLeadScore: clampScore(input.overallScore) * 0.6,
    contactQuality:
      clampScore((input.contactQuality ?? 0) + (input.emailVerified ? 15 : 0)) *
      0.1,
    sourcePerformance: clampScore(input.sourcePerformance ?? 50) * 0.08,
    queryPerformance: clampScore(input.queryPerformance ?? 50) * 0.07,
    recencyAdjustment: clampScore(input.recencyScore ?? 60) * 0.05,
    multiSignalConfidence: clampScore(input.multiSignalConfidence ?? 50) * 0.05,
    manualPreference: clampScore(input.manualPreference ?? 50) * 0.05,
  };
  return {
    score: clampScore(
      Math.round(
        Object.values(breakdown).reduce((sum, value) => sum + value, 0),
      ),
    ),
    breakdown,
  };
}

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    hour: Number(value("hour")),
    minute: Number(value("minute")),
    weekday: weekdayNumber(value("weekday")),
  };
}

function weekdayNumber(value: string) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(value);
}

function addLocalDays(
  local: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  },
  days: number,
) {
  const date = new Date(
    Date.UTC(local.year, local.month - 1, local.day + days),
  );
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: local.hour,
    minute: local.minute,
  };
}

function localTimeToUtc(
  local: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  },
  timezone: string,
) {
  const guess = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
  );
  for (let offset = -36 * 60; offset <= 36 * 60; offset += 15) {
    const candidate = new Date(guess - offset * 60_000);
    const parts = zonedParts(candidate, timezone);
    if (
      parts.year === local.year &&
      parts.month === local.month &&
      parts.day === local.day &&
      parts.hour === local.hour &&
      parts.minute === local.minute
    ) {
      return candidate;
    }
  }
  return new Date(guess);
}
