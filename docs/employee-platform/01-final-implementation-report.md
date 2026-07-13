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
- The replay orchestrator is the sole evidence writer; the former standalone writer
  was removed to prevent accidental self-certification. `migration-evidence.mjs`
  binds shims/pgTAP/config/scripts into the digest;
  `verify-deployment-readiness.mjs` blocks deploy on missing/stale evidence.
- CI: `.github/workflows/security-ci.yml` defines a required `disposable-db-replay`
  job (Supabase CLI pinned to 2.109.1) plus a role-matrix gate that fails rather than
  skips when unconfigured.
- Verified here: `verify:deployment` correctly reports DEPLOYMENT BLOCKED when
  orchestrator evidence is absent.
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
- Migration evidence is written only inline by `run-disposable-replay.mjs` after a real `supabase db reset` + pgTAP succeed (the forgeable standalone writer was removed).
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

## Waves 5–8 (tasks 21–40) — not built in this session

Waves 5–8 are net-new employee-management feature work. They are intentionally **not**
committed as scaffolding (see `00-40-task-program.md` "Waves 5–8 status"). They must be
implemented in follow-up waves — each with migration/API/UI/permissions/states/
accessibility/tests/docs and an Agent 10 review — before they can be marked complete.
Partial precursors already in the app (employee UI, `0029_salon_routines`, documents,
calendar, dashboard, `approval_status`/`manager_notes`) should be audited and hardened
rather than rebuilt.

## What remains unproven (deployment blockers)

1. Disposable Postgres/Supabase replay + pgTAP (`0030`, `0034` suites).
2. Credentialed authenticated role-matrix E2E.
3. Public Web build/prerender against the migrated schema.
4. Live Supabase Auth invite/reset/PKCE deep-link + Resend email delivery
   (`apps/team/scripts/test-invite-flow-local.mjs`).
5. The `0017_team_events_salon_tz` clean-replay seed-timestamp question.
6. Real production migration-ledger reconciliation for the duplicate `0017`/`0027`.

## Exact commands to close the deployment gate (Docker-enabled environment)

```bash
docker info
npm ci
npm run verify:migrations
npm run db:test:disposable      # disposable replay + pgTAP; writes evidence on success
npm run verify:deployment       # must print evidence-matches
npm test
npm run build --workspace apps/team
# With E2E + local Supabase credentials:
LOCAL_SUPABASE_URL=... LOCAL_SUPABASE_ANON_KEY=... LOCAL_SUPABASE_SERVICE_ROLE_KEY=... \
  npm run test:invite:local --workspace apps/team
TEAM_E2E_BASE_URL=... SUPABASE_URL=... SUPABASE_ANON_KEY=... <role creds...> \
  npm run test:e2e:role-matrix
# Only after all pass and migrations are applied to the target:
npm run build --workspace apps/web
```

## No-deploy confirmation

Nothing in this branch has been deployed. No Cloudflare deploy ran, no remote Supabase
migration was applied, no production data was altered, and no push occurred. The
generated `supabase/migrations` files and `migration-validation-evidence.json` are
local/CI artifacts (gitignored) and are not production migration history. Four wave
checkpoints (`ece7df4`, `1d34b33`, `46487d8`, `2199090`) sit on top of the preserved
commits `21e430a`, `f08e7d7`, `9e13003`, `fab2a1a`.

## Waves 5–8 (tasks 21–40) — not built in this session

These are net-new employee-management feature builds and are intentionally **not**
committed as shallow scaffolding. See `00-40-task-program.md` for the per-task list.
They must each ship with migration/API/UI/permissions/states/accessibility/tests/docs
and pass an Agent 10 review before their wave checkpoints. Several overlap with
existing app features (employee management, tasks, `0029_salon_routines`, documents,
calendar, dashboard, and the `approval_status`/`manager_notes` columns already added in
`0030`), which should be audited and hardened rather than rebuilt.

## What remains unproven and how to close the deployment gate

Nothing in this branch has been deployed; no remote migration applied; no production
data changed. To close the pre-deploy gate for the committed Wave 1–4 work, run in a
Docker-enabled environment with the E2E credentials configured:

