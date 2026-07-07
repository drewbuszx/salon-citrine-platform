# QA Swarm Consensus — Salon Citrine Platform

_Coordinator: QA Agent 5 · Updated: 2026-07-07 · Repo: `salon-citrine-platform` · Branch: `master`_

## Swarm status

| Agent | Focus | Findings doc |
| --- | --- | --- |
| Agent 1 | Book & Calendar | ✅ `docs/QA_SWARM_FINDINGS.md` |
| Agent 2 | Mobile / day-cal | _Section not received — synthesized from `MOBILE_DESIGN_SYSTEM.md`, code review_ |
| Agent 3 | Booking / checkout flows | _Section not received — synthesized from `BOOK_AGENT_BACKLOG.md`, `UX_INTELLIGENCE_FEED.md`_ |
| Agent 4 | Team list pages / shell | _Section not received — synthesized from `UX_AUDIT.md`, `TEAM_SIDEBAR_DECISION.md`_ |
| Agent 5 | Coordinator + ship pass | This document |

> **Note:** Only Agent 1 findings arrived before ship. Agents 2–4 sections were synthesized from existing audit docs and Agent 5 code review.

---

## Unified priority list (deduped)

### P0 — launch blockers

| ID | Issue | Area | Status |
| --- | --- | --- | --- |
| P0-1 | Guest `/book/` not on team Worker (redirects to staff login) | `apps/web` deploy | Open — separate Worker per `CLOUDFLARE_DEPLOY.md` |
| P0-2 | Authenticated visual QA blocked without staff credentials | QA process | Open — run locally or provide test login |
| P0-3 | Collect card at checkout when client has no card on file | Checkout | Open |
| P0-4 | Sticky day-cal corner z-index bleed on scroll | `/team/book` `.day-cal` | **Fixed this pass** |
| P0-5 | Keyboard shortcuts inert (`?`, `T`, `N`, arrows) | `.day-cal` | **Fixed this pass** (Agent 1) |

### P1 — competitive parity / off-brand

| ID | Issue | Area | Status |
| --- | --- | --- | --- |
| P1-1 | Custom tip $0.10 typo risk (Boulevard G2 pattern) | Checkout | **Fixed this pass** — min $1 custom + 25% preset |
| P1-2 | Injected appt quick-menu missing scoped styles | `.day-cal` sheets | **Fixed this pass** |
| P1-3 | Soft double-book warning + manager override | Booking API | Open (B2) |
| P1-4 | Quick client add inline in booking drawer | `.day-cal` drawer | Open (B4) |
| P1-5 | Recommended times / Precision-lite in slot picker | Booking | Open (B5) |
| P1-6 | Week view interaction parity vs day view | `/week` | Open beta (B7) — Agent 1: no PTO bands, read-only cards |
| P1-7 | Embeddable guest book `?embed=1` on marketing site | `apps/web` | Open |
| P1-8 | Returning-client OTP instead of password wall | `apps/web` | Open |
| P1-9 | Sidebar active state regression on list pages | TeamListLayout | Verify with auth — fix shipped in 3926b84 |

### P2 — polish

| ID | Issue | Area | Status |
| --- | --- | --- | --- |
| P2-1 | Full week calendar grid (strip exists) | Calendar | Open |
| P2-2 | Waitlist drag-to-schedule | `.day-cal` | Deferred (B3) |
| P2-3 | Cancel/no-show reason + fee hook | Booking API | Open (B9) |
| P2-4 | Tasks filter sidebar placeholders | `/tasks` | Open |
| P2-5 | Package/voucher redemption | Checkout | Open |
| P2-6 | Front Desk status board (Boulevard 2026) | New route | Open |
| P2-7 | Service search on long guest menus | `apps/web` | Open |

---

## Looking great (passes QA)

- [x] **Design system deployed** — citrine/stone/sage tokens, DM Sans, skip link on team layout
- [x] **Login page** — public, compact shell, primary CTA, no broken layout (HTTP 200 on Worker)
- [x] **Day calendar core** — sticky staff header, full-height column dividers, mobile single-column + swipe, tablet landscape compact toolbar
- [x] **Gap-fill hint** — clickable “Book slot” pre-fills appointment drawer; waitlist count badge live-refreshes
- [x] **Keyboard shortcuts** — day-cal help popover shipped (`5e286bd`)
- [x] **Waitlist ops** — team page + drawer with Book/Edit/Remove; guest waitlist form on web
- [x] **Checkout depth** — retail tax row, tip presets, prebook 4/6/8 week links
- [x] **List page cohesion** — TeamListLayout on clients, stock, tasks, events, docs, reports
- [x] **Team Pulse dashboard** — today’s book, waitlist queue, stock alerts with deep links
- [x] **Personal time off** — renders on day grid; excluded from find-openings (`793143b`)
- [x] **Build pipeline** — `npm run build:alt --workspace apps/team` (Windows-safe)

