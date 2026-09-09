import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const inputPath = "apps/api/openapi.json";
const outputPath = "docs/postman/scrapo-openapi.postman_collection.json";
const openapi = JSON.parse(readFileSync(inputPath, "utf8"));
const folders = new Map();

for (const [path, methods] of Object.entries(openapi.paths ?? {})) {
  for (const [method, operation] of Object.entries(methods)) {
    const tag = operation.tags?.[0] ?? "API";
    if (!folders.has(tag)) folders.set(tag, []);
    folders.get(tag).push({
      name: operation.summary ?? `${method.toUpperCase()} ${path}`,
      request: {
        method: method.toUpperCase(),
        header: [
          { key: "Authorization", value: "Bearer {{access_token}}" },
          { key: "Content-Type", value: "application/json" },
        ],
        url: {
          raw: `{{base_url}}${path}`,
          host: ["{{base_url}}"],
          path: path.split("/").filter(Boolean),
        },
      },
    });
  }
}

const collection = {
  info: {
    name: "Scrapo Lead Hunter API",
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    description:
      "Generated from apps/api/openapi.json. Use {{base_url}} = http://localhost:4000.",
  },
  item: [...folders.entries()].map(([name, item]) => ({ name, item })),
  variable: [
    { key: "base_url", value: "http://localhost:4000" },
    { key: "access_token", value: "demo-token" },
  ],
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(collection, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);
