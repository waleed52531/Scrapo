# Deployment

Use separate deployments for web, API, and worker. Do not put backend secrets in the web app.

## Web deployment

Required public variables:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_DEMO_MODE=false` in production

Build/start:

```bash
pnpm --filter @scrapo/web build
pnpm start:web
```

## API deployment

Required production variables:

- `NODE_ENV=production`
- `PORT`
- `APP_VERSION`
- `DATABASE_URL`
- `REDIS_URL`
- `SUPABASE_URL`
- `WEB_APP_URL`
- `CORS_ALLOWED_ORIGINS`
- `GMAIL_PROVIDER_MODE=REAL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GMAIL_TOKEN_ENCRYPTION_KEY`

Safe launch defaults:

```env
DEMO_AUTH_ENABLED=false
OUTREACH_PAUSED=true
AUTO_SEND_ENABLED=false
ALLOW_MOCK_PROVIDERS_IN_PRODUCTION=false
```

Build/start:

```bash
pnpm --filter @scrapo/api build
pnpm start:api
```

## Worker deployment

The worker must run continuously without web traffic. Required variables match the API for database, Redis, Gmail, provider modes, and safety limits.

Build/start:

```bash
pnpm --filter @scrapo/worker build
pnpm start:worker
```

## Database migration order

1. Take/verify a fresh backup.
2. Run `pnpm db:migrate:deploy`.
3. Deploy API and worker.
4. Deploy web.
5. Check `/api/v1/health` and `/api/v1/system/health`.
6. Run the production smoke test.

## Docker

Build service targets:

```bash
docker build --target api -t scrapo-api .
docker build --target worker -t scrapo-worker .
docker build --target web -t scrapo-web .
```

Local infrastructure only:

```bash
docker compose up -d postgres redis
```

Optional local app profile:

```bash
docker compose --profile app up --build
```

## Rollback

Rollback code by redeploying a known-good image/commit. Database rollback is not automatic; destructive migrations require a backup restore or a forward fix migration.
