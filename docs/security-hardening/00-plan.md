# Security and reliability hardening plan

## Scope and ownership

This branch hardens the employee-management product (`apps/team`) without deploying
Workers or applying database changes. The application team owns request
authentication, module gating, output encoding, onboarding, and API contracts. The
database owner reviews and applies the additive migrations after a staging rehearsal.
CI owns deterministic migration and regression checks.

## Threat model

The primary threats are a linked employee escalating privileges through direct
PostgREST access, anonymous disclosure of employee data, stored content executing in
another employee's browser, tampering with task completion updates, access to hidden
modules by guessing URLs, and stale Auth accounts retaining access after offboarding.
Secondary risks are private time-off disclosure, cookie-only APIs blocking supported
mobile clients, partial multi-step writes, and false-positive tests that never
establish an authenticated principal.

Trust boundaries:

- Browser and mobile inputs are untrusted, including strings already stored in
  Postgres.
- Supabase access tokens are accepted only after `auth.getUser(token)` validation.
- Authorization is derived from a linked, active `staff` row; JWT claims alone never
  grant an application role.
- The Supabase service-role secret is server-only and used only for manager-authorized
  Auth administration.
- RLS and RPC authorization remain effective for direct Supabase clients.

## Migration and deployment strategy

Migrations are additive and ordered after the existing production history. Existing
files, including duplicate historical prefixes, are not renamed. A checked-in
manifest pins the exact historical sequence and a verifier rejects duplicate new
prefixes or changed manifest entries.

Release procedure:

1. Run install, migration verification, unit/security tests, type checks, build, and
   configured authenticated E2E in CI.
2. Rehearse migrations against a disposable Supabase branch/local database.
3. Verify public booking against `public_staff_profiles`, direct anon/staff probes,
   task RPC transitions, and onboarding with test Auth users.
4. Apply migrations to staging, deploy the staging Worker, and complete the manual
   evidence checklist.
5. Only after explicit approval, apply production migrations before deploying the
   compatible Worker.

No command in this branch applies a remote migration or deploys a Worker.

## Rollback

Application rollback is a normal Worker version rollback. Database changes are
forward-fixed: restore previous grants/policies only through a new reviewed migration.
New columns and audit rows are retained because dropping them would destroy evidence.
If onboarding must be disabled, remove the service-role binding and the endpoints
fail closed with `503`; existing cookie and bearer sessions continue to be checked
against active staff state.

## Review gates

- Every critical/high fix has a static, unit, database, or authenticated route
  regression test.
- Security-definer functions use a restricted `search_path`, fully qualified objects,
  and internal authorization.
- Credential-dependent E2E is reported as optional only when its complete test-user
  environment is absent; protected-route unit tests remain required.
- Disabled routes are denied before authentication/data loading, including APIs.
- No production data mutation or deployment is part of implementation.
