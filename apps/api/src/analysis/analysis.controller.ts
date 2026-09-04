import { Body, Controller, Inject, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { WebsiteAnalysisDto } from "./dto/analysis.dto";
import { WebsiteAnalyzerService } from "./website-analyzer.service";

@ApiTags("analysis")
@ApiBearerAuth()
@Controller("analysis")
export class AnalysisController {
  constructor(
    @Inject(WebsiteAnalyzerService)
    private readonly websites: WebsiteAnalyzerService,
  ) {}

  @Post("website")
  @ApiOperation({
    summary: "Analyze a public company website with SSRF protection",
  })
  analyzeWebsite(@Body() input: WebsiteAnalysisDto) {
    return this.websites.analyze(input.url);
  }
}
