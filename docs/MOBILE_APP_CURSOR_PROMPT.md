# Salon Citrine — Mobile Team App Cursor Handoff Prompt

---

## Paste this first (executive summary)

Copy the block below into your **mobile app Cursor project** as the master agent prompt:

```
Build a native mobile client (iOS/Android — stack your choice) for the Salon Citrine employee-management team app.

MISSION
- Alternative client to the existing Astro web team app at https://salon-citrine-team.dbuszx.workers.dev/team/
- Same Supabase project, same staff roles and RLS, same salon timezone (America/Indiana/Indianapolis)
- Own repo, branches, and release process — do not deploy or modify salon-citrine-platform unless coordinating Bearer auth

MOBILE V1 SCOPE (build these only)
- Dashboard — Team Ops metrics, salon routine progress, upcoming events, quick links
- Tasks — all views (my, available, attention, completed, manager all), create/claim/complete, opening & closing salon routines
- Docs — category list, download/view, manager upload
- Events — calendar/agenda, CRUD, birthdays, time-off requests
- Manage — Employees (CRUD) + Business settings (manager only)
- Account — profile, photo, email, password change
- Alerts — tasks-open feed only (bell + badge + deep links)

OUT OF SCOPE FOR V1 (do not build, do not architect for)
Book, Stock, Clients, Reports, Waitlist, Checkout, inventory, CRM, appointment booking, revenue analytics

BACKEND
- Supabase: https://kkhdkmplbxzsckjhpsgf.supabase.co (anon key only in client)
- Team API base: https://salon-citrine-team.dbuszx.workers.dev/team (paths under /team/api/*)
- Auth: supabase.auth.signInWithPassword + secure session storage; require linked staff row after login
- Gap: team APIs use cookie auth today — prefer Supabase-direct queries for RLS-covered CRUD; coordinate Bearer auth PR if server-only endpoints needed (signed doc URLs)

BRAND
- Charcoal #3c3d3c, cream/stone surfaces, gold #e7ac46 for primary actions only
- Cormorant Garamond headings, DM Sans body; 44pt min touch targets

TEAM
- 9-agent structure: Product Lead, Backend/API, Auth, Dashboard, Tasks, Events, Docs+Manage, Shell/Design, QA
- Sprint 0 audit → 1 auth → 2 shell → 3 dashboard → 4 tasks → 5 events → 6 docs+manage → 7 alerts+QA
- Do not ship to stores without explicit instruction

REFERENCE REPO: C:\Users\Drew\Projects\salon-citrine-platform (read-only)
Full spec: docs/MOBILE_APP_CURSOR_PROMPT.md
```

> **Source platform repo:** `C:\Users\Drew\Projects\salon-citrine-platform`  
> **Deployed web team app:** https://salon-citrine-team.dbuszx.workers.dev/team/  
> **Last updated:** July 7, 2026

> **Note:** The web platform still preserves hidden modules in `apps/team/src/lib/modules.ts`; mobile v1 ignores them entirely.

---

## Mission

Build a **native mobile client** (iOS and/or Android — your stack choice) for the **Salon Citrine employee-management platform**. The mobile app is an **alternative client** to the existing Astro team web app. It must connect to the **same Supabase project**, honor the **same staff roles and RLS**, and deliver **feature parity with the employee-management modules** listed below.

**Do not deploy** the platform web app or modify `salon-citrine-platform` unless explicitly instructed. This mobile project owns its own repo, branches, and release process.

### Mobile v1 modules

| Module | Route (web `/team`) | Mobile v1 |
|--------|---------------------|-----------|
| Dashboard | `/` | **Build** |
| Tasks | `/tasks` | **Build** (incl. opening/closing routines) |
| Docs | `/docs` | **Build** |
| Events | `/events` | **Build** |
| Manage | `/manage` | **Build** (Employees + Business only) |
| Account | `/account` | **Build** |
| Alerts | header bell | **Build** (tasks-open only) |

### Out of scope for mobile v1

Do **not** build screens, navigation, or data layers for:

- Book (appointments, calendar, waitlist)
- Stock / inventory
- Clients / CRM
- Reports / revenue analytics
- Checkout / POS

If those modules return to the web app later, the mobile team can add them as a separate initiative.

### Recent web context (July 2026)

These shipped on web and inform mobile UX expectations:

