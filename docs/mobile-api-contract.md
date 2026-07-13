# Team mobile API contract

## Base URL and authentication

Production base URL is `https://team.saloncitrineindy.com/team/api`. Web requests use
the existing secure Supabase session cookies. Mobile requests send:

```http
Authorization: Bearer <supabase-access-token>
Accept: application/json
Content-Type: application/json
```

The Worker validates every bearer token with Supabase Auth `getUser(token)` and then
loads the linked `staff` row. JWT role/custom claims are not trusted for application
authorization. The staff record must be linked and `access_status = active`.

Refresh tokens only through the Supabase client SDK. Never send a refresh token to a
Team API endpoint. On `401`, refresh once and retry once. On `403`, do not retry: the
user is unlinked, disabled, or lacks the required staff role.

## Envelope and errors

Success responses are `{ "ok": true, ... }`. Errors are
`{ "ok": false, "error": "safe message", "code": "optional_machine_code" }`.
Expected statuses are `400` validation, `401` missing/expired/malformed token, `403`
linked-user permission failure, `404` missing resource or disabled module, `409`
state conflict, `503` missing server-side integration configuration, and `500` an
unexpected failure.

## Supported employee-management resources

- `GET/POST/PATCH /tasks`, task claim/complete, and `/tasks/routines`
- `GET/POST/PATCH/DELETE /events`
- `GET/POST/PATCH/DELETE /documents`
- manager-only `/staff` and `/staff/:id/access`
- manager-only `/business`
- `/account`
- `/alerts`

Shared TypeScript envelopes and request validators live in
`apps/team/src/lib/api-contract.ts`. New or changed write endpoints must add a
validator there and reject unknown fields.

Task completion accepts only:

```json
{ "completion_notes": "optional text, at most 2000 characters" }
```

The database RPC atomically verifies open/claimed state and manager/assignee access.
Fields such as title, due date, priority, creator, assignment type, and assignees are
never accepted by this transition.

## Documents

The storage bucket is private. List metadata through `/documents`; download through
`/documents/:id/download`. That endpoint reauthorizes the active staff principal and
returns a short-lived signed URL. Mobile clients must not persist or share signed
URLs and should request a new one after expiration.

## Disabled modules

Book, Stock, Clients, Reports, Waitlist, Checkout, Services, booking policy, and
my-book routes/APIs return `404` while employee-management mode is enabled. Mobile
clients must not depend on preserved implementation routes until the corresponding
module is enabled in `modules.ts`.

## Local/test setup

Use a disposable Supabase project or local Supabase with dedicated owner,
front-desk, stylist, esthetician, unlinked, and disabled Auth users. Configure
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and server-only
`SUPABASE_SERVICE_ROLE_KEY`. Never place production keys or refresh tokens in source,
fixtures, screenshots, or CI logs.
