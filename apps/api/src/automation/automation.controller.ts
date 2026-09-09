import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentAuth, type AuthContext } from "../auth/current-auth.decorator";
import { AutomationService } from "./automation.service";
import {
  AutomationRunListDto,
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
} from "./dto/automation.dto";

@ApiTags("automation")
@ApiBearerAuth()
@Controller()
export class AutomationController {
  constructor(
    @Inject(AutomationService) private readonly automation: AutomationService,
  ) {}

  @Get("automation")
  @ApiOperation({ summary: "List automation rules and status" })
  list(@CurrentAuth() auth: AuthContext) {
    return this.automation.list(auth.workspaceId);
  }

  @Post("automation")
  @ApiOperation({ summary: "Create an automation rule" })
  create(
    @CurrentAuth() auth: AuthContext,
    @Body() input: CreateAutomationRuleDto,
  ) {
    return this.automation.create(auth.workspaceId, auth.userId, input);
  }

  @Get("automation/status")
  @ApiOperation({ summary: "Get automation dashboard status" })
  status(@CurrentAuth() auth: AuthContext) {
    return this.automation.dashboard(auth.workspaceId);
  }

  @Post("automation/pause")
  @HttpCode(200)
  @ApiOperation({ summary: "Pause automation without pausing outreach" })
  pause(@CurrentAuth() auth: AuthContext) {
    return this.automation.pause(auth.workspaceId, auth.userId);
  }

  @Post("automation/resume")
  @HttpCode(200)
  @ApiOperation({ summary: "Resume automation and clear kill switch" })
  resume(@CurrentAuth() auth: AuthContext) {
    return this.automation.resume(auth.workspaceId, auth.userId);
  }

  @Post("automation/stop-all")
  @HttpCode(200)
  @ApiOperation({ summary: "Enable global automation kill switch" })
  stopAll(@CurrentAuth() auth: AuthContext) {
    return this.automation.stopAll(auth.workspaceId, auth.userId);
  }

  @Get("automation-runs")
  @ApiOperation({ summary: "List automation run history" })
  runs(@CurrentAuth() auth: AuthContext, @Query() query: AutomationRunListDto) {
    return this.automation.runs(auth.workspaceId, query);
  }

  @Get("automation-runs/:id")
  @ApiOperation({ summary: "Get automation run detail" })
  runDetail(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.automation.runDetail(auth.workspaceId, id);
  }

  @Post("automation-runs/:id/retry")
  @ApiOperation({ summary: "Retry a failed automation run with new history" })
  retry(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.automation.retryRun(auth.workspaceId, auth.userId, id);
  }

  @Get("automation/:id")
  @ApiOperation({ summary: "Get automation rule detail" })
  get(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.automation.get(auth.workspaceId, id);
  }

  @Patch("automation/:id")
  @ApiOperation({ summary: "Update automation rule configuration" })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateAutomationRuleDto,
  ) {
    return this.automation.update(auth.workspaceId, auth.userId, id, input);
  }

  @Delete("automation/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Delete automation rule" })
  delete(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.automation.delete(auth.workspaceId, auth.userId, id);
  }

  @Post("automation/:id/run")
  @ApiOperation({ summary: "Run automation immediately using saved config" })
  runNow(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.automation.runNow(auth.workspaceId, auth.userId, id);
  }

  @Post("automation/:id/enable")
  @ApiOperation({ summary: "Enable an automation rule" })
  enable(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.automation.enable(auth.workspaceId, auth.userId, id);
  }

  @Post("automation/:id/disable")
  @ApiOperation({ summary: "Disable an automation rule" })
  disable(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.automation.disable(auth.workspaceId, auth.userId, id);
  }

  @Post("automation/:id/skip-next")
  @ApiOperation({ summary: "Skip the next scheduled occurrence" })
  skipNext(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.automation.skipNext(auth.workspaceId, auth.userId, id);
  }
}
