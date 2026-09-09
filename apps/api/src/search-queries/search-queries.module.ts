import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SearchQueriesController } from "./search-queries.controller";
import { SearchQueriesService } from "./search-queries.service";

@Module({
  imports: [PrismaModule],
  controllers: [SearchQueriesController],
  providers: [SearchQueriesService],
  exports: [SearchQueriesService],
})
export class SearchQueriesModule {}
