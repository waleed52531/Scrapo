import { Module } from "@nestjs/common";
import { RankingModule } from "../ranking/ranking.module";
import { OptimizationController } from "./optimization.controller";
import { OptimizationService } from "./optimization.service";

@Module({
  imports: [RankingModule],
  controllers: [OptimizationController],
  providers: [OptimizationService],
  exports: [OptimizationService],
})
export class OptimizationModule {}
