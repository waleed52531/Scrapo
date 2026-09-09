import { Module } from "@nestjs/common";
import { LeadRankingService } from "./lead-ranking.service";

@Module({
  providers: [LeadRankingService],
  exports: [LeadRankingService],
})
export class RankingModule {}
