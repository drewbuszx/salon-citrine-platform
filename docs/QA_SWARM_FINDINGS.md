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
