# Disaster recovery

For each incident, record symptom, impact, immediate response, recovery, and verification.

## PostgreSQL failure

- Symptom: API health database check fails.
- Impact: most writes/reads unavailable.
- Immediate response: stop worker if writes are failing; check provider status.
- Recovery: fail over/restore managed database backup.
- Verification: `/api/v1/health`, CRUD smoke test, worker job processing.

## Redis loss

- Symptom: queue actions return `JOB_QUEUE_UNAVAILABLE`.
- Impact: read-only/basic CRM can continue; long jobs cannot queue.
- Immediate response: restart/fail over Redis.
- Recovery: Redis persistence restore where available; recreate scheduled jobs.
- Verification: queue a lead analysis and confirm worker processes it.

## Worker failure

- Symptom: `/api/v1/system/health` reports worker stale/offline.
- Impact: queued jobs stop processing.
- Immediate response: restart worker.
- Recovery: inspect failed jobs and retry safe jobs.
- Verification: heartbeat updates and queue depth drains.

## Gmail token revocation

- Symptom: Gmail status `REAUTH_REQUIRED`.
- Impact: drafts/sends/sync blocked.
- Immediate response: keep outreach paused.
- Recovery: reconnect Gmail through OAuth.
- Verification: Gmail test and sync.

## Provider outage

- Symptom: provider status `FAILED`/`DEGRADED`.
- Impact: affected discovery/enrichment/verification/AI operation stops.
- Immediate response: pause affected automation if repeated.
- Recovery: wait, rotate/reconfigure provider credentials if required.
- Verification: provider health and one controlled test operation.

## Bad migration

- Symptom: deployment errors or app failures after migration.
- Impact: depends on schema change.
- Immediate response: stop deploy, keep backup available.
- Recovery: forward fix migration or restore backup if destructive.
- Verification: migration status, app build, smoke test.

## Accidental outreach automation

- Symptom: unexpected sends/drafts.
- Impact: reputation/compliance risk.
- Immediate response: `POST /api/v1/automation/stop-all`, pause outreach, disconnect Gmail if needed.
- Recovery: inspect audit logs/outreach history, notify affected recipients if appropriate.
- Verification: sends blocked, automation paused, Gmail disconnected or controlled.

## Secret leak

- Symptom: API key/token appears in repo/logs/chat.
- Impact: unauthorized access risk.
- Immediate response: revoke/rotate the exposed secret.
- Recovery: remove references, purge logs where possible.
- Verification: `pnpm security:secrets`, provider dashboards, no leaked env remains.

## Server/provider outage

- Symptom: app unavailable or high errors.
- Impact: user cannot operate product.
- Immediate response: check platform, logs, health endpoints.
- Recovery: redeploy known-good release or fail over provider.
- Verification: production smoke test.
