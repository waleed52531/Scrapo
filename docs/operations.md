# Operations

## Health checks

- Public API health: `GET /api/v1/health`
- Protected system health: `GET /api/v1/system/health`
- Usage/cost controls: `GET /api/v1/health/usage`
- Swagger: `/api/docs`

## Restart services

```bash
pnpm start:api
pnpm start:worker
pnpm start:web
```

For development:

```bash
pnpm dev:api
pnpm dev:worker
pnpm dev:web
```

## Failed jobs

Use `/api/v1/jobs?status=FAILED` to inspect persisted job failures. BullMQ failed jobs are retained by `JOB_REMOVE_ON_FAIL` so queue failures can also be inspected in Redis/BullMQ tooling.

## Pause outreach

Set workspace `outreachPaused=true` from Settings, or set production default `OUTREACH_PAUSED=true` before first launch.

Allowed while outreach is paused:

- discovery
- analysis
- scoring
- Gmail incoming sync

Blocked:

- new outgoing sends
- automatic sends
- follow-up sends

## Stop automation

Use `POST /api/v1/automation/stop-all`. This sets both `automationPaused` and `automationKillSwitch`, clears next scheduled runs, and blocks scheduler-created work.

## Reconnect Gmail

1. Visit Integrations → Gmail.
2. Disconnect if necessary.
3. Connect again through Google OAuth.
4. Run Gmail test.
5. Sync replies.

## Provider outage response

If a provider is down or misconfigured, system health should show `FAILED`, `DEGRADED`, `DISABLED`, or `NOT_CONFIGURED`. Do not silently replace real providers with fake data in production.
