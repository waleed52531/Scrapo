import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentAuth, type AuthContext } from "../auth/current-auth.decorator";
import { DiscoveryService } from "./discovery.service";
import { ManualSocialImportDto, WebSearchDto } from "./dto/discovery.dto";

@ApiTags("discovery")
@ApiBearerAuth()
@Controller()
export class DiscoveryController {
  constructor(
    @Inject(DiscoveryService) private readonly discovery: DiscoveryService,
  ) {}

  @Post("discovery/web/search")
  @ApiOperation({ summary: "Run a provider-backed or mock web search preview" })
  webSearch(@Body() input: WebSearchDto) {
    return this.discovery.webSearch(input.query, input.limit ?? 10);
  }

  @Get("integrations/web-search/health")
  @ApiOperation({ summary: "Check web search provider configuration" })
  webSearchHealth() {
    return this.discovery.webSearchHealth();
  }

  @Get("integrations/email-enrichment/health")
  @ApiOperation({ summary: "Check email enrichment provider configuration" })
  emailEnrichmentHealth() {
    return this.discovery.emailEnrichmentHealth();
  }

  @Get("integrations/email-verification/health")
  @ApiOperation({ summary: "Check email verification provider configuration" })
  emailVerificationHealth() {
    return this.discovery.emailVerificationHealth();
  }

  @Get("integrations/x/health")
  @ApiOperation({ summary: "Check X discovery configuration" })
  xHealth() {
    return this.discovery.xHealth();
  }

  @Get("integrations/reddit/health")
  @ApiOperation({ summary: "Check Reddit compliant API configuration" })
  redditHealth() {
    return this.discovery.redditHealth();
  }

  @Get("integrations/telegram/health")
  @ApiOperation({ summary: "Check Telegram source monitoring configuration" })
  telegramHealth() {
    return this.discovery.telegramHealth();
  }

  @Post("discovery/social/manual")
  @ApiOperation({ summary: "Queue manual Reddit/X/Telegram signal ingestion" })
  importSocial(
    @CurrentAuth() auth: AuthContext,
    @Body() input: ManualSocialImportDto,
  ) {
    return this.discovery.importSocial(auth.workspaceId, input);
  }
}
