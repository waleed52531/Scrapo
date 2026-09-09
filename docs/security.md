# Security

## Authentication

The API expects `Authorization: Bearer <Supabase access token>`. Tokens are verified with Supabase JWKS or a configured legacy JWT secret. Demo tokens work only outside production.

## Authorization and workspace isolation

Every core service resolves `workspaceId` from the authenticated user membership. A frontend-supplied workspace header is accepted only when the authenticated user belongs to that workspace.

Expected IDOR behavior: requesting another workspace resource returns `404` or `403`, not leaked data.

## Secrets

Backend secrets stay in API/worker environments only. The web app receives only:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Run:

```bash
pnpm security:secrets
```

If a real secret was committed, rotate it. Removing the file is not enough.

## OAuth

Gmail OAuth uses a signed, expiring `state` value and HTTPS/localhost redirect URI validation. Tokens are encrypted before storage and are never returned to the web app.

## SSRF

The website analyzer allows only `http`/`https`, blocks localhost/private/link-local/metadata hosts, validates DNS and redirects, enforces response-size limits, and accepts only HTML content.

## XSS

External website/social/email content is rendered as text in React. Do not add `dangerouslySetInnerHTML` without sanitization.

## Rate limiting

Nest throttling protects all API routes. Tune with `RATE_LIMIT_TTL_MS` and `RATE_LIMIT_MAX`.

## CORS

Production CORS must use configured origins (`CORS_ALLOWED_ORIGINS` or `WEB_APP_URL`), never wildcard credentials.

## Email safety

Outreach enforces approval, suppression, Gmail connection, cooldown, company frequency, weekly limits, idempotency, pause controls, verified-email-only auto-send eligibility, and auto-send off by default.
