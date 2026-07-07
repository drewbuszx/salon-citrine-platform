# QA Swarm Findings

_Cross-agent quality swarm · Salon Citrine Team platform · 2026-07-08_

---

## Agent 1 — Book & Calendar

**Agent:** QA Agent 1 of 5  
**Scope:** `/team/book`, `/team/week`, `DayCalendar.astro`, `WeekCalendar.astro`  
**Production:** https://salon-citrine-team.dbuszx.workers.dev/team/book?day=2026-07-08  
**Login:** `dbuszx@gmail.com` (Miriam, owner) — **password not provided; all `/book` and `/week` routes redirect to login.** Testing below is code review + `build:alt` + unauthenticated fetch. Browser MCP tabs failed to persist in this session (no live screenshots).

### Test coverage summary

| Area | Method | Result |
| --- | --- | --- |
| Sticky staff header (Lily…Shelby row) | CSS + structure review | **Designed correctly** — `.day-cal__staff-row { position: sticky; top: 0; z-index: 36 }` inside scrollable `.day-cal__viewport`. Live scroll not verified. |
| Full-height column dividers | CSS review | **Implemented** — `repeating-linear-gradient` on `.day-cal__staff-row::after` and `.day-cal__columns::after`, driven by `--day-staff-count` (updated when staff filter hides columns). |
| Week view toggle / parity | Code compare | **Partial** — Day↔Week pills exist; week view is read-only overview (see P1). |
| Appointment cards | Code review | Rich day view (status, conflict layout, ⋮ menu). Week view cards are plain links. |
| New appointment modal | Code review | Service picker, client combobox, repeat-last, field validation present. |
| Keyboard shortcuts (`?`) | Code review | **P0 bug found** — module never imported; fixed in this session (see P0). |
| Waitlist badge / gap-fill / drawer | Code review | Toolbar badge, inline gap-hint banner, drawer with Book CTA all implemented. |
| Block time + time-off bands | Code review | Block: dashed gray `.day-cal__block--blocked`. PTO: dusty-rose `.day-cal__block--time-off`, `pointer-events: none`. Week view: blocks only, no PTO. |
| Staff filter chips vs sticky header | CSS review | **Clear visual hierarchy** — filter tray (`--day-filter-tray-bg`) vs structural header shelf (`--day-header-bg`). |
| Mobile 768px / tablet 1024px | CSS + `day-calendar-mobile.ts` | Single-column mode ≤48rem; compact toolbar + chip scroll-sync at 48–64rem; touch targets bumped at ≤64rem. Live resize not verified. |
| Build | `npm run build:alt` | **Pass** (exit 0) before and after P0 fix. |

---

### P0 bugs

1. **Keyboard shortcuts completely inert (fixed this session)**  
   `day-calendar-shortcuts.ts` was never imported. `DayCalendar.astro` called `window.__teamDayCalShortcuts?.(...)` but nothing assigned that global — `?`, `T`, `N`, `←`/`→`, `/`, and `Esc` handlers never registered despite help UI in DOM.  
   **Fix applied:** import shortcuts module; stash handlers on `root.__teamDayCalShortcutHandlers`; init on `team:day-cal-ready` (bubbles). Needs deploy + smoke test.

2. **Production QA blocked on auth**  
   Cannot verify runtime behavior (sticky scroll, conflict cards, drawer APIs) without owner credentials. Unauthenticated users hit login wall — expected, but blocks swarm visual QA on production.

---

### P1 polish

1. **Week view parity gap (beta)** — `WeekCalendar.astro` lacks: waitlist badge/drawer, gap-fill hint, Find opening, New appointment, keyboard shortcuts, overlap/conflict layout, ⋮ quick actions, drag-resize, time-off dusty-rose bands, multi-staff column filter (dropdown only). Appointment/blocked blocks link to day view instead of in-place actions. Aligns with backlog item B7.

2. **Week view missing personal time-off** — `week.astro` never loads/passes `timeOff`; managers cannot see PTO bands in week view.

3. **`/` shortcut only works with booking drawer open** — `focusSearch()` returns false when drawer closed and target is `client_name`. Help text says “Focus client search” but shortcut is a no-op from the grid. Consider opening New appointment first or retitling help.

4. **No visible `?` affordance in toolbar** — shortcuts help is discoverable only if user knows `?` / `Shift+/`. Add a ghost icon button next to Week toggle.

