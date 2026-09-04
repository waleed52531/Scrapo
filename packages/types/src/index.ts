export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedApiSuccess<T> = ApiSuccess<T[]> & {
  pagination: Pagination;
};

export const LEAD_STATUSES = [
  "NEW",
  "ANALYZING",
  "QUALIFIED",
  "SHORTLISTED",
  "DRAFTED",
  "APPROVED",
  "CONTACTED",
  "FOLLOW_UP",
  "REPLIED",
  "INTERESTED",
  "MEETING",
  "PROPOSAL",
  "WON",
  "LOST",
  "NOT_INTERESTED",
  "DO_NOT_CONTACT",
  "INVALID",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type LeadTemperature = "HOT" | "STRONG" | "REVIEW" | "WEAK" | "REJECT";
export type LeadSource =
  | "X"
  | "REDDIT"
  | "TELEGRAM"
  | "WEB"
  | "AGENCY_DIRECTORY"
  | "LINKEDIN"
  | "OTHER"
  | "MANUAL";
export type LeadType =
  | "AGENCY_PARTNER"
  | "ACTIVE_REQUIREMENT"
  | "BUSINESS_OPPORTUNITY"
  | "MVP_STARTUP"
  | "EXISTING_APP_FIX"
  | "FIREBASE_API_SUPPORT"
  | "APP_STORE_SUPPORT"
  | "GENERAL_MOBILE_SUPPORT"
  | "MANUAL"
  | "INVALID"
  | "OTHER";
export type EmailStatus =
  "UNKNOWN" | "GUESSED" | "UNVERIFIED" | "VERIFIED" | "INVALID" | "BOUNCED";
export type AnalysisStatus =
  "NOT_ANALYZED" | "QUEUED" | "ANALYZING" | "COMPLETED" | "FAILED";
export type RecommendedChannel =
  | "EMAIL"
  | "X_REPLY"
  | "X_DM"
  | "REDDIT_REPLY"
  | "TELEGRAM_REPLY"
  | "LINKEDIN_CONNECT"
  | "MANUAL_RESEARCH"
  | "NONE";
export type OutreachRecommendation =
  | "AGENCY_PARTNERSHIP"
  | "ACTIVE_REQUIREMENT"
  | "MVP_STARTUP"
  | "EXISTING_APP_FIX"
  | "FIREBASE_API_SUPPORT"
  | "APP_STORE_SUPPORT"
  | "GENERAL_MOBILE_SUPPORT"
  | "DO_NOT_CONTACT";
export type InvalidLeadReason =
  | "OTHER_FREELANCER"
  | "SPAM"
  | "STUDENT_PROJECT"
  | "PERMANENT_JOB_ONLY"
  | "IRRELEVANT"
  | "TUTORIAL"
  | "JOB_AGGREGATOR"
  | "COMPETITOR"
  | "EXPIRED"
  | "INSUFFICIENT_INFORMATION";

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  description: string | null;
  country: string | null;
  city: string | null;
  employeeRange: string | null;
  companyType: string | null;
  agencyType: string | null;
  services: string[];
  technologies: string[];
  industries: string[];
  hasWebService: boolean;
  hasBackendService: boolean;
  hasMobileService: boolean;
  hasFlutterService: boolean;
  hasAndroidService: boolean;
  hasIosService: boolean;
  mobileCapabilityConfidence: number;
  companyQualityScore: number;
  partnershipFitScore: number;
  companyAnalysisConfidence: number;
  companyAnalysisSummary: string | null;
  analysisStatus: AnalysisStatus;
  analyzedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  companyId: string | null;
  fullName: string;
  role: string | null;
  email: string | null;
  emailStatus: EmailStatus;
  linkedinUrl: string | null;
  xUrl: string | null;
  decisionMakerScore: number;
  contactConfidence: number;
  company?: Pick<Company, "id" | "name"> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  companyId: string | null;
  contactId: string | null;
  primarySource: LeadSource;
  leadType: LeadType;
  title: string;
  opportunitySummary: string | null;
  recommendedPitch: string | null;
  sourceUrl: string | null;
  sourceContent: string | null;
  publishedAt: string | null;
  analysisStatus: AnalysisStatus;
  analysisConfidence: number;
  analysisSummary: string | null;
  evidence: unknown;
  aiInterpretation: unknown;
  unknowns: unknown;
  invalidReason: InvalidLeadReason | null;
  outreachRecommendation: OutreachRecommendation | null;
  recommendedChannel: RecommendedChannel | null;
  scoreOverrideOriginal: number | null;
  scoreOverrideScore: number | null;
  scoreOverrideReason: string | null;
  scoreOverriddenAt: string | null;
  status: LeadStatus;
  temperature: LeadTemperature;
  overallScore: number;
  firstDiscoveredAt: string;
  lastSignalAt: string;
  company?: Pick<Company, "id" | "name" | "country" | "city"> | null;
  contact?: Pick<
    Contact,
    "id" | "fullName" | "role" | "email" | "emailStatus"
  > | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSettings {
  id: string;
  workspaceId: string;
  profile: {
    name: string;
    title: string;
    skills: string[];
    experience: string;
    portfolio: string;
    github: string;
    linkedin: string;
    availability: string;
    projectPreferences: string[];
  };
  targeting: {
    countries: string[];
    companySizes: string[];
    industries: string[];
    leadTypes: string[];
    technologies: string[];
    minimumBudget: number;
  };
  scoring: Record<string, number>;
  discovery: {
    target: number;
    minimumScore: number;
    shortlistLimit: number;
  };
  outreachPaused: boolean;
  emailMode: string;
  weeklyEmailLimit: number;
  followUpDelayDays: number;
  maxFollowUps: number;
  updatedAt: string;
}

export interface DashboardSummary {
  leadsDiscovered: number;
  qualified: number;
  shortlisted: number;
  contacted: number;
  replies: number;
  interested: number;
  meetings: number;
  won: number;
  analyzedLeads: number;
  hotLeads: number;
  strongLeads: number;
  reviewLeads: number;
  rejectedLeads: number;
  aiAnalysisFailures: number;
  recentLeads: Lead[];
  activeJobs: Array<{
    id: string;
    type: string;
    status: string;
    progress: number;
  }>;
}
