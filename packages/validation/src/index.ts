import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const uuidSchema = z.string().uuid();
export const optionalUrlSchema = z.union([z.literal(""), z.url()]).optional();

export const scoreSchema = z.coerce.number().int().min(0).max(100);

export const scoringWeightsSchema = z
  .object({
    buyingIntent: z.number().min(0).max(100),
    mobileRelevance: z.number().min(0).max(100),
    agencyFit: z.number().min(0).max(100),
    decisionMakerQuality: z.number().min(0).max(100),
    contactability: z.number().min(0).max(100),
    recency: z.number().min(0).max(100),
    companyQuality: z.number().min(0).max(100),
    countryPriority: z.number().min(0).max(100),
  })
  .refine(
    (weights) =>
      Object.values(weights).reduce((sum, value) => sum + value, 0) === 100,
    {
      message: "Scoring weights must total 100.",
    },
  );