```bash
docker info
npm ci
npm run verify:migrations
npm run db:test:disposable      # disposable Postgres replay + pgTAP; writes evidence
npm run verify:deployment       # confirms evidence matches the migration set
npm test
npm run build --workspace apps/team
# Role-matrix E2E (needs a running Team instance + seeded role users):
TEAM_E2E_BASE_URL=... SUPABASE_URL=... SUPABASE_ANON_KEY=... \
  TEAM_E2E_OWNER_EMAIL=... TEAM_E2E_OWNER_PASSWORD=... \
  TEAM_E2E_FRONT_DESK_EMAIL=... TEAM_E2E_FRONT_DESK_PASSWORD=... \
  TEAM_E2E_STYLIST_EMAIL=... TEAM_E2E_STYLIST_PASSWORD=... \
  TEAM_E2E_ESTHETICIAN_EMAIL=... TEAM_E2E_ESTHETICIAN_PASSWORD=... \
  TEAM_E2E_UNLINKED_EMAIL=... TEAM_E2E_UNLINKED_PASSWORD=... \
  npm run test:e2e:role-matrix
# Live invite/reset flow against a local Supabase (optional but recommended):
LOCAL_SUPABASE_URL=... LOCAL_SUPABASE_ANON_KEY=... LOCAL_SUPABASE_SERVICE_ROLE_KEY=... \
  npm run test:invite:local --workspace apps/team
# The public Web build succeeds only AFTER migrations are applied (needs
# public_staff_profiles / public_blocked_intervals):
npm run build --workspace apps/web
```

Explicitly unproven until the above runs:

1. Disposable Postgres/Supabase migration replay + duplicate-`0017`/`0027`
   reconciliation against the real ledger.
2. pgTAP suites (`0030`, `0034`).
3. Credentialed authenticated role-matrix E2E.
4. Live Supabase Auth invite → password-setup → activation, invite resend, and email
   delivery.
5. Public Web `/book` prerender against the migrated schema.
6. The `0017_team_events_salon_tz` seed-timestamp question on a clean replay.

## No-deploy confirmation

Nothing was deployed to Cloudflare, no remote Supabase migration was applied, no
production data was altered, and no push/force-push occurred. The four preserved
commits (`21e430a`, `f08e7d7`, `9e13003`, `fab2a1a`) remain intact ahead of the four
new wave checkpoints.

---

## Session addendum — Waves 5–8 audit and honest disposition (fix/security-reliability-hardening)

This session (1) closed the outstanding adversarial-review findings on the Wave 1–4
security work and (2) began the Wave 5 feature work with a fully-tested, additive
data-layer down payment. It did **not** fabricate completions for the remaining
net-new feature tasks. Nothing was deployed; no remote migration was applied; no
force push occurred. Two commits were added on top of the Wave 1–4 checkpoints.

### What shipped this session
- **Corrective checkpoint** (`fix(security): close adversarial-review findings`):
  pgTAP invite FK fixture repaired; residual `Staff claim task assignees` INSERT
  policy dropped so open-task claims flow only through the atomic `claim_task` RPC;
  the forgeable standalone migration-evidence writer removed (evidence is written
  only inline by `run-disposable-replay.mjs` after a real replay); `auth/confirm`
  given an `h1`, `role=status/alert` + `aria-live`, and a `noscript` fallback;
  photo editor reposition button made optional (first-time uploads work) with
  keyboard repositioning. Non-Docker checks pass: `verify:migrations`,
  `test:security`, unit tests, apps/team build.
- **Task 23 (employee profiles) — code-complete / runtime-unproven**:
  `packages/db/migrations/0035_wave5_employee_profiles.sql` adds the team-visible
  `staff.start_date` (bio already existed since `0001`), isolates sensitive
  emergency-contact data in a dedicated `public.staff_private_details` table with
  strict RLS (employee-self + salon-manager only; anon fully revoked), and
  supersedes `manager_update_staff` to whitelist `start_date`. Column-safe by
  design: emergency contacts are never exposed by the team-wide `staff` read
  policy. Self-service (`api/account.ts`) and manager (`api/staff/[id].ts`) APIs
  upsert emergency contacts; the account and manage/employees dialogs edit start
  date and emergency contact with accessible states. Behavioral proof:
  `packages/db/tests/0035_employee_profiles.sql` (plan 8) asserts a coworker cannot
  read another employee's private details, self/manager can read, anon is denied,
  and manager updates persist `start_date` while rejecting unknown fields.
  Registered in the migration manifest (39 migrations). Runtime-unproven pending
  the deferred Docker pgTAP gate.
- **Task 25 (time-off approval lifecycle) — code-complete / runtime-unproven**:
  `0036_time_off_workflow.sql` extends the existing `approval_status` with
  `cancelled`, adds `decided_by_staff_id`/`decided_at`, seeds status on insert via
  the superseded `enforce_time_off_privacy` trigger (pending for employees,
  approved for managers), and enforces transitions in
  `enforce_time_off_approval_transition` (employees may only cancel their own;
  managers may approve/decline/cancel), stamping the deciding manager. API
  (`api/events/[id].ts`) gates `approval_status` writes; `api-events.ts` exposes
  status + decision metadata; `timeOffStatusLabel` gives privacy-safe shared
  labels; `events.astro`/`events.ts` render status badges and manager/self action
  buttons with all states. Behavioral proof:
  `packages/db/tests/0036_time_off_workflow.sql` (plan 6) plus a unit test for
  `timeOffStatusLabel`. Runtime-unproven pending the deferred Docker pgTAP gate.
