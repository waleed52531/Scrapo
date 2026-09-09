import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EmailStatus, LeadStatus, OutreachStatus } from "@prisma/client";
import { defaultSettings } from "../auth/workspace-context.service";
import { PrismaService } from "../prisma/prisma.service";

type EligibilityMode =
  "GENERATE" | "DRAFT" | "SEND" | "AUTO_SEND" | "FOLLOW_UP";

type EligibilityInput = {
  mode: EligibilityMode;
  outreachId?: string;
  campaignId?: string | null;
};

type CheckKey =
  | "leadQualified"
  | "contactExists"
  | "emailExists"
  | "emailAllowed"
  | "emailVerified"
  | "notSuppressed"
  | "notRecentlyContacted"
  | "companyFrequency"
  | "noDuplicateActiveOutreach"
  | "weeklyLimitAvailable"
  | "outreachNotPaused"
  | "gmailConnected"
  | "campaignCanSend"
  | "autoSendThreshold"
  | "autoSendConfigured"
  | "decisionMakerScore"
  | "confidence";

@Injectable()
export class OutreachEligibilityService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async check(workspaceId: string, leadId: string, input: EligibilityInput) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      include: {
        company: true,
        contact: true,
        scores: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!lead) {
      throw new NotFoundException({
        code: "LEAD_NOT_FOUND",
        message: "Lead could not be found.",
      });
    }

    const settings = await this.prisma.userSettings.upsert({
      where: { workspaceId },
      update: {},
      create: { workspaceId, ...defaultSettings() },
    });
    const gmail = await this.prisma.integrationConnection.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: "GMAIL" } },
    });
    const contact = lead.contact;
    const email = contact?.email?.toLowerCase() ?? null;
    const domain = email?.split("@").at(1) ?? lead.company?.domain ?? null;
    const suppressed = await this.prisma.suppressionEntry.findFirst({
      where: {
        workspaceId,
        OR: [
          ...(email ? [{ email }] : []),
          ...(domain ? [{ domain }] : []),
          ...(contact?.id ? [{ contactId: contact.id }] : []),
        ],
      },
    });
    const weekStart = startOfWeek(new Date());
    const weeklyLimit = Number(
      process.env.COLD_OUTREACH_WEEKLY_LIMIT ?? settings.weeklyEmailLimit,
    );
    const sentThisWeek = await this.prisma.outreachMessage.count({
      where: {
        workspaceId,
        messageType: "INITIAL",
        sentAt: { gte: weekStart },
        status: {
          in: [
            OutreachStatus.SENT,
            OutreachStatus.DELIVERED,
            OutreachStatus.REPLIED,
          ],
        },
      },
    });
    const cooldownDays = Number(
      process.env.COLD_OUTREACH_COOLDOWN_DAYS ??
        settings.coldOutreachCooldownDays,
    );
    const cooldownSince = new Date(Date.now() - cooldownDays * 86_400_000);
    const recentContact = contact?.id
      ? await this.prisma.outreachMessage.findFirst({
          where: {
            workspaceId,
            contactId: contact.id,
            messageType: "INITIAL",
            sentAt: { gte: cooldownSince },
            id: input.outreachId ? { not: input.outreachId } : undefined,
          },
        })
      : null;
    const companyContactLimit = Number(
      process.env.MAX_NEW_CONTACTS_PER_COMPANY_PER_30_DAYS ??
        settings.maxNewContactsPerCompanyPer30Days,
    );
    const companySince = new Date(Date.now() - 30 * 86_400_000);
    const companyContacted = lead.companyId
      ? await this.prisma.outreachMessage.findMany({
          where: {
            workspaceId,
            lead: { companyId: lead.companyId },
            messageType: "INITIAL",
            sentAt: { gte: companySince },
            id: input.outreachId ? { not: input.outreachId } : undefined,
          },
          distinct: ["contactId"],
          take: companyContactLimit + 1,
        })
      : [];
    const duplicateActive = await this.prisma.outreachMessage.findFirst({
      where: {
        workspaceId,
        leadId: lead.id,
        id: input.outreachId ? { not: input.outreachId } : undefined,
        messageType: input.mode === "FOLLOW_UP" ? "FOLLOW_UP" : "INITIAL",
        status: {
          in: [
            OutreachStatus.GENERATED,
            OutreachStatus.EDITED,
            OutreachStatus.DRAFT,
            OutreachStatus.DRAFT_CREATED,
            OutreachStatus.APPROVED,
            OutreachStatus.SENDING,
            OutreachStatus.SENT,
          ],
        },
      },
    });
    const campaign = input.campaignId
      ? await this.prisma.campaign.findFirst({
          where: { id: input.campaignId, workspaceId },
        })
      : null;

    const checks = {
      leadQualified:
        lead.status !== LeadStatus.INVALID &&
        lead.status !== LeadStatus.DO_NOT_CONTACT &&
        lead.invalidReason === null,
      contactExists: Boolean(contact),
      emailExists: Boolean(email),
      emailAllowed: emailAllowed(contact?.emailStatus),
      emailVerified: contact?.emailStatus === EmailStatus.VERIFIED,
      notSuppressed: !suppressed,
      notRecentlyContacted: !recentContact,
      companyFrequency:
        !lead.companyId || companyContacted.length < companyContactLimit,
      noDuplicateActiveOutreach: !duplicateActive,
      weeklyLimitAvailable: sentThisWeek < weeklyLimit,
      outreachNotPaused: !settings.outreachPaused,
      gmailConnected: gmail?.status === "CONNECTED",
      campaignCanSend:
        !campaign || ["DRAFT", "ACTIVE"].includes(campaign.status),
      autoSendThreshold:
        lead.overallScore >=
        Number(
          process.env.AUTO_SEND_MINIMUM_SCORE ??
            campaign?.autoSendThreshold ??
            settings.autoSendMinimumScore,
        ),
      autoSendConfigured:
        process.env.AUTO_SEND_ENABLED === "true" ||
        settings.autoSendEnabled ||
        Boolean(campaign?.autoSendEnabled),
      decisionMakerScore: (contact?.decisionMakerScore ?? 0) >= 70,
      confidence:
        (lead.analysisConfidence || lead.scores[0]?.confidence || 0) >= 80,
    };
    const warnings: string[] = [];
    if (
      contact?.emailStatus === EmailStatus.LIKELY_VALID ||
      contact?.emailStatus === EmailStatus.UNVERIFIED
    ) {
      warnings.push(
        `Email status is ${contact.emailStatus}; verify before auto-send.`,
      );
    }
    const required = requiredChecks(input.mode);
    const reasons = required
      .filter((key) => !checks[key])
      .map((key) => reasonFor(key));
    return {
      eligible: reasons.length === 0,
      checks,
      warnings,
      reasons,
      lead,
      contact,
      company: lead.company,
      settings,
      campaign,
    };
  }

  async assertEligible(
    workspaceId: string,
    leadId: string,
    input: EligibilityInput,
  ) {
    const result = await this.check(workspaceId, leadId, input);
    if (result.eligible) return result;
    if (!result.checks.weeklyLimitAvailable) {
      throw new BadRequestException({
        code: "WEEKLY_OUTREACH_LIMIT_REACHED",
        message: "The configured weekly cold outreach limit has been reached.",
      });
    }
    if (!result.checks.outreachNotPaused) {
      throw new BadRequestException({
        code: "OUTREACH_PAUSED",
        message: "All outgoing outreach is paused for this workspace.",
      });
    }
    if (!result.checks.gmailConnected) {
      throw new BadRequestException({
        code: "GMAIL_NOT_CONNECTED",
        message: "Connect Gmail before creating drafts or sending email.",
      });
    }
    if (!result.checks.notSuppressed) {
      throw new BadRequestException({
        code: "OUTREACH_SUPPRESSED",
        message: "This lead, contact, email, or domain is suppressed.",
      });
    }
    throw new BadRequestException({
      code: "OUTREACH_NOT_ELIGIBLE",
      message: result.reasons[0] ?? "This lead is not eligible for outreach.",
      details: { checks: result.checks, reasons: result.reasons },
    });
  }
}

