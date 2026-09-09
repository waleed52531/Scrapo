import { Controller, Get, Inject } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentAuth, type AuthContext } from "../auth/current-auth.decorator";
import { HealthService } from "./health.service";

@ApiTags("system")
@ApiBearerAuth()
@Controller("system")
export class SystemHealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  @Get("health")
  @ApiOperation({
    summary:
      "Check protected system health across infrastructure and providers",
  })
  systemHealth(@CurrentAuth() auth: AuthContext) {
    return this.health.systemHealth(auth.workspaceId);
  }
}
