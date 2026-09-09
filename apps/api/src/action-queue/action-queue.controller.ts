import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Body,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentAuth, type AuthContext } from "../auth/current-auth.decorator";
import { ActionQueueService } from "./action-queue.service";
import {
  ActionQueueListDto,
  UpdateActionItemDto,
} from "./dto/action-queue.dto";

@ApiTags("action-queue")
@ApiBearerAuth()
@Controller("action-queue")
export class ActionQueueController {
  constructor(
    @Inject(ActionQueueService)
    private readonly actionQueue: ActionQueueService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List manual social/outreach action items" })
  list(@CurrentAuth() auth: AuthContext, @Query() query: ActionQueueListDto) {
    return this.actionQueue.list(auth.workspaceId, query);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a manual action item status/content" })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateActionItemDto,
  ) {
    return this.actionQueue.update(auth.workspaceId, auth.userId, id, input);
  }
}
