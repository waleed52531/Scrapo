import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentAuth, type AuthContext } from "../auth/current-auth.decorator";
import { CampaignsService } from "./campaigns.service";
import { CreateCampaignDto, UpdateCampaignDto } from "./dto/campaign.dto";

@ApiTags("campaigns")
@ApiBearerAuth()
@Controller("campaigns")
export class CampaignsController {
  constructor(
    @Inject(CampaignsService) private readonly campaigns: CampaignsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List outreach campaigns with analytics" })
  list(@CurrentAuth() auth: AuthContext) {
    return this.campaigns.list(auth.workspaceId);
  }

  @Post()
  @ApiOperation({ summary: "Create a controlled outreach campaign" })
  create(@CurrentAuth() auth: AuthContext, @Body() input: CreateCampaignDto) {
    return this.campaigns.create(auth.workspaceId, auth.userId, input);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get campaign detail" })
  get(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.campaigns.get(auth.workspaceId, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a campaign" })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateCampaignDto,
  ) {
    return this.campaigns.update(auth.workspaceId, auth.userId, id, input);
  }

  @Post(":id/activate")
  @ApiOperation({ summary: "Activate a campaign" })
  activate(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.campaigns.activate(auth.workspaceId, auth.userId, id);
  }

  @Post(":id/pause")
  @ApiOperation({ summary: "Pause a campaign" })
  pause(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.campaigns.pause(auth.workspaceId, auth.userId, id);
  }
}