5. **Appointment ⋮ menu touch target ~15px** — `.day-cal__appt-card-menu-btn` is `0.95rem` square; below 44px mobile guideline. Hover-only opacity hurts tablet/touch.

6. **Tablet staff-header z-index regression risk** — At 48–64rem, `.day-cal__staff-row` drops from `z-index: 36` to `7`. Hovering appointment cards use `z-index: 6`; tight stack may cause header/card bleed during scroll on iPad. Verify on 768px and 1024px landscape.

7. **Hard double-book block with no manager override** — `validateAppointmentTimeRange` server-side hard-blocks overlaps (backlog B2). Day UI shows conflict indicator but booking form cannot proceed with soft warning.

8. **Multi-staff → Week navigation friction** — Clicking Week with multiple visible columns triggers `confirm()` then picks `currentStaffId` or sole visible provider. Consider remembering last week-view staff or showing picker sheet instead of browser confirm.

9. **`team:day-cal-ready` did not bubble** — Mobile refresh listener on `document` may miss the event (fixed alongside shortcuts wiring). Confirm mobile staff chip ↔ grid sync after deploy.

---

### P2 ideas

1. **Ranked “Recommended times” in booking drawer** — Wire `/api/calendar/find-openings` into New appointment form (Precision-lite; backlog B5).

2. **Waitlist drag-to-schedule** — Drag drawer row onto slot to prefill booking (B3).

3. **Week view mini heatmap** — Use existing `week-cal__day-dot` counts; add density shading per day column header.

4. **Conflict resolution assistant** — When `day-cal__appt-card--conflict` detected, offer “Resolve” sheet: shorten, move, or reassign one appointment.

5. **Keyboard shortcut cheat sheet chip** — Subtle `?` hint in subbar on first visit (`localStorage` dismiss).

6. **Gap-fill banner analytics** — Track clicks on `data-gap-book` vs waitlist drawer to tune ops messaging.

7. **Embed mode** — `/book?embed=1` chromeless for marketing site iframe (B10).

8. **Prebook from checkout** — “Book again in 4/6/8 weeks” on checkout success (B6).

---

### Screenshot notes

_No screenshots captured._ Browser MCP created tabs but navigation failed (`No browser tab available` / `Browser view not found`). Production login page confirmed via HTTP fetch: standard email/password form, “Authorized Salon Citrine staff only.” Recommend re-run visual QA with authenticated session and capture:

- Full manager day view scrolled mid-grid (sticky header + dividers)
- Conflict overlap (two cards side-by-side + ⚠ badge)
- Gap-fill banner + waitlist badge lit (`waitlistCount > 0`)
- New appointment drawer: client search, repeat-last, validation errors
- `?` shortcuts panel
- Block time band + dusty-rose PTO band same column
- 768px mobile single-column + staff select bar
- 1024px tablet multi-column with staff filter chips
- Week view day row + link-back to day

---

### Fix applied by Agent 1

| File | Change |
| --- | --- |
| `apps/team/src/scripts/day-calendar-shortcuts.ts` | Bootstrap on `team:day-cal-ready` |
| `apps/team/src/components/DayCalendar.astro` | Import shortcuts module; wire handlers; bubble ready event |

**Not touched:** frozen sidebar architecture (`team-list-sidebar.css`).

---

## Agent 2 — Team Pages

**Agent:** QA Agent 2 of 5  
**Scope:** Non-book team pages — `/team/` (dashboard), `/team/clients`, `/team/inventory`, `/team/reports`, `/team/tasks`, `/team/events`, `/team/manage`, `/team/waitlist`  
**Production:** https://salon-citrine-team.dbuszx.workers.dev/team/  
**Login hint (from Agent 1):** `dbuszx@gmail.com` (Miriam, owner) — **password not provided; all authenticated routes redirect to `/team/login`.**  
**Method:** HTTP route probe · Playwright `qa:mobile-viewport` on production (unauthenticated) · production CSS token check · full source review of page components + `team-list-sidebar.css`. Browser MCP tabs failed to persist (no live screenshots).

### Test coverage summary

