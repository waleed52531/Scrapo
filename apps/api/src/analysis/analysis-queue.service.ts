import {
  BadRequestException,
  Inject,
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from "@nestjs/common";
import { QUEUE_NAMES } from "@scrapo/shared";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type AnalysisJobType =
  | "ANALYZE_LEAD"
  | "ANALYZE_COMPANY"
  | "RESCORE_LEAD"
  | "LEAD_HUNT"
  | "IMPORT_SOCIAL_SIGNAL"
  | "FIND_CONTACTS"
  | "VERIFY_EMAIL"
  | "SYNC_GMAIL"
  | "CLASSIFY_REPLY"
  | "GENERATE_FOLLOW_UP"
  | "CREATE_GMAIL_DRAFT"
  | "AUTOMATION_SCHEDULER_TICK"
  | "AUTOMATION_RUN"
  | "AUTO_SEND_OUTREACH";

@Injectable()
export class AnalysisQueueService implements OnModuleDestroy {
  private readonly connection: Redis;
  private readonly queue: Queue;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    this.connection = new Redis(
      process.env.REDIS_URL ?? "redis://localhost:6379",
      { maxRetriesPerRequest: null },
    );
    this.queue = new Queue(QUEUE_NAMES.leadAnalysis, {
      connection: this.connection,
    });
  }

  async enqueue(
    workspaceId: string,
    type: AnalysisJobType,
    payload: Record<string, unknown>,
  ) {
    await this.assertBudgetAvailable(workspaceId, type);
    const systemJob = await this.prisma.systemJob.create({
      data: {
        workspaceId,
        type,
        status: "QUEUED",
        metadata: payload as Prisma.InputJsonValue,
      },
    });
    try {
      const queueJob = await this.queue.add(
        type,
        { ...payload, workspaceId, systemJobId: systemJob.id },
        {
          attempts: Number(process.env.JOB_ATTEMPTS ?? 2),
          backoff: { type: "exponential", delay: 5_000 },
          removeOnComplete: Number(process.env.JOB_REMOVE_ON_COMPLETE ?? 100),
          removeOnFail: Number(process.env.JOB_REMOVE_ON_FAIL ?? 500),
        },
      );
      await this.prisma.systemJob.update({
        where: { id: systemJob.id },
        data: { queueJobId: queueJob.id },
      });
      return { jobId: systemJob.id, queueJobId: queueJob.id, status: "QUEUED" };
    } catch (error) {
      await this.prisma.systemJob.update({
        where: { id: systemJob.id },
        data: {
          status: "FAILED",
          error:
            error instanceof Error
              ? error.message
              : "Redis queue is unavailable.",
        },
      });
      throw new ServiceUnavailableException({
        code: "JOB_QUEUE_UNAVAILABLE",
        message:
          "The background job queue is unavailable. Read-only CRM actions may still work.",
      });
    }
  }

  async onModuleDestroy() {
    await this.queue.close();
    await this.connection.quit();
  }

  private async assertBudgetAvailable(
    workspaceId: string,
    type: AnalysisJobType,
  ) {
    if (["ANALYZE_LEAD", "ANALYZE_COMPANY", "RESCORE_LEAD"].includes(type)) {
      await this.assertCountUnderLimit("MAX_AI_CALLS_PER_DAY", () =>
        this.prisma.aiUsageLog.count({
          where: { workspaceId, createdAt: { gte: daysAgo(1) } },
        }),
      );
      await this.assertCountUnderLimit("MAX_AI_CALLS_PER_WEEK", () =>
        this.prisma.aiUsageLog.count({
          where: { workspaceId, createdAt: { gte: daysAgo(7) } },
        }),
      );
    }
    if (type === "LEAD_HUNT") {
      await this.assertCountUnderLimit("MAX_SEARCH_REQUESTS_PER_WEEK", () =>
        this.prisma.discoveryQueryRun.count({
          where: { workspaceId, createdAt: { gte: daysAgo(7) } },
        }),
      );
    }
    if (type === "FIND_CONTACTS") {
      await this.assertCountUnderLimit("MAX_ENRICHMENT_REQUESTS_PER_WEEK", () =>
        this.prisma.contactEnrichmentRecord.count({
          where: { workspaceId, createdAt: { gte: daysAgo(7) } },
        }),
      );
    }
    if (type === "VERIFY_EMAIL") {
      await this.assertCountUnderLimit("MAX_EMAIL_VERIFICATIONS_PER_WEEK", () =>
        this.prisma.emailVerificationRecord.count({
          where: { workspaceId, verifiedAt: { gte: daysAgo(7) } },
        }),
      );
    }
  }

  private async assertCountUnderLimit(
    envKey: string,
    count: () => Promise<number>,
  ) {
    const limit = Number(process.env[envKey]);
    if (!Number.isFinite(limit) || limit <= 0) return;
    if ((await count()) >= limit) {
      throw new BadRequestException({
        code: "RESOURCE_BUDGET_EXCEEDED",
        message: `${envKey} has been reached. Increase the configured cap intentionally before retrying.`,
      });
    }
  }
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}
