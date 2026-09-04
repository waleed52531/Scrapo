import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { QUEUE_NAMES } from "@scrapo/shared";
import { processAnalysisJob } from "./analysis/engine.js";
import { loadWorkerConfig } from "./config.js";

const config = loadWorkerConfig();
const prisma = new PrismaClient();
const workerConnection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
});
const queueConnection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
});
const queueName = QUEUE_NAMES.maintenance;

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
  { removeOnComplete: 20, removeOnFail: 50 },
);

const analysisWorker = new Worker(
  QUEUE_NAMES.leadAnalysis,
  (job) => processAnalysisJob(prisma, job),
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
  await analysisWorker.close();
  await worker.close();
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
