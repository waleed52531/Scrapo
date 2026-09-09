import { Module } from "@nestjs/common";
import { AnalysisModule } from "../analysis/analysis.module";
import { DiscoveryController } from "./discovery.controller";
import { DiscoveryService } from "./discovery.service";

@Module({
  imports: [AnalysisModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryService],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
