import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { TelegramSourcesController } from "./telegram-sources.controller";
import { TelegramSourcesService } from "./telegram-sources.service";

@Module({
  imports: [PrismaModule],
  controllers: [TelegramSourcesController],
  providers: [TelegramSourcesService],
})
export class TelegramModule {}
