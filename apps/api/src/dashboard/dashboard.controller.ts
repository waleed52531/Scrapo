import { Controller, Get, Inject } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentAuth, type AuthContext } from "../auth/current-auth.decorator";
import { DashboardService } from "./dashboard.service";

@ApiTags("dashboard")
@ApiBearerAuth()
@Controller("dashboard")
export class DashboardController {
  constructor(
    @Inject(DashboardService) private readonly dashboard: DashboardService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get the current workspace pipeline summary" })
  get(@CurrentAuth() auth: AuthContext) {
    return this.dashboard.get(auth.workspaceId);
  }
}
