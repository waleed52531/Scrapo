# Scrapo Lead Hunter

Phase 7 of a desktop-first freelance lead intelligence product. The repository now supports the Phase 1 foundation, Phase 2 manual analysis/scoring, Phase 3 automated web/agency discovery, Phase 4 social discovery sources with manual-only action queues, Phase 5 Gmail-backed outreach workflows, Phase 6 worker-based automation/reporting, and Phase 7 production hardening.

The web application is only a client. All business data and workspace rules live in the independent NestJS REST API under `/api/v1`, so a future Flutter client can use the same service without direct database access or duplicated business logic.

## Current scope

Implemented:

- pnpm monorepo with independently deployable web, API, and worker applications
- Next.js 16, React, TypeScript, Tailwind CSS, shadcn-style UI primitives, TanStack Query, React Hook Form, and Zod
- NestJS REST API with DTO validation, Helmet, CORS, rate limiting, request IDs, standardized responses, and Swagger
- Prisma/PostgreSQL schema, migration, indexes, foreign keys, workspace ownership, and audit records
- Supabase access-token verification through JWKS or the legacy JWT secret
- development-only demo authentication and automatic personal-workspace provisioning
- independent Redis/BullMQ worker with graceful shutdown and a real database startup job
- dashboard, lead detail, Leads CRUD, Companies CRUD, Contacts CRUD, and Settings UI/API
- manual lead/company analysis jobs using Redis/BullMQ
- protected website analyzer with SSRF safeguards, redirect validation, timeouts, and response-size limits
- deterministic backend score calculation with score bands and per-factor score history
- manual score override without destroying original score history
- AI settings status, scoring weight settings, review queue, and Phase 2 demo fixtures
- automated Phase 3 web/agency discovery pipeline: search, filter, deduplicate, analyze, enrich, verify, score, shortlist
- configurable web-search, email-enrichment, and email-verification provider health with mock fallback when keys are absent
- search query management with default agency queries for the UK, UAE, Saudi Arabia, United States, Canada, and Australia
- raw search result storage, duplicate tracking, enrichment records, email verification records, discovery runs, and shortlist snapshots
- Lead Hunter, search query, and shortlist web screens
- X, Reddit, and Telegram source architecture feeding the same raw lead, dedupe, company intelligence, contact enrichment, scoring, shortlist, and manual-action pipeline
- official X recent-search adapter when `X_ENABLED=true` and `X_BEARER_TOKEN` are configured, with mock-safe local fallback
- Reddit compliance gate with no scraping fallback; manual Reddit/social URL ingestion is supported through the API
- configured Telegram channel/group sources with health/status management; no arbitrary group joining or cold DM automation
- social profile storage, social signal evidence, social urgency/classification fields, social source badges, hot social leads, social funnel metrics, and action queue UI
- idempotent demo seed data and a Postman collection
- backend-only Gmail integration using official Google OAuth scopes for compose, send, and readonly thread/reply tracking
- encrypted Gmail credential storage, mock Gmail mode for local development, connect/reconnect/test/sync/disconnect endpoints, and no raw token exposure to the web app
- outreach generation, edit, draft creation, approval, sending, cancellation, one follow-up draft workflow, and central eligibility checks
- outreach safety controls: global pause, weekly cap defaulting to 20, cooldown window, suppression list, verified-email-only auto-send eligibility, and auto-send disabled by default
- campaigns, replies, reply classification, CRM status updates, bounce/unsubscribe suppression, and dashboard outreach metrics
- Gmail integration, Outreach, Campaigns, Replies, lead-detail outreach, shortlist outreach, and suppression web screens
- automation rules, automation run history, worker scheduler tick, manual run-now, pause/resume/kill switch, and skip-next controls
- weekly lead-hunt automation that can run while the browser is closed, rerank shortlists, and generate safe review drafts
- ranking score separate from lead score, rank reasons/breakdown, manual lead feedback, stale/reactivation maintenance, and source/query performance with small-sample protection
- optimization recommendations that are review-only until explicitly accepted
- scheduled Gmail reply sync/follow-up scans, weekly reports, notifications, and dashboard automation counters
- Automation, Automation Runs, Weekly Reports, Optimization, Notifications, ranking-aware Leads/Shortlist, and automation safety Settings screens
- production configuration validation for API/worker startup, including disabled-vs-misconfigured provider checks
- worker heartbeat persistence and protected `/api/v1/system/health`
- usage/cost-control visibility and queue-time budget caps for AI/search/enrichment/verification jobs
- Redis queue failure handling with `JOB_QUEUE_UNAVAILABLE`
- production-safe seeding that skips demo data unless explicitly forced
- outreach test-recipient mode for controlled launch sends
- CI workflow, Docker targets, security header configuration, secret-scan helper, and launch/operations documentation

Not implemented: automatic social replies/DMs, scraping bypasses, login automation, CAPTCHA/account rotation, LinkedIn scraping, uncontrolled bulk outreach, Flutter/mobile app, or unrestricted production auto-send.

## Architecture

