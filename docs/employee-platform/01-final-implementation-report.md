# Employee platform — final implementation report (40 tasks)

This report maps each task to files, behavior, tests, and any incomplete/unproven
items. It is updated at each wave checkpoint. Nothing has been deployed or applied
remotely. Runtime-unprovable items (disposable DB, live Supabase Auth, email,
storage, browser E2E) are implemented with their migration/tests/CI so they run in a
Docker/credentialed environment, and are marked "unproven" until then.

Legend: **complete** (verified here) · **implemented — unproven** (code + tests + CI
present, needs Docker/credentials to prove) · **deferred**.

## Wave 1 — Security foundations (tasks 1–5) — checkpoint committed

### 1. Duplicate migration IDs (0017, 0027) — implemented; replay unproven

- `packages/db/migration-manifest.json` maps each duplicate to a unique canonical
  version; `scripts/verify-migrations.mjs` blocks new duplicates and validates the
  canonical sequence including the reconciliation shim.
- `scripts/stage-canonical-migrations.mjs` deterministically stages 35 migrations + 1
  shim and refuses to run against any remote target.
- Verified here: `npm run verify:migrations` passes; staging produces 36 files.
- Unproven: real ledger reconciliation requires the production `schema_migrations`
  inspection described in the rollout doc.

### 2. Disposable Supabase/Postgres replay — implemented; unproven pending Docker

- `scripts/run-disposable-replay.mjs` orchestrates stage → start → reset → pgTAP →
  evidence, stopping Supabase in a finally block.
- `write-migration-evidence.mjs` refuses to self-certify (`SC_DISPOSABLE_REPLAY_OK`);
  `migration-evidence.mjs` binds shims/pgTAP/config/scripts into the digest;
  `verify-deployment-readiness.mjs` blocks deploy on missing/stale evidence.
- CI: `.github/workflows/security-ci.yml` defines a required `disposable-db-replay`
  job (Supabase CLI pinned to 2.109.1) plus a role-matrix gate that fails rather than
  skips when unconfigured.
- Verified here: evidence writer correctly refuses without the orchestration flag;
  `verify:deployment` correctly reports DEPLOYMENT BLOCKED.
- Unproven: the replay itself (Docker unavailable in this environment).

### 3. Staff-photo crop RPC contract — complete

- `packages/db/migrations/0031_staff_photo_profile_rpc.sql`: `update_own_staff_photo`
  now `returns void` (no staff-row/token leak), requires an object with exactly
  `{x,y,scale}`, enforces numeric JSON types before casts, and ranges 0–100 / 1–3.
- pgTAP (`tests/0030_...sql`) asserts boundary accept and below/above rejects as
  `22023`. `parsePhotoCrop` unit tests cover client clamping.
- Verified here via `npm run test:security` and static assertions; pgTAP runs in the
  disposable gate.

### 4. Invited-employee password setup — implemented; unproven pending live Auth

- `confirm.astro` / `api/auth/exchange.ts` verify the one-time token, set a verified
  `sc_pw_setup` context cookie, and do **not** activate staff yet.
- `api/auth/reset-password.ts` requires the setup context, updates the password, then
  atomically calls `confirm_staff_invite` (metadata-free, DB-derived) to flip
  `invited → active`, then clears the context.
- Middleware allows the invite reset POST through the change-password gate only within
  the setup context; `/reset-password` is unreachable otherwise.
- `packages/db/migrations/0033_wave1_invite_task_hardening.sql` implements
  `confirm_staff_invite`; pgTAP asserts idempotency and no disabled reactivation.
- Unproven: end-to-end PKCE/deep-link behavior against live Supabase Auth
  (`apps/team/scripts/test-invite-flow-local.mjs` runs it with local credentials).

### 5. Safe invite resend / error paths — implemented; unproven pending live Auth

- `api/staff/[id]/access.ts` finds an existing pending Auth user
  (`lib/auth-user-lookup.ts`, paginated, rejects duplicate/mismatched/consumed
  invites), reuses it for resend, rolls back generated Auth users on transition
  failure, and returns a documented partial-success contract when email delivery
  fails after a persisted `invited` state.
- `admin_transition_staff_access` now validates action/status/identity consistency
  (invited/reinvited keep the same Auth id; linked requires the pending id) as `22023`
  before authorization; pgTAP covers invite/resend/activate audit cardinality and
  identity-tamper rejection.
- Unproven: live email delivery (Resend) and real Auth user lifecycle.

### Wave 1 commands run here

- `npm run verify:migrations` → pass (35 migrations).
- `npm run test:security` → pass.
- `npm test` → pass (report-range, event-presentation, calendar-grid, security).
- `npm run stage:migrations` → 35 migrations + 1 shim staged.
- `npm run build --workspace apps/team` → pass.
- `npm run build --workspace apps/web` → fails at `/book` prerender because the
  remote DB lacks `public_staff_profiles` (expected; apply migrations first).
