import { normalizeDomain } from "@scrapo/shared";

export type ProviderHealth = {
  provider: string;
  status:
    | "CONNECTED"
    | "NOT_CONFIGURED"
    | "CONFIGURED"
    | "APPROVAL_REQUIRED"
    | "ACTIVE"
    | "DISABLED"
    | "ERROR";
  demoMode: boolean;
  message: string;
  lastSuccessfulSync?: string | null;
  lastError?: string | null;
};

export type WebSearchResult = {
  title: string;
  url: string;
  description: string;
  domain: string;
  country?: string;
};

export function providerHealth(
  providerEnv: string | undefined,
  apiKeyEnv: string | undefined,
  fallbackProvider: string,
): ProviderHealth {
  const provider = providerEnv?.trim() || fallbackProvider;
  if (!apiKeyEnv?.trim()) {
    return {
      provider: "mock",
      status: "NOT_CONFIGURED",
      demoMode: true,
      message: `${provider} credentials are not configured. Mock provider is active.`,
    };
  }
  return {
    provider,
    status: "CONNECTED",
    demoMode: false,
    message: `${provider} credentials are configured.`,
  };
}

export function socialProviderHealth(
  platform: "x" | "reddit" | "telegram",
): ProviderHealth {
  if (platform === "x") {
    const enabled = process.env.X_ENABLED === "true";
    const hasToken = Boolean(process.env.X_BEARER_TOKEN?.trim());
    if (enabled && hasToken) {
      return {
        provider: "x-api",
        status: "ACTIVE",
        demoMode: false,
        message: "X discovery is enabled with a bearer token.",
      };
    }
    if (enabled) {
      return {
        provider: "mock",
        status: "NOT_CONFIGURED",
        demoMode: true,
        message:
          "X is enabled but no bearer token is configured. Mock X results are active locally.",
      };
    }
    return {
      provider: "mock",
      status: "DISABLED",
      demoMode: true,
      message:
        "X discovery is disabled. Enable X_ENABLED=true for real or mock social hunts.",
    };
  }
  if (platform === "reddit") {
    if (process.env.REDDIT_ENABLED !== "true") {
      return {
        provider: "reddit-api",
        status: "APPROVAL_REQUIRED",
        demoMode: false,
        message:
          "Reddit discovery requires compliant API access. Manual Reddit URL/post import is available.",
      };
    }
    if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) {
      return {
        provider: "reddit-api",
        status: "NOT_CONFIGURED",
        demoMode: false,
        message: "Reddit is enabled but API credentials are missing.",
      };
    }
    return {
      provider: "reddit-api",
      status: "ACTIVE",
      demoMode: false,
      message: "Reddit discovery is enabled with configured API credentials.",
    };
  }
  if (
    process.env.TELEGRAM_ENABLED === "true" &&
    process.env.TELEGRAM_BOT_TOKEN
  ) {
    return {
      provider: "telegram-bot",
      status: "ACTIVE",
      demoMode: false,
      message: "Telegram monitoring is enabled for configured sources.",
    };
  }
  return {
    provider: "telegram-bot",
    status: "NOT_CONFIGURED",
    demoMode: true,
    message:
      "Telegram bot credentials are not configured. Configured sources can still be exercised in mock mode.",
  };
}

const mockDomains = [
  "northstar-digital.example",
  "pixelpalm.agency.example",
  "riyadhwebstudio.example",
  "maplecloud.dev.example",
  "auslaunchlabs.example",
  "enterpriseapps.example",
  "directory-listings.example",
  "freelancer-tutorials.example",
];

export function mockWebSearch(query: string, limit = 10): WebSearchResult[] {
  return mockDomains
    .slice(0, Math.max(1, Math.min(limit, 20)))
    .map((domain, index) => {
      const agencyName = (domain.split(".").at(0) ?? domain)
        .replace(/-/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
      return {
        title:
          index >= 6
            ? `${agencyName} directory result`
            : `${agencyName} - Web, SaaS and mobile app delivery partner`,
        url: `https://${domain}/${index >= 6 ? "listings" : "services/mobile-app-development"}`,
        description:
          index >= 6
            ? `Directory or tutorial style result for ${query}.`
            : `${agencyName} builds web platforms and partners with Flutter, iOS and Android specialists for client mobile apps.`,
        domain: normalizeDomain(domain),
        country:
          query.toLowerCase().includes("dubai") ||
          query.toLowerCase().includes("uae")
            ? "United Arab Emirates"
            : query.toLowerCase().includes("riyadh") ||
                query.toLowerCase().includes("saudi")
              ? "Saudi Arabia"
              : query.toLowerCase().includes("canada")
                ? "Canada"
                : query.toLowerCase().includes("australia")
                  ? "Australia"
                  : query.toLowerCase().includes("uk")
                    ? "United Kingdom"
                    : "United States",
      };
    });
}
