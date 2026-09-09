import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentAuth, type AuthContext } from "../auth/current-auth.decorator";
import { OptimizationService } from "./optimization.service";

@ApiTags("optimization")
@ApiBearerAuth()
@Controller("optimization/recommendations")
export class OptimizationController {
  constructor(
    @Inject(OptimizationService)
    private readonly optimization: OptimizationService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List performance optimization recommendations" })
  list(@CurrentAuth() auth: AuthContext) {
    return this.optimization.list(auth.workspaceId);
  }

  @Post("generate")
  @ApiOperation({
    summary: "Generate recommendations from historical outcomes",
  })
  generate(@CurrentAuth() auth: AuthContext) {
    return this.optimization.generate(auth.workspaceId);
  }

  @Post(":id/accept")
  @HttpCode(200)
  @ApiOperation({ summary: "Accept and explicitly apply a recommendation" })
  accept(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.optimization.accept(auth.workspaceId, auth.userId, id);
  }

  @Post(":id/reject")
  @HttpCode(200)
  @ApiOperation({ summary: "Reject an optimization recommendation" })
  reject(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.optimization.reject(auth.workspaceId, auth.userId, id);
  }

  @Post(":id/dismiss")
  @HttpCode(200)
  @ApiOperation({ summary: "Dismiss an optimization recommendation" })
  dismiss(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.optimization.dismiss(auth.workspaceId, auth.userId, id);
  }
}