1. **Contextual page shell** — `PageContextHeader` replaces a full-width title band; each page has a descriptive title + subtitle + primary action (`apps/team/src/lib/page-context.ts`).
2. **Alerts bell v1** — computed feed; mobile v1 surfaces **tasks-open** alerts only (`apps/team/src/lib/alerts.ts`).
3. **Opening/closing salon routines** — daily checklists (`salon_routines` tables, migration `0029`).
4. **Employee-management dashboard** — `TeamOps` panel with task metrics + routine progress (`apps/team/src/components/TeamOps.astro`).
5. **Owner auth account** — `dbuszx@gmail.com` linked to **Miriam Zhukov** (`owner` role) for dev/QA.
6. **Salon timezone** — `America/Indiana/Indianapolis` everywhere.

---

# Part A — Platform Context (for the mobile team)

## Architecture

```
salon-citrine-platform/          # Monorepo (reference only for mobile team)
├── apps/
│   ├── team/                    # Astro 7 SSR team app → Cloudflare Worker
│   └── web/                     # Client booking app (out of mobile v1 scope)
├── packages/
│   ├── db/                      # SQL migrations + seeds
│   ├── shared/                  # BUSINESS, TIMEZONE, policy helpers
│   └── theme/                   # Design tokens (charcoal, cream, gold, serif)
└── docs/                        # Specs including this file
```

| Layer | Technology |
|-------|------------|
| Team web app | Astro 7 + `@astrojs/cloudflare`, `base: '/team'` |
| Database | Supabase Postgres (`kkhdkmplbxzsckjhpsgf.supabase.co`) |
| Auth | Supabase Auth (email/password) |
| Storage | Supabase Storage (`team-documents`, `staff-photos`) |
| Deploy | Cloudflare Worker `salon-citrine-team` |
| Salon TZ | `America/Indiana/Indianapolis` (`TZ` in wrangler + `TIMEZONE` in shared) |

**Build (web reference):**
```bash
npm run build --workspace apps/team
cd apps/team && npx wrangler deploy
```

---

## Shared backend principle

The mobile app uses the **same Supabase project** as web. Prefer:

1. **Supabase JS client** with the user's JWT (RLS enforces permissions) for CRUD on tasks, events, documents, routines, staff profile.
2. **Team HTTP API** (`/team/api/*`) where the web app already encapsulates non-trivial server logic — **but see Auth gap below**.

Do **not** fork data models. Table names, column names, status enums, and RLS semantics must match `packages/db/migrations/`.

### API base URL

| Environment | Base |
|-------------|------|
| Production (current) | `https://salon-citrine-team.dbuszx.workers.dev/team` |
| Production (target domain) | `https://team.saloncitrineindy.com/team` |
| Local dev | `http://localhost:4322/team` |

All API routes are under `/team/api/…` (Astro `base` prefix).

### Response envelope

Most JSON APIs use:
```json
{ "ok": true, …payload }
{ "ok": false, "error": "message" }
```

---

## API routes (mobile v1)

Paths are relative to `/team/api`. **Auth** = cookie session on web; mobile see Auth section.

### Auth (`apps/team/src/pages/api/auth/`)

| Method | Route | Purpose | Public |
|--------|-------|---------|--------|
| POST | `/auth/login` | Form login → sets Supabase SSR cookies; requires linked `staff` row | Yes |
| POST | `/auth/logout` | Clears session | No |
| POST | `/auth/forgot-password` | Triggers Supabase reset email | Yes |
| POST | `/auth/reset-password` | Completes reset flow | Yes |
| POST | `/auth/change-password` | Forced password change when `user_metadata.must_change_password` | No |
| POST | `/auth/exchange` | JSON `{ access_token, refresh_token }` → cookie session (password-reset redirect helper) | Yes |

### Account

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| POST | `/account` | Form: update staff name/bio/phone + auth email | Yes |
| POST | `/account/photo` | Form: upload staff avatar to `staff-photos` bucket | Yes |

### Tasks & routines

