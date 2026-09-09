import { Module } from "@nestjs/common";
import { RankingModule } from "../ranking/ranking.module";
import { LeadFeedbackController } from "./lead-feedback.controller";
import { LeadFeedbackService } from "./lead-feedback.service";

@Module({
  imports: [RankingModule],
  controllers: [LeadFeedbackController],
  providers: [LeadFeedbackService],
})
export class LeadFeedbackModule {}
