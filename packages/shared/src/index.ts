export const API_PREFIX = "api/v1";
export const QUEUE_NAMES = {
  maintenance: "maintenance",
  leadAnalysis: "lead-analysis",
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

function roundToOne(value: number) {
  return Math.round(value * 10) / 10;
}
