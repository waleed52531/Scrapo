import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { JobStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class JobsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(workspaceId: string, status?: string) {
    const where: Prisma.SystemJobWhereInput = {
      workspaceId,
      ...(status && status in JobStatus ? { status: status as JobStatus } : {}),
    };
    return this.prisma.systemJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async get(workspaceId: string, id: string) {
    const job = await this.prisma.systemJob.findFirst({
      where: { id, workspaceId },
    });
    if (!job)
      throw new NotFoundException({
        code: "JOB_NOT_FOUND",
        message: "Job could not be found.",
      });
    return job;
  }
}