| Method | Route | Purpose | Auth / role |
|--------|-------|---------|-------------|
| GET | `/tasks?view=` | List tasks. Views: `my` (default), `available`, `attention`, `completed`, `all` (manager) | Linked staff |
| POST | `/tasks` | Create task (manager). Body: `title`, `description`, `due_at`, `priority`, `assignment_type`, `assignee_ids` | Manager |
| PATCH | `/tasks/:id` | Update task fields / assignees / status (manager) | Manager |
| DELETE | `/tasks/:id` | Hard delete; `?cancel=1` soft-cancels | Manager |
| POST | `/tasks/:id/claim` | Claim open-pool task | Assignee action |
| POST | `/tasks/:id/complete` | Complete assigned task; optional `completion_notes` | Assignee |
| GET | `/tasks/summary` | Dashboard aggregates: counts, dueSoon, openToClaim, activity | Linked staff |
| GET | `/tasks/routines` | Opening + closing checklist for **today's salon date** | Linked staff |
| PATCH | `/tasks/routines/:slug/items/:itemId` | Toggle item `completed` boolean (`slug`: `opening` \| `closing`) | Linked staff |

**Task enums** (`api-tasks.ts`):
- `status`: `open` | `claimed` | `done` | `cancelled`
- `assignment_type`: `assigned` | `open`
- `priority`: `low` | `normal` | `high`
- **Attention window:** due within 24h (`TASK_ATTENTION_HOURS = 24`)

### Events

| Method | Route | Purpose | Auth / role |
|--------|-------|---------|-------------|
| GET | `/events?from=&to=` | Team events + computed staff birthdays in range | Linked staff |
| POST | `/events` | Create event. Types: `event`, `time_off`, `closure`, `announcement` | Linked; non-managers only `time_off` |
| PATCH | `/events/:id` | Update event | Creator or manager rules (`canManageEvent`) |
| DELETE | `/events/:id` | Hard delete; `?soft=1` sets `is_active=false` | Creator or manager |

**Presentation layer:** `event-presentation.ts` maps DB types to UI tokens (birthday gold `#c8952b`, staff-colored time off, etc.). Mobile should port or replicate this mapping.

### Documents

| Method | Route | Purpose | Auth / role |
|--------|-------|---------|-------------|
| GET | `/documents?category=` | List active docs; filter `policies` \| `training` \| `forms` \| `other` | Linked staff |
| POST | `/documents` | Multipart upload (manager); max 10 MB; PDF/Word/images | Manager |
| PATCH | `/documents/:id` | Update metadata / deactivate | Manager |
| DELETE | `/documents/:id` | Hard delete; `?soft=1` deactivate | Manager |
| GET | `/documents/:id/download` | Returns `{ url, fileName, expiresIn: 120 }` signed URL; `?redirect=1` 302 | Linked staff |

**Storage bucket:** `team-documents` (private).

### Staff / Manage

| Method | Route | Purpose | Auth / role |
|--------|-------|---------|-------------|
| GET | `/staff` | List all employees | Manager (`owner` \| `front_desk`) |
| POST | `/staff` | Create employee row (not auth user) | Manager |
| GET | `/staff/:id` | Employee detail | Manager |
| PATCH | `/staff/:id` | Update employee | Manager |

**Staff roles:** `owner` | `stylist` | `esthetician` | `front_desk`  
**Managers:** `owner` OR `front_desk` (`isSalonManager` in `auth.ts`)

### Business settings

| Method | Route | Purpose | Auth / role |
|--------|-------|---------|-------------|
| GET | `/business` | Location + booking policy summary | Manager |
| PATCH | `/business` | Update `locations` row (slug `default`) | Manager |

### Alerts

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| GET | `/alerts` | Computed alerts — mobile v1: **tasks-open** only | Linked staff |

See `docs/TEAM_ALERTS_V1.md` for alert shape and dismiss behavior.

---

## Auth model

### How web auth works

1. **Login** (`POST /api/auth/login`): `signInWithPassword` via `@supabase/ssr` `createServerClient`, cookies store session.
2. **Middleware** (`middleware.ts`): every request loads `user` + `staff` (join on `staff.supabase_user_id = auth.users.id`).
3. **Staff linkage required:** unlinked auth users get `403` / redirect `?error=unlinked`.
4. **Session modes** (`auth-session.ts`):
   - Shift: 10 hours (`SESSION_MAX_AGE`)
   - Remember me: 14 days (`REMEMBER_MAX_AGE`)
5. **Forced password change:** `user.user_metadata.must_change_password === true` → `/change-password` gate.
6. **Banned users:** `banned_until` checked at login.

### Mobile auth recommendation

