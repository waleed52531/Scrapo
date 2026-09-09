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

export type ComponentHealthStatus =
  "HEALTHY" | "DEGRADED" | "FAILED" | "DISABLED" | "NOT_CONFIGURED";

export type UsagePeriod = {
  days: number;
  aiRequests: number;
  aiInputTokens: number;
  aiOutputTokens: number;
  aiEstimatedCost: string;
  searchRequests: number;
  enrichmentRequests: number;
  emailVerificationRequests: number;
  coldEmailsSent: number;
};

export type UsageSummary = {
  limits: {
    maxAiCallsPerDay: number | null;
    maxAiCallsPerWeek: number | null;
    maxSearchRequestsPerWeek: number | null;
    maxEnrichmentRequestsPerWeek: number | null;
    maxEmailVerificationsPerWeek: number | null;
    weeklyColdEmailLimit: number;
  };
  periods: {
    today: UsagePeriod;
    week: UsagePeriod;
    month: UsagePeriod;
  };
};

export type SystemHealth = {
  status: ComponentHealthStatus;
  service: "system";
  versions: { web: string; api: string; worker: string };
  generatedAt: string;
  components: {
    api: { status: ComponentHealthStatus; version: string };
    database: { status: ComponentHealthStatus };
    redis: { status: ComponentHealthStatus; queues?: string[] };
    worker: {
      status: ComponentHealthStatus;
      stale: boolean;
      workerId?: string | null;
      version?: string | null;
      queues?: unknown;
      lastHeartbeatAt?: string | null;
      ageMs?: number;
    };
  };
  providers: Record<
    string,
    {
      status: ComponentHealthStatus;
      provider?: string;
      demoMode?: boolean;
      message?: string;
      configured?: boolean;
      model?: string;
      accountIdentifier?: string | null;
      lastSuccessfulAt?: string | null;
      lastErrorAt?: string | null;
    }
  >;
  safety: {
    demoAuthEnabled: boolean;
    outreachPausedDefault: boolean;
    autoSendEnabled: boolean;
    mockProvidersAllowedInProduction: boolean;
  };
  usageToday: UsagePeriod;
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
  "STALE",
  "ARCHIVED",
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
  | "PERMANENT_JOB"
  | "OTHER";
export type EmailStatus =
  | "UNKNOWN"
  | "GUESSED"
  | "LIKELY_VALID"
  | "UNVERIFIED"
  | "VERIFIED"
  | "INVALID"
  | "BOUNCED";
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
  | "SELF_PROMOTION"
  | "SPAM"
  | "BOT"
  | "STUDENT_PROJECT"
  | "PERMANENT_JOB_ONLY"
  | "IRRELEVANT"
  | "TUTORIAL"
  | "NEWS"
  | "JOB_AGGREGATOR"
  | "COMPETITOR"
  | "EXPIRED"
  | "DUPLICATE"
  | "INSUFFICIENT_INFORMATION";
export type OpportunityUrgency =
  "IMMEDIATE" | "THIS_WEEK" | "THIS_MONTH" | "FLEXIBLE" | "UNKNOWN";
export type ActionStatus = "PENDING" | "COMPLETED" | "SKIPPED" | "EXPIRED";
export type OutreachStatus =
  | "GENERATED"
  | "EDITED"
  | "DRAFT"
  | "DRAFT_CREATED"
  | "APPROVED"
  | "SENDING"
  | "SENT"
  | "DELIVERED"
  | "REPLIED"
  | "FOLLOW_UP_DUE"
  | "FOLLOW_UP_SENT"
  | "FAILED"
  | "CANCELLED"
  | "SUPPRESSED";
export type OutreachApprovalStatus =
  "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";
export type OutreachStrategy =
  | "AGENCY_PARTNERSHIP"
  | "ACTIVE_REQUIREMENT"
  | "MVP_STARTUP"
  | "EXISTING_APP_FIX"
  | "FIREBASE_API_SUPPORT"
  | "APP_STORE_SUPPORT"
  | "GENERAL_MOBILE_SUPPORT"
  | "CUSTOM";
export type ReplyClassification =
  | "INTERESTED"
  | "MAYBE_LATER"
  | "QUESTION"
  | "PORTFOLIO_REQUEST"
  | "PRICING_REQUEST"
  | "MEETING_REQUESTED"
  | "REFERRAL"
  | "NOT_INTERESTED"
  | "UNSUBSCRIBE"
  | "OUT_OF_OFFICE"
  | "BOUNCE"
  | "WRONG_PERSON"
  | "UNCLEAR";
export type AutomationRuleType =
  | "WEEKLY_LEAD_HUNT"
  | "GMAIL_REPLY_SYNC"
  | "FOLLOW_UP_SCAN"
  | "ANALYTICS_REFRESH"
  | "WEEKLY_REPORT";
export type AutomationRunStatus =
  | "SCHEDULED"
  | "RUNNING"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED"
  | "SKIPPED"
  | "CANCELLED";
export type RecommendationStatus =
  "NEW" | "ACCEPTED" | "REJECTED" | "DISMISSED";
export type LeadFeedbackRating = "LIKE" | "NEUTRAL" | "DISLIKE";

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
  discoveryCount: number;
  lastDiscoveredAt: string | null;
  duplicateConfidence: number;
  preQualificationScore: number;
  mobileOutsourcingOpportunityConfidence: number;
  enrichmentStatus: string | null;
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
  source: string | null;
  verifiedAt: string | null;
  verificationProvider: string | null;
  verificationResult: unknown;
  linkedinUrl: string | null;
  xUrl: string | null;
  redditUsername: string | null;
  telegramUsername: string | null;
  profileUrl: string | null;
  decisionMakerScore: number;
  contactConfidence: number;
  company?: Pick<Company, "id" | "name"> | null;
  createdAt: string;
  updatedAt: string;
}

