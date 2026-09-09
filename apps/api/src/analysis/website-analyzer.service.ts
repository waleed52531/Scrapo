import { BadRequestException, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;
const MAX_PAGES_PER_DOMAIN = 5;

const usefulPaths = [
  "/",
  "/about",
  "/services",
  "/work",
  "/portfolio",
  "/team",
  "/contact",
];

@Injectable()
export class WebsiteAnalyzerService {
  async analyze(url: string) {
    const start = normalizeAndValidateUrl(url);
    const pages: Array<{ url: string; title: string; text: string }> = [];
    const origin = start.origin;

    for (const path of usefulPaths) {
      if (pages.length >= MAX_PAGES_PER_DOMAIN) break;
      const pageUrl = new URL(path, origin).toString();
      try {
        const html = await fetchHtml(pageUrl);
        const text = htmlToText(html).slice(0, 8_000);
        if (text.length > 80)
          pages.push({ url: pageUrl, title: extractTitle(html), text });
      } catch {
        if (path === "/" && pages.length === 0)
          throw new BadRequestException({
            code: "WEBSITE_FETCH_FAILED",
            message: "Could not fetch useful public website content.",
          });
      }
    }

    const combinedText = pages
      .map((page) => `${page.title}\n${page.text}`)
      .join("\n\n")
      .slice(0, 24_000);
    const analysis = analyzeWebsiteText(start.toString(), combinedText);
    return {
      ...analysis,
      website: start.toString(),
      pagesAnalyzed: pages.map((page) => page.url),
      contentHash: createHash("sha256").update(combinedText).digest("hex"),
      maxPages: MAX_PAGES_PER_DOMAIN,
    };
  }
}

export async function fetchHtml(
  input: string,
  redirectCount = 0,
): Promise<string> {
  const url = normalizeAndValidateUrl(input);
  await assertPublicHostname(url.hostname);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "manual",
      headers: { "User-Agent": "ScrapoPhase2WebsiteAnalyzer/1.0" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirectCount >= MAX_REDIRECTS)
        throw new BadRequestException({
          code: "TOO_MANY_REDIRECTS",
          message: "Website redirected too many times.",
        });
      const location = response.headers.get("location");
      if (!location)
        throw new BadRequestException({
          code: "INVALID_REDIRECT",
          message: "Website returned an empty redirect.",
        });
      return fetchHtml(new URL(location, url).toString(), redirectCount + 1);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("text/html")) {
      throw new BadRequestException({
        code: "UNSUPPORTED_WEBSITE_CONTENT",
        message: "Only public HTML pages can be analyzed.",
      });
    }
    return readLimitedText(response);
  } finally {
    clearTimeout(timeout);
  }
}

