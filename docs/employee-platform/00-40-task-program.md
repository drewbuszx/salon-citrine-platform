# Employee platform 40-task program

## Program rules

This program runs on `fix/security-reliability-hardening` and preserves commits
`21e430a`, `f08e7d7`, `9e13003`, and `fab2a1a`. Exactly ten coordinated agents are
assigned below. Work proceeds in eight sequential waves of exactly five numbered
tasks. A later wave may not begin until its five tasks are implemented, tested as far
as the available environment permits, reviewed by Agent 10, and checkpoint-committed.

Nothing in this program deploys Cloudflare, pushes a production branch, applies a
remote Supabase migration, or mutates production data. Deployment remains blocked
until canonical migrations and behavioral database tests pass in a disposable
environment.

## Agent roster and ownership

1. Program Lead / Architecture / integration — cross-wave sequencing, shared-file
   serialization, integration, commits, rollback and final evidence.
2. Database Security & RLS Engineer — additive schema, RLS/RPC, migration safety.
3. Authentication, Invitations & Access Engineer — Supabase Auth, invite/reset,
   bearer/cookie principal and offboarding.
4. API Contract & Module Enforcement Engineer — endpoint schemas, permissions,
   disabled surfaces and mobile/web compatibility.
5. CI, Migration & Security Test Engineer — canonical replay, pgTAP, CI and build
   evidence.
6. Employee Profiles, Roles & Audit Engineer — employee administration, capability
   UX and durable audit.
7. Tasks, Routines & Collaboration Engineer — tasks, recurrence, routines, comments
   and reminders.
8. Documents, Training & Acknowledgment Engineer — document lifecycle,
   acknowledgments, versions and training.
9. Calendar, Notifications, Dashboard & Search Engineer — Calendar privacy/workflow,
   notifications, dashboard and search.
10. Adversarial QA / Accessibility / Regression Lead — mandatory rejection/approval
    gate for every wave.

Agents 2–9 work only within assigned areas. Shared migrations, authentication,
manifest, CI, package, and shell configuration are serialized through Agent 1.

## Dependencies and wave gates

- Database changes precede APIs that depend on them.
- Auth state and active-staff helpers precede employee, Calendar and storage features.
- API contracts precede mobile-facing collaboration features.
- Notification and dashboard work consumes task/document/Calendar state only after
  those workflows are durable.
- Every wave gate requires: behavioral tests, Team build, affected Web build,
  migration verification, Agent-10 review, a clean worktree, and one checkpoint
  commit. Unavailable external verification is a deployment blocker, not a pass.

## Status matrix

Status values: `in progress`, `not started`, `blocked verification`, `complete`.

### Wave 1 — Security foundations

1. Duplicate migration reconciliation — **implemented; canonical replay unproven pending disposable DB** — Agents 1, 2, 5.
2. Disposable database replay — **implemented (orchestrated + evidence-gated); unproven pending Docker** — Agents 1, 2, 5.
3. Photo crop RPC contract — **complete (void return, strict crop typing, pgTAP boundaries)** — Agents 1, 2, 6.
4. Invite password setup — **implemented; unproven pending live Supabase Auth** — Agents 1, 3, 6.
5. Safe invite resend/error paths — **implemented; unproven pending live Supabase Auth/email** — Agents 1, 3, 5, 6.

Wave 1 corrective fixes applied after Agent-10 / specialist review:

- Invite activation no longer trusts mutable `user_metadata`. `confirm_staff_invite`
  derives the subject from the authenticated Auth UUID + database state, requires a
  genuinely `invited` row with matching email and invitation audit, is idempotent,
  and refuses to reactivate disabled/uninvited rows.
- Staff are activated only **after** the password is set (in
  `/api/auth/reset-password`), not at callback time.
- The password-setup form is reachable only inside a verified recovery/invite context
  (`sc_pw_setup` cookie); ordinary authenticated sessions cannot reset without the
  current password. Middleware lets the invite reset POST through the change-password
  gate only within that context.