| Route | HTTP | Auth | Layout / chrome (code) | Sticky sidebar | Mobile | Data / empty states |
| --- | --- | --- | --- | --- | --- | --- |
| `/team/` (dashboard) | 302→login | Blocked | `TeamLayout` + `TeamPulse` + hero avatar; cream bg; citrine accents | N/A | Quick actions stack ≤420px | Empty upcoming state + CTA; pulse metrics from API |
| `/team/clients` | 302→login | Blocked | `TeamListLayout` + filter sidebar; table + **card fallback ≤640px** | No sticky (scrolls away) | Filter sheet ≤900px; cards on phone | Search, skeleton, empty search hints |
| `/team/inventory` | 302→login | Blocked | `TeamListLayout`; low-stock banner; manager Add product | **Sticky ≥901px** (`.stock-page`) | FAB + filter sheet; touch targets 2.75rem | Category/brand filters; empty placeholders |
| `/team/reports` | 302→login | Blocked | `TeamListLayout`; manager-only (`redirect /` if not manager) | **Sticky ≥901px** (`.reports-page`) | Sidebar hidden ≤900px; section pill tabs | Skeleton loading; CSV export; date presets |
| `/team/tasks` | 302→login | Blocked | `TeamListLayout` + `TeamSidebarNav`; notebook paper UI | No sticky | Sidebar hidden ≤900px; **tasks-tabs** pill row | Attention badge; modal create; empty notebook |
| `/team/events` | 302→login | Blocked | `TeamListLayout` + month calendar + filter sidebar | No sticky | Bottom-sheet modals ≤900px; compact cells ≤640px | Type/staff filters; create/request time off |
| `/team/manage` | 302→login | Blocked | `TeamManageLayout` (reference sidebar); hub rows | Manage sidebar (link nav) | Hub list stacks; Soon badges on disabled rows | Staff/Business "Soon"; Services/Products live links |
| `/team/waitlist` | 302→login | Blocked | `TeamListLayout` **`showSidebar={false}`**; 7-col table | N/A | **Table only** — `overflow-x: auto` on wrap | Illustrated empty state; Add modal (managers); search filter |
| `/team/login` (gate) | **200** | Public | Split hero + form; citrine CTA; skip link | N/A | Hero hidden; mobile wordmark | — |

**Production CSS verified:** `--color-citrine`, `--color-stone-800`, `.team-list-layout__filter-chevron` (12px), `.team-bar` present in deployed bundle.

**Mobile viewport QA (production, unauthenticated):** All routes at 320–430px (+ 390px @2x zoom) report **0px horizontal overflow** — but every protected route resolves to login, so list/table layouts were **not** exercised at authenticated breakpoints.

---

### P0 bugs

1. **Authenticated team-page QA blocked on production**  
   All eight scoped routes return `302 → /team/login`. Cannot verify sticky sidebars, data tables, empty states with real data, or citrine active nav tabs without owner session. Same blocker as Agent 1 / `VISUAL_QA_REPORT.md`.

---

### P1 polish

1. **Waitlist mobile UX — table-only, no card fallback**  
   `waitlist.astro` renders a 7-column table with min-width columns (`Client`, `Phone`, `Staff`, `Services`, `Preferred Time`, `Date Added`, `Actions`). Unlike **Clients** (which swaps to `.clients-page__cards` at ≤640px), waitlist relies on `.team-list-layout__table-wrap { overflow-x: auto }` only. On phone, staff must horizontal-scroll a wide grid — poor front-desk UX.  
   **Fix:** Mirror clients card pattern or collapse to 2-column stacked rows on ≤640px. Selectors: `.waitlist-table`, `.waitlist-page__empty`.

2. **Waitlist page nav context misleading**  
   `waitlist.astro` sets `activeNav="book"` while `TeamSiteHeader` has no Waitlist tab. Users arriving from Dashboard Pulse (`TeamPulse` → `/waitlist`) see **Book** highlighted in the top bar, not a waitlist breadcrumb.  
   **Fix (CSS/copy only):** Add `.team-bar__page-title` subtitle "Waitlist" on this route, or sub-nav chip under Book; avoid restructuring sidebar architecture.

3. **Sticky filter sidebar inconsistent across list pages**  
   Only **Stock** (`.stock-page .team-list-layout__sidebar`) and **Reports** (`.reports-page …`) get `position: sticky; top: var(--team-bar-height)` on desktop ≥901px. **Clients, Tasks, Events** sidebars scroll away on long pages — filters fall off-screen while results scroll.  
   **Fix (CSS polish only):** Reuse the stock-page sticky block for `.clients-page`, `.tasks-page`, `.events-page` wrappers — no TeamListLayout restructure.