```text
apps/web (Next.js client)
        │ HTTPS REST + Supabase bearer token
        ▼
apps/api (NestJS /api/v1)
        ├── PostgreSQL via Prisma
        └── workspace authorization and business rules

apps/worker (independent process)
        ├── Redis / BullMQ
        ├── PostgreSQL via Prisma
        └── analysis, web/social discovery, enrichment, verification, shortlist, manual-action, Gmail sync, reply classification, follow-up, automation, ranking, recommendation, notification, and report jobs
```

No Next.js API routes or server actions contain core business logic.

## Repository layout

```text
apps/
  api/                  NestJS API, Swagger, auth, workspace-scoped modules
  web/                  Next.js client and dashboard UI
  worker/               BullMQ background worker for analysis, discovery, and outreach sync jobs
packages/
  database/             Prisma schema, migration, generated client, seed
  types/                shared client-safe TypeScript contracts
  validation/           shared Zod validation utilities
  shared/               framework-neutral constants, normalization, and score helpers
  eslint-config/        shared flat ESLint configurations
docs/postman/           importable Phase 1 Postman collection
docs/*.md               architecture, deployment, operations, security, backups, disaster recovery, mobile API, smoke-test, and release docs
docker-compose.yml      local PostgreSQL 16 and Redis 7
Dockerfile              production image targets for api, worker, and web
```

## Prerequisites

- Node.js 22 or newer
- pnpm 11 (`npm install --global pnpm@11.25.0`)
- Docker Desktop, or locally installed PostgreSQL 16 and Redis
- a Supabase project for real authentication (not required for demo mode)

## Local setup

1. Install packages:

   ```bash
   pnpm install
   ```

2. Start PostgreSQL and Redis with Docker:

   ```bash
   docker compose up -d postgres redis
   ```

   The supplied Docker database URL is `postgresql://postgres:postgres@localhost:5432/scrapo?schema=public`.

   Homebrew is also supported:

   ```bash
   brew install postgresql@16 redis
   brew services start postgresql@16
   brew services start redis
   createdb scrapo
   ```

   With Homebrew, use your local database role in `DATABASE_URL`, for example `postgresql://YOUR_MAC_USER@localhost:5432/scrapo?schema=public`.

3. Create environment files:

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/worker/.env.example apps/worker/.env
   cp apps/web/.env.example apps/web/.env.local
   cp packages/database/.env.example packages/database/.env
   ```

   Set `DATABASE_URL` in `packages/database/.env` as well as the API and worker environments. Prisma CLI commands run from the database package and load this file.

4. Generate the Prisma client, apply migrations, and seed demo data:

   ```bash
   pnpm db:generate
   pnpm db:migrate:deploy
   pnpm db:seed
   ```

5. Run all applications:

   ```bash
   pnpm dev
   ```

   Or run them independently:

   ```bash
   pnpm dev:web
   pnpm dev:api
   pnpm dev:worker
   ```

6. Open:

- Web: `http://localhost:3000`
- API: `http://localhost:4000/api/v1`
- Swagger UI: `http://localhost:4000/api/docs`
- OpenAPI JSON: `http://localhost:4000/api/docs-json`
- System status: `http://localhost:3000/system`
- Usage limits: `http://localhost:3000/settings/usage`

With demo mode enabled, choose **Enter demo workspace** on the sign-in page. Demo tokens are rejected in production regardless of configuration. The seed creates a mock Gmail connection so Phase 5 can be tested locally without a Google account.

## Phase 5 Gmail setup

Local development defaults to `GMAIL_PROVIDER_MODE=MOCK`. Mock mode creates Gmail drafts/sends with mock IDs and lets you simulate replies via the API without calling Google.

For real Gmail:

1. Create a Google Cloud OAuth client for a web application.
2. Add this redirect URI: `http://localhost:4000/api/v1/integrations/gmail/callback` for local development.
3. Configure only these Gmail scopes:
   - `https://www.googleapis.com/auth/gmail.compose`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.readonly`
4. Set `GMAIL_PROVIDER_MODE=REAL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and a long random `GMAIL_TOKEN_ENCRYPTION_KEY` in the API environment.
5. Set the same `GMAIL_TOKEN_ENCRYPTION_KEY` in the worker environment so mock queued replies can be decrypted during local sync.

Do not put Google client secrets, refresh tokens, or Gmail credentials in the web environment.

## Environment variables

### Web (`apps/web/.env.local`)

| Variable                        | Required  | Purpose                                                 |
| ------------------------------- | --------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`           | yes       | Versioned API root, e.g. `http://localhost:4000/api/v1` |
| `NEXT_PUBLIC_SUPABASE_URL`      | real auth | Public Supabase project URL                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | real auth | Public Supabase anonymous key                           |
| `NEXT_PUBLIC_DEMO_MODE`         | no        | Shows local demo access when `true`                     |

Only public Supabase values belong in the web application.

### API (`apps/api/.env`)

