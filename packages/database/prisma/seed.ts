import "dotenv/config";
import {
  AnalysisStatus,
  EmailStatus,
  InvalidLeadReason,
  LeadSource,
  LeadStatus,
  LeadTemperature,
  LeadType,
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
          followUpDelayDays: 7,
          maxFollowUps: 1,
        },
      },
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
      minimumScore: 82,
      shortlistLimit: 20,
      emailMode: "DRAFT_FIRST",
      followUpDays: 7,
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
          campaignId: campaign.id,
          channel: OutreachChannel.EMAIL,
          messageType: "INITIAL",
          subject: `Mobile development support for ${companies[index]!.name}`,
          body: "DEMO DATA — Example outreach draft. No email has been sent.",
          status: index < 3 ? OutreachStatus.REPLIED : OutreachStatus.DRAFT,
        },
      }),
    );
  }

  for (let index = 0; index < 3; index += 1) {
    await prisma.emailReply.create({
      data: {
        workspaceId: workspace.id,
        outreachMessageId: outreach[index]!.id,
        body: "DEMO DATA — Thanks for reaching out. Please share your portfolio.",
        classification: index === 0 ? "INTERESTED" : "QUESTION",
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

  console.info("Seeded DEMO DATA:", {
    workspaceId: workspace.id,
    companies: companies.length,
    contacts: contacts.length,
    rawLeads: 30,
    leads: leads.length,
    shortlistCandidates: leadScores.filter((score) => score >= 82).length,
    outreach: outreach.length,
    replies: 3,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
