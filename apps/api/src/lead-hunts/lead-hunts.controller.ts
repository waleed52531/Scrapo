import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentAuth, type AuthContext } from "../auth/current-auth.decorator";
import { CreateLeadHuntDto, LeadHuntListDto } from "./dto/lead-hunt.dto";
import { LeadHuntsService } from "./lead-hunts.service";

@ApiTags("lead-hunts")
@ApiBearerAuth()
@Controller("lead-hunts")
export class LeadHuntsController {
  constructor(
    @Inject(LeadHuntsService) private readonly leadHunts: LeadHuntsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List async agency discovery runs" })
  list(@CurrentAuth() auth: AuthContext, @Query() query: LeadHuntListDto) {
    return this.leadHunts.list(auth.workspaceId, query);
  }

  @Post()
  @HttpCode(202)
  @ApiOperation({ summary: "Start an async agency lead-hunt run" })
  create(@CurrentAuth() auth: AuthContext, @Body() input: CreateLeadHuntDto) {
    return this.leadHunts.create(auth.workspaceId, auth.userId, input);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get lead-hunt progress and generated leads" })
  get(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.leadHunts.get(auth.workspaceId, id);
  }

  @Post(":id/cancel")
  @ApiOperation({ summary: "Cancel a queued/running lead hunt" })
  cancel(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.leadHunts.cancel(auth.workspaceId, auth.userId, id);
  }
}