| Variable                                   | Required             | Purpose                                                                  |
| ------------------------------------------ | -------------------- | ------------------------------------------------------------------------ |
| `NODE_ENV`                                 | yes                  | `development`, `test`, or `production`                                   |
| `API_PORT`                                 | no                   | Defaults to `4000`                                                       |
| `PORT`                                     | deploy host          | Generic host port; API uses `PORT` before `API_PORT`                     |
| `APP_VERSION`                              | no                   | Build/release version shown in health                                    |
| `DATABASE_URL`                             | yes                  | PostgreSQL/Supabase connection URL                                       |
| `REDIS_URL`                                | worker/future queues | Redis connection URL                                                     |
| `SUPABASE_URL`                             | real auth            | Supabase project URL and expected JWT issuer                             |
| `SUPABASE_JWT_SECRET`                      | legacy HS JWT only   | Legacy symmetric JWT signing secret; omit for asymmetric JWKS projects   |
| `WEB_APP_URL`                              | yes                  | Comma-separated allowed browser origins                                  |
| `CORS_ALLOWED_ORIGINS`                     | production           | Explicit comma-separated browser origins; falls back to `WEB_APP_URL`    |
| `DEMO_AUTH_ENABLED`                        | local demo only      | Accepts `demo-token` outside production                                  |
| `RATE_LIMIT_TTL_MS`                        | no                   | Rate-limit window, default `60000`                                       |
| `RATE_LIMIT_MAX`                           | no                   | Requests per window, default `120`                                       |
| `GENERATE_OPENAPI`                         | no                   | Writes `apps/api/openapi.json` on startup when `true`                    |
| `SENTRY_DSN`                               | api                  | Optional error-monitoring DSN; unset disables external capture           |
| `OUTREACH_PAUSED`                          | production safety    | Production default should be `true`                                      |
| `ALLOW_MOCK_PROVIDERS_IN_PRODUCTION`       | no                   | Must be explicit if using mocks in an isolated production-like test      |
| `ALLOW_PRODUCTION_AUTO_SEND`               | no                   | Required before `AUTO_SEND_ENABLED=true` in production                   |
| `OPENAI_ENABLED`                           | no                   | Requires `OPENAI_API_KEY` when true                                      |
| `OPENAI_API_KEY`                           | Phase 2 AI           | Enables OpenAI-backed structured analysis in the worker                  |
| `OPENAI_MODEL`                             | no                   | Model used for analysis; defaults to `gpt-4o-mini`                       |
| `WEB_SEARCH_PROVIDER`                      | no                   | Web discovery provider name; use `mock` locally                          |
| `WEB_SEARCH_API_KEY`                       | real provider only   | Enables a future real web-search adapter; blank uses mock                |
| `EMAIL_ENRICHMENT_PROVIDER`                | no                   | Contact enrichment provider name; use `mock` locally                     |
| `EMAIL_ENRICHMENT_API_KEY`                 | real provider only   | Enables a future real enrichment adapter; blank uses mock                |
| `EMAIL_VERIFICATION_PROVIDER`              | no                   | Email verification provider name; use `mock` locally                     |
| `EMAIL_VERIFICATION_API_KEY`               | real provider only   | Enables a future real verifier; blank uses mock                          |
| `COMPANY_ANALYSIS_TTL_DAYS`                | no                   | Intended re-analysis cache window; defaults to `30`                      |
| `EMAIL_VERIFICATION_TTL_DAYS`              | no                   | Intended verification cache window; defaults to `90`                     |
| `MAX_QUERIES_PER_RUN`                      | no                   | Safety cap for queries per lead hunt                                     |
| `MAX_SEARCH_RESULTS_PER_QUERY`             | no                   | Safety cap for web-search results per query                              |
| `MAX_COMPANIES_PER_RUN`                    | no                   | Safety cap for discovered companies per lead hunt                        |
| `MAX_ENRICHMENT_REQUESTS_PER_RUN`          | no                   | Safety cap reserved for real enrichment providers                        |
| `MAX_VERIFICATION_REQUESTS_PER_RUN`        | no                   | Safety cap reserved for real verification providers                      |
| `X_ENABLED`                                | no                   | Enables official X API discovery only when `true`                        |
| `X_BEARER_TOKEN`                           | real X only          | X API bearer token used by the worker for recent search                  |
| `REDDIT_ENABLED`                           | no                   | Keeps Reddit discovery compliance-gated when `false`                     |
| `REDDIT_CLIENT_ID`                         | future Reddit API    | Reserved for compliant Reddit API access                                 |
| `REDDIT_CLIENT_SECRET`                     | future Reddit API    | Reserved for compliant Reddit API access                                 |
| `TELEGRAM_ENABLED`                         | no                   | Enables configured Telegram source sync checks when `true`               |
| `TELEGRAM_BOT_TOKEN`                       | Telegram only        | Bot token for configured-source Telegram access                          |
| `SOCIAL_PREQUALIFICATION_THRESHOLD`        | no                   | Minimum deterministic social prequalification score, default `55`        |
| `MAX_X_QUERIES_PER_RUN`                    | no                   | Reserved safety cap for X queries per run                                |
| `MAX_X_RESULTS_PER_QUERY`                  | no                   | Safety cap for X results per query                                       |
| `MAX_REDDIT_QUERIES_PER_RUN`               | no                   | Reserved safety cap for Reddit queries per run                           |
| `MAX_REDDIT_RESULTS_PER_QUERY`             | no                   | Safety cap for Reddit results per query                                  |
| `MAX_TELEGRAM_MESSAGES_PER_SYNC`           | no                   | Safety cap for Telegram messages per configured-source sync              |
| `GMAIL_PROVIDER_MODE`                      | no                   | `MOCK` locally; set `REAL` for Google OAuth                              |
| `GOOGLE_CLIENT_ID`                         | real Gmail only      | Google OAuth web client ID                                               |
| `GOOGLE_CLIENT_SECRET`                     | real Gmail only      | Google OAuth client secret; API only                                     |
| `GOOGLE_REDIRECT_URI`                      | real Gmail only      | Must match the Google OAuth redirect URI                                 |
| `GMAIL_TOKEN_ENCRYPTION_KEY`               | yes for Gmail        | Server-side key used to encrypt stored Gmail credentials                 |
| `GMAIL_SYNC_INTERVAL_MINUTES`              | no                   | Intended Gmail sync cadence; manual sync endpoint is available           |
| `COLD_OUTREACH_WEEKLY_LIMIT`               | no                   | Weekly cold email cap; defaults to settings value/20                     |
| `COLD_OUTREACH_COOLDOWN_DAYS`              | no                   | Contact cooldown window; defaults to 90                                  |
| `MAX_NEW_CONTACTS_PER_COMPANY_PER_30_DAYS` | no                   | Company frequency guardrail; defaults to 1                               |
| `AUTO_SEND_ENABLED`                        | no                   | Global auto-send flag; defaults to `false`                               |
| `AUTO_SEND_MINIMUM_SCORE`                  | no                   | Auto-send score floor; defaults to 92                                    |
| `AUTO_SEND_DAILY_LIMIT`                    | no                   | Conservative daily auto-send cap, default 5                              |
| `OUTREACH_TEST_MODE`                       | staging/prod smoke   | Routes outgoing email to `OUTREACH_TEST_RECIPIENT` and prefixes `[TEST]` |
| `OUTREACH_TEST_RECIPIENT`                  | test mode            | Controlled inbox for staging/production smoke sends                      |
| `FOLLOW_UP_DELAY_DAYS`                     | no                   | One-shot follow-up delay; defaults to 7                                  |
| `MAX_FOLLOW_UPS`                           | no                   | Defaults to 1                                                            |
| `DEFAULT_WORKSPACE_TIMEZONE`               | no                   | Default timezone for new workspace automation settings                   |
| `AUTOMATION_SCHEDULER_INTERVAL_MS`         | no                   | Worker scheduler tick interval; defaults to `60000`                      |
| `JOB_ATTEMPTS`                             | no                   | BullMQ attempts; default 2                                               |
| `JOB_REMOVE_ON_COMPLETE`                   | no                   | Completed job retention count; default 100                               |
| `JOB_REMOVE_ON_FAIL`                       | no                   | Failed job retention count; default 500                                  |
| `WORKER_HEARTBEAT_STALE_MS`                | no                   | API stale worker threshold; default 120000                               |
| `MAX_AI_CALLS_PER_DAY`                     | no                   | Optional queue-time AI budget cap                                        |
| `MAX_AI_CALLS_PER_WEEK`                    | no                   | Optional queue-time AI budget cap                                        |
| `MAX_SEARCH_REQUESTS_PER_WEEK`             | no                   | Optional queue-time discovery search cap                                 |
| `MAX_ENRICHMENT_REQUESTS_PER_WEEK`         | no                   | Optional queue-time enrichment cap                                       |
| `MAX_EMAIL_VERIFICATIONS_PER_WEEK`         | no                   | Optional queue-time email verification cap                               |

