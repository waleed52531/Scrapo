# Architecture

Scrapo is split into three independently deployable services:

```text
Next.js web client
  -> NestJS REST API under /api/v1
    -> PostgreSQL/Supabase via Prisma
    -> Redis/BullMQ queues
      -> independent worker process
```

The web app never owns core business rules. It authenticates with Supabase, stores the bearer access token in the browser, and calls the API. A future Flutter client can use the same `/api/v1` contract.

## Main components

- `apps/web`: dashboard UI, login, workspace screens, system status, usage limits.
- `apps/api`: authentication, workspace isolation, DTO validation, rate limiting, Swagger/OpenAPI, CRM, discovery, outreach, automation, health.
- `apps/worker`: BullMQ consumers for analysis, discovery, Gmail sync, follow-up scanning, reports, automation, and heartbeat.
- `packages/database`: Prisma schema, migrations, seed.
- `packages/shared`: framework-neutral constants and deterministic helpers.
- `packages/types`: client-safe API types.

## Data flow

1. User signs in through Supabase or local demo mode.
2. Web calls `/api/v1/*` with `Authorization: Bearer <token>`.
3. API verifies the token, resolves workspace membership, and executes business rules.
4. Long-running work is recorded in PostgreSQL and queued in Redis.
5. Worker consumes jobs, updates PostgreSQL, and records a heartbeat.
6. Web polls API endpoints for status, notifications, reports, and job history.

## Queues

BullMQ uses Redis as durable queue state. Redis must not use a cache eviction policy that can delete queue keys. Recommended production policy: `noeviction`, persistence enabled where supported, private networking, TLS/auth when provided.