| Concern | Web | Mobile (recommended) |
|---------|-----|----------------------|
| Session transport | HTTP-only Supabase SSR cookies | **Secure storage** (Keychain / Keystore) via `@supabase/supabase-js` `persistSession` |
| Login | Form POST to `/api/auth/login` | **`supabase.auth.signInWithPassword`** directly |
| Staff check | Server middleware | After login: `select id from staff where supabase_user_id = user.id` — reject if missing |
| Token refresh | Automatic via cookies | Supabase client auto-refresh with stored refresh token |
| Logout | `POST /api/auth/logout` | `supabase.auth.signOut()` + clear secure storage |
| API calls to `/team/api/*` | Cookie automatically sent | **Gap:** team APIs use cookie auth only today |

### Critical gap: Team API bearer auth

`requireApiAuth` / `requireTeamStaff` in `api-calendar.ts` read **cookies only**. Native mobile cannot rely on cookies for `/team/api/*` without a WebView or cookie jar hack.

**v1 strategy (pick one, document in mobile repo):**

- **Option A (preferred):** Use **Supabase client directly** for all operations RLS allows. Replicate aggregation logic from `api-tasks.ts`, `api-routines.ts`, `team-ops.ts` in mobile shared lib, or copy the TypeScript modules (they are mostly pure Supabase queries).
- **Option B:** For endpoints that must stay server-only (e.g. signed download URLs), add **`Authorization: Bearer <access_token>`** support to platform middleware — **requires a coordinated PR in `salon-citrine-platform`**, not mobile-only.
- **Option C (interim):** Call team API with `Cookie` header manually synced from Supabase session — fragile; not recommended for production.

**Password reset on mobile:** use Supabase `resetPasswordForEmail` with deep link to app; handle `exchange`-equivalent by setting session from tokens in the redirect URL.

---

## Data models (mobile v1)

### `staff`

| Column | Notes |
|--------|-------|
| `id`, `slug`, `name`, `role` | Core profile |
| `supabase_user_id` | Link to auth; null = not invited |
| `bio`, `phone`, `birthday` | Profile / events |
| `photo_url`, `photo_crop` | Avatar |

### `tasks` + `task_assignees`

See migration `0013_tasks.sql`. Open-pool tasks: `assignment_type='open'`, claim inserts `task_assignees` row with `claimed_at`, sets status `claimed`.

### `salon_routines`, `salon_routine_items`, `salon_routine_completions`

Migration `0029_salon_routines.sql`. Completions keyed by **`salon_date`** (date in `America/Indiana/Indianapolis`, not UTC midnight confusion). Slugs: `opening`, `closing`.

### `team_events`

Migration `0015_team_events.sql`. Types: `event`, `time_off`, `closure`, `announcement`. Staff birthdays are **computed** from `staff.birthday`, not stored as events.

### `team_documents`

Migration `0014_team_documents.sql`. Categories: `policies`, `training`, `forms`, `other`.

### `locations` (business settings)

Migration `0028_manage_staff_and_business.sql`. Default slug `default` for salon address, hours, contact.

### RLS helpers (Postgres)

- `is_linked_staff()` — authenticated + staff row exists
- `is_salon_manager()` — owner or front_desk
- `current_staff_id()` — staff id for auth user

Mobile Supabase client operates under these policies when using user JWT.

---

## Real-time vs polling (web patterns)

The web app **does not use Supabase Realtime** (no `.channel()` / `.subscribe()` in `apps/team`).

| Feature | Web refresh pattern |
|---------|---------------------|
| Alerts bell | Fetch on load, panel open, `document.visibilitychange` |
| Tasks / dashboard | SSR on page load; client scripts refetch on user action |
| Events calendar | Fetch on month/range change |
| Network status | Periodic / visibility refresh in header scripts |

**Mobile recommendation:** polling on screen focus + pull-to-refresh; optional Supabase Realtime later for task/routine collaboration (not required v1).

---

## Environment variables

### Mobile app (client-safe)

```env
SUPABASE_URL=https://kkhdkmplbxzsckjhpsgf.supabase.co
SUPABASE_ANON_KEY=<anon key from platform .env or Supabase dashboard>
TEAM_API_BASE_URL=https://salon-citrine-team.dbuszx.workers.dev/team
SALON_TIMEZONE=America/Indiana/Indianapolis
```

Never embed `SUPABASE_SERVICE_ROLE_KEY` in the mobile app.

### Platform reference (web worker secrets)

From `.env.example` / `wrangler.toml`:
- `SUPABASE_URL` (committed in wrangler vars)
- `SUPABASE_ANON_KEY` (secret)
- `SUPABASE_SERVICE_ROLE_KEY` (secret, server-only)
- `TZ=America/Indiana/Indianapolis`
- Stripe, Twilio, Resend — **not needed for employee-mgmt mobile v1**

