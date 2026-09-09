import {
  Body,
  Controller,
  Get,
  Headers,
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
  GenerateOutreachDto,
  OutreachListDto,
  SendOutreachDto,
  UpdateOutreachDto,
} from "./dto/outreach.dto";
import { OutreachService } from "./outreach.service";

@ApiTags("outreach")
@ApiBearerAuth()
@Controller()
export class OutreachController {
  constructor(
    @Inject(OutreachService) private readonly outreach: OutreachService,
  ) {}

  @Get("leads/:id/outreach-eligibility")
  @ApiOperation({ summary: "Check backend outreach eligibility for a lead" })
  eligibility(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.outreach.eligibilityForLead(auth.workspaceId, id);
  }

  @Post("leads/:id/outreach/generate")
  @ApiOperation({ summary: "Generate personalized outreach for a lead" })
  generate(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: GenerateOutreachDto,
  ) {
    return this.outreach.generate(auth.workspaceId, auth.userId, id, input);
  }

  @Get("outreach")
  @ApiOperation({ summary: "List outreach messages" })
  list(@CurrentAuth() auth: AuthContext, @Query() query: OutreachListDto) {
    return this.outreach.list(auth.workspaceId, query);
  }

  @Get("outreach/:id")
  @ApiOperation({ summary: "Get outreach detail" })
  get(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.outreach.get(auth.workspaceId, id);
  }

  @Patch("outreach/:id")
  @ApiOperation({ summary: "Edit outreach subject/body" })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateOutreachDto,
  ) {
    return this.outreach.update(auth.workspaceId, auth.userId, id, input);
  }

  @Post("outreach/:id/create-draft")
  @ApiOperation({ summary: "Create a Gmail draft after eligibility checks" })
  createDraft(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.outreach.createDraft(auth.workspaceId, auth.userId, id);
  }

  @Post("outreach/:id/approve")
  @ApiOperation({ summary: "Approve outreach for sending" })
  approve(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.outreach.approve(auth.workspaceId, auth.userId, id);
  }

  @Post("outreach/:id/send")
  @ApiOperation({
    summary: "Send approved outreach with idempotency protection",
  })
  send(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: SendOutreachDto,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.outreach.send(auth.workspaceId, auth.userId, id, {
      ...input,
      idempotencyKey: input.idempotencyKey ?? idempotencyKey,
    });
  }

  @Post("outreach/:id/cancel")
  @HttpCode(200)
  @ApiOperation({ summary: "Cancel outreach" })
  cancel(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.outreach.cancel(auth.workspaceId, auth.userId, id);
  }

  @Post("outreach/:id/follow-up/generate")
  @ApiOperation({ summary: "Generate one eligible follow-up" })
  generateFollowUp(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.outreach.generateFollowUp(auth.workspaceId, auth.userId, id);
  }

  @Post("outreach/:id/follow-up/create-draft")
  @ApiOperation({ summary: "Create Gmail draft for one eligible follow-up" })
  createFollowUpDraft(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.outreach.createFollowUpDraft(auth.workspaceId, auth.userId, id);
  }

  @Get("follow-ups/due")
  @ApiOperation({
    summary: "List outreach messages eligible for one follow-up",
  })
  dueFollowUps(@CurrentAuth() auth: AuthContext) {
    return this.outreach.dueFollowUps(auth.workspaceId);
  }
}
