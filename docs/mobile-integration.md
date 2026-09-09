# Mobile integration

Flutter should use the same REST API as the web app.

## Base URL

```text
https://api.example.com/api/v1
```

## Authentication

Use Supabase Auth in the mobile app. Send the access token:

```http
Authorization: Bearer <Supabase access token>
```

No browser cookies are required for the API contract.

## Response format

Success:

```json
{ "success": true, "data": {} }
```

Error:

```json
{ "success": false, "error": { "code": "CODE", "message": "Safe message" } }
```

Pagination:

```json
{
  "success": true,
  "data": [],
  "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
}
```

## Sample requests

```http
GET /api/v1/leads?limit=20
Authorization: Bearer <token>
```

```http
GET /api/v1/shortlist/current
Authorization: Bearer <token>
```

```http
POST /api/v1/leads/:id/approve
Authorization: Bearer <token>
```

```http
GET /api/v1/notifications
Authorization: Bearer <token>
```

```http
GET /api/v1/system/health
Authorization: Bearer <token>
```

## Mobile readiness audit

The existing web flows call API endpoints for login token usage, dashboard, leads, lead detail, shortlist, review/feedback, outreach generation/edit/draft/send, replies, campaigns, notifications, automation status, and weekly reports.