No Supabase service-role key is required in Phase 1 because the API validates user tokens and uses its own PostgreSQL connection. Never expose a database URL, service-role key, or JWT secret to the web client.

### Worker (`apps/worker/.env`)

| Variable                       | Required   | Purpose                                                     |
| ------------------------------ | ---------- | ----------------------------------------------------------- |
| `NODE_ENV`                     | yes        | Runtime environment                                         |
| `APP_VERSION`                  | no         | Build/release version shown in health                       |
| `WORKER_ID`                    | no         | Stable worker identifier; generated from host/pid if absent |
| `DATABASE_URL`                 | yes        | Same PostgreSQL database used by the API                    |
| `REDIS_URL`                    | yes        | Redis connection used by BullMQ                             |
| `WORKER_HEARTBEAT_INTERVAL_MS` | no         | Worker heartbeat cadence; default 30000                     |
| `OPENAI_API_KEY`               | Phase 2 AI | Same key used by analysis jobs                              |
| `OPENAI_MODEL`                 | no         | Same model used by analysis jobs                            |

## Phase 7 operations docs

- [Architecture](docs/architecture.md)
- [Deployment](docs/deployment.md)
- [Operations](docs/operations.md)
- [Security](docs/security.md)
- [Backups](docs/backups.md)
- [Disaster recovery](docs/disaster-recovery.md)
- [Release checklist](docs/release-checklist.md)
- [Mobile integration](docs/mobile-integration.md)
- [Production smoke test](docs/production-smoke-test.md)

