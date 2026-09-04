import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AnalysisController } from "./analysis.controller";
import { AnalysisQueueService } from "./analysis-queue.service";
import { WebsiteAnalyzerService } from "./website-analyzer.service";

@Module({
  imports: [PrismaModule],
  controllers: [AnalysisController],
  providers: [AnalysisQueueService, WebsiteAnalyzerService],
  exports: [AnalysisQueueService, WebsiteAnalyzerService],
})
export class AnalysisModule {}
