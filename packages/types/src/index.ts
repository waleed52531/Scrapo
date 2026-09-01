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
  'NEW',
  'ANALYZING',
  'QUALIFIED',
  'SHORTLISTED',
  'DRAFTED',
  'APPROVED',
  'CONTACTED',
  'FOLLOW_UP',
  'REPLIED',
  'INTERESTED',
  'MEETING',
  'PROPOSAL',
  'WON',
  'LOST',
  'NOT_INTERESTED',
  'DO_NOT_CONTACT',
  'INVALID',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type LeadTemperature = 'HOT' | 'STRONG' | 'REVIEW' | 'WEAK' | 'REJECT';
export type LeadSource = 'X' | 'REDDIT' | 'TELEGRAM' | 'WEB' | 'AGENCY_DIRECTORY' | 'MANUAL';
export type LeadType = 'AGENCY_PARTNER' | 'ACTIVE_REQUIREMENT' | 'BUSINESS_OPPORTUNITY' | 'MANUAL';
export type EmailStatus = 'UNKNOWN' | 'GUESSED' | 'UNVERIFIED' | 'VERIFIED' | 'INVALID' | 'BOUNCED';

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
  partnershipFitScore: number;
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
  company?: Pick<Company, 'id' | 'name'> | null;
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
  status: LeadStatus;
  temperature: LeadTemperature;
  overallScore: number;
  firstDiscoveredAt: string;
  lastSignalAt: string;
  company?: Pick<Company, 'id' | 'name' | 'country' | 'city'> | null;
  contact?: Pick<Contact, 'id' | 'fullName' | 'role' | 'email' | 'emailStatus'> | null;
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
  recentLeads: Lead[];
  activeJobs: Array<{ id: string; type: string; status: string; progress: number }>;
}