## Production hardening commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm security:secrets
```

Generate a Postman collection from the current OpenAPI export:

```bash
pnpm openapi:postman
```

| `WEB_SEARCH_PROVIDER` | no | Web discovery provider name; blank/mock uses demo-safe results |
| `WEB_SEARCH_API_KEY` | real provider only | Future real web-search credentials |
| `EMAIL_ENRICHMENT_PROVIDER` | no | Contact enrichment provider name |
| `EMAIL_ENRICHMENT_API_KEY` | real provider only | Future real enrichment credentials |
| `EMAIL_VERIFICATION_PROVIDER` | no | Email verification provider name |
| `EMAIL_VERIFICATION_API_KEY` | real provider only | Future real verifier credentials |
| `COMPANY_ANALYSIS_TTL_DAYS` | no | Intended re-analysis cache window |
| `EMAIL_VERIFICATION_TTL_DAYS` | no | Intended verification cache window |
| `MAX_QUERIES_PER_RUN` | no | Safety cap for queries per lead hunt |
| `MAX_SEARCH_RESULTS_PER_QUERY` | no | Safety cap for web-search results per query |
| `MAX_COMPANIES_PER_RUN` | no | Safety cap for discovered companies per run |
| `MAX_ENRICHMENT_REQUESTS_PER_RUN` | no | Safety cap reserved for real enrichment providers |
| `MAX_VERIFICATION_REQUESTS_PER_RUN` | no | Safety cap reserved for real verification providers |
| `X_ENABLED` | no | Enables official X API discovery only when `true` |
| `X_BEARER_TOKEN` | real X only | X API bearer token used for recent search |
| `REDDIT_ENABLED` | no | Keeps Reddit discovery compliance-gated when `false` |
| `REDDIT_CLIENT_ID` | future Reddit API | Reserved for compliant Reddit API access |
| `REDDIT_CLIENT_SECRET` | future Reddit API | Reserved for compliant Reddit API access |
| `TELEGRAM_ENABLED` | no | Enables configured Telegram source sync checks when `true` |
| `TELEGRAM_BOT_TOKEN` | Telegram only | Bot token for configured-source Telegram access |
| `SOCIAL_PREQUALIFICATION_THRESHOLD` | no | Minimum deterministic social prequalification score |
| `MAX_X_QUERIES_PER_RUN` | no | Reserved safety cap for X queries per run |
| `MAX_X_RESULTS_PER_QUERY` | no | Safety cap for X results per query |
| `MAX_REDDIT_QUERIES_PER_RUN` | no | Reserved safety cap for Reddit queries per run |
| `MAX_REDDIT_RESULTS_PER_QUERY` | no | Safety cap for Reddit results per query |
| `MAX_TELEGRAM_MESSAGES_PER_SYNC` | no | Safety cap for Telegram messages per configured-source sync |
| `GMAIL_PROVIDER_MODE` | no | `MOCK` locally; `REAL` for production Gmail sync behavior |
| `GMAIL_TOKEN_ENCRYPTION_KEY` | yes for Gmail | Same encryption key used by the API |
| `GMAIL_SYNC_INTERVAL_MINUTES` | no | Intended Gmail sync cadence |
| `COLD_OUTREACH_WEEKLY_LIMIT` | no | Weekly cold email cap |
| `COLD_OUTREACH_COOLDOWN_DAYS` | no | Contact cooldown window |
| `MAX_NEW_CONTACTS_PER_COMPANY_PER_30_DAYS` | no | Company frequency guardrail |
| `AUTO_SEND_ENABLED` | no | Defaults to `false` |
| `AUTO_SEND_MINIMUM_SCORE` | no | Auto-send score floor |
| `FOLLOW_UP_DELAY_DAYS` | no | One-shot follow-up delay |
| `MAX_FOLLOW_UPS` | no | Defaults to 1 |
| `DEFAULT_WORKSPACE_TIMEZONE` | no | Default timezone for workspace automation settings |
| `AUTOMATION_SCHEDULER_INTERVAL_MS` | no | Worker scheduler tick interval; defaults to `60000` |

## Supabase setup

1. Create a Supabase project and enable email/password authentication.
2. Put the project URL and anon key in the web environment.
3. Put `SUPABASE_URL` in the API environment.
4. For current asymmetric signing keys, the API retrieves the project JWKS automatically. For legacy `HS256` access tokens, also set `SUPABASE_JWT_SECRET` from the Supabase JWT settings.
5. Use the Supabase PostgreSQL connection string as `DATABASE_URL`. Prefer a direct/session connection for migrations; use the pooler mode appropriate to Prisma for deployed runtimes.
6. Create a user through Supabase Auth or the Supabase dashboard. On the first authenticated API request, the API creates that user's personal workspace and default settings.

Clients send the Supabase access token as:

```http
Authorization: Bearer <access_token>
```

An optional `X-Workspace-Id` header selects a workspace. The API verifies membership; it never trusts a workspace ID from request data.

## Database and migrations

The committed migration is:

```text
packages/database/prisma/migrations/20260901134345_init/migration.sql
packages/database/prisma/migrations/20260904181328_phase_2_analysis_scoring/migration.sql
packages/database/prisma/migrations/20260904190255_phase_3_web_discovery/migration.sql
packages/database/prisma/migrations/<timestamp>_phase_4_social_discovery/migration.sql
packages/database/prisma/migrations/20260908000000_phase_5_gmail_outreach/migration.sql
packages/database/prisma/migrations/20260908160049_phase_6_automation/migration.sql
```

Useful commands:

```bash
pnpm db:generate
pnpm db:migrate          # create a development migration
pnpm db:migrate:deploy   # apply committed migrations
pnpm db:seed
pnpm db:studio
```

The schema includes users, workspaces, members, companies, contacts, social profiles, configured Telegram sources, raw leads, leads, social signals, score records, AI usage logs, discovery runs, discovery query runs, search queries, shortlists, enrichment records, verification records, campaigns, outreach, replies, activities, manual action queue, suppression, source statistics, integrations, jobs, automation rules/runs, optimization recommendations, lead feedback, notifications, weekly reports, audit logs, settings, and future device tokens.

The seed is idempotent for the `demo-workspace` and creates clearly labeled `DEMO DATA`: 31 raw leads, 15 companies, 20 contacts, 19 leads, agency/social search queries, one configured Telegram source, one hot social lead with X + Telegram signals, one manual social action item, 5 outreach records, 3 replies, 5 automation rules, 2 notifications, 1 weekly report, 1 optimization recommendation, 1 lead-feedback record, and fixtures for agency partnership, active Flutter requirement, invalid freelancer, student project, large mobile-agency weak fit, and review-stage SaaS MVP.

## API response contract

Success:

```json
{ "success": true, "data": {} }
```

Collection:

```json
{
  "success": true,
  "data": [],
  "pagination": { "page": 1, "limit": 20, "total": 125, "totalPages": 7 }
}
```

Error:

```json
{
  "success": false,
  "error": { "code": "LEAD_NOT_FOUND", "message": "Lead could not be found." }
}
```

## API endpoints

All business endpoints require a bearer token.

```text
GET    /api/v1/health                    public
GET    /api/v1/dashboard

