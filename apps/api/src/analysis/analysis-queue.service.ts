import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { QUEUE_NAMES } from "@scrapo/shared";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type AnalysisJobType =
  "ANALYZE_LEAD" | "ANALYZE_COMPANY" | "RESCORE_LEAD";

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
    const systemJob = await this.prisma.systemJob.create({
      data: {
        workspaceId,
        type,
        status: "QUEUED",
        metadata: payload as Prisma.InputJsonValue,
      },
    });
    const queueJob = await this.queue.add(
      type,
      { ...payload, workspaceId, systemJobId: systemJob.id },
      { attempts: 1, removeOnComplete: 100, removeOnFail: 100 },
    );
    await this.prisma.systemJob.update({
      where: { id: systemJob.id },
      data: { queueJobId: queueJob.id },
    });
    return { jobId: systemJob.id, queueJobId: queueJob.id, status: "QUEUED" };
  }

  async onModuleDestroy() {
    await this.queue.close();
    await this.connection.quit();
  }
}