---

## Design tokens (brand)

From `packages/theme/tokens.css` — preserve on mobile:

| Token | Value / usage |
|-------|----------------|
| Charcoal | `#3c3d3c` |
| Cream / stone surfaces | `--color-stone-50` `#faf9f7`, `--color-stone-100` |
| Gold (citrine) | `#e7ac46` — **primary actions only** |
| Serif headings | Cormorant Garamond (`--font-display`) |
| Body | DM Sans (`--font-body`) |
| Birthday gold | `#c8952b` (distinct from staff accents) |

See also `docs/MOBILE_DESIGN_SYSTEM.md` for touch targets (44px min), sentence-case buttons, and semantic colors.

### Page titles (mobile screen headers)

Mirror `page-context.ts`:

| Module | Title | Subtitle |
|--------|-------|----------|
| Dashboard | Team Dashboard | Your tasks, salon routines, and upcoming team events. |
| Tasks | Team Tasks & Checklists | Assign work, claim open tasks, and track salon checklists. |
| Docs | Documents & Resources | Store policies, training materials, forms, and salon references. |
| Events | Team Calendar & Events | Track birthdays, time off, closures, meetings, and salon announcements. |
| Manage | Business Settings | Manage employees and salon business details. |

---

# Part B — Feature Parity Checklist (mobile v1)

## Dashboard

| Item | Web reference | API / data | Mobile UX notes |
|------|---------------|------------|-----------------|
| Greeting + avatar hero | `index.astro` | Staff from session | Use salon TZ for morning/afternoon/evening |
| Team Ops metrics | `TeamOps.astro` | `loadTaskSummary` / `GET /tasks/summary` | 4 metric tiles: assigned, open, attention, done this week |
| Salon routines progress | `TeamOps.astro` | `GET /tasks/routines` | Opening ☀ / closing ☾ progress bars |
| Quick links | `index.astro` | — | Tasks, Docs, Events, Manage |
| Upcoming events (14d) | `team-ops.ts` | `GET /events` or direct query | Max 6 items; event type icons/colors |
| Alerts | `TeamSiteHeader` + `team-alerts.ts` | `GET /alerts` | Bell + badge; tasks-open only |

**Mobile considerations:** Single-column scroll; pull-to-refresh; deep links from metrics to Tasks filtered views.

---

## Tasks & salon routines

| Item | Web reference | API | Mobile UX |
|------|---------------|-----|-----------|
| View: My tasks | `tasks.astro`, `?view=my` | `GET /tasks?view=my` | Default tab |
| View: Available (open pool) | `?view=available` | `GET /tasks?view=available` | Claim CTA on row |
| View: Needs attention | `?view=attention` | `GET /tasks?view=attention` | Urgent styling (24h due) |
| View: Completed | `?view=completed` | `GET /tasks?view=completed` | Manager sees all |
| Create task | Manager only | `POST /tasks` | Form sheet |
| Claim / complete | `scripts/tasks.ts` | `POST …/claim`, `…/complete` | Swipe or button |
| Opening routine | `?view=routine-opening` | `GET /tasks/routines`, `PATCH …/opening/items/:id` | Checkbox list for **today** |
| Closing routine | `?view=routine-closing` | Same | Checkbox list |

**Mobile considerations:** Offline queue for routine checkboxes (sync on reconnect); haptic on complete; respect salon date boundary at midnight Indianapolis.

---

## Events

| Item | Web reference | API | Mobile UX |
|------|---------------|-----|-----------|
| Month calendar | `events.astro` | `GET /events?from&to` | Native calendar or agenda list |
| Type filter + legend | `event-presentation.ts` | — | Port presentation tokens |
| Add event | Manager / time-off request | `POST /events` | Stylists: time off only |
| Edit / cancel | | `PATCH`, `DELETE ?soft=1` | |
| Birthdays | Computed in API | Included in GET | Gold cake icon; never confuse with time off |

**Mobile considerations:** All-day events; multi-day bars; `datetime-local` inputs map to salon wall clock then UTC (see `parseDateTimeLocalInput`).

---

## Docs