GET    /api/v1/leads
POST   /api/v1/leads
GET    /api/v1/leads/:id
GET    /api/v1/leads/:id/scores
POST   /api/v1/leads/:id/analyze
POST   /api/v1/leads/:id/rescore
POST   /api/v1/leads/:id/score-override
POST   /api/v1/leads/:id/feedback
PATCH  /api/v1/leads/:id
DELETE /api/v1/leads/:id

GET    /api/v1/companies
POST   /api/v1/companies
GET    /api/v1/companies/:id
POST   /api/v1/companies/:id/analyze
POST   /api/v1/companies/:id/find-contacts
PATCH  /api/v1/companies/:id
DELETE /api/v1/companies/:id

POST   /api/v1/analysis/website
POST   /api/v1/discovery/web/search
POST   /api/v1/discovery/social/manual

GET    /api/v1/integrations/web-search/health
GET    /api/v1/integrations/email-enrichment/health
GET    /api/v1/integrations/email-verification/health
GET    /api/v1/integrations/x/health
GET    /api/v1/integrations/reddit/health
GET    /api/v1/integrations/telegram/health
GET    /api/v1/integrations/gmail
POST   /api/v1/integrations/gmail/connect
GET    /api/v1/integrations/gmail/callback
POST   /api/v1/integrations/gmail/disconnect
POST   /api/v1/integrations/gmail/test
POST   /api/v1/integrations/gmail/sync
POST   /api/v1/integrations/gmail/mock-reply

GET    /api/v1/jobs
GET    /api/v1/jobs/:id

GET    /api/v1/contacts
POST   /api/v1/contacts
GET    /api/v1/contacts/:id
POST   /api/v1/contacts/:id/verify-email
PATCH  /api/v1/contacts/:id
DELETE /api/v1/contacts/:id

GET    /api/v1/search-queries
POST   /api/v1/search-queries
POST   /api/v1/search-queries/defaults
GET    /api/v1/search-queries/:id
POST   /api/v1/search-queries/:id/clone
PATCH  /api/v1/search-queries/:id
DELETE /api/v1/search-queries/:id

GET    /api/v1/lead-hunts
POST   /api/v1/lead-hunts
GET    /api/v1/lead-hunts/:id
POST   /api/v1/lead-hunts/:id/cancel

GET    /api/v1/shortlists
GET    /api/v1/shortlists/:id
GET    /api/v1/shortlist/current

GET    /api/v1/leads/:id/outreach-eligibility
POST   /api/v1/leads/:id/outreach/generate
GET    /api/v1/outreach
GET    /api/v1/outreach/:id
PATCH  /api/v1/outreach/:id
POST   /api/v1/outreach/:id/create-draft
POST   /api/v1/outreach/:id/approve
POST   /api/v1/outreach/:id/send
POST   /api/v1/outreach/:id/cancel
GET    /api/v1/follow-ups/due
POST   /api/v1/outreach/:id/follow-up/generate
POST   /api/v1/outreach/:id/follow-up/create-draft

GET    /api/v1/replies
GET    /api/v1/replies/:id
POST   /api/v1/replies/:id/reclassify

