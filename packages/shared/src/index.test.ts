import { describe, expect, it } from "vitest";
import {
  calculateLeadScore,
  classifyDeterministicReply,
  classifySocialOpportunity,
  generateDeterministicOutreach,
  nextDailyRun,
  nextWeeklyRun,
  normalizeCompanyName,
  normalizeDomain,
  rankingScoreForLead,
  scoreCountryPriority,
  scoreRecency,
  temperatureForScore,
} from "./index";

describe("normalization", () => {
  it("normalizes equivalent company domains", () => {
    expect(normalizeDomain("https://www.Example.com/path")).toBe("example.com");
  });

  it("normalizes company names", () => {
    expect(normalizeCompanyName("ABC Digital, Ltd.")).toBe("abc digital ltd");
  });

  it("calculates weighted lead scores deterministically", () => {
    const result = calculateLeadScore({
      buyingIntent: 100,
      mobileRelevance: 90,
      agencyFit: 80,
      decisionMakerQuality: 70,
      contactability: 60,
      recency: 50,
      companyQuality: 80,
      countryPriority: 100,
    });

    expect(result.baseScore).toBe(82);
    expect(result.overallScore).toBe(82);
    expect(result.temperature).toBe("STRONG");
    expect(result.breakdown.buyingIntent).toEqual({
      score: 100,
      weight: 25,
      contribution: 25,
    });
  });

  it("applies spam and competitor penalties separately", () => {
    const result = calculateLeadScore({
      buyingIntent: 100,
      mobileRelevance: 100,
      agencyFit: 100,
      decisionMakerQuality: 100,
      contactability: 100,
      recency: 100,
      companyQuality: 100,
      countryPriority: 100,
      spamProbability: 85,
      competitorProbability: 70,
    });

    expect(result.baseScore).toBe(100);
    expect(result.penalty).toBe(50);
    expect(result.overallScore).toBe(50);
    expect(result.temperature).toBe("WEAK");
  });

  it("rejects invalid scoring weight totals", () => {
    expect(() =>
      calculateLeadScore(
        {
          buyingIntent: 100,
          mobileRelevance: 100,
          agencyFit: 100,
          decisionMakerQuality: 100,
          contactability: 100,
          recency: 100,
          companyQuality: 100,
          countryPriority: 100,
        },
        {
          buyingIntent: 25,
          mobileRelevance: 20,
          agencyFit: 15,
          decisionMakerQuality: 10,
          contactability: 10,
          recency: 10,
          companyQuality: 5,
          countryPriority: 4,
        },
      ),
    ).toThrow(/total 100/);
  });

  it("returns the documented score bands", () => {
    expect(temperatureForScore(90)).toBe("HOT");
    expect(temperatureForScore(80)).toBe("STRONG");
    expect(temperatureForScore(70)).toBe("REVIEW");
    expect(temperatureForScore(50)).toBe("WEAK");
    expect(temperatureForScore(49)).toBe("REJECT");
  });

  it("scores country priority and recency without AI guesses", () => {
    expect(scoreCountryPriority("United Kingdom")).toBe(100);
    expect(scoreCountryPriority("Germany")).toBe(75);
    expect(scoreCountryPriority("Brazil")).toBe(45);
    expect(scoreRecency(new Date(), "ACTIVE_REQUIREMENT")).toBe(100);
    expect(scoreRecency(null, "AGENCY_PARTNER")).toBe(70);
  });
});

