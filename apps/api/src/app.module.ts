import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ActionQueueModule } from "./action-queue/action-queue.module";
import { AuthGuard } from "./auth/auth.guard";
import { AuthModule } from "./auth/auth.module";
import { AutomationModule } from "./automation/automation.module";
import { CampaignsModule } from "./campaigns/campaigns.module";
import { CompaniesModule } from "./companies/companies.module";
import { ContactsModule } from "./contacts/contacts.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { DiscoveryModule } from "./discovery/discovery.module";
import { GmailModule } from "./gmail/gmail.module";
import { HealthModule } from "./health/health.module";
import { AnalysisModule } from "./analysis/analysis.module";
import { JobsModule } from "./jobs/jobs.module";
import { LeadFeedbackModule } from "./lead-feedback/lead-feedback.module";
import { LeadHuntsModule } from "./lead-hunts/lead-hunts.module";
import { LeadsModule } from "./leads/leads.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { OptimizationModule } from "./optimization/optimization.module";
import { OutreachModule } from "./outreach/outreach.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RequestIdMiddleware } from "./common/request-id.middleware";
import { validateEnv } from "./config/env.validation";
import { RankingModule } from "./ranking/ranking.module";
import { RepliesModule } from "./replies/replies.module";
import { ReportsModule } from "./reports/reports.module";
import { SearchQueriesModule } from "./search-queries/search-queries.module";
import { SettingsModule } from "./settings/settings.module";
import { ShortlistsModule } from "./shortlists/shortlists.module";
import { SocialProfilesModule } from "./social-profiles/social-profiles.module";
import { SuppressionModule } from "./suppression/suppression.module";
import { TelegramModule } from "./telegram/telegram.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.RATE_LIMIT_TTL_MS ?? 60_000),
        limit: Number(process.env.RATE_LIMIT_MAX ?? 120),
      },
    ]),
    PrismaModule,
    AuthModule,
    HealthModule,
    ActionQueueModule,
    AnalysisModule,
    AutomationModule,
    GmailModule,
    DiscoveryModule,
    DashboardModule,
    CampaignsModule,
    LeadFeedbackModule,
    LeadHuntsModule,
    CompaniesModule,
    ContactsModule,
    LeadsModule,
    NotificationsModule,
    OptimizationModule,
    JobsModule,
    OutreachModule,
    RankingModule,
    RepliesModule,
    ReportsModule,
    SearchQueriesModule,
    ShortlistsModule,
    SocialProfilesModule,
    SuppressionModule,
    TelegramModule,
    SettingsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: "*path", method: RequestMethod.ALL });
  }
}
