import { describe, expect, it } from "vitest";
import { validateEnv } from "./env.validation";

describe("validateEnv", () => {
  it("blocks unsafe production defaults", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://example",
        REDIS_URL: "redis://example",
        SUPABASE_URL: "https://example.supabase.co",
        WEB_APP_URL: "https://app.example.com",
        DEMO_AUTH_ENABLED: "true",
        GMAIL_PROVIDER_MODE: "MOCK",
      }),
    ).toThrow(/DEMO_AUTH_ENABLED/);
  });

  it("requires credentials only when optional providers are enabled", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "development",
        GMAIL_PROVIDER_MODE: "REAL",
        GOOGLE_CLIENT_ID: "client",
        GOOGLE_REDIRECT_URI:
          "http://localhost:4000/api/v1/integrations/gmail/callback",
      }),
    ).toThrow(/GOOGLE_CLIENT_SECRET/);

    expect(
      validateEnv({
        NODE_ENV: "development",
        WEB_SEARCH_PROVIDER: "mock",
        GMAIL_PROVIDER_MODE: "MOCK",
      }).RATE_LIMIT_MAX,
    ).toBe("120");
  });
});