4. **Mobile filter-sheet active state uses sage, not citrine**  
   At ≤900px, `.team-list-layout__sidebar-nav-btn.is-active` uses `--color-sage` inset border/background (`team-list-sidebar.css` ~785–789). Reports mobile tabs duplicate this (`reports.astro` `.reports-tabs__btn.is-active`). Design system + `TEAM_SIDEBAR_DECISION` specify **citrine** active chrome. Desktop sidebar correctly uses `--team-sidebar-active-border` (citrine).  
   **Fix:** Swap mobile sheet active tokens to citrine-muted / citrine border — CSS-only.

5. **Reports silently redirects non-managers**  
   `reports.astro` redirects stylists/estheticians to `/` with no toast or "Managers only" message. Users may think Reports is broken.  
   **Fix:** Redirect to `/` with query param + one-line notice, or hide Reports tab for non-managers in `TeamSiteHeader` (role-gated nav).

6. **`qa:mobile-viewport` omits `/waitlist`**  
   `apps/team/scripts/mobile-viewport-qa.mjs` ROUTES array has `/login`, `/`, `/book`, `/clients`, … `/manage` but **not `/waitlist`**. Post-deploy mobile regression can miss waitlist table overflow.  
   **Fix:** Add `/waitlist` to ROUTES.

---

### P2 ideas

1. **Waitlist discovery** — No top-nav entry; only Dashboard Pulse, Book drawer badge, and deep link. Consider a Waitlist sub-link under Book dropdown or Pulse-only is intentional — document in demo script.

2. **Clients "Saved Audiences" empty filter** — Sidebar shows `Saved Audiences (0)` / "No saved audiences yet" — marketing-segment placeholder with no backend. Hide until schema exists or rename to reduce clutter.

3. **Manage hub "Soon" rows** — Staff + Business Details disabled with Soon badge; fine for beta but flag for owner demos (manage/index.astro).

4. **Dashboard "Scan" label** — Quick action says "Scan" but links to `/inventory`, not the barcode scanner modal. Rename to "Stock" or open scanner FAB directly.

5. **Events calendar legend hidden on mobile** — `.events-calendar-legend { display: none }` at ≤900px; color-coded event types harder to decode on phone.

6. **Unified empty-state component** — Waitlist, clients, tasks, and reports each hand-roll empty UI; extract shared `.ui-empty` with citrine illustration slot for brand consistency.

7. **Post-deploy auth QA** — Check in `team-auth.json` (Playwright storage) for CI; run `qa:mobile-viewport` + `qa:desktop-sidebar` against production after each deploy.

8. **Docs URL drift** — `VISUAL_QA_CHECKLIST.md` still references `salon-citrine-platform.dbuszx.workers.dev`; production team Worker is `salon-citrine-team.dbuszx.workers.dev`.

---

### Wins (verified in code + production gate)

- **Login page** — HTTP 200; zero horizontal overflow at 320–430px and 390px@2x on production; skip link + citrine tokens deployed.
- **TeamListLayout cohesion** — Clients, Stock, Tasks, Events, Reports, Waitlist share Boulevard-style subheader, filter sheet, and data table chrome.
- **Team Pulse dashboard** — Citrine live dot, metric cards deep-link to book/waitlist/inventory/reports; hot/alert states for waitlist ≥3 and low stock.
- **Clients mobile** — Card grid fallback at ≤640px (table hidden) — best-in-class mobile list pattern in the app.
- **Stock** — Sticky filter sidebar, low-stock banner shortcut, manager add product, export in sidebar footer.
- **Tasks** — Notebook metaphor, attention badge with pulse animation, mobile pill tabs mirroring sidebar views.
- **Waitlist** — Full empty-state illustration, manager Add modal with Morning/Afternoon/Evening chips, Book/Remove row actions wired in `waitlist.ts`.
- **Manage** — Reference `TeamManageLayout` with citrine 3px left active border; hub rows with clear Soon vs Open CTAs.
- **Reports** — Section sidebar + mobile tabs, date presets, skeleton shimmer, low-stock section links to inventory.
- **Global sidebar guard** — 12px chevrons, `(N)` count spacing, SVG size constraints in `team-list-sidebar.css`.

---

### Screenshot notes

_No authenticated screenshots captured._ Recommend re-run with owner session (`dbuszx@gmail.com` or `TEAM_QA_STORAGE_STATE`) and capture:

- Dashboard: Team Pulse strip + empty upcoming state
- Clients: desktop filter sidebar (citrine active) + mobile card list
- Stock: sticky sidebar scrolled mid-page + low-stock banner
- Tasks: notebook entries + Needs attention badge lit
- Events: month grid + filter sheet on tablet
- Reports: metric cards + staff table (manager view)
- Manage: hub list with Soon badges
- Waitlist: empty state + populated table (or horizontal-scroll failure on 390px)
- Mobile ≤900px: filter sheet open on Clients/Stock (verify citrine vs sage active)

---

### Fixes applied by Agent 2

_None — QA/reporting only. No changes to `TeamListLayout` / sidebar architecture._

---

## Agent 4 — Innovation & Opportunities

**Agent:** QA Agent 4 of 5 (Innovation & Boulevard gap analyst)  
**Date:** 2026-07-07  
**Repo:** `C:\Users\Drew\Projects\salon-citrine-platform`

**Scope:** `docs/BOOK_AGENT_BACKLOG.md`, `docs/BOULEVARD_FEATURE_GAP.md` (stale on week view/waitlist — backlog is source of truth), plus `find-openings`, waitlist, checkout, and reports code in `salon-citrine-platform`.

### Executive summary

Platform has Boulevard-shaped *spine* (cart book, day calendar, checkout, waitlist API, find-openings). Innovation gap is **intelligence layer**: ranked gaps, proactive waitlist, completed rebook loop, processing-time calendar, chair-side memory. ~35–40% Boulevard parity per gap doc; **~60% on daily ops slice** if I1–I4 ship this sprint.

---

### Current state (innovation baseline)