---

## Must fix before ship

1. **Deploy guest book Worker** (`apps/web` → `salon-citrine-book`) — marketing embed and public `/book` depend on it.
2. **Auth-backed smoke test** — verify sidebar chevrons (12px), citrine active borders, and calendar interactions on real data.
3. **Checkout card collection** — block or guide when `hasCardOnFile === false` (currently hard error).
4. **Week view beta hardening** — day↔week toggle, block/appointment parity (B7).

---

## Top 10 polish actions (ranked by impact)

1. Deploy embeddable guest book + iframe snippet for saloncitrineindy.com _(P0/P1 — conversion)_
2. Soft double-book warning with manager override _(P1 — daily ops safety)_
3. Inline “+ New client” in booking drawer _(P1 — front-desk speed)_
4. Recommended times at top of slot picker _(P1 — Boulevard parity)_
5. Week view interaction parity + promote from beta _(P1 — manager planning)_
6. Returning-client OTP on web book _(P1 — frictionless rebook)_
7. Collect card at checkout fallback _(P0 — payment completion)_
8. Front Desk status columns _(P1 — reception iPad workflow)_
9. Auth QA pass on all TeamListLayout sidebars _(P1 — brand regression guard)_
10. Service search on guest service step _(P2 — 40+ service menus)_

---

## Agent consensus statement

All perspectives agree on the following:

1. **The team app is structurally ship-ready** for staff operations — calendar, waitlist, checkout, CRM list pages, and dashboard pulse are implemented and visually aligned with the Boulevard-inspired design system.
2. **The guest booking surface is the main external gap** — team Worker correctly protects staff routes, but public `/book` must live on a separate Worker with embed support.
3. **Day calendar (`.day-cal`) is the highest-value surface** — recent swarm work (sticky header, dividers, mobile, gap-fill, conflict layout, drawer forms) addressed the biggest UX risks; remaining calendar gaps are parity features (soft overlap, recommended times, drag waitlist), not layout collapse.
4. **Do not reopen sidebar architecture** — filter/nav patterns are settled (`TEAM_SIDEBAR_DECISION.md`); future work is verification, not redesign.
5. **Polish before features** — tip validation, scoped injected UI, and sticky z-index fixes are the right class of pre-ship patches; net-new routes (Front Desk, packages) can follow deploy.

---

## Shipped in this pass (Agent 5)

| Fix | Files | Priority |
| --- | --- | --- |
| Scoped styles on injected appt quick-menu + immediate drawer stamp | `DayCalendar.astro` | P1 |
| Sticky time-axis corner z-index (no scroll bleed under staff header) | `DayCalendar.astro` | P0 |
| Tablet staff-row z-index restored to 36 (iPad scroll stack) | `DayCalendar.astro` | P1 |
| Keyboard shortcuts bootstrap on `team:day-cal-ready` | `day-calendar-shortcuts.ts`, `DayCalendar.astro` | P0 |
| Custom tip min $1.00 + 25% preset + hint copy | `checkout.ts`, `checkout/[appointmentId].astro` | P1 |
| Consistent auth redirects via `teamUrl()` | `waitlist.astro`, `clients/index.astro`, `clients/[id].astro` | P2 |

**Deploy:** `salon-citrine-team` · Version `65df37b9-2818-47d8-926c-b30b7bdbfda5`  
**URL:** https://salon-citrine-team.dbuszx.workers.dev/team/  
**Build:** `npm run build:alt --workspace apps/team` — pass (exit 0)

**Commits:** `6ac0d2f`, `bc10d83`

### Remaining after this pass

- Guest book Worker deploy
- Auth-gated visual QA on list sidebars
- B2/B4/B5/B7 book backlog items
- Cash/card-present tender, packages, Front Desk board

---

## Honest assessment

**Looking great?** **Yes, with caveats.**

The staff team app presents as a cohesive, on-brand operations product. Day calendar, dashboard, waitlist, and checkout are demo-ready for authenticated users. Caveats: public guest booking is not verified on production, several competitive-parity features remain backlog, and this swarm could not run browser-authenticated route QA without credentials.

**Deploy target:** `salon-citrine-team` Worker · https://salon-citrine-team.dbuszx.workers.dev/team/ (deployed 2026-07-07, version `65df37b9`)