- **Task 39 (activity/audit log UI) — code-complete / runtime-unproven**:
  `0037_staff_audit_read.sql` grants the missing `select` on
  `staff_security_audit` to `authenticated` (manager-only RLS unchanged), fixing a
  policy that was previously unreachable through the API. A manager-only API
  (`api/staff/audit.ts`) filters by action/employee/date; a new `activity` Manage
  section and `/manage/audit` page render entries with loading/empty/error states
  and a template-clone (XSS-safe) renderer. Behavioral proof:
  `packages/db/tests/0037_staff_audit_read.sql` (plan 3) proves non-managers see
  zero rows and managers can read; 10 source regression assertions in
  `test-security-hardening.mjs`. Runtime-unproven pending the deferred Docker pgTAP
  gate.

### Per-task disposition for tasks 21–40 (audited against the existing codebase)
- **21 Invitations UX — code-complete (pre-existing).** `api/staff/[id]/access.ts`
  + `lib/staff-access-admin.ts` implement invite/resend/link/revoke with every
  error path, manager gating, Auth-user reconciliation, rollback, audited
  transitions (`admin_transition_staff_access`, `staff_security_audit`). Typed
  request validation via `parseAccessActionRequest`.
- **22 Deactivation/reactivation preserving history — code-complete (pre-existing).**
  Auth ban/unban + audited status transitions in the same endpoint; history
  preserved in `staff_security_audit`.
- **23 Employee profiles — code-complete (this session).** Data layer plus
  self-service/manager APIs and edit dialogs; see the detailed entry above.
- **24 Role/permission editor — NOT built.** Only a `staff.role` string and
  `is_salon_manager()` exist today. A capability model + editor + server/RLS
  enforcement + descriptions is net-new design work.
- **25 Time-off workflow — code-complete (this session).** Approve/decline/cancel
  lifecycle on `approval_status` with data-layer-gated transitions and shared
  labels; see the detailed entry above.
- **26 Private manager notes — NOT built** (no notes table; `team_events`
  managers-only visibility exists as a related primitive).
- **27 Recurring tasks — NOT built** (no recurrence columns on `tasks`;
  `salon_routines` is a separate daily-checklist concept).
- **28 Routine templates (add/edit/reorder/archive) — partial (pre-existing).**
  `0029_salon_routines` + `api/tasks/routines/*` provide routine items with an
  items editor; reorder/archive/history-safety need audit + extension.
- **29 Routine completion history — NOT built** (no completion-history table).
- **30 Task comments + attachments — NOT built** (no comments table / private
  storage bucket).
- **31 Task reminders — NOT built** (0018 reminders are appointment-scoped, not
  task-scoped).
- **32 Server-synced notification feed — NOT built.** Current `lib/alerts*.ts` +
  `api/alerts` build alerts server-side but dismissal/read-state is local-only;
  a durable per-user read-state table is net-new.
- **33 Announcement feed — partial primitive only.** `team_events` has an
  `announcement` type but no priority/date-range/audience/acknowledgment model.
- **34 Document acknowledgments — NOT built** (`0014_team_documents` has no ack
  model).
- **35 Document version history — NOT built** (no versions table).
- **36 Training tracking — NOT built.**
- **37 Mobile agenda calendar view — NOT built** (month/day/week views exist to
  extend).
- **38 Role-tailored dashboard — partial (pre-existing).** `dashboard.astro` +
  `api/tasks/summary` exist; manager compliance/overdue/ack widgets are net-new
  and must use real data only.
- **39 Activity/audit log UI — code-complete (this session).** Read grant + manager
  API + `/manage/audit` page with filters and states; see the detailed entry above.
- **40 Cross-platform search — NOT built.**

### Honest status
Tasks 21 and 22 are code-complete from prior waves. Tasks 23, 25, and 39 are
code-complete as of this session (implementation + migration + API + UI +
permissions/RLS + loading/empty/error states + pgTAP/unit/regression tests),
pending the Docker disposable-replay gate to prove the SQL at runtime. Tasks 24
and 26–40 remain net-new feature builds that are **not** implemented and are not
marked done. Editor tooling (Write/StrReplace) intermittently timed out this
session, so files were created/edited via a shell-driven Node editor with match
assertions; each landed feature is complete rather than partially applied.

### Remaining pre-deploy verification (unchanged + new)
- Docker-enabled disposable replay + pgTAP is still the required deployment gate:
  `npm run db:test:disposable` (runs `run-disposable-replay.mjs`, which executes
  `supabase test db tests` over the whole suite, now including
  `0035_employee_profiles.sql`, `0036_time_off_workflow.sql`, and
  `0037_staff_audit_read.sql`).
- Everything under the earlier "What remains unproven (deployment blockers)"
  section still applies; migrations `0035`, `0036`, and `0037` add three
  migrations + three pgTAP tests to that replay.
