# Rollout, rollback and the disposable-DB deployment gate

Nothing in this branch has been deployed. No remote Supabase migration has been
applied, no Cloudflare deploy has run, and no production data has been altered.

## Pre-deploy gate — run first, in a Docker-enabled environment

The single most important pre-deploy action is a disposable Postgres/Supabase replay
plus pgTAP. Deployment stays blocked until this passes and `verify:deployment`
confirms the evidence matches the current migration set.

```bash
docker info                     # confirm Docker is running
npm ci
npm run verify:migrations       # manifest + duplicate + canonical-sequence checks
npm run db:test:disposable      # stage canonical files, supabase start, db reset,
                                # pgTAP, then write evidence only on full success
npm run verify:deployment       # fails if evidence is missing/stale
npm test                        # unit + security regression
npm run build --workspace apps/team
```

On Windows PowerShell the orchestrator (`run-disposable-replay.mjs`) already wraps
`supabase stop --no-backup` in a finally block, so a failed run still tears down the
local stack.

### Why evidence is trustworthy

- `db:test:disposable` runs one orchestrator that writes evidence **only** after
  `supabase db reset` and `supabase test db` both exit 0.
- The replay orchestrator is the only evidence writer; no standalone evidence-writing
  command is exposed. Local JSON is integrity/staleness evidence, not an unforgeable
  attestation; the required CI replay job is the authoritative deployment gate.
- The evidence digest binds the manifest, every migration, the reconciliation shim,
  the pgTAP suite, `supabase/config.toml`, and the staging/verify scripts.

## Production deployment order (only after the gate passes)

1. Back up the production database.
2. Inspect the real `supabase_migrations.schema_migrations` ledger and confirm the
   seven legacy staff rows the shim stands in for actually exist in production
   (`packages/db/reconciliation/legacy-seed-dependencies.sql` is disposable-only and
   must never be applied to production).
3. Reconcile/repair the duplicate `0017` and `0027` ledger entries with reviewed
   commands based on the real ledger.
4. Apply the additive migrations `0030`–`0033` (and later-wave migrations) in order.
5. Deploy the Team Worker.
6. Build and deploy the public Web app **after** migrations are live (its `/book`
   prerender needs `public_staff_profiles` / `public_blocked_intervals`).
7. Run role/public/privacy smoke tests.
8. Roll back or forward-fix on failure.

## Rollback

- Application: redeploy the previous Worker version only after confirming schema
  compatibility.
- Database: forward-fix with new additive migrations. Never drop audit/history rows.
- Auth administration fails closed when service-role or email configuration is
  absent; no partial state is treated as success in the UI.

## Canonical replay safety

The staged canonical version numbers are synthetic and do not match the production
ledger. `stage-canonical-migrations.mjs` refuses to run when `SUPABASE_DB_URL`,
`SUPABASE_PROJECT_REF`, or a linked `supabase/.temp/project-ref` is present, and the
generated `supabase/migrations` directory is gitignored, so canonical files cannot be
pushed to a remote project.

---

## Addendum — task 23 profile migration (0035)

`0035_wave5_employee_profiles.sql` is additive (new nullable columns on `staff`
plus the new `staff_private_details` table and its RLS). Rollout: apply with the
other pending migrations during the disposable replay / deployment gate; it has no
data backfill and is safe to apply before UI ships. Rollback: `drop table
public.staff_private_details;` and `alter table public.staff drop column bio, drop
column start_date;` (no dependent objects). Behavioral coverage:
`packages/db/tests/0035_employee_profiles.sql` runs inside `npm run
db:test:disposable`.

## Addendum — task 25 time-off workflow migration (0036)

`0036_time_off_workflow.sql` is additive: it widens the existing
`team_events_approval_status_check` constraint to allow `cancelled`, adds
`decided_by_staff_id`/`decided_at`, supersedes the `enforce_time_off_privacy`
trigger to seed `approval_status` on insert, and adds
`enforce_time_off_approval_transition` to gate status changes at the data layer.
It backfills existing `time_off` rows from `not_required` to `approved`. Rollout:
apply during the disposable replay / deployment gate. Rollback: restore the prior
trigger bodies from `0034`/`0030`, `drop trigger
enforce_time_off_approval_transition on public.team_events;`, and
`alter table public.team_events drop column decided_by_staff_id, drop column
decided_at;` (the `cancelled` enum value can remain harmlessly). Behavioral
coverage: `packages/db/tests/0036_time_off_workflow.sql` runs inside `npm run
db:test:disposable`.

## Addendum — task 39 audit read grant (0037)

`0037_staff_audit_read.sql` only adds `grant select on
public.staff_security_audit to authenticated`; the manager-only RLS SELECT policy
from `0030` is unchanged, so rows stay restricted to managers. This closes the
gap where the policy existed but the table privilege was never granted, leaving
the log unreadable through the API. Rollout: apply during the disposable replay /
deployment gate. Rollback: `revoke select on public.staff_security_audit from
authenticated;`. Behavioral coverage: `packages/db/tests/0037_staff_audit_read.sql`
proves non-managers see zero rows and managers can read; runs inside `npm run
db:test:disposable`.

## Addendum — task 24 role capabilities (0038) — HIGHEST RISK

`0038_role_capabilities.sql` is the **highest-risk migration** in this program. It
rewrites `public.is_salon_manager()`, which backs 20+ RLS policies and
security-definer functions across tasks, events, waitlist, booking policy, staff
services, audit, and more.

What it does:
- Adds bounded `capabilities` and `role_capabilities` catalogs (seed reproduces
  today's owner + front_desk manager behavior).
- Adds `staff_has_capability(text)` with a hard floor: owners always have
  `manage_team`.
- Rewrites `is_salon_manager()` to `staff_has_capability('manage_team')`.
- Adds owner-only audited `set_role_capability` RPC (refuses revoking owner
  `manage_team`; writes `capability_changed` audit rows).
- Moves `staff_security_audit` SELECT onto `view_activity`.

**Mandatory before deploy:** `npm run db:test:disposable` must pass, including
`packages/db/tests/0038_role_capabilities.sql` (owner anti-lockout, front_desk
toggle flips `is_salon_manager()`, `view_activity` remains independent). Do not
apply this migration to production until that disposable replay is green.

Rollback (only if not yet relied on by app code in production): restore the prior
`is_salon_manager()` body from `0030`, drop `set_role_capability` /
`staff_has_capability`, drop tables `role_capabilities` and `capabilities`, and
restore the prior audit SELECT policy. Prefer forward-fix over rollback if any
capability rows have already been customized.