| Area | Shipped | Innovation gap |
|------|---------|----------------|
| **find-openings** | `GET /api/calendar/find-openings` + "Find opening" drawer in `DayCalendar.astro` | Chronological only; not in booking slot picker or guest `/book` datetime; no ideal-gap ranking |
| **Waitlist** | Guest CTA on zero slots; team drawer + click-to-book via `sessionStorage` | No drag-to-slot (B3); no auto-match on cancellation |
| **Checkout** | Tax, tips, retail, inventory deduct, 4/6/8-week prebook links on receipt | Prebook links use `?prebook=&client=` but `book.astro` does not consume them — links don't complete the loop |
| **Reports** | Revenue, staff appts, cancel/no-show, low stock + CSV | No utilization, retail attach, or actionable links back to calendar/waitlist |
| **Double-book** | Visual `⚠ conflict` on overlapping cards; API + DB hard-block | No manager override; no processing-time nests (Boulevard's color-window model) |

**Team Pulse** (`TeamPulse.astro` + `team-pulse.ts`) is a strong seed — today's book, waitlist count, low stock, revenue pace — but metrics are informational, not action-driving.

---

### Prioritized roadmap

#### Ship now (≤2 agent-days each; APIs exist)

| # | Innovation | Why it wins vs Boulevard | Implementation hook |
|---|------------|--------------------------|---------------------|
| **I1** | **Precision-lite in slot picker** | Boulevard markets Precision Scheduling™; we already have the engine | B5: Top 3 "Recommended" chips from `find-openings` at top of team booking form + guest `datetime.astro` before full slot grid. Rank by ideal gap (30/60/90 configurable), soonest fit, preferred stylist |
| **I2** | **Gap hint → one-tap book** | Empty cells stay passive in most tools | B8: `data-gap-book` / `nextOpenGap` already opens form — extend to auto-POST on confirm and show ranked alternatives from find-openings when slot is taken |
| **I3** | **Checkout rebook that actually books** | Boulevard buries 4/6/8-week buttons; ours are `btn-secondary` links to a calendar that ignores `?prebook=` | Wire `checkout.ts` prebook → `find-openings` for target week + booking POST with prior `appointment_services` + client; show as primary post-payment actions, not footer links |
| **I4** | **Cancellation → waitlist match chip** | Boulevard's waitlist is manual hunt | On cancel/no-show, gap hint shows top 1–3 scored waitlist entries (stylist pref, service match, time window, days waiting) with existing click-to-book flow |

#### Next sprint (1–2 weeks)

| # | Innovation | Category | Hook |
|---|------------|----------|------|
| **I5** | **Soft double-book + processing windows** | Calendar UX | B2: Manager "Book anyway" non-blocking warning; add `processing_minutes` on services for nestable appointments (blowout during color) |
| **I6** | **Waitlist drag-to-schedule** | Booking flow | B3: Drag drawer entry onto slot → prefill + create (click-to-book already works) |
| **I7** | **Client memory panel at book/checkout** | Client cross-feature | `GET /api/clients/[id]` already returns formula, timeline, LTV — collapsible panel in booking drawer + checkout sidebar |
| **I8** | **Retail intelligence at checkout** | Inventory cross-feature | After service lines, suggest 1–2 products by category + client purchase history; suppress if out of stock (inventory already deducts on complete) |
| **I9** | **Reports → ops actions** | Reports cross-feature | Add retail attach %, chair utilization; link low-stock rows → inventory; link cancel spike → waitlist drawer |

#### Visionary (90-day bets)

| # | Innovation | Delight factor |
|---|------------|----------------|
| **I10** | **Auto waitlist cascade with SMS hold** | Cancellation → SMS top match with 15-min hold → auto-cascade on decline |
| **I11** | **Intelligent day board** | Gap opens → "3 good fits": rebook-due + waitlist + processing nest — one surface per `SALON_CITRINE_VISION.md` |
| **I12** | **Front desk status board** | Expected → Arrived → In service → Done (not another calendar clone) |
| **I13** | **Learned rebook cadence** | Default prebook interval from client's historical spacing (e.g. always 6 weeks with Jamie) |

---

### Top 5 recommendations

**1. Precision-lite everywhere (Ship now)**  
`find-openings` is built but buried in a secondary drawer and sorts chronologically. Surface 2–3 ranked "Recommended" times at the top of team booking and guest datetime — Boulevard's most marketable scheduling feature, achievable without their enterprise config surface.

**2. Cancellation → ranked waitlist match (Ship now)**  
Waitlist infra is shipped (guest join, team drawer, click-to-book). The missing leap is *proactive* matching when a slot opens. Score entries on stylist/service/time preference and surface in the gap-hint strip — turns Boulevard's "todo list with extra steps" into an 8-second book flow.

**3. One-tap rebook loop at checkout (Ship now)**  
Prebook UI exists (`checkout.ts` lines 258–274) but links to `/book?prebook=` with no handler in `book.astro`. Complete the loop: find opening at N weeks → hold slot → confirm with prior service stack. Highest retention ROI per `SIGNATURE_FEATURES_BACKLOG.md` and `SALON_CITRINE_VISION.md`.

**4. Soft double-book + processing windows (Next sprint)**  
Hard overlap block (`validateAppointmentTimeRange` + DB constraint) fights real salon workflow. Managers need override; color services need processing-time nests. Visual conflict indicator (`day-cal__appt-indicator--conflict`) already exists — extend to intentional, not accidental, overlaps.

**5. Client memory + retail intelligence at chair (Next sprint)**  
CRM depth exists in API (`formula_notes`, visit timeline, LTV, checkout history) and checkout already adds retail with inventory deduct. Combine into a chair-side panel + 1–2 contextual product suggestions. Cross-feature win that compounds every visit — Boulevard has notes; nobody does *moment-of-service* memory well.

---

### Anti-patterns to fix before adding breadth

From `SPRINT_WATCHER_NOTES.md` + code audit:

- Prebook links that don't prefill = broken delight promise
- Find-openings hidden in drawer = shipped feature with zero daily impact
- Reports siloed from calendar/waitlist/inventory = owners still export to Excel mentally
- `BOULEVARD_FEATURE_GAP.md` stale on waitlist/week view — use `BOOK_AGENT_BACKLOG.md` for coordination

---

### Roadmap summary

| Tier | Items |
|------|-------|
| Ship now | I1–I4 |
| Next sprint | I5–I9 |
| Visionary | I10–I13 |

### Key files

- `apps/team/src/pages/api/calendar/find-openings.ts`
- `apps/team/src/lib/calendar.ts` (`findOpenGaps`, `findNextOpenGap`)
- `apps/team/src/components/DayCalendar.astro` (gap hint, waitlist drawer, find-opening drawer)
- `apps/team/src/scripts/checkout.ts` (prebook links)
- `apps/team/src/lib/reports.ts`, `apps/team/src/lib/team-pulse.ts`
- `docs/BOOK_AGENT_BACKLOG.md` (B2–B8 backlog IDs)

---

## Agent 3 — Auth, Mobile & Shell

**Agent:** QA Agent 3 of 5  
**Scope:** `/team/login`, `/team/forgot-password`, `/team/change-password`, session persistence, Miriam staff profile after `dbuszx@gmail.com` login, mobile nav / sidebar / touch targets, page load performance, console errors, local `astro.config` Vite setup  
**Local:** http://localhost:4322/team  
**Production:** https://salon-citrine-platform.dbuszx.workers.dev/team/ (also https://salon-citrine-team.dbuszx.workers.dev/team/ per Agent 2)  
**Method:** Playwright auth/perf/touch-target probes · `qa:mobile-viewport` + `qa:mobile-a11y` (local) · `qa:desktop-sidebar` (unauthenticated) · Supabase SQL staff-link verification · `astro.config.mjs` read-only review · middleware + auth-session code review. Browser MCP tabs failed to persist (no live screenshots).

### Test coverage summary

| Area | Method | Result |
| --- | --- | --- |
| `/team/login` load | HTTP + Playwright | **Pass** — 200 local & prod; title "Sign in · Team · Salon Citrine" |
| Login form validation | Playwright empty submit | **Pass** — HTML5 + client validation blocks empty fields |
| Invalid credentials | POST → redirect | **Pass** — `/login?error=invalid&email=…` + alert "Email or password is incorrect…" |
| `/team/forgot-password` | HTTP + form POST | **Pass** — 200; submit → `?sent=1` success message |
| `/team/change-password` (unauthed) | GET redirect | **Pass** — redirects to `/team/login` |
| Protected routes (`/`, `/book`, etc.) | GET unauthed | **Pass** — middleware redirects to login |
| Miriam staff profile link | Supabase SQL | **Pass** — `dbuszx@gmail.com` → `miriam-zhukov`, name "Miriam Zhukov", role `owner`, `must_change_password=false` |
| Live login + profile UI | Playwright | **Blocked** — password not available in swarm; cannot verify avatar/name in header or mobile drawer |
| Session persistence (remember / idle lock) | Code review | **Designed** — shift 10h, remember 14d, 30min idle lock via `session-guard.ts`; not live-tested |
| Mobile viewport overflow (login) | `qa:mobile-viewport` | **Pass** — 0px overflow at 320–430px (+ 390px @2x) on all routes (protected routes resolve to login) |
| Mobile a11y (login) | `qa:mobile-a11y` | **Pass** — skip link present; no unlabeled icon buttons on login |
| Touch targets (login, 390px) | Playwright bbox | **Partial** — submit/toggle/remember meet 44px; see P1 |
| Desktop list sidebars | `qa:desktop-sidebar` | **Blocked** — 24/24 checks fail (all routes redirect to login; sidebar DOM absent) |
| Mobile nav drawer / team bar | Code review | **Designed** — drawer ≤1100px (`team-header.ts`); cannot verify open/close/Escape without auth |
| Page load performance | Navigation Timing API | **Pass (dev warm)** — login DCL ~623ms, forgot ~163ms local; prod login DCL ~546ms |
| Console errors (auth pages) | Playwright listeners | **Pass** — zero console errors on login (local + prod reload) |
| `astro.config.mjs` Vite setup | Read-only | **Pass** — intentional `strictPort`, `envDir: "../../"`, `optimizeDeps` include/exclude; see P0 cache note |

**QA reports written:**  
`apps/team/qa-reports/mobile-viewport-2026-07-07T05-28-20-973Z.json`  
`apps/team/qa-reports/mobile-a11y-2026-07-07T05-27-55-150Z.json`  
`apps/team/qa-reports/desktop-sidebar-2026-07-07T05-31-04-622Z.json`

---

### P0 bugs

1. **Local dev server 500 — stale Vite SSR deps cache (recovered this session)**  
   Before restart, `/team/login` returned HTTP 500 with:  
   `The file does not exist at …/node_modules/.vite/deps_ssr/astro_compiler-runtime.js`.  
   Triggered after prior `vite config has changed` re-optimization.  
   **Recovery:** `astro dev stop` → delete `apps/team/node_modules/.vite` → `npm run dev:team`. Login then 200.  
   **Not an `astro.config` defect** — operational cache corruption. Document in README/dev runbook: if team app 500s on all routes after config churn, clear `.vite` before changing config.

2. **Authenticated auth / shell QA blocked without password**  
   Same blocker as Agents 1–2. Cannot verify: successful login redirect, Miriam avatar/name in `TeamSiteHeader`, mobile drawer (`data-mobile-drawer`), profile menu, remember-me cookie duration, idle lock logout, or post-login change-password flow (`must_change_password` is already `false` for this account).  
   **Unblock:** Provide password or check in `team-auth.json` + `TEAM_QA_STORAGE_STATE=team-auth.json` for Playwright scripts.

---

### P1 polish

1. **"Forgot password?" link below 44px touch target**  
   At 390px viewport: `.login-link--quiet` measures **95×17px**. WCAG/mobile guideline is 44×44px minimum.  
   **Fix:** Increase hit area with padding/min-height on `.login-field__label-row .login-link` (CSS-only).

2. **Skip link height 36px on login**  
   `.skip-link` is 135×36px — slightly under 44px height. Consider `min-height: 44px` + vertical padding when focused.

3. **Login footer "Privacy" link narrow width (37px)**  
   Footer nav link width 37px at 390px — tap target too small. Add padding or increase footer link min-width.

4. **Duplicate error alert text on invalid login**  
   Playwright captured two identical strings in `#login-alert-slot` after bad password — possible duplicate render or live region + visible alert overlap. Verify DOM; dedupe if redundant.

5. **Change-password flow not regression-tested**  
   Middleware + API (`change-password.ts`) correctly gate on `must_change_password` metadata, but account is already past first-login. Need a test user with `must_change_password: true` or a one-off QA flag to validate the full forced-reset path.

6. **Production URL drift across docs**  
   This agent tested `salon-citrine-platform.dbuszx.workers.dev`; Agent 2 uses `salon-citrine-team.dbuszx.workers.dev`. Both serve login 200 — consolidate canonical team Worker URL in `VISUAL_QA_CHECKLIST.md`.

---

### P2 ideas

1. **`team-auth.json` in CI** — Generate via `npx playwright codegen --save-storage=team-auth.json` after login; run `qa:mobile-viewport`, `qa:desktop-sidebar`, and `qa:mobile-a11y` on every deploy.

2. **Auth flow E2E script** — Add `apps/team/scripts/auth-flow-qa.mjs` covering login, forgot-password, change-password redirect, and protected-route guards (mirrors this session's ad-hoc Playwright probe).

3. **Login perf budget** — Track DCL/TTFB in QA report JSON; alert if local warm DCL > 1s or prod > 800ms.

4. **Remember-me UX audit** — After auth unblock, verify `sc_team_session_mode` cookie + 14-day persistence vs shift session + idle lock on shared iPad scenario.

5. **Mobile drawer touch audit** — Once authenticated, measure `.team-bar__drawer-link` and `.team-bar__mobile-menu-btn` at 390px (avatar menu is primary nav entry ≤1100px).

---

### Wins (verified)

- **Auth middleware** — Public paths (`/login`, `/forgot-password`, `/auth/confirm`) reachable; API routes 401 when unauthed; unlinked staff → `?error=unlinked`; password-change gate redirects correctly in code.
- **Staff link integrity** — `dbuszx@gmail.com` correctly mapped to Miriam Zhukov (`owner`) in Supabase; login API will reject unlinked users via `staff.supabase_user_id` check.
- **Forgot-password UX** — Generic success copy (no email enumeration); error states for missing/send/connection query params.
- **Login mobile shell** — Split layout hides hero on phone; mobile wordmark shown; no authenticated `team-bar` on login page; zero horizontal scroll at all tested widths.
- **No JS console errors** on auth pages (local dev after cache fix, production).
- **Vite dev config** — `strictPort: true` on 4322 prevents silent port drift to wrong app; `envDir: "../../"` loads repo-root `.env` correctly.
- **Session design** — Sensible salon defaults: 10h shift, 14d remember-me, 30min idle lock on non-remember sessions (`auth-session.ts`, `session-guard.ts`).

---

### Screenshot notes

_No authenticated screenshots captured._ Recommend re-run with owner session and capture:

- Login mobile (390px): form, remember-me, forgot-password link hit area
- Post-login dashboard: Miriam name + avatar in team bar
- Mobile drawer open (390px): nav list, account section, Done close
- Desktop (1280px): horizontal nav tabs + profile dropdown
- `/team/tasks` or `/clients`: list sidebar sticky behavior (with `TEAM_QA_STORAGE_STATE`)
- Change-password page (if test user with `must_change_password: true`)

---

### Fixes applied by Agent 3

| Action | Detail |
| --- | --- |
| Local dev recovery | Stopped hung Astro dev (pid 15376), cleared `.vite` cache, restarted — login 200 again |
| Config changes | **None** — `astro.config.mjs` read-only; issue was cache not config |