- SSR callbacks sign out on any post-exchange failure; confirmation route sends
  `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.
- `update_own_staff_photo` returns void (no staff-row/token leak) and strictly
  validates crop shape/types/ranges.
- Task claiming is the atomic `claim_task` RPC; the broad direct-UPDATE claim policy
  is removed so open-task claims cannot mutate arbitrary columns.
- Disposable replay is orchestrated by one script that writes evidence only after
  `supabase db reset` and pgTAP succeed; the evidence digest binds shims, pgTAP,
  config, and staging scripts; CI defines a required disposable-replay job.

Known deferred/unproven for Wave 1 (deployment blockers):

- Disposable Postgres replay + pgTAP have not executed here (Docker unavailable).
- Public Web prerender of `/book` requires the migrated schema; it fails against the
  un-migrated remote DB by design. Apply migrations before building/deploying Web.
- The `0017_team_events_salon_tz` seed timestamp double-shift on a clean replay is an
  open disposable-replay data question (does not affect production or app security);
  must be confirmed during replay before deploy.

### Wave 2 — Identity and public-data safety (checkpoint committed)

6. Unique Auth/staff linking — **implemented; unproven pending disposable DB** — Agents 2, 3, 6.
7. Deactivation proof across boundaries — **implemented (RLS + pgTAP); unproven pending disposable DB** — Agents 2, 3, 5.
8. Active-staff sensitive RLS — **implemented; unproven pending disposable DB** — Agent 2.
9. Secure legacy booking carts — **implemented; unproven pending disposable DB** — Agents 2, 4.
10. Public blocked-interval projection — **implemented; unproven pending disposable DB** — Agents 2, 4.

Delivered in `0034_identity_public_privacy_closure.sql` + `packages/db/tests/0034_identity_public_privacy.sql`:
partial unique index with a pre-check on `staff.supabase_user_id`; `is_linked_staff()`/
`is_salon_manager()` replace authenticated-only policies on staff, services,
staff_services, email/sms logs, waitlist and events; `booking_carts`/
`booking_cart_items` lose all anon/authenticated grants and the `FOR ALL USING(true)`
policies; anonymous availability reads only `public_blocked_intervals` (no `reason`).
pgTAP asserts deactivated-user denial, managers-only event visibility, cart lockout,
and reason hiding. Unproven until the disposable replay executes the suite.

### Wave 3 — Legacy boundary and privacy (checkpoint committed)

11. Safe public booking availability — **implemented; anon /book prerender unproven pending migrated schema** — Agents 2, 4, 5.
12. Complete hidden-module gating — **complete (behavioral unit tests)** — Agents 4, 10.
13. Manager-only event visibility — **implemented (RLS + API + pgTAP)** — Agents 2, 9.
14. Private time-off reason lifecycle — **implemented (trigger + RPC + API + pgTAP)** — Agents 2, 9.
15. Nonce/hash CSP — **complete** — Agents 4, 10.

`is_public_bookable_staff` keeps `staff_services`/availability public without exposing
`public.staff`; `disabledModuleForPath` blocks `/book`, `/week`, `/block-time`,
`/inventory`, `/clients`, `/reports` and their APIs server-side (unit-tested); event
visibility is enforced in RLS and `api/events/index.ts`; private reasons gated via
`get_private_event_details`; CSP is nonce-based with `script-src-attr 'none'` and no
`unsafe-inline`/`unsafe-eval`.

### Wave 4 — Verification and release engineering (checkpoint committed)

16. Expanded pgTAP behavior suite — **implemented; unproven pending disposable DB** — Agents 2, 5, 10.
17. Mandatory authenticated role matrix — **implemented (required CI gate); unproven pending credentials** — Agents 3, 5, 10.
18. Migrated Team/Web builds and diagnostics — **Team complete; Web build unproven pending migrated schema; astro check backlog documented** — Agents 4, 5, 10.
19. Independent security/regression gate — **complete (per-wave Agent 10 + test:security)** — Agent 10.
20. Supported Bearer API contract — **complete (typed validators + doc)** — Agents 3, 4.

pgTAP now spans `0030` (29 assertions: profile/photo/task/claim/invite RPCs, public
projection) and `0034` (12 assertions: deactivation, visibility, cart lockout, reason
hiding). CI defines a required `disposable-db-replay` job and a role-matrix job that
fails (not skips) when unconfigured. `parseAccessActionRequest`/`parseCompleteTaskRequest`
enforce strict request bodies for the Bearer/cookie APIs (`docs/mobile-api-contract.md`).
Web build and `astro check` diagnostics are documented deployment/backlog items.

### Wave 5 — Employee administration

21. Invitation UX — **not started** — Agents 3, 6.
22. Deactivation/reactivation UX — **not started** — Agents 3, 6.
23. Protected employee profiles — **not started** — Agents 2, 6.
24. Capability-aware role editor — **not started** — Agents 2, 4, 6.
25. Time-off approval workflow — **not started** — Agents 2, 6, 9.

### Wave 6 — Core operational collaboration

26. Strict manager notes — **not started** — Agents 2, 6, 9.
27. Recurring tasks — **not started** — Agents 2, 7.
28. Editable routine templates — **not started** — Agents 2, 7.
29. Routine completion history — **not started** — Agents 2, 7.
30. Task comments and attachments — **not started** — Agents 2, 7.

### Wave 7 — Reminders, documents and training

31. Task reminders — **not started** — Agents 7, 9.
32. Server-synced notification state — **not started** — Agents 2, 4, 9.
33. Announcement feed/acknowledgment — **not started** — Agents 2, 8, 9.
34. Document acknowledgments — **not started** — Agents 2, 8.
35. Document version history — **not started** — Agents 2, 8.

### Wave 8 — Insights, mobile usefulness and discovery

36. Training tracking — **not started** — Agents 2, 6, 8.
37. Accessible mobile agenda — **not started** — Agents 9, 10.
38. Role-tailored real-data dashboard — **not started** — Agents 6, 7, 8, 9.
39. Durable activity/audit UI — **not started** — Agents 2, 6.
40. Permission-safe cross-platform search — **not started** — Agents 2, 4, 9.

## Rollback

Application rollback uses the previous Worker version only after schema compatibility
is confirmed. Database changes are forward-fixed through new additive migrations;
audit/history rows are never dropped. Auth administration fails closed when service
or email configuration is absent. Generated canonical replay files and validation
evidence are local/CI artifacts, not production migration history.

## Production rollout gate

Strict order: canonical disposable DB replay → pgTAP and authenticated tests → backup
and inspect real `supabase_migrations.schema_migrations` plus required legacy objects
→ reconcile/repair migration ledger with reviewed commands → apply additive
migrations → deploy Team and Web apps → role/public/privacy smoke tests → rollback or
forward-fix on failure. No step is authorized by this branch alone.
