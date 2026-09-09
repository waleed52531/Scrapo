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
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentAuth, type AuthContext } from "../auth/current-auth.decorator";
import {
  CreateTelegramSourceDto,
  UpdateTelegramSourceDto,
} from "./dto/telegram-source.dto";
import { TelegramSourcesService } from "./telegram-sources.service";

@ApiTags("telegram")
@ApiBearerAuth()
@Controller("telegram/sources")
export class TelegramSourcesController {
  constructor(
    @Inject(TelegramSourcesService)
    private readonly telegramSources: TelegramSourcesService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List configured Telegram channels/groups" })
  list(@CurrentAuth() auth: AuthContext) {
    return this.telegramSources.list(auth.workspaceId);
  }

  @Post()
  @ApiOperation({ summary: "Add a Telegram channel/group to monitor" })
  create(
    @CurrentAuth() auth: AuthContext,
    @Body() input: CreateTelegramSourceDto,
  ) {
    return this.telegramSources.create(auth.workspaceId, auth.userId, input);
  }

  @Post(":id/sync")
  @ApiOperation({ summary: "Request a sync for a configured Telegram source" })
  syncNow(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.telegramSources.syncNow(auth.workspaceId, auth.userId, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a Telegram source" })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateTelegramSourceDto,
  ) {
    return this.telegramSources.update(
      auth.workspaceId,
      auth.userId,
      id,
      input,
    );
  }

  @Delete(":id")
  @HttpCode(200)
  @ApiOperation({ summary: "Remove a Telegram source" })
  delete(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.telegramSources.delete(auth.workspaceId, auth.userId, id);
  }
}
