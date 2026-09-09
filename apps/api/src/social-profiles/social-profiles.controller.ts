import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentAuth, type AuthContext } from "../auth/current-auth.decorator";
import { SocialProfilesService } from "./social-profiles.service";

@ApiTags("social-profiles")
@ApiBearerAuth()
@Controller("social-profiles")
export class SocialProfilesController {
  constructor(
    @Inject(SocialProfilesService)
    private readonly socialProfiles: SocialProfilesService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List linked social profiles for the workspace" })
  list(@CurrentAuth() auth: AuthContext, @Query("platform") platform?: string) {
    return this.socialProfiles.list(auth.workspaceId, platform);
  }
}
