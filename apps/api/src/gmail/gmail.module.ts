import { Module } from "@nestjs/common";
import { AnalysisModule } from "../analysis/analysis.module";
import { GmailController } from "./gmail.controller";
import { GmailService } from "./gmail.service";

@Module({
  imports: [AnalysisModule],
  controllers: [GmailController],
  providers: [GmailService],
  exports: [GmailService],
})
export class GmailModule {}
