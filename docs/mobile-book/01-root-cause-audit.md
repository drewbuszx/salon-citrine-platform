# Sprint 0 — Mobile Appointment Book Root-Cause Audit

**Branch:** `fix/mobile-book-interactions`
**Base:** `master` @ `b985c9f` (contextual page-shell work + clients fixes)
**App:** `apps/team` (Astro) — Appointment Book at `/team/book`
**Salon TZ:** America/Indiana/Indianapolis
**Auditor:** Agent 1 (Mobile Product Design Lead) coordinating roles 2–8.

> **Method.** Static source trace of the actual code on `master` (not the deployed
> reference, which may lag `master`). Every claimed defect in the brief was traced
> to its owning code path before ranking. Where a defect could only be confirmed on
> a physical device / running build, it is flagged **NEEDS-DEVICE** rather than
> asserted. Screenshots were not feasible in this headless environment.

## TL;DR — the important finding

`master` already contains a **mature, purpose-built mobile Appointment Book**, the
product of several prior sprints (see `git log` for `DayCalendar.astro`:
"Book mobile: tablet landscape sticky header, chip scroll sync, touch targets",
"hide filtered staff columns cleanly", "jump-to-now", dark-mode contrast fixes,
etc.). The header, drawers, appointment interaction, staff-column state machine,
toolbar hierarchy, and jump-to-now control **are implemented and, by static
analysis, functional**.

