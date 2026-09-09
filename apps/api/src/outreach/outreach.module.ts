import { Module } from "@nestjs/common";
import { GmailModule } from "../gmail/gmail.module";
import { OutreachController } from "./outreach.controller";
import { OutreachEligibilityService } from "./outreach-eligibility.service";
import { OutreachService } from "./outreach.service";

@Module({
  imports: [GmailModule],
  controllers: [OutreachController],
  providers: [OutreachEligibilityService, OutreachService],
  exports: [OutreachEligibilityService, OutreachService],
})
export class OutreachModule {}