function emailAllowed(status: EmailStatus | null | undefined) {
  return (
    status === EmailStatus.VERIFIED ||
    status === EmailStatus.LIKELY_VALID ||
    status === EmailStatus.UNVERIFIED
  );
}

function requiredChecks(mode: EligibilityMode): CheckKey[] {
  const base = [
    "leadQualified",
    "contactExists",
    "emailExists",
    "emailAllowed",
    "notSuppressed",
  ] as const;
  if (mode === "GENERATE") return [...base, "noDuplicateActiveOutreach"];
  if (mode === "DRAFT")
    return [...base, "gmailConnected", "noDuplicateActiveOutreach"];
  if (mode === "FOLLOW_UP")
    return [
      ...base,
      "gmailConnected",
      "outreachNotPaused",
      "weeklyLimitAvailable",
    ];
  if (mode === "AUTO_SEND")
    return [
      ...base,
      "emailVerified",
      "notRecentlyContacted",
      "companyFrequency",
      "weeklyLimitAvailable",
      "outreachNotPaused",
      "gmailConnected",
      "campaignCanSend",
      "autoSendThreshold",
      "autoSendConfigured",
      "decisionMakerScore",
      "confidence",
    ];
  return [
    ...base,
    "notRecentlyContacted",
    "companyFrequency",
    "weeklyLimitAvailable",
    "outreachNotPaused",
    "gmailConnected",
    "campaignCanSend",
  ];
}

function reasonFor(key: string) {
  const reasons: Record<string, string> = {
    leadQualified: "Lead is invalid, rejected, or marked do-not-contact.",
    contactExists: "Lead does not have a contact.",
    emailExists: "Contact does not have an email address.",
    emailAllowed: "Contact email status is not eligible for outreach.",
    emailVerified: "Automatic sending requires a verified email.",
    notSuppressed: "Lead, contact, email, or domain is suppressed.",
    notRecentlyContacted: "This contact was emailed recently.",
    companyFrequency: "Company contact frequency limit would be exceeded.",
    noDuplicateActiveOutreach: "A duplicate active outreach already exists.",
    weeklyLimitAvailable: "Weekly outreach limit has been reached.",
    outreachNotPaused: "All outgoing outreach is paused.",
    gmailConnected: "Gmail is not connected.",
    campaignCanSend: "Campaign is paused or archived.",
    autoSendThreshold: "Lead does not meet auto-send score threshold.",
    autoSendConfigured: "Auto-send is disabled.",
    decisionMakerScore:
      "Contact does not meet auto-send decision-maker threshold.",
    confidence: "Analysis confidence is too low for auto-send.",
  };
  return reasons[key] ?? key;
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  result.setDate(result.getDate() - result.getDay());
  result.setHours(0, 0, 0, 0);
  return result;
}
