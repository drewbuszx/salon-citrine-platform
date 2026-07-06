# Sprint 1 Handoff — 10-Minute Polish Pass (8 Screens)

> **Date:** July 6, 2026  
> **Repo:** `salon-citrine-platform`  
> **Baseline commits:** `3926b84` (design system), `12feea3` (citrine accent), `b02789d` (sidebar fix)  
> **Authority:** [TAKEOVER_NOTE.md](./TAKEOVER_NOTE.md) · [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)

---

## Sprint goal

**10-minute parallel polish pass across 8 user-facing surfaces** — citrine/stone tokens only, no sidebar architecture churn, no new competitor docs. Each screen owner ships one focused commit tagged `Sprint: …`, passes `build:alt` (team) or `build` (web), and pushes to `master`. Watcher documents creative direction for Sprint 2; Scrum Master packages handoff + retro.

**North star:** Make every screen feel like one product (Salon Citrine editorial luxury), not Boulevard-purple SaaS stitched together. Real data, real empty states, no "Coming soon" teases.

---

## Agent roster

| # | Role | Owner | Route / app | Expected commit message |
|---|------|-------|-------------|-------------------------|
| 1 | Screen owner | **Dashboard** | `/team/` (`index.astro`, `TeamPulse.astro`) | `Sprint: polish team dashboard.` |
| 2 | Screen owner | **Book calendar** | `/team/book` (`DayCalendar.astro`) | `Sprint: polish book calendar.` |
| 3 | Screen owner | **Clients CRM** | `/team/clients`, client profile | `Sprint: polish clients CRM.` |
| 4 | Screen owner | **Stock** | `/team/inventory` | `Sprint: polish stock inventory.` |
| 5 | Screen owner | **Tasks** | `/team/tasks` | `Sprint: polish tasks notebook.` |
| 6 | Screen owner | **Events** | `/team/events` | `Sprint: polish events calendar.` |
| 7 | Screen owner | **Waitlist** | `/team/waitlist` | `Sprint: polish waitlist inbox.` |
| 8 | Screen owner | **Guest book** | `apps/web` `/book/*` | `Sprint: polish guest booking flow.` |
| 9 | Watcher | **Creative strategist** | — (docs only) | `Sprint: watcher creative notes for handoff.` |
| 10 | Scrum Master | **Coordinator** | — (docs only) | `Sprint: scrum handoff retro and sprint 2 brief.` |

**Read before coding:** `DESIGN_SYSTEM.md`, `UX_INTELLIGENCE_FEED.md`, `TAKEOVER_NOTE.md`. Screen-specific: `EMBED_BOOK.md` (guest book, waitlist), `TEAM_SIDEBAR_DECISION.md` (list pages).

---

## Definition of done — per screen

### 1. Dashboard (`/team/`)

- [ ] Team Pulse: clearer labels, citrine tiles, live counts (appointments / waitlist / low stock)
- [ ] Pulse tiles link through to book, waitlist, inventory
- [ ] Upcoming appointments: formatted times, strong empty state
- [ ] Stylist hero: citrine ring on avatar
- [ ] Quick actions: hover states; no duplicate links to `/book` for checkout
- [ ] `npm run build:alt --workspace apps/team` passes
- [ ] Commit + push `Sprint: polish team dashboard.`

### 2. Book calendar (`/team/book`)

- [ ] Waitlist link/badge: citrine styling, today-relevant count
- [ ] Appointment blocks: readable typography, staff accent colors
- [ ] New appointment modal: layout + inline validation
- [ ] Today / date nav polish
- [ ] Optional: gap-fill or "next available" hint (no week-view rewrite)
- [ ] `build:alt` passes · commit `Sprint: polish book calendar.`

### 3. Clients (`/team/clients` + profile)

- [ ] Table: zebra rows, sage hover, row → profile works
- [ ] Search: debounce loading indicator
- [ ] Add New Client modal polish
- [ ] Profile: intake panel readability, edit UX
- [ ] Filter sidebar: `(N)` counts; no architecture changes
- [ ] `build:alt` passes · commit `Sprint: polish clients CRM.`

### 4. Stock (`/team/inventory`)

- [ ] Product cards: hover lift, placeholder silhouette
- [ ] Low-stock badge visible in grid + banner
- [ ] Expand card details layout
- [ ] Filter apply feedback (toast or stats bar count)
- [ ] Scan-to-check-in prominent on mobile
- [ ] `build:alt` passes · commit `Sprint: polish stock inventory.`

### 5. Tasks (`/team/tasks`)

- [ ] "Needs attention" badge count from API
- [ ] Notebook ruled-line typography
- [ ] Create/edit modal polish
- [ ] Completed vs active visual distinction
- [ ] Empty state when filter matches nothing
- [ ] `build:alt` passes · commit `Sprint: polish tasks notebook.`

### 6. Events (`/team/events`)

- [ ] Calendar markers: consistent size/color per event type (citrine/stone/sage)
- [ ] Day click filters list below (verify)
- [ ] Legend aligned to design system
- [ ] Upcoming list: compact rows
- [ ] Add event modal polish
- [ ] `build:alt` passes · commit `Sprint: polish events calendar.`

