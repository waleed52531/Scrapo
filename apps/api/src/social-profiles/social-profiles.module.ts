import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SocialProfilesController } from "./social-profiles.controller";
import { SocialProfilesService } from "./social-profiles.service";

@Module({
  imports: [PrismaModule],
  controllers: [SocialProfilesController],
  providers: [SocialProfilesService],
})
export class SocialProfilesModule {}