export interface SearchQuery {
  id: string;
  workspaceId: string;
  source: LeadSource;
  query: string;
  enabled: boolean;
  priority: number;
  country: string | null;
  category: string;
  lastRun: string | null;
  lastRunAt: string | null;
  lastResultCount: number;
  totalResults: number;
  relevantResults: number;
  prequalifiedResults: number;
  uniqueCompanies: number;
  shortlisted: number;
  manualActions: number;
  qualityScore: number;
  lowPerformance: boolean;
  resultsFound: number;
  qualifiedResults: number;
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveryRun {
  id: string;
  workspaceId: string;
  systemJobId: string | null;
  name: string;
  status:
    "QUEUED" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED" | "CANCELLED";
  sources: string[];
  countries: string[];
  categories: string[];
  maxQueries: number;
  maxDiscoveries: number;
  minimumScore: number;
  shortlistLimit: number;
  rawResults: number;
  relevantResults: number;
  uniqueCompanies: number;
  duplicatesRemoved: number;
  companiesAnalyzed: number;
  contactsFound: number;
  emailsVerified: number;
  leadsScored: number;
  qualified: number;
  shortlisted: number;
  errors: unknown;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  queryRuns?: DiscoveryQueryRun[];
  leads?: Lead[];
  shortlists?: Shortlist[];
  _count?: { queryRuns: number; leads: number; shortlists: number };
}

export interface DiscoveryQueryRun {
  id: string;
  leadHuntId: string;
  searchQueryId: string | null;
  query: string;
  country: string | null;
  category: string | null;
  provider: string;
  resultsFound: number;
  relevantResults: number;
  duplicateResults: number;
  prequalifiedResults: number;
  enrichedResults: number;
  scoredResults: number;
  manualActions: number;
  uniqueCompanies: number;
  qualifiedCompanies: number;
  shortlistedCompanies: number;
  status: string;
  error: string | null;
  createdAt: string;
}

export interface Shortlist {
  id: string;
  workspaceId: string;
  discoveryRunId: string | null;
  name: string;
  weekStart: string;
  weekEnd: string;
  minimumScore: number;
  maximumItems: number;
  createdAt: string;
  discoveryRun?: DiscoveryRun | null;
  items?: ShortlistItem[];
  _count?: { items: number };
}

export interface ShortlistItem {
  id: string;
  shortlistId: string;
  leadId: string;
  rank: number;
  scoreAtSelection: number;
  rankingScore: number;
  rankReason: string[];
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  lead: Lead;
}

export interface ProviderHealth {
  provider: string;
  status:
    | "CONNECTED"
    | "NOT_CONFIGURED"
    | "CONFIGURED"
    | "APPROVAL_REQUIRED"
    | "ACTIVE"
    | "DISABLED"
    | "ERROR";
  demoMode: boolean;
  message: string;
  lastSuccessfulSync?: string | null;
  lastError?: string | null;
}

export interface Lead {
  id: string;
  companyId: string | null;
  contactId: string | null;
  primarySignalId: string | null;
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
  socialPreQualificationScore: number;
  opportunityUrgency: OpportunityUrgency;
  buyerIntentScore: number;
  selfPromotionProbability: number;
  socialSpamProbability: number;
  sourceCount: number;
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
  rankingScore: number;
  rankReason: string[];
  rankBreakdown: unknown;
  staleAt: string | null;
  reactivatedAt: string | null;
  status: LeadStatus;
  temperature: LeadTemperature;
  overallScore: number;
  firstDiscoveredAt: string;
  lastSignalAt: string;
  company?: Pick<Company, "id" | "name" | "country" | "city"> | null;
  contact?: Pick<
    Contact,
    | "id"
    | "fullName"
    | "role"
    | "email"
    | "emailStatus"
    | "xUrl"
    | "redditUsername"
    | "telegramUsername"
    | "profileUrl"
  > | null;
  signals?: SocialSignal[];
  actions?: ActionItem[];
  _count?: { signals?: number; actions?: number };
  createdAt: string;
  updatedAt: string;
}

export interface SocialSignal {
  id: string;
  source: LeadSource;
  signalType: string;
  content: string;
  sourceUrl: string | null;
  profileUrl: string | null;
  authorExternalId: string | null;
  username: string | null;
  displayName: string | null;
  authorType: string | null;
  authorTypeConfidence: number;
  opportunityUrgency: OpportunityUrgency;
  signalQualityScore: number;
  socialPreQualificationScore: number;
  signalScore: number;
  metadata: unknown;
  publishedAt: string | null;
  createdAt: string;
}

export interface AutomationRule {
  id: string;
  workspaceId: string;
  name: string;
  type: AutomationRuleType | string;
  enabled: boolean;
  scheduleType: string;
  timezone: string;
  cronExpression: string | null;
  configuration: unknown;
  skipNextAt: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastRunStatus: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  runs?: AutomationRun[];
}

export interface AutomationRun {
  id: string;
  workspaceId: string;
  automationRuleId: string;
  scheduledFor: string;
  scheduledPeriod: string;
  startedAt: string | null;
  completedAt: string | null;
  status: AutomationRunStatus | string;
  jobId: string | null;
  previousRunId: string | null;
  summary: unknown;
  error: string | null;
  createdAt: string;
  automationRule?: AutomationRule;
}

export interface Notification {
  id: string;
  workspaceId: string;
  userId: string | null;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface WeeklyReport {
  id: string;
  workspaceId: string;
  weekStart: string;
  weekEnd: string;
  metrics: Record<string, number>;
  sourcePerformance: unknown;
  queryPerformance: unknown;
  recommendations: unknown;
  failures: unknown;
  generatedAt: string;
}

export interface OptimizationRecommendation {
  id: string;
  workspaceId: string;
  type: string;
  title: string;
  description: string;
  evidence: unknown;
  status: RecommendationStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface LeadFeedback {
  id: string;
  workspaceId: string;
  leadId: string;
  rating: LeadFeedbackRating;
  reason: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface ActionItem {
  id: string;
  workspaceId: string;
  leadId: string | null;
  contactId: string | null;
  platform: LeadSource | null;
  actionType: string | null;
  type: string;
  title: string;
  content: string | null;
  suggestedText: string | null;
  sourceUrl: string | null;
  profileUrl: string | null;
  status: ActionStatus;
  dueAt: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  stale: boolean;
  createdAt: string;
  updatedAt: string;
  lead?: Lead | null;
  contact?: Contact | null;
}

export interface GmailIntegrationStatus {
  provider: "GMAIL";
  status:
    | "NOT_CONFIGURED"
    | "CONFIGURED"
    | "CONNECTED"
    | "REAUTH_REQUIRED"
    | "DISCONNECTED"
    | "ERROR";
  connected: boolean;
  accountIdentifier: string | null;
  connectedAt: string | null;
  lastSuccessfulSync: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  capabilities: {
    createDrafts: boolean;
    sendEmail: boolean;
    readReplies: boolean;
    threadTracking: boolean;
  };
  scopes: string[];
  mockMode: boolean;
  connectUrl?: string | null;
}

export interface OutreachEligibility {
  eligible: boolean;
  checks: Record<string, boolean>;
  warnings: string[];
  reasons: string[];
}

export interface OutreachMessage {
  id: string;
  workspaceId: string;
  leadId: string;
  contactId: string | null;
  campaignId: string | null;
  channel: string;
  strategy: OutreachStrategy | string;
  messageType: "INITIAL" | "FOLLOW_UP" | "REPLY" | string;
  subject: string | null;
  body: string;
  originalGeneratedSubject: string | null;
  originalGeneratedBody: string | null;
  personalizationPoints: string[];
  confidence: number;
  approvalStatus: OutreachApprovalStatus;
  status: OutreachStatus;
  gmailDraftId: string | null;
  gmailMessageId: string | null;
  gmailThreadId: string | null;
  generatedByModel: string | null;
  promptVersion: string | null;
  generatedAt: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  repliedAt: string | null;
  followUpNumber: number;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  lead?: Lead | null;
  contact?: Contact | null;
  campaign?: Campaign | null;
  replies?: EmailReply[];
}

export interface EmailReply {
  id: string;
  workspaceId: string;
  outreachMessageId: string;
  leadId: string | null;
  contactId: string | null;
  gmailMessageId: string | null;
  gmailThreadId: string | null;
  fromEmail: string | null;
  toEmail: string | null;
  subject: string | null;
  body: string;
  bodyText: string | null;
  classification: ReplyClassification | string | null;
  sentiment: string | null;
  summary: string | null;
  recommendedAction: string | null;
  requiresResponse: boolean;
  meetingRequested: boolean;
  aiConfidence: number;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
  outreachMessage?: OutreachMessage | null;
  lead?: Lead | null;
  contact?: Contact | null;
}

export interface Campaign {
  id: string;
  workspaceId: string;
  name: string;
  strategy: OutreachStrategy | string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED" | string;
  minimumScore: number;
  shortlistLimit: number;
  weeklyLimit: number;
  emailMode: string;
  autoSendEnabled: boolean;
  autoSendThreshold: number;
  followUpDays: number;
  followUpMode: string;
  maxFollowUps: number;
  targeting: unknown;
  createdAt: string;
  updatedAt: string;
  analytics?: {
    leads: number;
    sent: number;
    replies: number;
    interested: number;
    meetings: number;
    won: number;
    replyRate: number;
  };
}

export interface SuppressionEntry {
  id: string;
  workspaceId: string;
  email: string | null;
  domain: string | null;
  contactId: string | null;
  reason: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  contact?: Contact | null;
}

export interface SocialProfile {
  id: string;
  workspaceId: string;
  contactId: string | null;
  platform: LeadSource;
  externalId: string | null;
  username: string | null;
  displayName: string | null;
  profileUrl: string | null;
  authorType: string | null;
  authorTypeConfidence: number;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  contact?: Contact | null;
}

export interface TelegramSource {
  id: string;
  workspaceId: string;
  externalId: string | null;
  name: string;
  username: string | null;
  type: string;
  enabled: boolean;
  keywords: string[];
  notes: string | null;
  status: string;
  lastSyncedAt: string | null;
  lastError: string | null;
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
  autoSendEnabled: boolean;
  autoSendMinimumScore: number;
  autoSendDailyLimit: number;
  autoGenerateOutreachDrafts: boolean;
  automationPaused: boolean;
  automationKillSwitch: boolean;
  timezone: string;
  outreachBusinessHoursStart: string;
  outreachBusinessHoursEnd: string;
  outreachBusinessDays: number[];
  sourcePriorities: Record<string, "HIGH" | "NORMAL" | "LOW" | string>;
  discoveryBudgetAllocation: Record<string, number>;
  optimizationSettings: Record<string, unknown>;
  staleLeadTtls: Record<string, number>;
  sendOwnerEmailAlerts: boolean;
  dailyDigestEnabled: boolean;
  scoreJumpThreshold: number;
  followUpDelayDays: number;
  followUpMode: string;
  maxFollowUps: number;
  coldOutreachCooldownDays: number;
  maxNewContactsPerCompanyPer30Days: number;
  emailSignature: string | null;
  optOutFooter: string | null;
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
  emailsSentThisWeek?: number;
  replyRate?: number;
  followUpsDue?: number;
  enabledAutomationRules?: number;
  failedAutomationRuns?: number;
  unreadNotifications?: number;
  newOptimizationRecommendations?: number;
  gmailStatus?: GmailIntegrationStatus["status"];
  outreachAnalytics?: {
    generated: number;
    drafted: number;
    sent: number;
    replied: number;
    interested: number;
    meetings: number;
    proposals: number;
    won: number;
    notInterested: number;
    bounced: number;
  };
  socialFunnel: Array<{
    source: LeadSource;
    found: number;
    qualified: number;
    shortlisted: number;
    manualActions: number;
  }>;
  hotSocialLeads: Array<
    Lead & {
      signals?: SocialSignal[];
      actions?: ActionItem[];
    }
  >;
  recentLeads: Lead[];
  activeJobs: Array<{
    id: string;
    type: string;
    status: string;
    progress: number;
  }>;
}
