import { describe, expect, it } from "vitest";
import { LeadTemperature } from "@prisma/client";
import { temperatureFor } from "./leads.service";

describe("temperatureFor", () => {
  it.each([
    [95, LeadTemperature.HOT],
    [85, LeadTemperature.STRONG],
    [75, LeadTemperature.REVIEW],
    [55, LeadTemperature.WEAK],
    [30, LeadTemperature.REJECT],
  ])("maps score %s to %s", (score, expected) => {
    expect(temperatureFor(score)).toBe(expected);
  });
});
