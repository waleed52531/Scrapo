import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { hostname } from "node:os";
import { QUEUE_NAMES } from "@scrapo/shared";
import { processAnalysisJob } from "./analysis/engine.js";
import { processAutomationJob } from "./automation/engine.js";
import { loadWorkerConfig } from "./config.js";
import { processDiscoveryJob } from "./discovery/engine.js";
import { processOutreachJob } from "./outreach/engine.js";

const config = loadWorkerConfig();
const prisma = new PrismaClient();
const workerId = config.workerId ?? `worker-${hostname()}-${process.pid}`;
const workerConnection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
});
const queueConnection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
});
const queueName = QUEUE_NAMES.maintenance;
const leadQueue = new Queue(QUEUE_NAMES.leadAnalysis, {
  connection: queueConnection,
});

const worker = new Worker(
  queueName,
  async (job) => {
    if (job.name === "startup-check") {
      await prisma.$queryRaw`SELECT 1`;
      return { database: "connected", checkedAt: new Date().toISOString() };
    }
    throw new Error(`Unsupported Phase 1 job: ${job.name}`);
  },
  { connection: workerConnection, concurrency: 2 },
);

worker.on("ready", () => log("worker.ready", { queue: queueName }));
worker.on("completed", (job) =>
  log("job.completed", { queue: queueName, jobId: job.id, jobName: job.name }),
);
worker.on("failed", (job, error) =>
  log("job.failed", {
    queue: queueName,
    jobId: job?.id,
    jobName: job?.name,
    error: error.message,
  }),
);
worker.on("error", (error) => log("worker.error", { error: error.message }));

const queue = new Queue(queueName, { connection: queueConnection });
await queue.add(
  "startup-check",
  { source: "worker-startup" },
  {
    attempts: config.jobAttempts,
    removeOnComplete: config.removeOnComplete,
    removeOnFail: config.removeOnFail,
  },
);
await leadQueue.upsertJobScheduler(
  "automation-scheduler-tick",
  { every: Number(process.env.AUTOMATION_SCHEDULER_INTERVAL_MS ?? 60_000) },
  {
    name: "AUTOMATION_SCHEDULER_TICK",
    data: { source: "worker-scheduler" },
    opts: {
      attempts: config.jobAttempts,
      removeOnComplete: config.removeOnComplete,
      removeOnFail: config.removeOnFail,
    },
  },
);

await heartbeat("HEALTHY");
const heartbeatTimer = setInterval(() => {
  void heartbeat("HEALTHY").catch((error: unknown) =>
    log("worker.heartbeat_failed", {
      error: error instanceof Error ? error.message : "Heartbeat failed.",
    }),
  );
}, config.heartbeatIntervalMs);

const analysisWorker = new Worker(
  QUEUE_NAMES.leadAnalysis,
  (job) => {
    if (
      [
        "AUTOMATION_SCHEDULER_TICK",
        "AUTOMATION_RUN",
        "AUTO_SEND_OUTREACH",
      ].includes(job.name)
    ) {
      return processAutomationJob(prisma, job, leadQueue);
    }
    if (
      [
        "LEAD_HUNT",
        "FIND_CONTACTS",
        "VERIFY_EMAIL",
        "IMPORT_SOCIAL_SIGNAL",
      ].includes(job.name)
    ) {
      return processDiscoveryJob(prisma, job);
    }
    if (
      [
        "SYNC_GMAIL",
        "CLASSIFY_REPLY",
        "GENERATE_FOLLOW_UP",
        "CREATE_GMAIL_DRAFT",
      ].includes(job.name)
    ) {
      return processOutreachJob(prisma, job);
    }
    return processAnalysisJob(prisma, job);
  },
  { connection: workerConnection, concurrency: 2 },
);
analysisWorker.on("ready", () =>
  log("worker.ready", { queue: QUEUE_NAMES.leadAnalysis }),
);
analysisWorker.on("completed", (job) =>
  log("job.completed", {
    queue: QUEUE_NAMES.leadAnalysis,
    jobId: job.id,
    jobName: job.name,
  }),
);
analysisWorker.on("failed", (job, error) =>
  log("job.failed", {
    queue: QUEUE_NAMES.leadAnalysis,
    jobId: job?.id,
    jobName: job?.name,
    error: error.message,
  }),
);
analysisWorker.on("error", (error) =>
  log("worker.error", {
    queue: QUEUE_NAMES.leadAnalysis,
    error: error.message,
  }),
);

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  log("worker.shutdown", { signal });
  clearInterval(heartbeatTimer);
  await heartbeat("OFFLINE").catch(() => undefined);
  await analysisWorker.close();
  await worker.close();
  await leadQueue.close();
  await queue.close();
  await workerConnection.quit();
  await queueConnection.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

function log(event: string, payload: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: "worker",
      event,
      ...payload,
    }),
  );
}

async function heartbeat(status: string) {
  await prisma.workerHeartbeat.upsert({
    where: { workerId },
    update: {
      status,
      version: config.version,
      queues: Object.values(QUEUE_NAMES),
      metadata: { pid: process.pid, host: hostname() },
      lastHeartbeatAt: new Date(),
    },
    create: {
      workerId,
      version: config.version,
      status,
      queues: Object.values(QUEUE_NAMES),
      metadata: { pid: process.pid, host: hostname() },
    },
  });
  log("worker.heartbeat", {
    workerId,
    status,
    queues: Object.values(QUEUE_NAMES),
  });
}