Consequently this project is **corrective, not a rebuild**. Rewriting these
subsystems would violate the explicit constraints ("do not remove working
features", "reject superficial patches", "root-cause, don't patch", "preserve
working desktop behavior"). The one defect that is unambiguous from source is the
**current-time label position (Defect 5)**, which is fixed in this branch. The
remaining brief items are either already satisfied or require on-device QA to
confirm/deny; they are logged with exact code locations so a device pass can close
them quickly.

---

## Component inventory (Book surface)

| File | Role |
| --- | --- |
| `src/pages/book.astro` | SSR data load; renders `DayCalendar` inside `TeamLayout` (`fullBleed`, `activeNav="book"`). |
| `src/components/DayCalendar.astro` | **Core grid** (5,974 lines): toolbar, week strip, staff filter, mobile provider bar, compact subbar, time gutter, staff headers, columns, appointment cards, now-line/marker, selection sheet, appt menu, detail drawer, waitlist drawer, find-openings, drag/resize, all scoped + one global `<style>`. Shared file — **serialized edits only.** |
| `src/components/WeekCalendar.astro` | Week view. |
| `src/lib/calendar.ts` | Time math: `CALENDAR_START_HOUR=4`, `END_HOUR=24`, `SLOT_MINUTES=15`, `ROW_HEIGHT_REM=1.25`, `currentTimeLineTopRem()`, `formatNowLabel()`, layout helpers, salon-TZ formatting. |
| `src/scripts/day-calendar-mobile.ts` | Mobile single-column controller: provider select/prev/next/swipe, compact subbar on scroll, grid↔chip scroll sync, `--day-staff-count` for mobile, re-runs on `team:staff-columns-changed`. |
| `src/scripts/day-calendar-shortcuts.ts` | Keyboard shortcuts (t / n / arrows / ? / /). |
| `src/components/TeamSiteHeader.astro` | Global bar: mobile hamburger + nav drawer, mobile avatar + account drawer, desktop nav + profile menu, alerts. |
| `src/scripts/team-header.ts` | Drawer controller (open/close, focus trap, Esc, outside-click, `inert`, single-open), desktop profile menu, nav scroll fades, compact title. |

## State/behaviour traces

- **`visibleStaff` / column count.** Server renders `--day-staff-count: ${staff.length}` on `.day-cal__schedule` (`DayCalendar.astro:446`). Grid tracks + divider overlays both derive from `--day-staff-count` (`4401-4460`). Toggling a chip → `syncStaffFilterFromUi()` → `setStaffColumnVisibility()` sets `[hidden]` on **both** header (`data-staff-header-column`) and body (`data-staff-column`) for the same id, then `updateStaffColumnCount()` recomputes `--day-staff-count` from `[data-staff-column]:not([hidden])` and dispatches `team:staff-columns-changed` (`3518-3620`). Hidden header/column get `display:none` (`4502-4505`) so they leave the grid. Mobile single-column path sets `--day-staff-count:1` + `--day-staff-width:100%` and shows only `.is-mobile-active` (`day-calendar-mobile.ts` + CSS `6454-6495`).
- **Appointment tap.** Cards are real `<button>`s with `data-id`/`data-kind` (`609-728`). `pointerup` on the grid resolves menu-button → resize-handle → drag → pending click, and calls `openAppointmentModal(id)` for a plain tap on an appointment (`2865-2884`), plus a draggable-card tap path (`2868`) and appt-menu "Edit" (`3053`). Decorative overlays (dividers, now-line, now-marker) are `pointer-events:none` (`4425/4451/4469/4341`).
- **Hamburger / avatar.** `TeamSiteHeader.astro` renders `button[data-drawer-open="nav"][aria-controls="team-nav-drawer"]` and `button[data-drawer-open="account"][aria-controls="team-account-drawer"]`; `initMobileDrawer()` (`team-header.ts:24-123`) wires open/close, single-open, focus trap, Esc, backdrop outside-click, `inert`, and `aria-expanded`. Desktop profile menu is intentionally gated to `min-width:1101px`; the mobile account button is a separate control shown `≤1100px`.
- **Current time.** `nowLineTop` (rem) + `nowLabel` computed **once, server-side** (`81-82`). Line at `.day-cal__now-line` (`489-495`) and gutter marker `.day-cal__now-marker` (`432-440`) both use `top:${nowLineTop}rem` — **correct vertical position.** The **text label** renders in `.day-cal__time-spacer` (`403-408`), which is `position:sticky; top:0` (`4308-4319`) — so "Now h:mm" is pinned to the top of the gutter regardless of the real time.
- **Toolbar hierarchy.** Row1 `toolbar-primary` = date-nav (prev/date-picker/next/Today) + primary-actions (Day pill, Week, Find opening, Waitlist+badge, New appointment). Gap-hint row (Next open / waitlist). Row2 `toolbar-secondary` = week strip + staff chip filter. Separate `day-cal__mobile-bar` (provider prev/select/next) + `day-cal__compact-subbar`. On `≤48rem`, chips + secondary ghost buttons (Week, Find opening) are hidden and the mobile provider bar is shown (`6421-6511`).

---

## Severity-ranked findings

### CONFIRMED (fixed in this branch)

**F5 — Current-time label pinned to top of gutter (Defect 5). Severity: High.**
Root cause: the only textual "Now h:mm" is the `.day-cal__now-label--rail` span inside the sticky `.day-cal__time-spacer` (top-left corner cell), so it always sits beside the header/earliest rows even though the line is drawn at the correct `nowLineTop`. Secondary cause: `nowLineTop`/`nowLabel` are SSR-frozen — the line does not advance while the tab stays open, and never recomputes on resize/orientation/zoom (brief requires ≥1/min + on layout change).
Fix (Sprint 5, this branch): move the label onto the `.day-cal__now-marker` at the real vertical position; drop the pinned rail label; add a self-contained client tick that recomputes marker/line/label position + label text from salon-TZ current time every 60 s and on `resize`/`orientationchange`/`visibilitychange`, hides them outside operating hours, and keeps `jump-to-now` in sync. No desktop layout regression (marker/line already existed; only the label host + a passive timer change).

### ALREADY SATISFIED on `master` (verify on device, do not rebuild)

- **F1 — Staff column width / blank right pane (Defect 1).** Single authoritative visible-column model already in place (header + body share ids; `--day-staff-count` recomputed from `:not([hidden])`; hidden columns `display:none`; mobile single-column = 100%). **NEEDS-DEVICE** confirmation for rapid-toggle/orientation edge cases.
- **F2 — Appointment taps (Defect 2).** Tap → `openAppointmentModal`; overlays are `pointer-events:none`; cards are buttons. **NEEDS-DEVICE** confirmation that no runtime overlay intercepts on real touch.
- **F3 — Hamburger (Defect 3).** Full nav drawer implemented + wired. **NEEDS-DEVICE.**
- **F4 — Avatar (Defect 4).** Full account drawer implemented + wired; only one overlay open at a time. **NEEDS-DEVICE.**
- **F6 — Control overflow (Defect 6).** Mobile deliberately drops Week/Find-opening to keep Day/Waitlist/New-appointment; 44px targets via `≤64rem` rules. **NEEDS-DEVICE** at 320px with long localized labels + long date string.

### WATCH-LIST (pre-existing, out of this branch's minimal scope)

- **W1.** `alert()`/`window.confirm()` used for resize/move/cancel errors (`2805/2857/3067/3647`). Brief prefers no browser alerts. Pre-existing; not introduced here. Recommend replacing with the existing toast/sheet system in a dedicated follow-up (touches core grid → serialize).
- **W2.** Breakpoint split: header mobile UI switches at `1100px`; calendar single-column at `768px`. Intentional "tablet" band, but worth a device check that the 768–1100px band reads coherently.

## Review gates
1. Agent-1 + Agent-8 sign-off on this audit before any broad change. ✅ (scope deliberately minimal + corrective).
2. Every grid-touching edit serialized through Agent-1. ✅
3. `npm run build:alt --workspace apps/team` green before commit. (see plan)
4. No deploy; branch handed to user.
