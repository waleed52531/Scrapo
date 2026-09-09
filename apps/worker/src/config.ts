import { z } from "zod";

const configSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "staging", "production"])
      .default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
    REDIS_URL: z.string().min(1, "REDIS_URL is required."),
    WORKER_ID: z.string().optional(),
    APP_VERSION: z.string().default("0.1.0"),
    WORKER_HEARTBEAT_INTERVAL_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(30_000),
    JOB_ATTEMPTS: z.coerce.number().int().positive().default(2),
    JOB_REMOVE_ON_COMPLETE: z.coerce.number().int().positive().default(100),
    JOB_REMOVE_ON_FAIL: z.coerce.number().int().positive().default(500),
    GMAIL_PROVIDER_MODE: z.enum(["MOCK", "REAL"]).default("MOCK"),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_REDIRECT_URI: z.string().optional(),
    GMAIL_TOKEN_ENCRYPTION_KEY: z.string().optional(),
    OPENAI_ENABLED: z.enum(["true", "false"]).default("false"),
    OPENAI_API_KEY: z.string().optional(),
    X_ENABLED: z.enum(["true", "false"]).default("false"),
    X_BEARER_TOKEN: z.string().optional(),
    REDDIT_ENABLED: z.enum(["true", "false"]).default("false"),
    REDDIT_CLIENT_ID: z.string().optional(),
    REDDIT_CLIENT_SECRET: z.string().optional(),
    TELEGRAM_ENABLED: z.enum(["true", "false"]).default("false"),
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    ALLOW_MOCK_PROVIDERS_IN_PRODUCTION: z
      .enum(["true", "false"])
      .default("false"),
  })
  .superRefine((value, context) => {
    if (
      value.NODE_ENV === "production" &&
      value.GMAIL_PROVIDER_MODE !== "REAL" &&
      value.ALLOW_MOCK_PROVIDERS_IN_PRODUCTION !== "true"
    ) {
      context.addIssue({
        code: "custom",
        message:
          "GMAIL_PROVIDER_MODE must be REAL in production unless ALLOW_MOCK_PROVIDERS_IN_PRODUCTION=true.",
      });
    }
    if (value.GMAIL_PROVIDER_MODE === "REAL") {
      for (const key of [
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "GOOGLE_REDIRECT_URI",
        "GMAIL_TOKEN_ENCRYPTION_KEY",
      ] as const) {
        if (!value[key]) {
          context.addIssue({
            code: "custom",
            message: `${key} is required when GMAIL_PROVIDER_MODE=REAL.`,
          });
        }
      }
    }
    if (value.OPENAI_ENABLED === "true" && !value.OPENAI_API_KEY) {
      context.addIssue({
        code: "custom",
        message: "OPENAI_API_KEY is required when OPENAI_ENABLED=true.",
      });
    }
    if (value.X_ENABLED === "true" && !value.X_BEARER_TOKEN) {
      context.addIssue({
        code: "custom",
        message: "X_BEARER_TOKEN is required when X_ENABLED=true.",
      });
    }
    if (
      value.REDDIT_ENABLED === "true" &&
      (!value.REDDIT_CLIENT_ID || !value.REDDIT_CLIENT_SECRET)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET are required when REDDIT_ENABLED=true.",
      });
    }
    if (value.TELEGRAM_ENABLED === "true" && !value.TELEGRAM_BOT_TOKEN) {
      context.addIssue({
        code: "custom",
        message: "TELEGRAM_BOT_TOKEN is required when TELEGRAM_ENABLED=true.",
      });
    }
  });

export function loadWorkerConfig(environment: NodeJS.ProcessEnv = process.env) {
  const parsed = configSchema.parse(environment);
  return {
    redisUrl: parsed.REDIS_URL,
    databaseUrl: parsed.DATABASE_URL,
    workerId: parsed.WORKER_ID,
    version: parsed.APP_VERSION,
    heartbeatIntervalMs: parsed.WORKER_HEARTBEAT_INTERVAL_MS,
    jobAttempts: parsed.JOB_ATTEMPTS,
    removeOnComplete: parsed.JOB_REMOVE_ON_COMPLETE,
    removeOnFail: parsed.JOB_REMOVE_ON_FAIL,
  };
}
