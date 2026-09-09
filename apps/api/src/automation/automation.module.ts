import { Module } from "@nestjs/common";
import { AnalysisModule } from "../analysis/analysis.module";
import { AutomationController } from "./automation.controller";
import { AutomationService } from "./automation.service";

@Module({
  imports: [AnalysisModule],
  controllers: [AutomationController],
  providers: [AutomationService],
  exports: [AutomationService],
})
export class AutomationModule {}
