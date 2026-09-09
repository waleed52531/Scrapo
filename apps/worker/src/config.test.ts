import { describe, expect, it } from "vitest";
import { loadWorkerConfig } from "./config";

describe("loadWorkerConfig", () => {
  it("requires Redis and PostgreSQL URLs", () => {
    expect(() => loadWorkerConfig({})).toThrow(/DATABASE_URL|REDIS_URL/);
  });

  it("returns valid configuration", () => {
    expect(
      loadWorkerConfig({
        REDIS_URL: "redis://localhost:6379",
        DATABASE_URL: "postgresql://localhost/db",
      }),
    ).toMatchObject({
      redisUrl: "redis://localhost:6379",
      databaseUrl: "postgresql://localhost/db",
      version: "0.1.0",
      heartbeatIntervalMs: 30_000,
      jobAttempts: 2,
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  });
});
