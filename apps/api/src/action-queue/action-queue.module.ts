import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ActionQueueController } from "./action-queue.controller";
import { ActionQueueService } from "./action-queue.service";

@Module({
  imports: [PrismaModule],
  controllers: [ActionQueueController],
  providers: [ActionQueueService],
})
export class ActionQueueModule {}