| Item | Web reference | API | Mobile UX |
|------|---------------|-----|-----------|
| Category filter | `docs.astro` | `GET /documents?category=` | Chips: policies, training, forms, other |
| List + metadata | | | File type, size, uploader |
| Download / open | | `GET /documents/:id/download` | In-app browser or QuickLook / intent |
| Upload | Manager | `POST /documents` multipart | Document picker; 10 MB limit |

**Mobile considerations:** Signed URL expires in 120s — fetch fresh URL on tap.

---

## Manage

| Item | Web reference | API | Mobile UX |
|------|---------------|-----|-----------|
| Hub | `manage/index.astro` | — | Employees + Business rows |
| Employees list | `manage/employees.astro` | `GET /staff` | Manager only |
| Create / edit employee | | `POST /staff`, `PATCH /staff/:id` | Role picker |
| Business details | `manage/business.astro` | `GET/PATCH /business` | Address, hours, contact |

**Mobile considerations:** Manager gate on entire section; read-only for stylists/esthetician.

---

## Account & auth (cross-cutting)

| Item | Web reference | Mobile |
|------|---------------|--------|
| Login | `/login` | Email/password screen |
| Unlinked account error | `?error=unlinked` | Clear messaging |
| Change password | `/change-password` | Block app until done |
| Account profile | `/account` | Name, bio, phone, email, photo |
| Logout | | Clear secure session |

---

## Alerts (v1)

| Item | Spec | Mobile |
|------|------|--------|
| Feed | `TEAM_ALERTS_V1.md` | Header bell |
| Unread badge | Count-based dismiss | Use **AsyncStorage** equivalent of `team-alerts-dismissed-v1` |
| Deep links | `/tasks?view=attention` etc. | Navigation routes |
| Scope | tasks-open only | No waitlist/stock alerts |

---

# Part C — Agent Team Prompt (9 coordinated agents)

Use this structure in the **mobile app Cursor project**. Each agent works in **feature branches**; merge via PR review. **Do not deploy to App Store / Play Store or production API without explicit user instruction.**

## Global rules for all agents

1. **Same Supabase project** — no forked schema.
2. **Salon timezone** — `America/Indiana/Indianapolis` for all “today” / salon date logic.
3. **v1 scope only** — build the seven modules listed in Mission; no Book/Stock/Clients/Reports.
4. **Brand** — charcoal, cream, gold accents, serif headings.
5. **No platform deploys** — read `salon-citrine-platform` for reference; PRs go to mobile repo only unless coordinating Bearer auth (Agent 2).
6. **Branch strategy:** `main` protected; feature branches `feat/<agent-area>-<short-description>`; sprint integration branch `integration/sprint-N` optional.

---

### Agent 1 — Mobile Product Lead / Architect

**Responsibilities:** Own roadmap, navigation IA, cross-agent sequencing, acceptance sign-off.

**Owns:** `docs/ARCHITECTURE.md`, `src/navigation/*`, agent coordination docs.

**Dependencies:** None (starts Sprint 0).

**Deliverables:**
- Mobile architecture decision record (Supabase-direct vs API hybrid)
- Nav map for v1 modules (Dashboard, Tasks, Docs, Events, Manage + Account)
- Sprint gates and review checklists

**Sprint sequence:** 0 → all sprints (orchestration)

**Acceptance criteria:**
- Every screen maps to a web module and data source
- Out-of-scope modules are not stubbed or partially built
- No agent ships without Lead sign-off

---

### Agent 2 — Backend & API Integration Engineer (Supabase + team API)

**Responsibilities:** Supabase client setup, query modules ported from `api-*.ts`, team API client, Bearer auth spike if needed.

**Owns:** `src/lib/supabase/*`, `src/lib/api/*`, `src/types/database.ts`, env config.

**Dependencies:** Agent 1 (architecture); Agent 3 (auth session).

**Deliverables:**
- Typed Supabase wrappers for tasks, events, docs, routines, staff, business
- API client with `{ ok, error }` envelope parsing
- Documented gap list for server-only endpoints

**Sprint sequence:** 0–2 foundational; 3–6 per-module hooks; 7 hardening

**Acceptance criteria:**
- RLS errors surfaced cleanly
- Salon date helpers match `report-range.ts` / `salonLocalDate`
- No service role key in client

---

### Agent 3 — Auth & Session Engineer

**Responsibilities:** Login, logout, session persistence, staff linkage guard, password change / reset flows.

**Owns:** `src/features/auth/*`, secure storage adapter, auth navigation guard.

**Dependencies:** Agent 2 (Supabase client).

