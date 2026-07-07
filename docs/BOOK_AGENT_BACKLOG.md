# Book Page — Agent Backlog & Coordination

_Owner: Autonomous Booking Coordinator · Updated: 2026-07-06 · Repo: `salon-citrine-platform` · Page: `/team/book`_

This is the live task board for the booking swarm. It scouts work for the calendar/booking agents, keeps priorities straight, and records what is already shipped so agents do **not** rebuild done features. Pull the top unclaimed task for your agent type, mark it `[claimed:<id>]`, and move it to **In review** when the commit is up.

---

## Coordinator log (this session)

Shell/terminal is **working** this session (commands must run outside the sandbox — the Windows sandbox helper only proxies network, no fs isolation). The prior coordinator was blocked on a dead shell; that blocker is cleared. Actions taken:

- **Verified** the sticky staff header + full-height column dividers work (agent `981e329f`) is **shipped** in commit `18b8d5f`. `DayCalendar.astro` is clean in the working tree — no follow-up edit needed. QA checklist (B1) below is now the only remaining gate.
- **Verified** keyboard shortcuts (agent `800444af` retry) shipped in commit `5e286bd`.
- **Ran** `build:alt` on the full working tree → **passes** (exit 0, only benign font + `:global` lightningcss warnings).
- **Committed + pushed + deployed** all uncommitted swarm work in labeled, revertable groups (book/calendar, auth, team-ui, docs).
- **Checked the wrong repo** (`saloncitrineindy`, the marketing site): clean tree, only marketing commits. **No book work leaked there** — no agent re-dispatch required.

---

## Shipped (do NOT rebuild)

| Capability | Reality on `/team/book` today |
| --- | --- |
| Sticky staff header + full-height dividers | ✅ `18b8d5f` — `.day-cal__staff-row` (`position: sticky`) + `.day-cal__columns::after` gradient overlay, `--day-staff-count` alignment, mobile-single overrides |
| Keyboard shortcuts + help popover | ✅ `5e286bd` — `day-calendar-shortcuts.ts` |
| Week view | ✅ Shipped (beta) — `week.astro` + `WeekCalendar.astro` (`loadWeekCalendarData`), manager view + staff filter + error fallbacks. Watch for interaction parity vs day view (see B7). |
| Block time | ✅ `block-time.astro`, `/api/block-time`, in-grid `data-action="block"` |
| Waitlist management | ✅ `waitlist.astro` + calendar waitlist drawer with per-entry **Book** |
| Checkout from card | ✅ appointment card `Checkout` / `View receipt` → `/checkout/[id]` |
| No-show / cancel from card | ✅ status dropdown + `data-action="cancel-appointment"` |
| Staff birthdays / holidays on calendar | ✅ `calendar-holidays.ts` + `api-birthdays.ts` + migration `0027_staff_birthday` |
| Gap-fill (basic) | ⚠️ Partial — `nextOpenGap` hint + `/api/calendar/find-openings`; no ranked "recommended times" in booking form yet (B5/B8) |
| Quick client add | ⚠️ Partial — appointments API auto-creates client on book; no inline "new client" affordance (B4) |
| Double-book warning | ❌ `validateAppointmentTimeRange` hard-blocks overlaps; no soft warning + manager override (B2) |
| Waitlist drag-to-schedule | ❌ click-to-book only (B3) |

---

## Frozen zones / working rules

- ✅ `DayCalendar.astro` — **unlocked** (sticky-header edit landed). Normal review rules apply.
- 🧊 `team-list-sidebar.css` — treat as sensitive layout; small, reviewed diffs only.
- ✅ Prefer new components / API routes over editing shared calendar files.
- 🧪 Run `apps/team` `build:alt` before every commit. Commands must run **outside the sandbox** on this machine.
- 🧊 Keep `book.astro` data-loading contract stable (`loadCalendarData` / `loadStaffServicesByStaff` / `waitlistCount`).

---

## Prioritized backlog

Priority: **P0** launch-blocking · **P1** competitive parity · **P2** nice-to-have. Effort in agent-days.

