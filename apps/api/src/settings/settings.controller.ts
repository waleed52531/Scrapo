import { Body, Controller, Get, Inject, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentAuth, type AuthContext } from "../auth/current-auth.decorator";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
import { SettingsService } from "./settings.service";

@ApiTags("settings")
@ApiBearerAuth()
@Controller("settings")
export class SettingsController {
  constructor(
    @Inject(SettingsService) private readonly settings: SettingsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get editable workspace settings" })
  get(@CurrentAuth() auth: AuthContext) {
    return this.settings.get(auth.workspaceId);
  }

  @Patch()
  @ApiOperation({ summary: "Update workspace settings" })
  update(@CurrentAuth() auth: AuthContext, @Body() input: UpdateSettingsDto) {
    return this.settings.update(auth.workspaceId, auth.userId, input);
  }

  @Get("scoring")
  @ApiOperation({ summary: "Get deterministic lead scoring weights" })
  getScoring(@CurrentAuth() auth: AuthContext) {
    return this.settings.getScoring(auth.workspaceId);
  }

  @Patch("scoring")
  @ApiOperation({ summary: "Update deterministic lead scoring weights" })
  updateScoring(
    @CurrentAuth() auth: AuthContext,
    @Body() scoring: Record<string, number>,
  ) {
    return this.settings.updateScoring(auth.workspaceId, auth.userId, scoring);
  }

  @Get("ai")
  @ApiOperation({
    summary: "Get OpenAI configuration status without exposing secrets",
  })
  getAiStatus() {
    return this.settings.aiStatus();
  }
}