export function analyzeWebsiteText(website: string, text: string) {
  const lower = text.toLowerCase();
  const companyName = inferCompanyName(website, text);
  const technologies = matchKeywords(lower, [
    "Laravel",
    "React",
    "Node.js",
    "TypeScript",
    "Next.js",
    "PHP",
    "WordPress",
    "Flutter",
    "Firebase",
    "Android",
    "iOS",
  ]);
  const services = matchKeywords(lower, [
    "Web development",
    "Backend development",
    "Mobile development",
    "App development",
    "Product design",
    "E-commerce",
    "API development",
  ]);
  const industries = matchKeywords(lower, [
    "SaaS",
    "E-commerce",
    "Healthcare",
    "Fintech",
    "Education",
    "Real estate",
    "Logistics",
  ]);
  const hasMobile =
    /mobile|android|ios|iphone|flutter|react native|app development/.test(
      lower,
    );
  const hasFlutter = /flutter/.test(lower);
  const hasWeb =
    /web development|website|react|next\.js|wordpress|laravel/.test(lower);
  const hasBackend = /backend|api|laravel|node\.js|database|server/.test(lower);
  const portfolio = /portfolio|case stud|our work|clients|brands|projects/.test(
    lower,
  );
  const contact = /contact|email|@|book a call|let's talk/.test(lower);
  const team = /team|founder|ceo|cto|director/.test(lower);
  const country = inferCountry(lower);
  const companyQualityScore = clamp(
    (portfolio ? 30 : 0) +
      (contact ? 20 : 0) +
      (services.length ? 25 : 0) +
      (team ? 15 : 0) +
      10,
  );
  const partnershipFitScore = clamp(
    (hasWeb ? 35 : 10) +
      (hasBackend ? 25 : 5) +
      (portfolio ? 20 : 0) +
      (hasMobile ? -20 : 25),
  );

  return {
    companyName,
    website,
    country,
    city: "",
    companyType: /agency|studio|digital|software house/.test(lower)
      ? "AGENCY"
      : "UNKNOWN",
    agencyType: hasWeb || hasBackend ? "WEB_AND_BACKEND" : "UNKNOWN",
    description: text.slice(0, 260),
    services,
    technologies,
    industries,
    hasWebDevelopment: hasWeb,
    hasBackendDevelopment: hasBackend,
    hasMobileDevelopment: hasMobile,
    hasFlutterDevelopment: hasFlutter,
    hasAndroidDevelopment: /android/.test(lower),
    hasIosDevelopment: /ios|iphone|app store/.test(lower),
    commercialClientEvidence: portfolio,
    teamInformationFound: team,
    contactInformationFound: contact,
    mobileCapabilityConfidence: hasMobile ? 80 : 45,
    companyQualityScore,
    partnershipFitScore,
    analysisConfidence: text.length > 1_000 ? 78 : 58,
    summary: hasMobile
      ? "Public pages show some mobile capability; partnership fit should be reviewed carefully."
      : "No clear mobile specialization detected on the analyzed public pages.",
  };
}

function normalizeAndValidateUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new BadRequestException({
      code: "INVALID_URL",
      message: "Provide a valid http or https URL.",
    });
  }
  if (!["http:", "https:"].includes(url.protocol))
    throw new BadRequestException({
      code: "UNSUPPORTED_PROTOCOL",
      message: "Only http and https URLs are allowed.",
    });
  assertPublicHostValue(url.hostname);
  return url;
}

async function assertPublicHostname(hostname: string) {
  assertPublicHostValue(hostname);
  const records = await lookup(hostname, { all: true, verbatim: true });
  for (const record of records) assertPublicHostValue(record.address);
}

function assertPublicHostValue(value: string) {
  const host = value.toLowerCase().replace(/^\[(.*)]$/, "$1");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "metadata.google.internal"
  ) {
    throw new BadRequestException({
      code: "BLOCKED_PRIVATE_URL",
      message: "Private/internal hosts cannot be analyzed.",
    });
  }
  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    const parts = host.split(".").map(Number);
    const first = parts[0] ?? 0;
    const second = parts[1] ?? 0;
    if (
      first === 10 ||
      first === 127 ||
      first === 0 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 169 && second === 254)
    ) {
      throw new BadRequestException({
        code: "BLOCKED_PRIVATE_URL",
        message: "Private/internal URLs cannot be analyzed.",
      });
    }
  }
  if (
    ipVersion === 6 &&
    (host === "::1" ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      host.startsWith("fe80"))
  ) {
    throw new BadRequestException({
      code: "BLOCKED_PRIVATE_URL",
      message: "Private/internal URLs cannot be analyzed.",
    });
  }
}

async function readLimitedText(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return response.text();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_BYTES)
      throw new BadRequestException({
        code: "WEBSITE_TOO_LARGE",
        message: "Website response exceeded the analysis size limit.",
      });
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string) {
  return (
    html
      .match(/<title[^>]*>(.*?)<\/title>/i)?.[1]
      ?.replace(/\s+/g, " ")
      .trim() ?? ""
  );
}

function inferCompanyName(website: string, text: string) {
  const title = text.split("\n")[0]?.trim();
  if (title && title.length < 80) return title;
  return new URL(website).hostname.replace(/^www\./, "").split(".")[0] ?? "";
}

function inferCountry(text: string) {
  const countries = [
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
  ];
  return (
    countries.find((country) => text.includes(country.toLowerCase())) ?? ""
  );
}

function matchKeywords(text: string, keywords: string[]) {
  return keywords.filter((keyword) => text.includes(keyword.toLowerCase()));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
