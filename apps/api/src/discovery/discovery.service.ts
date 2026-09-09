import { Inject, Injectable } from "@nestjs/common";
import { LeadSource } from "@prisma/client";
import { AnalysisQueueService } from "../analysis/analysis-queue.service";
import {
  mockWebSearch,
  providerHealth,
  socialProviderHealth,
  type ProviderHealth,
} from "./providers";
import type { ManualSocialImportDto } from "./dto/discovery.dto";

@Injectable()
export class DiscoveryService {
  constructor(
    @Inject(AnalysisQueueService)
    private readonly analysisQueue: AnalysisQueueService,
  ) {}

  webSearchHealth(): ProviderHealth {
    return providerHealth(
      process.env.WEB_SEARCH_PROVIDER,
      process.env.WEB_SEARCH_API_KEY,
      "web-search",
    );
  }

  emailEnrichmentHealth(): ProviderHealth {
    return providerHealth(
      process.env.EMAIL_ENRICHMENT_PROVIDER,
      process.env.EMAIL_ENRICHMENT_API_KEY,
      "email-enrichment",
    );
  }

  emailVerificationHealth(): ProviderHealth {
    return providerHealth(
      process.env.EMAIL_VERIFICATION_PROVIDER,
      process.env.EMAIL_VERIFICATION_API_KEY,
      "email-verification",
    );
  }

  xHealth(): ProviderHealth {
    return socialProviderHealth("x");
  }

  redditHealth(): ProviderHealth {
    return socialProviderHealth("reddit");
  }

  telegramHealth(): ProviderHealth {
    return socialProviderHealth("telegram");
  }

  async webSearch(query: string, limit = 10) {
    const health = this.webSearchHealth();
    return {
      provider: health.provider,
      status: health.status,
      demoMode: health.demoMode,
      query,
      results: mockWebSearch(query, limit),
    };
  }

  async importSocial(workspaceId: string, input: ManualSocialImportDto) {
    const platform =
      input.platform === LeadSource.X || input.platform === LeadSource.TELEGRAM
        ? input.platform
        : LeadSource.REDDIT;
    return this.analysisQueue.enqueue(workspaceId, "IMPORT_SOCIAL_SIGNAL", {
      platform,
      title: input.title,
      content: input.content,
      sourceUrl: input.sourceUrl,
      profileUrl: input.profileUrl,
      username: input.username,
      displayName: input.displayName,
    });
  }
}
