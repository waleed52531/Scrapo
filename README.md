# Scrapo Lead Hunter

Phase 2 of a desktop-first freelance lead intelligence product. The repository now supports manual company/opportunity analysis, explainable lead scoring, score history, review workflows, and OpenAI-backed classification when configured.

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
- idempotent demo seed data and a Postman collection

Not implemented yet: automated Google/web lead searches, agency directory scraping, X/Reddit/Telegram discovery jobs, Hunter, Apollo, email verification providers, Gmail sending, automatic emails, follow-ups, or automated outreach.

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
        └── OpenAI analysis when OPENAI_API_KEY is configured
```

No Next.js API routes or server actions contain core business logic.

## Repository layout

```text
apps/
  api/                  NestJS API, Swagger, auth, workspace-scoped modules
  web/                  Next.js client and dashboard UI
  worker/               BullMQ background worker
packages/
  database/             Prisma schema, migration, generated client, seed
  types/                shared client-safe TypeScript contracts
  validation/           shared Zod validation utilities
  shared/               framework-neutral constants, normalization, and score helpers
  eslint-config/        shared flat ESLint configurations
docs/postman/           importable Phase 1 Postman collection
docker-compose.yml      local PostgreSQL 16 and Redis 7
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

With demo mode enabled, choose **Enter demo workspace** on the sign-in page. Demo tokens are rejected in production regardless of configuration.

## Environment variables

### Web (`apps/web/.env.local`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | yes | Versioned API root, e.g. `http://localhost:4000/api/v1` |
| `NEXT_PUBLIC_SUPABASE_URL` | real auth | Public Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | real auth | Public Supabase anonymous key |
| `NEXT_PUBLIC_DEMO_MODE` | no | Shows local demo access when `true` |

Only public Supabase values belong in the web application.

### API (`apps/api/.env`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | yes | `development`, `test`, or `production` |
| `API_PORT` | no | Defaults to `4000` |
| `DATABASE_URL` | yes | PostgreSQL/Supabase connection URL |
| `REDIS_URL` | worker/future queues | Redis connection URL |
| `SUPABASE_URL` | real auth | Supabase project URL and expected JWT issuer |
| `SUPABASE_JWT_SECRET` | legacy HS JWT only | Legacy symmetric JWT signing secret; omit for asymmetric JWKS projects |
| `WEB_APP_URL` | yes | Comma-separated allowed browser origins |
| `DEMO_AUTH_ENABLED` | local demo only | Accepts `demo-token` outside production |
| `RATE_LIMIT_TTL_MS` | no | Rate-limit window, default `60000` |
| `RATE_LIMIT_MAX` | no | Requests per window, default `120` |
| `GENERATE_OPENAPI` | no | Writes `apps/api/openapi.json` on startup when `true` |
| `OPENAI_API_KEY` | Phase 2 AI | Enables OpenAI-backed structured analysis in the worker |
| `OPENAI_MODEL` | no | Model used for analysis; defaults to `gpt-4o-mini` |

No Supabase service-role key is required in Phase 1 because the API validates user tokens and uses its own PostgreSQL connection. Never expose a database URL, service-role key, or JWT secret to the web client.

### Worker (`apps/worker/.env`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | yes | Runtime environment |
| `DATABASE_URL` | yes | Same PostgreSQL database used by the API |
| `REDIS_URL` | yes | Redis connection used by BullMQ |
| `OPENAI_API_KEY` | Phase 2 AI | Same key used by analysis jobs |
| `OPENAI_MODEL` | no | Same model used by analysis jobs |

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
```

Useful commands:

```bash
pnpm db:generate
pnpm db:migrate          # create a development migration
pnpm db:migrate:deploy   # apply committed migrations
pnpm db:seed
pnpm db:studio
```

The schema includes users, workspaces, members, companies, contacts, raw leads, leads, signals, score records, AI usage logs, queries, campaigns, outreach, replies, activities, action queue, suppression, source statistics, integrations, jobs, automation, audit logs, settings, and future device tokens.

The seed is idempotent for the `demo-workspace` and creates clearly labeled `DEMO DATA`: 30 raw leads, 15 companies, 20 contacts, 18 leads, 8 shortlist candidates, 5 outreach records, 3 replies, and Phase 2 fixtures for agency partnership, active Flutter requirement, invalid freelancer, student project, large mobile-agency weak fit, and review-stage SaaS MVP.

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
PATCH  /api/v1/leads/:id
DELETE /api/v1/leads/:id

GET    /api/v1/companies
POST   /api/v1/companies
GET    /api/v1/companies/:id
POST   /api/v1/companies/:id/analyze
PATCH  /api/v1/companies/:id
DELETE /api/v1/companies/:id

POST   /api/v1/analysis/website

GET    /api/v1/jobs
GET    /api/v1/jobs/:id

GET    /api/v1/contacts
POST   /api/v1/contacts
GET    /api/v1/contacts/:id
PATCH  /api/v1/contacts/:id
DELETE /api/v1/contacts/:id

GET    /api/v1/settings
GET    /api/v1/settings/ai
GET    /api/v1/settings/scoring
PATCH  /api/v1/settings/scoring
PATCH  /api/v1/settings
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

## Deployment notes

- Deploy `apps/web`, `apps/api`, and `apps/worker` as separate services.
- Vercel is suitable for the web client. Use a long-running Node host for the API and worker.
- Use Supabase PostgreSQL and managed Redis in production.
- Set `DEMO_AUTH_ENABLED=false` and `NEXT_PUBLIC_DEMO_MODE=false` in production.
- Run `pnpm db:migrate:deploy` during an API deployment release step.
- Configure `WEB_APP_URL` to the exact production web origin.
- Swagger is currently exposed at `/api/docs`; protect or disable it at the infrastructure layer if required by your production policy.
- Keep `OPENAI_API_KEY` only in API/worker environments. Never expose it to the web client.

## Troubleshooting

- **API cannot reach PostgreSQL:** verify `DATABASE_URL`, start PostgreSQL, and use a direct connection for migrations.
- **Worker repeatedly reconnects:** verify Redis is running and `REDIS_URL` is reachable.
- **401 with a Supabase token:** confirm `SUPABASE_URL`, token issuer, project signing-key mode, and legacy secret if using HS256.
- **Demo login returns 401:** enable both `NEXT_PUBLIC_DEMO_MODE` and API `DEMO_AUTH_ENABLED`, and do not use production mode.
- **Prisma client types are missing after dependency changes:** run `pnpm db:generate`.
- **Analysis jobs stay queued:** verify the worker is running and `REDIS_URL` points to the same Redis instance used by the API.
- **Next Turbopack cannot bind an internal port during a managed build:** the committed production build already uses `next build --webpack`.

Phase 3 should begin only after this foundation remains green. Discovery and outreach automation are intentionally still absent.
