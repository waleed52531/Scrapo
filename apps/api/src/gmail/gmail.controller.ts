import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentAuth, type AuthContext } from "../auth/current-auth.decorator";
import { Public } from "../common/public.decorator";
import { GmailCallbackDto, MockGmailReplyDto } from "./dto/gmail.dto";
import { GmailService } from "./gmail.service";

@ApiTags("gmail")
@ApiBearerAuth()
@Controller("integrations/gmail")
export class GmailController {
  constructor(@Inject(GmailService) private readonly gmail: GmailService) {}

  @Get()
  @ApiOperation({ summary: "Get Gmail integration status" })
  status(@CurrentAuth() auth: AuthContext) {
    return this.gmail.status(auth.workspaceId);
  }

  @Post("connect")
  @ApiOperation({ summary: "Start Gmail OAuth or connect mock Gmail locally" })
  connect(@CurrentAuth() auth: AuthContext) {
    return this.gmail.connect(auth.workspaceId, auth.userId);
  }

  @Public()
  @Get("callback")
  @ApiOperation({ summary: "Handle Google OAuth callback" })
  callback(@Query() input: GmailCallbackDto) {
    return this.gmail.callback(input.code, input.state);
  }

  @Post("disconnect")
  @HttpCode(200)
  @ApiOperation({ summary: "Disconnect Gmail while preserving history" })
  disconnect(@CurrentAuth() auth: AuthContext) {
    return this.gmail.disconnect(auth.workspaceId, auth.userId);
  }

  @Post("test")
  @ApiOperation({ summary: "Test Gmail connection without exposing tokens" })
  test(@CurrentAuth() auth: AuthContext) {
    return this.gmail.test(auth.workspaceId);
  }

  @Post("sync")
  @HttpCode(202)
  @ApiOperation({ summary: "Queue Gmail reply synchronization" })
  sync(@CurrentAuth() auth: AuthContext) {
    return this.gmail.sync(auth.workspaceId);
  }

  @Post("mock-reply")
  @ApiOperation({ summary: "Queue a mock Gmail reply for local testing" })
  mockReply(
    @CurrentAuth() auth: AuthContext,
    @Body() input: MockGmailReplyDto,
  ) {
    return this.gmail.enqueueMockReply(auth.workspaceId, auth.userId, input);
  }
}
