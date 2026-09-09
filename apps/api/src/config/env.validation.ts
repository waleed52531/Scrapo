type Env = Record<string, unknown>;

const ENVIRONMENTS = new Set(["development", "test", "staging", "production"]);

export function validateEnv(config: Env) {
  const env = stringValue(config.NODE_ENV) || "development";
  const errors: string[] = [];

  if (!ENVIRONMENTS.has(env)) {
    errors.push(
      "NODE_ENV must be one of development, test, staging, or production.",
    );
  }

  requireAny(config, ["API_PORT", "PORT"], errors, { numeric: true });
  requireNumber(config, "RATE_LIMIT_TTL_MS", errors);
  requireNumber(config, "RATE_LIMIT_MAX", errors);
  requireNumber(config, "JOB_ATTEMPTS", errors);
  requireNumber(config, "JOB_REMOVE_ON_COMPLETE", errors);
  requireNumber(config, "JOB_REMOVE_ON_FAIL", errors);
  requireNumber(config, "WORKER_HEARTBEAT_STALE_MS", errors);

  if (env === "production") {
    requireString(config, "DATABASE_URL", errors);
    requireString(config, "REDIS_URL", errors);
    requireString(config, "SUPABASE_URL", errors);
    requireString(config, "WEB_APP_URL", errors);
    if (config.DEMO_AUTH_ENABLED === "true") {
      errors.push("DEMO_AUTH_ENABLED must not be true in production.");
    }
    if (
      config.GMAIL_PROVIDER_MODE !== "REAL" &&
      config.ALLOW_MOCK_PROVIDERS_IN_PRODUCTION !== "true"
    ) {
      errors.push(
        "GMAIL_PROVIDER_MODE must be REAL in production unless ALLOW_MOCK_PROVIDERS_IN_PRODUCTION=true.",
      );
    }
    if (
      config.AUTO_SEND_ENABLED === "true" &&
      config.ALLOW_PRODUCTION_AUTO_SEND !== "true"
    ) {
      errors.push(
        "AUTO_SEND_ENABLED=true in production requires ALLOW_PRODUCTION_AUTO_SEND=true.",
      );
    }
  }

  if (config.OPENAI_ENABLED === "true" || config.OPENAI_REQUIRED === "true") {
    requireString(config, "OPENAI_API_KEY", errors);
  }
  if (config.WEB_SEARCH_PROVIDER && config.WEB_SEARCH_PROVIDER !== "mock") {
    requireString(config, "WEB_SEARCH_API_KEY", errors);
  }
  if (
    config.EMAIL_ENRICHMENT_PROVIDER &&
    config.EMAIL_ENRICHMENT_PROVIDER !== "mock"
  ) {
    requireString(config, "EMAIL_ENRICHMENT_API_KEY", errors);
  }
  if (
    config.EMAIL_VERIFICATION_PROVIDER &&
    config.EMAIL_VERIFICATION_PROVIDER !== "mock"
  ) {
    requireString(config, "EMAIL_VERIFICATION_API_KEY", errors);
  }
  if (config.X_ENABLED === "true")
    requireString(config, "X_BEARER_TOKEN", errors);
  if (config.REDDIT_ENABLED === "true") {
    requireString(config, "REDDIT_CLIENT_ID", errors);
    requireString(config, "REDDIT_CLIENT_SECRET", errors);
  }
  if (config.TELEGRAM_ENABLED === "true")
    requireString(config, "TELEGRAM_BOT_TOKEN", errors);
  if (config.GMAIL_PROVIDER_MODE === "REAL") {
    requireString(config, "GOOGLE_CLIENT_ID", errors);
    requireString(config, "GOOGLE_CLIENT_SECRET", errors);
    requireString(config, "GOOGLE_REDIRECT_URI", errors);
    requireString(config, "GMAIL_TOKEN_ENCRYPTION_KEY", errors);
  }

  if (errors.length) {
    throw new Error(
      `Environment configuration is invalid:\n- ${errors.join("\n- ")}`,
    );
  }

  return {
    ...config,
    NODE_ENV: env,
    API_PORT: stringValue(config.API_PORT ?? config.PORT ?? "4000"),
    PORT: stringValue(config.PORT ?? config.API_PORT ?? "4000"),
    RATE_LIMIT_TTL_MS: stringValue(config.RATE_LIMIT_TTL_MS ?? "60000"),
    RATE_LIMIT_MAX: stringValue(config.RATE_LIMIT_MAX ?? "120"),
    JOB_ATTEMPTS: stringValue(config.JOB_ATTEMPTS ?? "2"),
    JOB_REMOVE_ON_COMPLETE: stringValue(config.JOB_REMOVE_ON_COMPLETE ?? "100"),
    JOB_REMOVE_ON_FAIL: stringValue(config.JOB_REMOVE_ON_FAIL ?? "500"),
    WORKER_HEARTBEAT_STALE_MS: stringValue(
      config.WORKER_HEARTBEAT_STALE_MS ?? "120000",
    ),
  };
}

function requireAny(
  config: Env,
  keys: string[],
  errors: string[],
  options: { numeric?: boolean } = {},
) {
  const value = keys
    .map((key) => config[key])
    .find((item) => stringValue(item));
  if (!value) return;
  if (options.numeric && !isNumeric(value)) {
    errors.push(`${keys.join(" or ")} must be numeric when configured.`);
  }
}

function requireString(config: Env, key: string, errors: string[]) {
  if (!stringValue(config[key])) errors.push(`${key} is required.`);
}

function requireNumber(config: Env, key: string, errors: string[]) {
  if (config[key] !== undefined && !isNumeric(config[key])) {
    errors.push(`${key} must be numeric.`);
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isNumeric(value: unknown) {
  return stringValue(value) !== "" && Number.isFinite(Number(value));
}
