import { Controller, Get, Inject } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentAuth, type AuthContext } from "../auth/current-auth.decorator";
import { Public } from "../common/public.decorator";
import { HealthService } from "./health.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    @Inject(HealthService) private readonly healthService: HealthService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "Check public API process and database health" })
  async health() {
    return this.healthService.publicHealth();
  }

  @Get("/system")
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Check protected system health across infrastructure and providers",
  })
  async system(@CurrentAuth() auth: AuthContext) {
    return this.healthService.systemHealth(auth.workspaceId);
  }

  @Get("/usage")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Summarize usage and configured budget limits" })
  usage(@CurrentAuth() auth: AuthContext) {
    return this.healthService.usage(auth.workspaceId);
  }
}
