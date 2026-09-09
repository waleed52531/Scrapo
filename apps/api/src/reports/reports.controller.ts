import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentAuth, type AuthContext } from "../auth/current-auth.decorator";
import { ReportsService } from "./reports.service";

@ApiTags("reports")
@ApiBearerAuth()
@Controller("reports/weekly")
export class ReportsController {
  constructor(
    @Inject(ReportsService) private readonly reports: ReportsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List weekly automation reports" })
  list(@CurrentAuth() auth: AuthContext) {
    return this.reports.listWeekly(auth.workspaceId);
  }

  @Post("generate")
  @HttpCode(200)
  @ApiOperation({ summary: "Generate this week's automation report now" })
  generate(@CurrentAuth() auth: AuthContext) {
    return this.reports.generateWeekly(auth.workspaceId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get weekly report detail" })
  get(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.reports.getWeekly(auth.workspaceId, id);
  }
}