**Deliverables:**
- Auth stack screens (Login, ChangePassword, ForgotPassword)
- `must_change_password` gate
- Staff linkage validation post-login

**Sprint sequence:** 1 (after Sprint 0 audit)

**Acceptance criteria:**
- Session survives app restart
- Unlinked users cannot reach main app
- Logout clears all tokens

---

### Agent 4 — Dashboard & Team Ops Engineer

**Responsibilities:** Home screen, Team Ops metrics, upcoming events list, quick links.

**Owns:** `src/features/dashboard/*`

**Dependencies:** Agents 2, 3; data from tasks + routines + events modules.

**Deliverables:**
- Dashboard screen matching web sections
- Pull-to-refresh
- Deep links to Tasks/Events filtered views

**Sprint sequence:** 3

**Acceptance criteria:**
- Metric counts match `GET /tasks/summary` (or equivalent queries)
- Routine progress matches web for same salon date
- Greeting uses salon TZ

---

### Agent 5 — Tasks & Salon Routines Engineer

**Responsibilities:** Task lists (all views), create/claim/complete, opening/closing checklists.

**Owns:** `src/features/tasks/*`

**Dependencies:** Agents 2, 3.

**Deliverables:**
- Tabbed or segmented task views
- Manager create/edit task flows
- Routine checklist with optimistic toggle + PATCH

**Sprint sequence:** 4

**Acceptance criteria:**
- Attention filter matches 24h rule
- Claim/complete permissions match web
- Routine completions keyed to correct `salon_date`

---

### Agent 6 — Events & Calendar Engineer

**Responsibilities:** Calendar/agenda UI, event CRUD, birthday presentation, time-off requests.

**Owns:** `src/features/events/*`, port of `event-presentation.ts` logic.

**Dependencies:** Agents 2, 3.

**Deliverables:**
- Month/list calendar
- Event detail + create/edit sheets
- Presentation tokens (icons, colors, shapes)

**Sprint sequence:** 5

**Acceptance criteria:**
- Non-managers can only create `time_off` for self
- Birthday events styled with gold + cake (not staff color)
- Range queries align with web `defaultEventRange`

---

### Agent 7 — Docs & Manage Engineer

**Responsibilities:** Document library, download, upload; employee admin; business settings.

**Owns:** `src/features/docs/*`, `src/features/manage/*`

**Dependencies:** Agents 2, 3 (manager role).

**Deliverables:**
- Docs list + category filters + viewer
- Manage hub, employees CRUD, business form

**Sprint sequence:** 6

**Acceptance criteria:**
- Manager-only gates enforced
- Upload respects MIME + size limits
- Download uses fresh signed URLs

---

### Agent 8 — Navigation, Shell & Design System Engineer

**Responsibilities:** App shell, tab bar, headers (PageContext equivalent), theme, alerts bell, account menu.

**Owns:** `src/components/shell/*`, `src/theme/*`, design tokens.

**Dependencies:** Agent 1 (IA); integrates Agents 4–7 screens.

**Deliverables:**
- Bottom tab nav: Dashboard, Tasks, Docs, Events, Manage
- Context headers with title/subtitle/primary action
- Alerts bell component + dismiss state
- Dark mode (match web tokens)

**Sprint sequence:** 2 (shell); 7 (alerts polish)

**Acceptance criteria:**
- Touch targets ≥ 44pt
- Gold reserved for primary CTAs
- Alerts badge reflects unread tasks alert

---

### Agent 9 — QA, Accessibility & Parity Lead

**Responsibilities:** Test plans, parity matrix vs web, a11y audit, regression gates.

**Owns:** `docs/QA/*`, E2E / Detox / Maestro flows (tooling per mobile stack).

**Dependencies:** All feature agents.

**Deliverables:**
- Parity checklist (Part B) signed off per release
- Screen reader labels, focus order, contrast
- Test account matrix (owner, stylist, unlinked)

**Sprint sequence:** 0 (audit baseline); 7 (final gate)

**Acceptance criteria:**
- QA sign-off before any store submission
- Known gaps documented with web links
- No P0 parity bugs open

---

# Part D — Sprint Plan (mobile app)