describe("Phase 6 automation helpers", () => {
  it("calculates daily and weekly runs in a timezone-aware way", () => {
    expect(
      nextDailyRun({
        time: "08:00",
        timezone: "UTC",
        from: new Date("2026-09-08T06:00:00.000Z"),
      }).toISOString(),
    ).toBe("2026-09-08T08:00:00.000Z");
    expect(
      nextDailyRun({
        time: "08:00",
        timezone: "UTC",
        from: new Date("2026-09-08T09:00:00.000Z"),
      }).toISOString(),
    ).toBe("2026-09-09T08:00:00.000Z");
    expect(
      nextWeeklyRun({
        dayOfWeek: 1,
        time: "08:00",
        timezone: "UTC",
        from: new Date("2026-09-08T06:00:00.000Z"),
      }).toISOString(),
    ).toBe("2026-09-14T08:00:00.000Z");
  });

  it("keeps ranking separate from the base lead score", () => {
    const result = rankingScoreForLead({
      overallScore: 90,
      contactQuality: 80,
      emailVerified: true,
      sourcePerformance: 70,
      queryPerformance: 60,
      recencyScore: 100,
      multiSignalConfidence: 85,
      manualPreference: 100,
    });

    expect(result.score).toBeGreaterThan(80);
    expect(result.breakdown.baseLeadScore).toBe(54);
    expect(result.breakdown.manualPreference).toBe(5);
  });
});

describe("Phase 5 outreach helpers", () => {
  it("generates concise outreach from supplied facts without inventing details", () => {
    const result = generateDeterministicOutreach({
      developerProfile: {
        name: "Waleed",
        title: "Flutter developer",
        skills: ["Flutter", "Firebase"],
      },
      signature: "Waleed",
      lead: {
        title: "Agency partnership",
        opportunitySummary:
          "Web agency has no visible mobile delivery team and serves SaaS clients.",
        overallScore: 94,
      },
      contact: { fullName: "Sara Khan", role: "Founder" },
      company: {
        name: "Northstar Digital",
        country: "United Kingdom",
        hasMobileService: false,
        hasFlutterService: false,
      },
      strategy: "AGENCY_PARTNERSHIP",
    });

    expect(result.subject).toContain("Northstar Digital");
    expect(result.body).toContain("Sara");
    expect(result.body).toContain("Flutter");
    expect(result.body).not.toContain("worked with");
    expect(result.body.split(/\s+/).length).toBeLessThanOrEqual(170);
    expect(result.confidence).toBeGreaterThanOrEqual(70);
  });

  it("classifies unsubscribe and meeting replies deterministically", () => {
    expect(
      classifyDeterministicReply("Please unsubscribe me.").classification,
    ).toBe("UNSUBSCRIBE");
    expect(
      classifyDeterministicReply("Could we schedule a meeting next week?")
        .classification,
    ).toBe("MEETING_REQUESTED");
  });
});

describe("classifySocialOpportunity", () => {
  it("classifies an X buyer post as a valid active requirement", () => {
    const result = classifySocialOpportunity(
      "We're looking for a Flutter developer to finish our Firebase application this month.",
      "X",
      new Date(),
    );

    expect(result.valid).toBe(true);
    expect(result.leadType).toBe("ACTIVE_REQUIREMENT");
    expect(result.buyerIntentScore).toBeGreaterThanOrEqual(80);
    expect(result.recommendedChannel).toBe("X_REPLY");
  });

  it("rejects freelancer self-promotion", () => {
    const result = classifySocialOpportunity(
      "Flutter developer available for freelance projects. DM me.",
      "X",
      new Date(),
    );

    expect(result.valid).toBe(false);
    expect(result.invalidReason).toBe("OTHER_FREELANCER");
  });

  it("rejects tutorial content", () => {
    const result = classifySocialOpportunity(
      "My new Flutter Firebase tutorial is live.",
      "X",
      new Date(),
    );

    expect(result.valid).toBe(false);
    expect(result.invalidReason).toBe("TUTORIAL");
  });

  it("classifies a manually imported Reddit founder post", () => {
    const result = classifySocialOpportunity(
      "I'm building an MVP and need an experienced Flutter developer to help complete the mobile app.",
      "REDDIT",
      new Date(),
    );

    expect(result.valid).toBe(true);
    expect(result.leadType).toBe("MVP_STARTUP");
    expect(result.recommendedChannel).toBe("REDDIT_REPLY");
  });

  it("rejects student project requests", () => {
    const result = classifySocialOpportunity(
      "Can someone build my Flutter university assignment?",
      "REDDIT",
      new Date(),
    );

    expect(result.valid).toBe(false);
    expect(result.invalidReason).toBe("STUDENT_PROJECT");
  });
});