| # | Task | Pri | Effort | Agent type | Depends on |
| --- | --- | --- | --- | --- | --- |
| B1 | **QA sticky header/dividers** — verify pinned-on-scroll, column alignment on horizontal scroll, full-height dividers across empty + tinted/blocked slots, mobile single-column, no `now-marker` regression. | P0 | 0.5 | `qa-verify-agent` | — |
| B7 | **Week view parity polish** — confirm `/week` has staff filter, block/appointment rendering, day↔week toggle in subbar, and matches day-view interactions. Ship-gated as beta today. | P1 | 1.5 | `calendar-ui-agent` | B1 |
| B2 | **Soft double-book warning + manager override** — non-blocking overlap warning in booking form + manager-only "Book anyway"; keep hard block for non-managers. | P1 | 2 | `booking-api-agent` | B1 |
| B4 | **Quick client add in booking form** — inline "＋ New client" + duplicate-match prompt (server already de-dupes phone/email); return `client_id` into booking POST. | P1 | 1.5 | `calendar-ui-agent` | — |
| B5 | **Recommended times (Precision-lite)** — surface ranked openings from `/api/calendar/find-openings` at top of slot picker. | P1 | 2 | `booking-api-agent` | — |
| B3 | **Waitlist drag-to-schedule** — drag drawer entry onto a slot to prefill + create appointment. | P1 | 2–3 | `calendar-ui-agent` | B1 |
| B8 | **Gap-fill hint upgrade** — make `nextOpenGap` clickable to open booking form pre-seeded to that slot/staff. | P2 | 1 | `calendar-ui-agent` | — |
| B6 | **Checkout deep-link hardening** — carry appointment context, handle cancelled/completed gracefully, add "Prebook 4/6/8 wk" on checkout success. | P1 | 1 | `checkout-agent` | — |
| B9 | **Cancel/no-show reason + fee hook** — capture reason; stub late-cancel fee per policy (charge wiring deferred). | P2 | 1.5 | `booking-api-agent` | — |
| B10 | **Embed/chromeless `/book?embed=1`** for the marketing site. | P2 | 2 | `web-booking-agent` | — |

---

## Killed / deferred (do NOT reopen without coordinator sign-off)

- ❌ **Duplicate "rebuild the day grid" efforts** — the sticky-header/divider grid in `DayCalendar.astro` is the canonical implementation. No parallel grid rewrites.
- ❌ **Re-scoping week view / waitlist / block-time as "missing"** — they are shipped. `docs/BOULEVARD_FEATURE_GAP.md` is stale; this board is source of truth.
- 🕒 **Waitlist drag-to-schedule (B3)** — deferred behind B1/B2; click-to-book covers the ops need for now.

---

## Next 5 tasks (assign now)

1. **B1 — QA sticky header/dividers** → `qa-verify-agent`. Fast confidence check on the just-shipped grid; unblocks everything that touches `DayCalendar.astro`.
2. **B7 — Week view parity polish** → `calendar-ui-agent`. It shipped as beta; harden interactions + add day↔week toggle before promoting.
3. **B2 — Soft double-book warning + override** → `booking-api-agent`. Clearest calendar-behavior gap vs Boulevard.
4. **B4 — Quick client add in booking form** → `calendar-ui-agent`. Backend already de-dupes; just needs the affordance.
5. **B5 — Recommended times (Precision-lite)** → `booking-api-agent`. `find-openings` API already exists; surface + rank it.

---

## Post-sticky-header QA checklist (B1)

- [ ] Staff header row stays pinned while scrolling vertically.
- [ ] Header cells stay aligned to columns while scrolling horizontally (multi-staff manager view).
- [ ] Full-height dividers render across empty **and** tinted/blocked slots.
- [ ] Time axis stays sticky-left; header spacer holds both sticky corners (no z-index bleed).
- [ ] Mobile single-column (`day-cal--mobile-single`) unaffected.
- [ ] No regression to `now-marker` / `now-line`.