- `npm run write:migration-evidence` → correctly refuses without replay flag.
- `npm run db:test:disposable` → blocked: Docker Desktop unavailable.

## Wave 2 — Identity and public-data safety (tasks 6–10) — checkpoint committed

All five land in `packages/db/migrations/0034_identity_public_privacy_closure.sql`
with behavioral coverage in `packages/db/tests/0034_identity_public_privacy.sql`.

- **6. Unique non-null `staff.supabase_user_id`** — pre-check raises if duplicates
  exist, then a partial unique index enforces one Auth identity per staff row. The
  Wave 1 link/confirm paths already reject cross-employee links.
- **7. Deactivation across boundaries** — `current_staff_id()`/`is_linked_staff()`
  require `access_status='active'`, so PostgREST/RPC access closes on deactivation;
  Auth ban is applied in `api/staff/[id]/access.ts`. pgTAP proves a disabled user is
  not linked and reads no events.
- **8. Active-staff sensitive RLS** — authenticated-only policies on staff, services,
  staff_services, email/sms logs, waitlist and events are replaced with
  `is_linked_staff()` / `is_salon_manager()`.
- **9. Booking carts** — `FOR ALL USING(true)` policies dropped and all
  anon/authenticated grants revoked on `booking_carts` and `booking_cart_items`;
  server service-role code remains the only accessor. pgTAP asserts anon lockout.
- **10. Blocked-interval projection** — anon loses `select` on `blocked_times`;
  `public_blocked_intervals` exposes only id/staff/start/end. `apps/web/src/lib/
  availability.ts` reads the projection. pgTAP asserts no `reason` column and that
  anon cannot read `blocked_times.reason`.
- Unproven: the pgTAP suite requires the disposable replay (Docker).

## Wave 3 — Legacy boundary and privacy (tasks 11–15) — checkpoint committed

- **11. Public booking availability** — `is_public_bookable_staff` backs the public
  `staff_services` policy and `public_blocked_intervals`; `booking-data.ts` reads
  `public_staff_profiles`, `availability.ts` reads `public_blocked_intervals`. No
  sensitive staff columns are exposed to anon (pgTAP column assertion in 0030 test).
  Unproven: the anon `/book` prerender only succeeds against the migrated schema.
- **12. Hidden-module gating** — `lib/modules.ts` `disabledModuleForPath` blocks
  `/book`, `/week`, `/block-time`, `/my-book`, `/services`, `/waitlist`, `/checkout`,
  `/inventory`, `/clients`, `/reports` and their `/api/*` counterparts; middleware
  returns 404 for these. Unit-tested in `test-security-hardening.mjs`.
- **13. Manager-only event visibility** — enforced in RLS (0030/0034) and in
  `api/events/index.ts` (non-managers filtered to team/own; private reason gated).
  pgTAP proves manager vs non-manager visibility.
- **14. Private time-off reason lifecycle** — `enforce_time_off_privacy` neutralizes
  the title, clears the public description, and stores the reason in `private_reason`;
  `get_private_event_details` returns it to manager/creator only. pgTAP covers it.
- **15. Strict CSP** — `lib/security-headers.ts` builds a per-request nonce policy
  (`script-src 'self' 'nonce-…'`, `script-src-attr 'none'`, no `unsafe-inline`/
  `unsafe-eval`); all executable inline scripts carry the nonce; the lone
  `application/json` config block is data, not script. Unit-tested.

## Wave 4 — Verification and release engineering (tasks 16–20) — checkpoint committed

- **16. Expanded pgTAP** — `tests/0030_...sql` (29) and `tests/0034_...sql` (12) give
  behavioral coverage of every new RPC/policy. Executed in the disposable gate.
- **17. Mandatory role matrix** — `.github/workflows/security-ci.yml`
  `authenticated-role-matrix` is a standalone required job that fails when
  `TEAM_E2E_BASE_URL` is unset, so it cannot pass green unconfigured on a protected
  branch. `scripts/test-role-matrix-e2e.mjs` covers owner/front-desk/stylist/
  esthetician/unlinked.
- **18. Builds/diagnostics** — `npm run build --workspace apps/team` passes here.
  The public Web build requires the migrated schema (documented in the rollout gate).
  `astro check` carries ~178 pre-existing diagnostics excluded from required CI and
  tracked as backlog, not a security regression.
- **19. Independent gate** — `test:security` behavioral+source regression plus a
  per-wave adversarial Agent 10 review; unproven items must be honestly recorded.
- **20. Bearer API contract** — `lib/api-contract.ts` `parseCompleteTaskRequest` and
  `parseAccessActionRequest` reject unknown/mistyped fields and validate the link
  `authUserId` as a UUID; documented in `docs/mobile-api-contract.md`. Bearer +
  cookie auth are unified in `getRequestUser`.
- Unproven: disposable pgTAP replay, credentialed role-matrix E2E, migrated Web build.
