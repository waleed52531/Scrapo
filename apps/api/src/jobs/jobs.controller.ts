import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentAuth, type AuthContext } from "../auth/current-auth.decorator";
import { JobsService } from "./jobs.service";

@ApiTags("jobs")
@ApiBearerAuth()
@Controller("jobs")
export class JobsController {
  constructor(@Inject(JobsService) private readonly jobs: JobsService) {}

  @Get()
  @ApiOperation({ summary: "List workspace system jobs" })
  list(@CurrentAuth() auth: AuthContext, @Query("status") status?: string) {
    return this.jobs.list(auth.workspaceId, status);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a workspace system job" })
  get(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.jobs.get(auth.workspaceId, id);
  }
}
