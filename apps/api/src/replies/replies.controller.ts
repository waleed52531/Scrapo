import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentAuth, type AuthContext } from "../auth/current-auth.decorator";
import { ReplyListDto } from "./dto/reply.dto";
import { RepliesService } from "./replies.service";

@ApiTags("replies")
@ApiBearerAuth()
@Controller("replies")
export class RepliesController {
  constructor(
    @Inject(RepliesService) private readonly replies: RepliesService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List tracked Gmail replies" })
  list(@CurrentAuth() auth: AuthContext, @Query() query: ReplyListDto) {
    return this.replies.list(auth.workspaceId, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get reply detail" })
  get(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.replies.get(auth.workspaceId, id);
  }

  @Post(":id/reclassify")
  @ApiOperation({ summary: "Re-run AI/deterministic reply classification" })
  reclassify(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.replies.reclassify(auth.workspaceId, auth.userId, id);
  }
}
