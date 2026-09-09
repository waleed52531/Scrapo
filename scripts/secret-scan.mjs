import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const ignored = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "coverage",
  "playwright-report",
  "test-results",
  ".pnpm-store",
]);
const patterns = [
  { name: "OpenAI key", regex: /sk-[A-Za-z0-9_-]{20,}/ },
  { name: "Google OAuth secret", regex: /GOCSPX-[A-Za-z0-9_-]{20,}/ },
  {
    name: "Supabase JWT",
    regex: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
  },
  {
    name: "Private key",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: "Database URL with password",
    regex: /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/,
  },
  { name: "Redis URL with password", regex: /redis:\/\/[^:\s]+:[^@\s]+@/ },
];
const allowedFiles = new Set([
  ".env.example",
  "apps/api/.env.example",
  "apps/web/.env.example",
  "apps/worker/.env.example",
  "packages/database/.env.example",
]);

const findings = [];
walk(root);

if (findings.length) {
  console.error("Potential secret findings:");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.name}`);
  }
  process.exit(1);
}

console.log(
  "Secret scan passed: no likely real secrets found in tracked source files.",
);

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    if (ignored.has(entry)) continue;
    const full = join(directory, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      walk(full);
      continue;
    }
    if (!info.isFile() || info.size > 1_000_000) continue;
    const file = relative(root, full);
    if (allowedFiles.has(file)) continue;
    if (
      !/\.(ts|tsx|js|mjs|json|md|yml|yaml|prisma|sql|txt|example)$/.test(
        file,
      ) &&
      !["Dockerfile", ".gitignore"].includes(entry)
    ) {
      continue;
    }
    const content = readFileSync(full, "utf8");
    content.split(/\r?\n/).forEach((line, index) => {
      if (isAllowedPlaceholder(line)) return;
      for (const pattern of patterns) {
        if (pattern.regex.test(line)) {
          findings.push({ file, line: index + 1, name: pattern.name });
        }
      }
    });
  }
}

function isAllowedPlaceholder(line) {
  return (
    line.includes("postgres:postgres@localhost") ||
    line.includes("postgres:postgres@postgres") ||
    line.includes("redis://localhost") ||
    line.includes("{{access_token}}")
  );
}
