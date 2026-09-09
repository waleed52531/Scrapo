import "dotenv/config";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import {
  ActionStatus,
  AnalysisStatus,
  EmailStatus,
  IntegrationStatus,
  InvalidLeadReason,
  LeadSource,
  LeadStatus,
  LeadTemperature,
  LeadType,
  OpportunityUrgency,
  OutreachRecommendation,
  RecommendedChannel,
  OutreachChannel,
  OutreachStatus,
  PrismaClient,
  ProcessingStatus,
  WorkspaceRole,
} from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_AUTH_ID = "00000000-0000-0000-0000-000000000001";

const defaultAgencySearchQueries = [
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

const defaultSocialSearchQueries = [
  {
    source: LeadSource.X,
    category: "FLUTTER_REQUIREMENT",
    query: '"looking for flutter developer"',
    priority: 100,
  },
  {
    source: LeadSource.X,
    category: "ACTIVE_REQUIREMENT",
    query: '"need someone to finish our app"',
    priority: 88,
  },
  {
    source: LeadSource.REDDIT,
    category: "MVP",
    query: "mobile app MVP",
    priority: 76,
  },
  {
    source: LeadSource.TELEGRAM,
    category: "FLUTTER_REQUIREMENT",
    query: "flutter",
    priority: 80,
  },
] as const;

const companySeeds = [
  [
    "Northstar Digital",
    "northstardigital.demo",
    "United Kingdom",
    "London",
    94,
  ],
  ["Sandstone Labs", "sandstonelabs.demo", "United Arab Emirates", "Dubai", 91],
  ["Maple Stack", "maplestack.demo", "Canada", "Toronto", 89],
  ["Harbor Web Co", "harborweb.demo", "Australia", "Sydney", 88],
  ["Riyadh Product Studio", "riyadhstudio.demo", "Saudi Arabia", "Riyadh", 87],
  ["Cedar SaaS Works", "cedarsaas.demo", "United States", "Austin", 85],
  ["Brightline UX", "brightlineux.demo", "Ireland", "Dublin", 83],
  ["Delta Commerce", "deltacommerce.demo", "Netherlands", "Amsterdam", 82],
  ["Alpine Backend", "alpinebackend.demo", "Germany", "Berlin", 80],
  ["Lion City Systems", "lioncitysystems.demo", "Singapore", "Singapore", 78],
  ["Pearl Digital", "pearldigital.demo", "Qatar", "Doha", 76],
  ["Gulf Web Partners", "gulfwebpartners.demo", "Bahrain", "Manama", 74],
  ["Kiwi Product Co", "kiwiproduct.demo", "New Zealand", "Auckland", 72],
  ["Prairie Platforms", "prairieplatforms.demo", "Canada", "Calgary", 70],
  [
    "Thames Software House",
    "thamessoftware.demo",
    "United Kingdom",
    "Manchester",
    68,
  ],
] as const;

const firstNames = [
  "James",
  "Amira",
  "Oliver",
  "Sophie",
  "Faisal",
  "Maya",
  "Aoife",
  "Noah",
  "Lena",
  "Wei",
  "Layla",
  "Omar",
  "Aria",
  "Ethan",
  "Charlotte",
  "Daniel",
  "Sara",
  "Adam",
  "Nora",
  "Lucas",
];

async function main() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.SEED_DEMO_DATA !== "true"
  ) {
    console.info(
      "Production seed skipped. Set SEED_DEMO_DATA=true only for an intentionally isolated staging/demo database.",
    );
    return;
  }

  const existing = await prisma.workspace.findUnique({
    where: { slug: "demo-workspace" },
  });
  if (existing) await prisma.workspace.delete({ where: { id: existing.id } });

  const user = await prisma.user.upsert({
    where: { externalAuthId: DEMO_AUTH_ID },
    update: { email: "demo@scrapo.local", displayName: "Demo Developer" },
    create: {
      externalAuthId: DEMO_AUTH_ID,
      email: "demo@scrapo.local",
      displayName: "Demo Developer",
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: "Scrapo Demo Workspace",
      slug: "demo-workspace",
      members: { create: { userId: user.id, role: WorkspaceRole.OWNER } },
      settings: {
        create: {
          profile: {
            name: "Demo Developer",
            title: "Mobile Application Developer",
            skills: [
              "Flutter development",
              "Android development",
              "iOS development",
              "Firebase integration",
              "REST API integration",
              "Push notifications",
              "Authentication and OTP",
              "Google Maps",
              "Payment integrations",
              "App maintenance",
              "Bug fixing",
              "Performance improvement",
              "Figma to Flutter",
              "Play Store deployment",
              "App Store deployment",
            ],
            experience:
              "Production mobile application delivery and ongoing support.",
            portfolio: "",
            github: "",
            linkedin: "",
            availability: "Available for freelance and agency partnerships",
            projectPreferences: [
              "Existing application development",
              "Flutter bug fixing",
              "Firebase/API integration",
              "Agency outsourcing partnerships",
              "MVP mobile applications",
              "Long-term mobile development support",
            ],
          },
          targeting: {
            countries: [
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
            ],
            companySizes: ["2-10", "11-50", "51-100"],
            industries: ["Software", "SaaS", "Digital agencies", "E-commerce"],
            leadTypes: [
              "AGENCY_PARTNER",
              "ACTIVE_REQUIREMENT",
              "BUSINESS_OPPORTUNITY",
            ],
            technologies: ["Flutter", "Firebase", "Android", "iOS"],
            minimumBudget: 0,
          },
          scoring: {
            buyingIntent: 25,
            mobileRelevance: 20,
            agencyFit: 15,
            decisionMakerQuality: 10,
            contactability: 10,
            recency: 10,
            companyQuality: 5,
            countryPriority: 5,
          },
          discovery: { target: 300, minimumScore: 82, shortlistLimit: 20 },
          outreachPaused: false,
          emailMode: "DRAFT_FIRST",
          weeklyEmailLimit: 20,
          autoSendEnabled: false,
          autoSendMinimumScore: 92,
          autoSendDailyLimit: 5,
          autoGenerateOutreachDrafts: true,
          automationPaused: false,
          automationKillSwitch: false,
          timezone: process.env.DEFAULT_WORKSPACE_TIMEZONE ?? "Asia/Karachi",
          outreachBusinessHoursStart: "09:00",
          outreachBusinessHoursEnd: "17:00",
          outreachBusinessDays: [1, 2, 3, 4, 5],
          sourcePriorities: { WEB: 100, X: 80, REDDIT: 60, TELEGRAM: 60 },
          discoveryBudgetAllocation: {
            WEB: 60,
            X: 20,
            REDDIT: 10,
            TELEGRAM: 10,
          },
          optimizationSettings: {
            minimumSourceSampleSize: 10,
            minimumQuerySampleSize: 5,
            recommendationsAutoApply: false,
          },
          staleLeadTtls: { defaultDays: 30, activeRequirementDays: 14 },
          sendOwnerEmailAlerts: false,
          dailyDigestEnabled: true,
          scoreJumpThreshold: 10,
          followUpDelayDays: 7,
          followUpMode: "DRAFT",
          maxFollowUps: 1,
          coldOutreachCooldownDays: 90,
          maxNewContactsPerCompanyPer30Days: 1,
          emailSignature:
            "Demo Developer\nFlutter, Firebase, Android and iOS support",
          optOutFooter:
            "If this is not relevant, reply unsubscribe and I will not contact you again.",
        },
      },
    },
  });

  await prisma.integrationConnection.create({
    data: {
      workspaceId: workspace.id,
      provider: "GMAIL",
      status: IntegrationStatus.CONNECTED,
      accountIdentifier: "mock.gmail@scrapo.local",
      encryptedCredentials: encryptCredentials({
        provider: "mock",
        mockReplies: [],
      }),
      encryptedCredentialsReference:
        "integration_connections.encrypted_credentials",
      scopes: [
        "https://www.googleapis.com/auth/gmail.compose",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.readonly",
      ],
      connectedAt: new Date(),
      lastSuccessfulAt: new Date(),
      lastSuccessfulRequest: new Date(),
    },
  });

  await prisma.automationRule.createMany({
    data: [
      {
        workspaceId: workspace.id,
        name: "Weekly Lead Hunt",
        type: "WEEKLY_LEAD_HUNT",
        enabled: false,
        schedule: "0 8 * * 1",
        scheduleType: "WEEKLY",
        timezone: process.env.DEFAULT_WORKSPACE_TIMEZONE ?? "Asia/Karachi",
        cronExpression: "0 8 * * 1",
        configuration: {
          dayOfWeek: 1,
          time: "08:00",
          sources: ["WEB", "X"],
          countries: [
            "United Kingdom",
            "United Arab Emirates",
            "United States",
          ],
          categories: ["WEB_AGENCY", "FLUTTER_REQUIREMENT"],
          maxQueries: 8,
          maxRawDiscoveries: 300,
          minimumScore: 82,
          shortlistLimit: 20,
          autoGenerateOutreachDrafts: true,
        },
        config: {
          dayOfWeek: 1,
          time: "08:00",
          sources: ["WEB", "X"],
          countries: [
            "United Kingdom",
            "United Arab Emirates",
            "United States",
          ],
          categories: ["WEB_AGENCY", "FLUTTER_REQUIREMENT"],
          maxQueries: 8,
          maxRawDiscoveries: 300,
          minimumScore: 82,
          shortlistLimit: 20,
          autoGenerateOutreachDrafts: true,
        },
      },
      {
        workspaceId: workspace.id,
        name: "Gmail Reply Sync",
        type: "GMAIL_REPLY_SYNC",
        enabled: true,
        schedule: "*/30 * * * *",
        scheduleType: "INTERVAL_MINUTES",
        timezone: process.env.DEFAULT_WORKSPACE_TIMEZONE ?? "Asia/Karachi",
        cronExpression: "*/30 * * * *",
        configuration: { intervalMinutes: 30 },
        config: { intervalMinutes: 30 },
        nextRunAt: new Date(Date.now() + 30 * 60_000),
      },
      {
        workspaceId: workspace.id,
        name: "Follow-up Scan",
        type: "FOLLOW_UP_SCAN",
        enabled: true,
        schedule: "0 9 * * 1-5",
        scheduleType: "DAILY",
        timezone: process.env.DEFAULT_WORKSPACE_TIMEZONE ?? "Asia/Karachi",
        cronExpression: "0 9 * * 1-5",
        configuration: { time: "09:00" },
        config: { time: "09:00" },
        nextRunAt: new Date(Date.now() + 24 * 60 * 60_000),
      },
      {
        workspaceId: workspace.id,
        name: "Analytics Refresh",
        type: "ANALYTICS_REFRESH",
        enabled: true,
        schedule: "0 7 * * 1-5",
        scheduleType: "DAILY",
        timezone: process.env.DEFAULT_WORKSPACE_TIMEZONE ?? "Asia/Karachi",
        cronExpression: "0 7 * * 1-5",
        configuration: { time: "07:00" },
        config: { time: "07:00" },
        nextRunAt: new Date(Date.now() + 12 * 60 * 60_000),
      },
      {
        workspaceId: workspace.id,
        name: "Weekly Report",
        type: "WEEKLY_REPORT",
        enabled: false,
        schedule: "0 17 * * 5",
        scheduleType: "WEEKLY",
        timezone: process.env.DEFAULT_WORKSPACE_TIMEZONE ?? "Asia/Karachi",
        cronExpression: "0 17 * * 5",
        configuration: { dayOfWeek: 5, time: "17:00" },
        config: { dayOfWeek: 5, time: "17:00" },
      },
    ],
    skipDuplicates: true,
  });

  await prisma.searchQuery.createMany({
    data: defaultAgencySearchQueries.map((item) => ({
      workspaceId: workspace.id,
      source: LeadSource.WEB,
      query: item.query,
      country: item.country,
      category: item.category,
      priority: item.priority,
      enabled: true,
    })),
    skipDuplicates: true,
  });

  await prisma.searchQuery.createMany({
    data: defaultSocialSearchQueries.map((item) => ({
      workspaceId: workspace.id,
      source: item.source,
      query: item.query,
      category: item.category,
      priority: item.priority,
      enabled: true,
    })),
    skipDuplicates: true,
  });

  await prisma.telegramSource.create({
    data: {
      workspaceId: workspace.id,
      externalId: "demo-telegram-flutter-builders",
      name: "DEMO DATA — Flutter Builders Channel",
      username: "flutter_builders_demo",
      type: "CHANNEL",
      enabled: true,
      keywords: ["flutter", "mobile developer", "firebase", "MVP"],
      notes:
        "DEMO DATA — configured channel example. Only approved Telegram sources are monitored.",
      status: "NOT_CONFIGURED",
    },
  });

  const companies = [];
  for (const [name, domain, country, city, fit] of companySeeds) {
    companies.push(
      await prisma.company.create({
        data: {
          workspaceId: workspace.id,
          name,
          normalizedName: name.toLowerCase(),
          domain,
          website: `https://${domain}`,
          description: `DEMO DATA — ${name} is a web and backend product studio.`,
          country,
          city,
          employeeRange: "11-50",
          companyType: "AGENCY",
          agencyType: "WEB_AND_BACKEND",
          services: [
            "Web development",
            "Backend development",
            "Product design",
          ],
          technologies: ["TypeScript", "React", "Node.js"],
          industries: ["SaaS", "E-commerce"],
          hasWebService: true,
          hasBackendService: true,
          hasMobileService: fit < 75,
          partnershipFitScore: fit,
          companyQualityScore: Math.min(95, fit + 2),
          mobileCapabilityConfidence: fit < 75 ? 65 : 20,
        },
      }),
    );
  }

  const contacts = [];
  for (let index = 0; index < 20; index += 1) {
    const company = companies[index % companies.length]!;
    const fullName = `${firstNames[index]} ${index % 2 === 0 ? "Smith" : "Khan"}`;
    contacts.push(
      await prisma.contact.create({
        data: {
          workspaceId: workspace.id,
          companyId: company.id,
          fullName,
          role:
            index % 3 === 0
              ? "Founder"
              : index % 3 === 1
                ? "CEO"
                : "Technical Director",
          email: `${firstNames[index]!.toLowerCase()}@${company.domain}`,
          emailStatus:
            index < 12 ? EmailStatus.VERIFIED : EmailStatus.UNVERIFIED,
          emailSource: "DEMO_DATA",
          linkedinUrl: `https://www.linkedin.com/in/demo-${index + 1}`,
          decisionMakerScore: Math.max(60, 96 - index),
          contactConfidence: Math.max(55, 92 - index),
        },
      }),
    );
  }

  await prisma.rawLead.createMany({
    data: Array.from({ length: 30 }, (_, index) => ({
      workspaceId: workspace.id,
      source:
        index % 3 === 0
          ? LeadSource.WEB
          : index % 3 === 1
            ? LeadSource.MANUAL
            : LeadSource.AGENCY_DIRECTORY,
      externalId: `demo-raw-${index + 1}`,
      sourceUrl: `https://example.com/demo-signal-${index + 1}`,
      author: `Demo source ${index + 1}`,
      content: `DEMO DATA — Public signal ${index + 1} indicating a possible mobile development opportunity.`,
      publishedAt: new Date(Date.now() - index * 86_400_000),
      rawPayload: { demo: true, sequence: index + 1 },
      processingStatus:
        index < 12 ? ProcessingStatus.PROCESSED : ProcessingStatus.REJECTED,
    })),
  });

  const leadScores = [95, 92, 90, 88, 86, 85, 84, 82, 79, 77, 75, 72];
  const leads = [];
  for (let index = 0; index < leadScores.length; index += 1) {
    const score = leadScores[index]!;
    const company = companies[index]!;
    const contact = contacts[index]!;
    const status =
      index === 0
        ? LeadStatus.INTERESTED
        : index < 8
          ? LeadStatus.SHORTLISTED
          : LeadStatus.QUALIFIED;
    const lead = await prisma.lead.create({
      data: {
        workspaceId: workspace.id,
        companyId: company.id,
        contactId: contact.id,
        primarySource: index % 2 === 0 ? LeadSource.WEB : LeadSource.MANUAL,
        leadType:
          index < 9 ? LeadType.AGENCY_PARTNER : LeadType.ACTIVE_REQUIREMENT,
        title: `${company.name} mobile partnership opportunity`,
        opportunitySummary:
          "DEMO DATA — Web-focused team with a credible need for external mobile delivery capacity.",
        recommendedPitch:
          "Offer focused Flutter and mobile delivery support while the agency retains its client relationship.",
        status,
        temperature:
          score >= 90
            ? LeadTemperature.HOT
            : score >= 80
              ? LeadTemperature.STRONG
              : LeadTemperature.REVIEW,
        overallScore: score,
        firstDiscoveredAt: new Date(Date.now() - index * 86_400_000),
        lastSignalAt: new Date(Date.now() - index * 43_200_000),
      },
    });
    leads.push(lead);
    await prisma.leadScore.create({
      data: {
        workspaceId: workspace.id,
        leadId: lead.id,
        buyingIntent: Math.min(25, 16 + (index % 10)),
        mobileRelevance: 18,
        agencyFit: 14,
        decisionMakerQuality: 9,
        contactability: 9,
        recency: 8,
        companyQuality: 5,
        countryPriority: 5,
        overall: score,
        confidence: 90 - index,
        explanation:
          "DEMO DATA — Precomputed example score; no AI analysis was performed.",
      },
    });
  }

  const campaign = await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      name: "Agency Mobile Development Partnerships",
      strategy: "AGENCY_PARTNERSHIP",
      status: "ACTIVE",
      minimumScore: 82,
      shortlistLimit: 20,
      weeklyLimit: 20,
      emailMode: "DRAFT_FIRST",
      autoSendEnabled: false,
      autoSendThreshold: 92,
      followUpDays: 7,
      followUpMode: "DRAFT",
      maxFollowUps: 1,
      targeting: {
        companyTypes: [
          "web agencies",
          "backend agencies",
          "SaaS agencies",
          "design agencies",
          "software agencies",
        ],
        countries: ["USA", "UK", "UAE", "Saudi Arabia", "Australia", "Canada"],
      },
    },
  });

  const outreach = [];
  for (let index = 0; index < 5; index += 1) {
    outreach.push(
      await prisma.outreachMessage.create({
        data: {
          workspaceId: workspace.id,
          leadId: leads[index]!.id,
          contactId: contacts[index]!.id,
          campaignId: campaign.id,
          channel: OutreachChannel.EMAIL,
          strategy: "AGENCY_PARTNERSHIP",
          messageType: "INITIAL",
          subject: `Mobile development support for ${companies[index]!.name}`,
          body: "DEMO DATA — Example outreach message for agency partnership review.",
          originalGeneratedSubject: `Mobile development support for ${companies[index]!.name}`,
          originalGeneratedBody:
            "DEMO DATA — Example outreach message for agency partnership review.",
          personalizationPoints: [
            "Uses the company name from the lead",
            "References mobile development support only because it is in the lead record",
          ],
          confidence: 84,
          approvalStatus: index < 3 ? "APPROVED" : "PENDING",
          generatedByModel: "seed-fixture",
          promptVersion: "phase-5-demo-outreach",
          generatedAt: new Date(Date.now() - (index + 9) * 86_400_000),
          approvedAt:
            index < 3 ? new Date(Date.now() - (index + 8) * 86_400_000) : null,
          sentAt:
            index < 3 ? new Date(Date.now() - (index + 8) * 86_400_000) : null,
          gmailDraftId: index >= 3 ? `mock-draft-seed-${index}` : null,
          gmailMessageId: `mock-message-seed-${index}`,
          gmailThreadId: `mock-thread-seed-${index}`,
          gmailHeaderMessageId: `<mock-message-seed-${index}@scrapo.local>`,
          status:
            index < 3 ? OutreachStatus.REPLIED : OutreachStatus.DRAFT_CREATED,
        },
      }),
    );
  }

  for (let index = 0; index < 3; index += 1) {
    await prisma.emailReply.create({
      data: {
        workspaceId: workspace.id,
        outreachMessageId: outreach[index]!.id,
        leadId: leads[index]!.id,
        contactId: contacts[index]!.id,
        gmailMessageId: `mock-reply-seed-${index}`,
        gmailThreadId: `mock-thread-seed-${index}`,
        fromEmail: contacts[index]!.email,
        toEmail: "mock.gmail@scrapo.local",
        subject: `Re: ${outreach[index]!.subject}`,
        body: "DEMO DATA — Thanks for reaching out. Please share your portfolio.",
        bodyText:
          "DEMO DATA — Thanks for reaching out. Please share your portfolio.",
        classification: index === 0 ? "INTERESTED" : "QUESTION",
        sentiment: "positive",
        summary: "Recipient asked for more details.",
        recommendedAction: "Reply manually with portfolio examples.",
        requiresResponse: true,
        meetingRequested: false,
        aiConfidence: 86,
        receivedAt: new Date(Date.now() - index * 86_400_000),
      },
    });
  }

  const phase2Fixtures = [
    {
      company: companies[0]!,
      contact: contacts[0]!,
      title: "UK Laravel and React agency partnership test",
      sourceContent:
        "Web agency in the UK with Laravel, React, backend delivery, a strong client portfolio, and no obvious mobile-development offering.",
      leadType: LeadType.AGENCY_PARTNER,
      status: LeadStatus.QUALIFIED,
      temperature: LeadTemperature.HOT,
      score: 91,
      invalidReason: null,
      recommendation: OutreachRecommendation.AGENCY_PARTNERSHIP,
      channel: RecommendedChannel.EMAIL,
      explanation:
        "Strong web/backend agency with limited visible mobile specialization and verified decision-maker contact.",
    },
    {
      company: companies[5]!,
      contact: contacts[5]!,
      title: "Founder needs Flutter app finished this month",
      sourceContent:
        "Looking for a Flutter developer to finish our Firebase app this month. Need someone available immediately.",
      leadType: LeadType.ACTIVE_REQUIREMENT,
      status: LeadStatus.QUALIFIED,
      temperature: LeadTemperature.HOT,
      score: 94,
      invalidReason: null,
      recommendation: OutreachRecommendation.ACTIVE_REQUIREMENT,
      channel: RecommendedChannel.EMAIL,
      explanation:
        "Very high buying intent with direct Flutter/Firebase relevance and immediate timing.",
    },
    {
      company: companies[2]!,
      contact: contacts[2]!,
      title: "Another Flutter freelancer looking for work",
      sourceContent:
        "I'm available for Flutter freelance work. Hire me for your app projects.",
      leadType: LeadType.INVALID,
      status: LeadStatus.INVALID,
      temperature: LeadTemperature.REJECT,
      score: 22,
      invalidReason: InvalidLeadReason.OTHER_FREELANCER,
      recommendation: OutreachRecommendation.DO_NOT_CONTACT,
      channel: RecommendedChannel.NONE,
      explanation:
        "Rejected because the author is another freelancer, not a buyer.",
    },
    {
      company: companies[3]!,
      contact: contacts[3]!,
      title: "Student Flutter university assignment",
      sourceContent:
        "Need help with my Flutter university assignment before Friday.",
      leadType: LeadType.INVALID,
      status: LeadStatus.INVALID,
      temperature: LeadTemperature.REJECT,
      score: 18,
      invalidReason: InvalidLeadReason.STUDENT_PROJECT,
      recommendation: OutreachRecommendation.DO_NOT_CONTACT,
      channel: RecommendedChannel.NONE,
      explanation:
        "Rejected because it appears to be a student assignment rather than commercial freelance work.",
    },
    {
      company: companies[9]!,
      contact: contacts[9]!,
      title: "Large mobile-development company agency fit test",
      sourceContent:
        "Large mobile-development company with 100 mobile engineers and mature native app teams.",
      leadType: LeadType.AGENCY_PARTNER,
      status: LeadStatus.QUALIFIED,
      temperature: LeadTemperature.WEAK,
      score: 58,
      invalidReason: null,
      recommendation: OutreachRecommendation.GENERAL_MOBILE_SUPPORT,
      channel: RecommendedChannel.MANUAL_RESEARCH,
      explanation:
        "Company quality is credible, but agency partnership fit is weak because mobile capacity appears already strong.",
    },
    {
      company: companies[6]!,
      contact: contacts[6]!,
      title: "Small SaaS founder considering mobile MVP",
      sourceContent:
        "Small SaaS founder considering a mobile MVP eventually, but timing and budget are not confirmed.",
      leadType: LeadType.MVP_STARTUP,
      status: LeadStatus.QUALIFIED,
      temperature: LeadTemperature.REVIEW,
      score: 72,
      invalidReason: null,
      recommendation: OutreachRecommendation.MVP_STARTUP,
      channel: RecommendedChannel.EMAIL,
      explanation:
        "Relevant possible future mobile MVP, but buying intent is moderate and needs review.",
    },
  ];

  for (const fixture of phase2Fixtures) {
    const lead = await prisma.lead.create({
      data: {
        workspaceId: workspace.id,
        companyId: fixture.company.id,
        contactId: fixture.contact.id,
        primarySource: LeadSource.MANUAL,
        leadType: fixture.leadType,
        title: fixture.title,
        opportunitySummary: fixture.sourceContent,
        sourceContent: fixture.sourceContent,
        recommendedPitch:
          fixture.recommendation === OutreachRecommendation.DO_NOT_CONTACT
            ? "Do not contact."
            : "Use a focused manual outreach message based on the detected opportunity.",
        status: fixture.status,
        temperature: fixture.temperature,
        overallScore: fixture.score,
        analysisStatus: AnalysisStatus.COMPLETED,
        analysisConfidence: 84,
        analysisSummary: fixture.explanation,
        evidence: { facts: [fixture.sourceContent], source: "DEMO_DATA" },
        aiInterpretation: { summary: fixture.explanation },
        unknowns: [],
        invalidReason: fixture.invalidReason,
        outreachRecommendation: fixture.recommendation,
        recommendedChannel: fixture.channel,
        aiModel: "seed-fixture",
        promptVersion: "phase-2-demo-fixture",
        firstDiscoveredAt: new Date(),
        lastSignalAt: new Date(),
      },
    });
    await prisma.leadScore.create({
      data: {
        workspaceId: workspace.id,
        leadId: lead.id,
        buyingIntent: fixture.score >= 90 ? 95 : fixture.score >= 70 ? 70 : 35,
        mobileRelevance:
          fixture.title.includes("Flutter") ||
          fixture.sourceContent.includes("mobile")
            ? 95
            : 70,
        agencyFit: fixture.title.includes("Large mobile") ? 35 : 80,
        decisionMakerQuality: 85,
        contactability: fixture.channel === RecommendedChannel.EMAIL ? 85 : 25,
        recency: 90,
        companyQuality: 80,
        countryPriority: 100,
        spamProbability: 0,
        competitorProbability: fixture.title.includes("Large mobile") ? 75 : 5,
        baseScore: fixture.score,
        penalty: 0,
        overall: fixture.score,
        temperature: fixture.temperature,
        confidence: 84,
        reason: fixture.explanation,
        explanation: fixture.explanation,
        recommendedChannel: fixture.channel,
        recommendedPitch:
          fixture.recommendation === OutreachRecommendation.DO_NOT_CONTACT
            ? "Do not contact."
            : "Use a focused manual outreach message based on the detected opportunity.",
        aiModel: "seed-fixture",
        promptVersion: "phase-2-demo-fixture",
      },
    });
    leads.push(lead);
  }

  const socialContact = await prisma.contact.update({
    where: { id: contacts[0]!.id },
    data: {
      xUrl: "https://x.com/demo_founder",
      profileUrl: "https://x.com/demo_founder",
    },
  });
  const socialRawLead = await prisma.rawLead.create({
    data: {
      workspaceId: workspace.id,
      source: LeadSource.X,
      externalId: "demo-x-flutter-buyer-1",
      sourceUrl: "https://x.com/demo_founder/status/1001",
      author: "Demo Founder",
      authorExternalId: "demo-founder-x-id",
      username: "demo_founder",
      displayName: "Demo Founder",
      profileUrl: "https://x.com/demo_founder",
      content:
        "DEMO DATA — We're looking for a Flutter developer to finish our Firebase application this month. Need someone available immediately.",
      publishedAt: new Date(),
      rawPayload: { demo: true, platform: "X" },
      processingStatus: ProcessingStatus.PROCESSED,
    },
  });
  const socialLead = await prisma.lead.create({
    data: {
      workspaceId: workspace.id,
      companyId: companies[0]!.id,
      contactId: socialContact.id,
      primarySource: LeadSource.X,
      leadType: LeadType.ACTIVE_REQUIREMENT,
      title: "X founder needs Flutter Firebase app finished",
      opportunitySummary:
        "DEMO DATA — Buyer is actively looking for Flutter/Firebase help this month.",
      sourceUrl: socialRawLead.sourceUrl,
      sourceContent: socialRawLead.content,
      publishedAt: socialRawLead.publishedAt,
      recommendedPitch:
        "Reply manually with concise Flutter/Firebase experience and ask what remains to ship.",
      status: LeadStatus.SHORTLISTED,
      temperature: LeadTemperature.HOT,
      overallScore: 93,
      analysisStatus: AnalysisStatus.COMPLETED,
      analysisConfidence: 89,
      analysisSummary:
        "High buyer intent, mobile relevance, immediate timing, and a reachable social profile.",
      socialPreQualificationScore: 88,
      opportunityUrgency: OpportunityUrgency.THIS_MONTH,
      buyerIntentScore: 92,
      selfPromotionProbability: 2,
      socialSpamProbability: 1,
      sourceCount: 2,
      evidence: {
        facts: [
          "Looking for a Flutter developer",
          "Firebase application",
          "this month",
        ],
        source: "X",
      },
      aiInterpretation: {
        summary:
          "Treat as an active buyer signal requiring a manual social reply.",
      },
      unknowns: ["Budget", "current app scope"],
      outreachRecommendation: OutreachRecommendation.ACTIVE_REQUIREMENT,
      recommendedChannel: RecommendedChannel.X_REPLY,
      aiModel: "seed-fixture",
      promptVersion: "phase-4-social-demo-fixture",
      firstDiscoveredAt: new Date(),
      lastSignalAt: new Date(),
    },
  });
  const primarySignal = await prisma.leadSignal.create({
    data: {
      workspaceId: workspace.id,
      leadId: socialLead.id,
      rawLeadId: socialRawLead.id,
      source: LeadSource.X,
      signalType: "SOCIAL_BUYER_INTENT",
      content: socialRawLead.content,
      sourceUrl: socialRawLead.sourceUrl,
      profileUrl: socialRawLead.profileUrl,
      authorExternalId: socialRawLead.authorExternalId,
      username: socialRawLead.username,
      displayName: socialRawLead.displayName,
      authorType: "FOUNDER",
      authorTypeConfidence: 88,
      opportunityUrgency: OpportunityUrgency.THIS_MONTH,
      signalQualityScore: 91,
      socialPreQualificationScore: 88,
      signalScore: 93,
      publishedAt: socialRawLead.publishedAt,
      metadata: { demo: true },
    },
  });
  await prisma.lead.update({
    where: { id: socialLead.id },
    data: { primarySignalId: primarySignal.id },
  });
  await prisma.leadSignal.create({
    data: {
      workspaceId: workspace.id,
      leadId: socialLead.id,
      source: LeadSource.TELEGRAM,
      signalType: "SOCIAL_SUPPORTING_SIGNAL",
      content:
        "DEMO DATA — Founder also asked a configured Telegram channel for Flutter/Firebase shipping help.",
      sourceUrl: "https://t.me/flutter_builders_demo/42",
      profileUrl: "https://t.me/demo_founder",
      username: "demo_founder",
      displayName: "Demo Founder",
      authorType: "FOUNDER",
      authorTypeConfidence: 80,
      opportunityUrgency: OpportunityUrgency.THIS_MONTH,
      signalQualityScore: 82,
      socialPreQualificationScore: 80,
      signalScore: 84,
      publishedAt: new Date(),
      metadata: { demo: true, source: "configured-telegram-channel" },
    },
  });
  await prisma.socialProfile.create({
    data: {
      workspaceId: workspace.id,
      contactId: socialContact.id,
      platform: LeadSource.X,
      externalId: "demo-founder-x-id",
      username: "demo_founder",
      displayName: "Demo Founder",
      profileUrl: "https://x.com/demo_founder",
      authorType: "FOUNDER",
      authorTypeConfidence: 88,
      metadata: { demo: true },
    },
  });
  await prisma.actionItem.create({
    data: {
      workspaceId: workspace.id,
      leadId: socialLead.id,
      contactId: socialContact.id,
      platform: LeadSource.X,
      actionType: RecommendedChannel.X_REPLY,
      type: "MANUAL_SOCIAL_ACTION",
      title: "Manually reply to X Flutter/Firebase buyer",
      content:
        "Manual action only. Review the original post and decide whether to reply.",
      suggestedText:
        "I work with Flutter/Firebase and existing app fixes. If the remaining work is around Firebase/API integration, I can help with that specifically. Happy to take a look if you are still looking.",
      sourceUrl: socialRawLead.sourceUrl,
      profileUrl: socialRawLead.profileUrl,
      status: ActionStatus.PENDING,
      dueAt: new Date(Date.now() + 86_400_000),
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    },
  });
  await prisma.leadScore.create({
    data: {
      workspaceId: workspace.id,
      leadId: socialLead.id,
      buyingIntent: 92,
      mobileRelevance: 95,
      agencyFit: 75,
      decisionMakerQuality: 88,
      contactability: 65,
      recency: 95,
      companyQuality: 80,
      countryPriority: 100,
      spamProbability: 1,
      competitorProbability: 0,
      baseScore: 93,
      penalty: 0,
      overall: 93,
      temperature: LeadTemperature.HOT,
      confidence: 89,
      reason:
        "DEMO DATA — Phase 4 social buyer signal scored through the existing scoring model.",
      explanation:
        "Phase 4 social discovery reuses the same scoring model and creates only a manual action.",
      recommendedChannel: RecommendedChannel.X_REPLY,
      recommendedPitch:
        "Reply manually with concise Flutter/Firebase experience and ask what remains to ship.",
      aiModel: "seed-fixture",
      promptVersion: "phase-4-social-demo-fixture",
    },
  });
  leads.push(socialLead);

  for (const [index, lead] of leads.entries()) {
    const rankingScore = Math.max(
      0,
      Math.min(
        100,
        lead.overallScore + (index < 5 ? 3 : index % 2 === 0 ? 1 : -2),
      ),
    );
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        rankingScore,
        rankReason: [
          `DEMO DATA — Ranked ${rankingScore}/100 using Phase 6 ranking factors.`,
          index < 12
            ? "Verified decision-maker/contact quality included."
            : "Manual review recommended.",
        ],
        rankBreakdown: {
          baseLeadScore: Math.round(lead.overallScore * 0.6),
          contactQuality: index < 12 ? 9 : 5,
          sourcePerformance: 4,
          queryPerformance: 4,
          recencyAdjustment: 4,
          multiSignalConfidence: index === leads.length - 1 ? 5 : 3,
          manualPreference: 2,
        },
      },
    });
  }

  await prisma.leadFeedback.create({
    data: {
      workspaceId: workspace.id,
      leadId: leads[0]!.id,
      createdBy: user.id,
      rating: "LIKE",
      reason: "Strong agency fit",
      notes:
        "DEMO DATA — Example feedback used by Phase 6 ranking and recommendations.",
    },
  });

  await prisma.optimizationRecommendation.create({
    data: {
      workspaceId: workspace.id,
      type: "QUERY_PRIORITY_INCREASE",
      title: "Increase priority: agency mobile partnership queries",
      description:
        "DEMO DATA — This recommendation is not auto-applied. Review before accepting.",
      evidence: {
        state: "EXCELLENT",
        sampleProtected: true,
        note: "Phase 6 demo recommendation.",
      },
      status: "NEW",
    },
  });

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  await prisma.weeklyReport.create({
    data: {
      workspaceId: workspace.id,
      weekStart,
      weekEnd,
      metrics: {
        discovered: leads.length,
        qualified: leads.filter((lead) => lead.overallScore >= 82).length,
        shortlisted: leads.filter(
          (lead) => lead.status === LeadStatus.SHORTLISTED,
        ).length,
        contacted: outreach.filter((message) => message.sentAt).length,
        replies: 3,
        interested: 1,
        meetings: 0,
        won: 0,
      },
      sourcePerformance: [
        {
          source: "WEB",
          contacted: 3,
          replies: 2,
          state: "INSUFFICIENT_DATA",
          note: "Protected from over-optimization until 10 contacted leads.",
        },
      ],
      queryPerformance: [
        {
          query: "agency mobile partnership",
          contacted: 3,
          replies: 2,
          state: "INSUFFICIENT_DATA",
          note: "Protected from over-optimization until 5 contacted leads.",
        },
      ],
      recommendations: [],
      failures: [],
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        workspaceId: workspace.id,
        type: "WEEKLY_REPORT_READY",
        title: "Weekly report ready",
        message: "DEMO DATA — Phase 6 weekly automation report is ready.",
        entityType: "WeeklyReport",
      },
      {
        workspaceId: workspace.id,
        type: "INTERESTED_REPLY",
        title: "Interested reply received",
        message: "DEMO DATA — A reply was classified as interested.",
        entityType: "EmailReply",
      },
    ],
  });

  console.info("Seeded DEMO DATA:", {
    workspaceId: workspace.id,
    companies: companies.length,
    contacts: contacts.length,
    rawLeads: 31,
    leads: leads.length,
    shortlistCandidates: leadScores.filter((score) => score >= 82).length,
    searchQueries:
      defaultAgencySearchQueries.length + defaultSocialSearchQueries.length,
    telegramSources: 1,
    actionQueue: 1,
    outreach: outreach.length,
    replies: 3,
    automationRules: 5,
    notifications: 2,
    weeklyReports: 1,
  });
}

function encryptCredentials(value: {
  provider: "mock";
  mockReplies: unknown[];
}) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function encryptionKey() {
  return createHash("sha256")
    .update(
      process.env.GMAIL_TOKEN_ENCRYPTION_KEY ??
        process.env.SUPABASE_JWT_SECRET ??
        "scrapo-local-development-gmail-secret",
    )
    .digest();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