GET    /api/v1/campaigns
POST   /api/v1/campaigns
GET    /api/v1/campaigns/:id
PATCH  /api/v1/campaigns/:id
POST   /api/v1/campaigns/:id/activate
POST   /api/v1/campaigns/:id/pause

GET    /api/v1/automation
POST   /api/v1/automation
GET    /api/v1/automation/status
POST   /api/v1/automation/pause
POST   /api/v1/automation/resume
POST   /api/v1/automation/stop-all
GET    /api/v1/automation/:id
PATCH  /api/v1/automation/:id
DELETE /api/v1/automation/:id
POST   /api/v1/automation/:id/run
POST   /api/v1/automation/:id/enable
POST   /api/v1/automation/:id/disable
POST   /api/v1/automation/:id/skip-next
GET    /api/v1/automation-runs
GET    /api/v1/automation-runs/:id
POST   /api/v1/automation-runs/:id/retry

GET    /api/v1/optimization/recommendations
POST   /api/v1/optimization/recommendations/generate
POST   /api/v1/optimization/recommendations/:id/accept
POST   /api/v1/optimization/recommendations/:id/reject
POST   /api/v1/optimization/recommendations/:id/dismiss

GET    /api/v1/notifications
PATCH  /api/v1/notifications/:id/read
POST   /api/v1/notifications/read-all

GET    /api/v1/reports/weekly
POST   /api/v1/reports/weekly/generate
GET    /api/v1/reports/weekly/:id

GET    /api/v1/social-profiles

GET    /api/v1/action-queue
PATCH  /api/v1/action-queue/:id

GET    /api/v1/telegram/sources
POST   /api/v1/telegram/sources
POST   /api/v1/telegram/sources/:id/sync
PATCH  /api/v1/telegram/sources/:id
DELETE /api/v1/telegram/sources/:id

GET    /api/v1/settings
GET    /api/v1/settings/ai
GET    /api/v1/settings/scoring
PATCH  /api/v1/settings/scoring
PATCH  /api/v1/settings
GET    /api/v1/settings/suppression
POST   /api/v1/settings/suppression
DELETE /api/v1/settings/suppression/:id
```

Lead filters include status, temperature, source, lead type, country, company, score range, date range, free-text search, sorting, and pagination. Company and contact collections also support search and pagination.

Import `docs/postman/scrapo-phase1.postman_collection.json` into Postman. The generated `apps/api/openapi.json` can also be imported by Postman or used for future Flutter client generation.

## Quality checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

The API integration suite requires a migrated/seeded test database at `DATABASE_URL` and Redis for queue tests. It verifies unauthenticated rejection, public health, workspace isolation, pagination, CRUD, scoring settings validation, private URL blocking, analysis enqueueing, and manual score override history.

## Manual Phase 2 test procedure

1. Start all services with `pnpm dev`.
2. Open `http://localhost:3000`, enter the demo workspace, and go to Leads.
3. Add a lead with source text: `Looking for an experienced Flutter developer to finish our Firebase application this month. Need someone available immediately.`
4. Open the lead detail page and click **Analyze**.
5. Watch `/review` or `GET /api/v1/jobs/:id` until the worker completes the job.
6. Confirm the lead shows a score, band, factor breakdown, evidence, explanation, and outreach recommendation.
7. Repeat with `I'm available for Flutter freelance work` and confirm it is marked invalid/rejected.
8. Try `POST /api/v1/analysis/website` with `http://127.0.0.1` and confirm it is blocked.

## Manual Phase 3 test procedure

1. Start PostgreSQL and Redis.
2. Run `pnpm db:migrate:deploy` and `pnpm db:seed`.
3. Start API, worker, and web with `pnpm dev`.
4. Open `http://localhost:3000`, enter the demo workspace, and go to **Lead Hunter**.
5. Confirm provider cards show `NOT_CONFIGURED` with mock/demo mode if provider keys are blank.
6. Click **Start lead hunt**.
7. Keep the worker running and open the generated job detail page.
8. Confirm the run reaches `COMPLETED`, query runs are recorded, companies/contacts/leads are created, emails are mock-verified, and **Weekly Shortlist** contains ranked items.

## Manual Phase 4 test procedure

1. Start PostgreSQL and Redis.
2. Run `pnpm db:migrate:deploy` and `pnpm db:seed`.
3. Start API, worker, and web with `pnpm dev`.
4. Open `http://localhost:3000`, enter the demo workspace, and go to **Lead Hunter**.
5. Confirm X/Reddit/Telegram health cards load. Reddit should remain compliance-gated unless you explicitly set `REDDIT_ENABLED=true`.
6. Select **X** and/or **Telegram**, then click **Start lead hunt**.
7. Confirm the worker rejects self-promotion/tutorial/student noise, creates valid social leads through the existing scoring pipeline, and adds manual actions to **Action Queue**.
8. Open a social lead detail page and confirm original evidence, interpretation, identity, urgency, source badges, and recommended manual action are visible.
9. Go to **Telegram Sources** and add/update/delete only configured channels or groups you are allowed to monitor.

## Manual Phase 5 test procedure

