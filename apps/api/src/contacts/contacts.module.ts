import { Module } from "@nestjs/common";
import { AnalysisModule } from "../analysis/analysis.module";
import { ContactsController } from "./contacts.controller";
import { ContactsService } from "./contacts.service";

@Module({
  imports: [AnalysisModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
