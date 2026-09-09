import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentAuth, type AuthContext } from "../auth/current-auth.decorator";
import { CreateLeadFeedbackDto } from "./lead-feedback.dto";
import { LeadFeedbackService } from "./lead-feedback.service";

@ApiTags("lead-feedback")
@ApiBearerAuth()
@Controller("leads/:leadId/feedback")
export class LeadFeedbackController {
  constructor(
    @Inject(LeadFeedbackService) private readonly feedback: LeadFeedbackService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List manual feedback for a lead" })
  list(
    @CurrentAuth() auth: AuthContext,
    @Param("leadId", ParseUUIDPipe) leadId: string,
  ) {
    return this.feedback.list(auth.workspaceId, leadId);
  }

  @Post()
  @ApiOperation({ summary: "Store manual lead feedback for ranking" })
  create(
    @CurrentAuth() auth: AuthContext,
    @Param("leadId", ParseUUIDPipe) leadId: string,
    @Body() input: CreateLeadFeedbackDto,
  ) {
    return this.feedback.create(auth.workspaceId, auth.userId, leadId, input);
  }
}