1. Start PostgreSQL and Redis.
2. Run `pnpm db:migrate:deploy` and `pnpm db:seed`.
3. Start API, worker, and web with `pnpm dev`.
4. Open `http://localhost:3000`, enter the demo workspace, and go to **Gmail**.
5. Confirm Gmail shows `CONNECTED` and `Mock mode`, then click **Test** and **Sync replies**.
6. Go to **Weekly Shortlist** or a lead detail page and click **Generate Email**.
7. Go to **Outreach**, edit the message if desired, create a Gmail draft, approve it, and send it.
8. In mock mode, call `POST /api/v1/integrations/gmail/mock-reply` for that outreach ID, then `POST /api/v1/integrations/gmail/sync`.
9. Open **Replies** and confirm the reply classification is visible and CRM status is updated.
10. Add an email or domain under **Settings → Suppression** and confirm future sends are blocked.

Phase 5 remains draft-first and safety-gated. Auto-send is off by default and only allowed when all stricter eligibility checks pass.

## Manual Phase 6 test procedure

1. Start PostgreSQL and Redis.
2. Run `pnpm db:migrate:deploy` and `pnpm db:seed`.
3. Start API, worker, and web with `pnpm dev`.
4. Open `http://localhost:3000`, enter the demo workspace, and go to **Automation**.
5. Confirm the five default rules are visible. Enable **Weekly Lead Hunt** if you want it to run on schedule, or click **Run now** for a manual automation run.
6. Keep only API + worker running if desired; the browser does not need to stay open for scheduled runs.
7. Open **Automation Runs** and confirm scheduled/manual runs record status, timestamps, summaries, and failures.
8. Open **Weekly Shortlist** and **Leads** to confirm ranking score and rank reasons are visible separately from the original lead score.
9. Open a lead detail page and use **Like / Neutral / Dislike** in Phase 6 Ranking to create manual lead feedback.
10. Open **Optimization** and click **Generate recommendations**. Recommendations are not auto-applied; use **Accept** only if you want the suggested query/source adjustment.
11. Open **Weekly Reports** and click **Generate report**.
12. Open **Notifications** and confirm report/reply/automation alerts can be marked read.

Phase 6 automation remains safety-gated. It may generate review drafts when enabled, but auto-send is off by default and additionally requires verified emails, high lead/ranking scores, daily limits, business hours, and no pause/kill switch.

## Deployment notes

- Deploy `apps/web`, `apps/api`, and `apps/worker` as separate services.
- Vercel is suitable for the web client. Use a long-running Node host for the API and worker.
- Use Supabase PostgreSQL and managed Redis in production.
- Set `DEMO_AUTH_ENABLED=false` and `NEXT_PUBLIC_DEMO_MODE=false` in production.
- Run `pnpm db:migrate:deploy` during an API deployment release step.
- Configure `WEB_APP_URL` to the exact production web origin.
- Swagger is currently exposed at `/api/docs`; protect or disable it at the infrastructure layer if required by your production policy.
- Keep `OPENAI_API_KEY`, `X_BEARER_TOKEN`, Reddit credentials, Telegram bot tokens, and database credentials only in API/worker environments. Never expose them to the web client.

## Troubleshooting

- **API cannot reach PostgreSQL:** verify `DATABASE_URL`, start PostgreSQL, and use a direct connection for migrations.
- **Worker repeatedly reconnects:** verify Redis is running and `REDIS_URL` is reachable.
- **401 with a Supabase token:** confirm `SUPABASE_URL`, token issuer, project signing-key mode, and legacy secret if using HS256.
- **Demo login returns 401:** enable both `NEXT_PUBLIC_DEMO_MODE` and API `DEMO_AUTH_ENABLED`, and do not use production mode.
- **Prisma client types are missing after dependency changes:** run `pnpm db:generate`.
- **Analysis jobs stay queued:** verify the worker is running and `REDIS_URL` points to the same Redis instance used by the API.
- **Lead hunts stay queued:** verify the worker is running and listening to the `lead-analysis` queue.
- **Provider health says NOT_CONFIGURED:** this is expected locally when API keys are blank; the mock providers keep the demo working.
- **Reddit health says APPROVAL_REQUIRED:** this is expected in Phase 4 unless compliant Reddit API access is deliberately enabled. There is no scraping fallback.
- **Action queue is empty:** run `pnpm db:seed` or start a lead hunt with X/Telegram selected while the worker is running.
- **Gmail shows mock mode:** expected locally unless `GMAIL_PROVIDER_MODE=REAL` and Google OAuth variables are configured.
- **Gmail says reauth required:** reconnect Gmail from the **Gmail** screen; stored refresh tokens are server-side only.
- **Outreach send is blocked:** check global pause, suppression list, weekly limit, lead score/status, contact email status, and Gmail connection.
- **Automation runs do not start:** verify the worker is running, Redis is reachable, the automation rule is enabled, and workspace automation is not paused or kill-switched.
- **Automation run is skipped:** check **Settings** or **Automation** for the global pause/kill switch.
- **Next Turbopack cannot bind an internal port during a managed build:** the committed production build already uses `next build --webpack`.

Phase 6 stops at safe worker-based automation, ranking, optimization recommendations, notifications, and reports. Phase 7 functionality is intentionally still absent.
