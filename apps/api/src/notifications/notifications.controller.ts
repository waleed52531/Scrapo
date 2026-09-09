import {
  Controller,
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
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@ApiBearerAuth()
@Controller("notifications")
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List in-app notifications" })
  list(@CurrentAuth() auth: AuthContext) {
    return this.notifications.list(auth.workspaceId);
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "Mark one notification read" })
  read(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(auth.workspaceId, id);
  }

  @Post("read-all")
  @HttpCode(200)
  @ApiOperation({ summary: "Mark all notifications read" })
  readAll(@CurrentAuth() auth: AuthContext) {
    return this.notifications.readAll(auth.workspaceId);
  }
}