### 7. Waitlist (`/team/waitlist`)

- [ ] Table columns readable; warm gold-brown client links
- [ ] Add To Waitlist form/modal complete
- [ ] Preferred time: Morning / Afternoon / Evening chips where API supports
- [ ] Empty state (icon + copy + CTA)
- [ ] Filter search polish
- [ ] `build:alt` passes · commit `Sprint: polish waitlist inbox.`

### 8. Guest book (`apps/web` `/book/*`)

- [ ] `BookingSteps`: citrine progress polish
- [ ] Details/intake layout for new clients; inline validation errors
- [ ] `?embed=1` minimal chrome on all steps
- [ ] Confirm page polish
- [ ] `npm run build --workspace apps/web` passes
- [ ] Commit `Sprint: polish guest booking flow.`

### 9. Watcher

- [ ] `docs/SPRINT_WATCHER_NOTES.md` with 10 features, 5 wow moments, 5 anti-patterns, per-screen tips
- [ ] No large feature implementation
- [ ] Commit `Sprint: watcher creative notes for handoff.`

### 10. Scrum Master

- [ ] This file + `SPRINT_1_RETRO.md` + `SPRINT_2_BRIEF.md`
- [ ] Poll `git log --grep="Sprint:"` at sprint end
- [ ] Commit `Sprint: scrum handoff retro and sprint 2 brief.`

---

## Frozen files — DO NOT TOUCH

Per [TAKEOVER_NOTE.md](./TAKEOVER_NOTE.md) and [TEAM_SIDEBAR_DECISION.md](./TEAM_SIDEBAR_DECISION.md). **No edits unless production regression (P0).**

| File / area | Reason |
|-------------|--------|
| `apps/team/src/components/TeamListLayout.astro` | Sidebar shell architecture |
| `apps/team/src/styles/team-list-sidebar.css` | Global sidebar chrome (12px chevrons, citrine border) |
| `apps/team/src/components/TeamSidebarNav.astro` | Nav-style sidebar primitive |
| `apps/team/src/components/TeamSidebarFilter.astro` | Filter-style sidebar primitive |
| `apps/team/src/components/TeamListFilter.astro` | Filter re-export |
| `apps/team/src/components/TeamManageLayout.astro` | Manage reference layout |
| Manage page inventory / hub redesigns | Accent swap only — no hub rewrites |

**Allowed:** Page content, scripts, modals, tables, API routes, dashboard/calendar/waitlist pages that do **not** use `TeamListLayout` scoped CSS hacks.

**Forbidden:** Purple (`#7c3aed`), SaaS blue (`#0096ff`), new sidebar refactors, duplicate agent work on the same frozen surface.

---

## Build / deploy checklist

Run **after all Sprint commits land** — not mid-sprint.

### Local build verification

```bash
# Team (Windows EPERM workaround)
npm run build:alt --workspace apps/team

# Guest book
npm run build --workspace apps/web
```

See [BOOKING_SHIP_CHECKLIST.md](./BOOKING_SHIP_CHECKLIST.md) for smoke tests.

### Deploy (Workers — not Pages)

| Worker | App | Build | Domain |
|--------|-----|-------|--------|
| `salon-citrine-team` | `apps/team` | `npm run build --workspace apps/team` | `team.saloncitrineindy.com` |
| `salon-citrine-book` | `apps/web` | `npm run build --workspace apps/web` | `book.saloncitrineindy.com` |

Full steps: [CLOUDFLARE_DEPLOY.md](./CLOUDFLARE_DEPLOY.md).

### Post-deploy verification (Drew)

1. **Team dashboard** — Team Pulse strip shows real counts; citrine tiles; links work
2. **Manage → any section** — active nav citrine left bar, not purple
3. **Embed** — `https://book.saloncitrineindy.com/book?embed=1` in iframe; funnel completes
4. **Waitlist** — table zebra/hover, empty state centered, no purple focus rings
5. **Visual QA** — say "run visual QA" → updates [VISUAL_QA_REPORT.md](./VISUAL_QA_REPORT.md)

### Known blockers

| Blocker | Mitigation |
|---------|------------|
| Windows `dist/` EPERM | Always `build:alt` for team locally |
| Staff auth for visual QA | Run `create-dev-admin.mjs` locally or provide test credentials |
| Book on team Worker redirects to login | Deploy separate `salon-citrine-book` Worker |
| Browser MCP tab loss | Re-run visual QA with locked browser session |

---

## Sprint commit grep

Poll sprint output anytime:

```bash
git log --oneline --grep="Sprint:"
```

Expected messages listed in roster table above.

---

*Sprint 1 kickoff — Scrum Master. Next: [SPRINT_1_RETRO.md](./SPRINT_1_RETRO.md) · [SPRINT_2_BRIEF.md](./SPRINT_2_BRIEF.md) · [SPRINT_WATCHER_NOTES.md](./SPRINT_WATCHER_NOTES.md)*
