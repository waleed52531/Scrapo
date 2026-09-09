import { Controller, Get, Inject, Param, ParseUUIDPipe } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentAuth, type AuthContext } from "../auth/current-auth.decorator";
import { ShortlistsService } from "./shortlists.service";

@ApiTags("shortlists")
@ApiBearerAuth()
@Controller()
export class ShortlistsController {
  constructor(
    @Inject(ShortlistsService) private readonly shortlists: ShortlistsService,
  ) {}

  @Get("shortlists")
  @ApiOperation({ summary: "List generated shortlists" })
  list(@CurrentAuth() auth: AuthContext) {
    return this.shortlists.list(auth.workspaceId);
  }

  @Get("shortlist/current")
  @ApiOperation({ summary: "Get the latest generated shortlist" })
  current(@CurrentAuth() auth: AuthContext) {
    return this.shortlists.current(auth.workspaceId);
  }

  @Get("shortlists/:id")
  @ApiOperation({ summary: "Get a generated shortlist with ranked items" })
  get(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.shortlists.get(auth.workspaceId, id);
  }
}
