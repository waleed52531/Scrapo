import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentAuth, type AuthContext } from "../auth/current-auth.decorator";
import { CreateSuppressionDto } from "../outreach/dto/outreach.dto";
import { SuppressionService } from "./suppression.service";

@ApiTags("suppression")
@ApiBearerAuth()
@Controller("settings/suppression")
export class SuppressionController {
  constructor(
    @Inject(SuppressionService)
    private readonly suppression: SuppressionService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List suppressed emails/domains/contacts" })
  list(@CurrentAuth() auth: AuthContext) {
    return this.suppression.list(auth.workspaceId);
  }

  @Post()
  @ApiOperation({ summary: "Add suppression entry" })
  create(
    @CurrentAuth() auth: AuthContext,
    @Body() input: CreateSuppressionDto,
  ) {
    return this.suppression.create(auth.workspaceId, auth.userId, input);
  }

  @Delete(":id")
  @HttpCode(200)
  @ApiOperation({ summary: "Remove suppression entry" })
  delete(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.suppression.delete(auth.workspaceId, auth.userId, id);
  }
}
