import { Module } from "@nestjs/common";
import { AnalysisModule } from "../analysis/analysis.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SearchQueriesModule } from "../search-queries/search-queries.module";
import { LeadHuntsController } from "./lead-hunts.controller";
import { LeadHuntsService } from "./lead-hunts.service";

@Module({
  imports: [PrismaModule, AnalysisModule, SearchQueriesModule],
  controllers: [LeadHuntsController],
  providers: [LeadHuntsService],
})
export class LeadHuntsModule {}
