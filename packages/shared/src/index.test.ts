import { describe, expect, it } from "vitest";
import {
  calculateLeadScore,
  normalizeCompanyName,
  normalizeDomain,
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