| Sprint | Focus | Agents | Exit criteria |
|--------|-------|--------|---------------|
| **0** | Audit platform repo, confirm Supabase schema, env, auth strategy, scaffold mobile repo | 1, 2, 9 | ADR written; types generated; no UI |
| **1** | Auth — login, staff linkage, password change, secure session | 3, 2 | Can authenticate as Miriam test account |
| **2** | Shell / nav — tabs, theme, context headers, placeholder screens | 8, 1 | Navigate all 5 modules (empty state) |
| **3** | Dashboard — Team Ops, upcoming, quick links | 4 | Dashboard matches web data |
| **4** | Tasks + salon routines | 5 | Full task lifecycle + opening/closing |
| **5** | Events & calendar | 6 | CRUD + birthdays + time off |
| **6** | Docs + Manage (employees, business) | 7 | Manager flows complete |
| **7** | Alerts + account + a11y/parity QA | 8, 9 | Part B checklist green |

**Dependency graph:**
```
Sprint 0 → Sprint 1 → Sprint 2 → Sprint 3
                              ↘ Sprint 4
                              ↘ Sprint 5
                              ↘ Sprint 6
         Sprints 3–6 → Sprint 7
```

Sprints 4–6 can run **in parallel** after Sprint 2 if agents respect shared file ownership.

---

# Part E — Technical Constraints

1. **Connect to same Supabase project** — `https://kkhdkmplbxzsckjhpsgf.supabase.co`. Do not create a new project or duplicate migrations.

2. **Same staff permissions** — enforce `isSalonManager` rules client-side for UX; trust RLS server-side. Roles: `owner`, `front_desk` = manager; `stylist`, `esthetician` = non-manager.

3. **Same salon timezone** — `America/Indiana/Indianapolis`. All “today”, salon date, business hours, and routine completion dates use salon-local calendar semantics (see `packages/shared/src/constants.ts` and `apps/team/src/lib/report-range.ts`).

4. **Do not fork data models** — use existing table/column names and enums from `packages/db/migrations/`.

5. **Prefer existing `/team/api/*` where practical** — but implement Supabase-direct reads/writes when cookie auth blocks native calls. Coordinate Bearer support with platform if server-only logic is required.

6. **Document API gaps** — track in mobile `docs/API_GAPS.md`:
   - Bearer auth for team API (if not implemented)
   - Any aggregation duplicated from `loadTaskSummary`, `buildTeamAlerts`
   - Account photo upload (currently form POST to web; may use Supabase storage directly)

7. **Preserve brand** — charcoal, cream, gold, serif headings (Cormorant Garamond or platform equivalent). See `packages/theme/tokens.css` and `docs/MOBILE_DESIGN_SYSTEM.md`.

8. **No unnecessary deploys** — web Worker deploy is separate; mobile ships on its own release cadence.

9. **Test credentials** — dev owner login `dbuszx@gmail.com` → staff **Miriam Zhukov** (`miriam-zhukov`, role `owner`). Use for manager-path QA only; never commit passwords.

10. **Reference files (platform repo)** — when in doubt, read:

| Topic | Path |
|-------|------|
| Web nav / module config | `apps/team/src/lib/modules.ts` |
| Auth | `apps/team/src/middleware.ts`, `apps/team/src/lib/auth.ts` |
| Tasks | `apps/team/src/lib/api-tasks.ts`, `apps/team/src/pages/api/tasks/*` |
| Routines | `apps/team/src/lib/api-routines.ts`, migration `0029` |
| Events | `apps/team/src/lib/api-events.ts`, `apps/team/src/lib/event-presentation.ts` |
| Docs | `apps/team/src/lib/api-documents.ts` |
| Alerts | `apps/team/src/lib/alerts.ts`, `docs/TEAM_ALERTS_V1.md` |
| Dashboard | `apps/team/src/pages/index.astro`, `TeamOps.astro`, `team-ops.ts` |
| Page copy | `apps/team/src/lib/page-context.ts` |
| Shell IA | `docs/interface-shell/01-page-naming-and-context.md` |
| Deploy | `docs/CLOUDFLARE_DEPLOY.md`, `apps/team/wrangler.toml` |

---

## First actions when you paste this prompt

1. Confirm mobile stack (React Native / Expo / Flutter / SwiftUI / Kotlin).
2. Clone or submodule-reference `salon-citrine-platform` for read-only types and docs.
3. Run Sprint 0: verify Supabase connectivity with anon key + test login.
4. Create `docs/API_GAPS.md` and `docs/ARCHITECTURE.md` in the mobile repo.
5. Assign Agents 1–9 per Part C and begin Sprint 1 on `feat/auth`.

**End of handoff prompt.**
