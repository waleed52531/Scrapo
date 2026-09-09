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
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentAuth, type AuthContext } from "../auth/current-auth.decorator";
import {
  CreateSearchQueryDto,
  SearchQueryListDto,
  UpdateSearchQueryDto,
} from "./dto/search-query.dto";
import { SearchQueriesService } from "./search-queries.service";

@ApiTags("search-queries")
@ApiBearerAuth()
@Controller("search-queries")
export class SearchQueriesController {
  constructor(
    @Inject(SearchQueriesService)
    private readonly searchQueries: SearchQueriesService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List workspace discovery search queries" })
  list(@CurrentAuth() auth: AuthContext, @Query() query: SearchQueryListDto) {
    return this.searchQueries.list(auth.workspaceId, query);
  }

  @Post()
  @ApiOperation({ summary: "Create a workspace discovery search query" })
  create(
    @CurrentAuth() auth: AuthContext,
    @Body() input: CreateSearchQueryDto,
  ) {
    return this.searchQueries.create(auth.workspaceId, auth.userId, input);
  }

  @Post("defaults")
  @ApiOperation({ summary: "Install or refresh default agency queries" })
  installDefaults(@CurrentAuth() auth: AuthContext) {
    return this.searchQueries.ensureDefaults(auth.workspaceId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a search query and recent run history" })
  get(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.searchQueries.get(auth.workspaceId, id);
  }

  @Post(":id/clone")
  @ApiOperation({ summary: "Clone a search query as a disabled draft" })
  clone(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.searchQueries.clone(auth.workspaceId, auth.userId, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a search query" })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateSearchQueryDto,
  ) {
    return this.searchQueries.update(auth.workspaceId, auth.userId, id, input);
  }

  @Delete(":id")
  @HttpCode(200)
  @ApiOperation({ summary: "Delete a search query" })
  delete(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.searchQueries.delete(auth.workspaceId, auth.userId, id);
  }
}
