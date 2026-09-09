import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ShortlistsController } from "./shortlists.controller";
import { ShortlistsService } from "./shortlists.service";

@Module({
  imports: [PrismaModule],
  controllers: [ShortlistsController],
  providers: [ShortlistsService],
})
export class ShortlistsModule {}
