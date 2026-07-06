# Sprint 1 Retro — 10-Minute Polish Pass

> **Sprint window:** July 6, 2026 (~1:02–1:15 AM ET)  
> **Retro author:** Scrum Master (agent 10)  
> **Handoff doc:** [SPRINT_1_HANDOFF.md](./SPRINT_1_HANDOFF.md)  
> **Watcher notes:** [SPRINT_WATCHER_NOTES.md](./SPRINT_WATCHER_NOTES.md)

---

## Sprint commits (`git log --grep="Sprint:"`)

Polled at retro close (July 6, 2026):

| Commit | Message | Agent |
|--------|---------|-------|
| `3e76ddd` | Sprint: polish team dashboard. | Dashboard ✅ |
| `67980a5` | Sprint: polish book calendar. | Book calendar ✅ |
| `19e3088` | Sprint: polish clients CRM. | Clients ✅ |
| `0dcf78d` | Sprint: polish stock inventory. | Stock ✅ |
| `a709fe7` | Sprint: polish tasks notebook. | Tasks ✅ |
| `2e2ee60` | Sprint: polish events calendar. | Events ✅ |
| `e4361c8` | Sprint: polish waitlist inbox. | Waitlist ✅ |
| `a6f30b7` | Sprint: polish guest booking flow. | Guest book ✅ |
| `7d0522b` | Sprint: watcher creative notes for handoff. | Watcher ✅ |
| — | Sprint: scrum handoff retro and sprint 2 brief. | Scrum Master ⏳ (this commit) |

**Status:** Sprint **complete** — 8/8 screen owners + watcher shipped. Scrum Master docs landing in this commit.

---

## Sprint status table

| # | Screen | Owner | Commit | Status |
|---|--------|-------|--------|--------|
| 1 | Dashboard | Screen owner | `3e76ddd` | ✅ Shipped |
| 2 | Book calendar | Screen owner | `67980a5` | ✅ Shipped |
| 3 | Clients CRM | Screen owner | `19e3088` | ✅ Shipped |
| 4 | Stock | Screen owner | `0dcf78d` | ✅ Shipped |
| 5 | Tasks | Screen owner | `a709fe7` | ✅ Shipped |
| 6 | Events | Screen owner | `2e2ee60` | ✅ Shipped |
| 7 | Waitlist | Screen owner | `e4361c8` | ✅ Shipped |
| 8 | Guest book | Screen owner | `a6f30b7` | ✅ Shipped |
| 9 | Watcher | Watcher | `7d0522b` | ✅ Shipped |
| 10 | Scrum Master | Scrum Master | ⏳ | Handoff docs in this commit |

---

## What shipped vs blocked

### Shipped (Sprint 1)

| Area | Commit | Highlights |
|------|--------|------------|
| Dashboard | `3e76ddd` | Team Pulse polish, upcoming list, quick actions |
| Book calendar | `67980a5` | Waitlist badge, appointment readability, modal polish |
| Clients | `19e3088` | Table zebra/hover, search feedback, profile polish |
| Stock | `0dcf78d` | Card hover, low-stock visibility, scan prominence |
| Tasks | `a709fe7` | Notebook typography, attention badge, empty states |
| Events | `2e2ee60` | Marker consistency, list sync, modal polish |
| Waitlist | `e4361c8` | Table polish, add flow, preferred-time chips |
| Guest book | `a6f30b7` | BookingSteps, embed mode, validation, confirm polish |
| Watcher | `7d0522b` | [SPRINT_WATCHER_NOTES.md](./SPRINT_WATCHER_NOTES.md) — Sprint 2 backlog |

### Blocked (post-sprint — Sprint 2 scope)

| Item | Blocker |
|------|---------|
| Production visual QA on 8 team routes | Staff login required ([VISUAL_QA_REPORT.md](./VISUAL_QA_REPORT.md)) |
| Guest book live audit | `salon-citrine-book` Worker not deployed; `/book/` on team Worker → login redirect |
| Waitlist row actions (Book/Edit/Remove) | Polish shipped; P0 actions deferred to Sprint 2 |
| Full deploy smoke | Redeploy both Workers after this sprint batch |

---

## Blockers (carry to Sprint 2)

1. **EPERM `dist/` on Windows** — Team builds must use `npm run build:alt --workspace apps/team`. Document in every screen-owner prompt.
2. **Auth for visual QA** — 8/9 team routes blocked without staff session. Drew: run `create-dev-admin.mjs` or provide test credentials; then "run visual QA."
3. **Book Worker deploy** — P1 from visual QA. Guest embed and Sprint 1 web book polish cannot be verified in production until `apps/web` deploys to `salon-citrine-book` Worker (`book.saloncitrineindy.com`).
4. **Browser MCP session** — Tab lost during initial audit; retry with `browser_lock` workflow per [AGENT_VISUAL_QA.md](./AGENT_VISUAL_QA.md).
5. **Parallel agent overlap** — Do not spawn multiple agents on frozen sidebar files ([TAKEOVER_NOTE.md](./TAKEOVER_NOTE.md)).

---

## Sprint 2 priority order

From watcher + UX feed + visual QA (highest first):

1. **Deploy book Worker + verify `embed=1`** on marketing site iframe
2. **Waitlist row actions** — Book / Edit / Remove (P0 UX feed #5)
3. **Remove "Coming soon" teases** — Merge Clients, export buttons, disabled filters
4. **Dashboard checkout link fix** — Sale/Checkout should not deep-link to calendar grid
5. **Clients list depth** — visit count + LTV columns; empty search hint
6. **Stock + Tasks** — complete Sprint 1 polish if still missing; then watcher features
7. **Recommended times** on guest slot picker (Precision Scheduling lite)
8. **Front desk status board** toggle on calendar (P1 UX feed #7)
9. **Visual QA full pass** after auth + deploy
10. **Formula vault teaser** on client profile (roadmap comms, not full schema)

Full mission: [SPRINT_2_BRIEF.md](./SPRINT_2_BRIEF.md).

---

## HANDOFF TO FRESH GROUP OF 10 — copy-paste prompts

Spawn **one agent per prompt**. All agents: repo `C:\Users\Drew\Projects\salon-citrine-platform`, read `DESIGN_SYSTEM.md`, `UX_INTELLIGENCE_FEED.md`, `SPRINT_WATCHER_NOTES.md`, `SPRINT_2_BRIEF.md`. **Do not touch frozen sidebar files** (see handoff). Commit pattern: `Sprint 2: …`

---

### Agent 1 — Dashboard (deeper)

```
Sprint 2 — Screen owner: Dashboard (`/team/`)

Repo: C:\Users\Drew\Projects\salon-citrine-platform

READ: SPRINT_2_BRIEF.md, SPRINT_WATCHER_NOTES.md § Dashboard, UX_INTELLIGENCE_FEED P1 #15.

DO NOT touch: TeamListLayout, team-list-sidebar.css, TeamSidebarNav, TeamSidebarFilter.

Mission (30–45 min):
- Fix "Sale / Checkout" quick action → deep-link to checkout/walk-in, NOT /book calendar
- Waitlist notification copy on pulse when count > 0 ("2 clients waiting for openings today")
- Booking link: copy-to-clipboard + toast (stylists share via text)
- Upcoming card: "In 25 min" relative urgency + live dot on first today appointment

Build: npm run build:alt --workspace apps/team
Commit: "Sprint 2: dashboard ops intelligence and checkout link fix."
Push master. Return commit hash.
```

---

### Agent 2 — Book calendar (deeper)

```
Sprint 2 — Screen owner: Book calendar (`/team/book`, DayCalendar)

Repo: C:\Users\Drew\Projects\salon-citrine-platform

READ: SPRINT_2_BRIEF.md, SPRINT_WATCHER_NOTES.md § Book, UX_INTELLIGENCE_FEED P1 #7.

DO NOT refactor sidebar frozen files.

Mission:
- Waitlist badge: today-relevant count only (not all-time active)
- Week picker: label "Week view" or tooltip if /week not shipped
- v1 Front Desk mode toggle: horizontal status columns (Expected → Arrived → In service → Done) for TODAY only — read-only OK if swipe not done

Build: build:alt. Commit: "Sprint 2: book calendar waitlist badge and front desk toggle."
Push master. Return commit hash.
```

---

### Agent 3 — Clients CRM (deeper)

```
Sprint 2 — Screen owner: Clients (`/team/clients`, profile)

Repo: C:\Users\Drew\Projects\salon-citrine-platform

READ: SPRINT_2_BRIEF.md, SPRINT_WATCHER_NOTES.md § Clients, UX_INTELLIGENCE_FEED Brief: Clients.

Mission:
- REMOVE or hide Merge Clients + disabled location filters (coming-soon teases)
- List table: add visit count + LTV (expose in list query/API)
- Empty search: "Try phone or email" hint
- Profile: Client memory panel — last visit, formula snippet, allergies, rebook cadence (collapsible)

Build: build:alt. Commit: "Sprint 2: clients CRM depth and anti-pattern cleanup."
Push master. Return commit hash.
```

---

### Agent 4 — Stock (deeper)

```
Sprint 2 — Screen owner: Stock (`/team/inventory`)

Repo: C:\Users\Drew\Projects\salon-citrine-platform

READ: SPRINT_2_BRIEF.md, SPRINT_WATCHER_NOTES.md § Stock. Finish Sprint 1 polish if missing.

Mission:
- Complete Sprint 1 DoD if not shipped: card hover, low-stock badge, mobile scan FAB
- Low-stock banner copy matches Team Pulse vocabulary
- Checkout-aware badge: when product below reorder, show "Only N left" pattern (stub OK if checkout not wired)

Build: build:alt. Commit: "Sprint 2: stock inventory polish and mobile scan."
Push master. Return commit hash.
```

---

### Agent 5 — Tasks (deeper)

```
Sprint 2 — Screen owner: Tasks (`/team/tasks`)

Repo: C:\Users\Drew\Projects\salon-citrine-platform

READ: SPRINT_2_BRIEF.md, SPRINT_WATCHER_NOTES.md § Tasks. Finish Sprint 1 DoD if missing.

Mission:
- Complete Sprint 1 notebook polish if not shipped
- Remove empty "coming soon" filter sections OR wire Due date filter
- Completed view: show completion timestamp + who claimed
- Needs attention badge: citrine pulse when count > 0

Build: build:alt. Commit: "Sprint 2: tasks notebook accountability polish."
Push master. Return commit hash.
```

---

### Agent 6 — Events (deeper)

```
Sprint 2 — Screen owner: Events (`/team/events`)

Repo: C:\Users\Drew\Projects\salon-citrine-platform

READ: SPRINT_2_BRIEF.md, SPRINT_WATCHER_NOTES.md § Events.

Mission:
- Event type colors → DESIGN_SYSTEM sage/citrine/rose tokens only
- Consolidate duplicate month nav (sidebar vs header)
- v1: when manager adds closure event, block bookable slots on web datetime for that date (API or availability filter)

Build: build:alt. Commit: "Sprint 2: events calendar consistency and closure sync."
Push master. Return commit hash.
```

---

### Agent 7 — Waitlist (deeper — P0)

```
Sprint 2 — Screen owner: Waitlist (`/team/waitlist`)

Repo: C:\Users\Drew\Projects\salon-citrine-platform

READ: SPRINT_2_BRIEF.md, UX_INTELLIGENCE_FEED P0 #5, SPRINT_WATCHER_NOTES.md § Waitlist.

Mission (P0):
- Row actions: Book / Edit / Remove — wire to existing APIs
- Preferred time column: Morning/Afternoon/Evening chips display
- Book action opens calendar with client + service pre-filled

Build: build:alt. Commit: "Sprint 2: waitlist row actions and preferred time chips."
Push master. Return commit hash.
```

---

### Agent 8 — Guest book (deeper)

```
Sprint 2 — Screen owner: Guest book (`apps/web`, `/book/*`)

Repo: C:\Users\Drew\Projects\salon-citrine-platform

READ: SPRINT_2_BRIEF.md, EMBED_BOOK.md, UX_INTELLIGENCE_FEED Brief: Book flow.

Mission:
- Card-on-file explanation before Stripe on waitlist/deposit ("not charged until service")
- Recommended times: 2–3 slots with "Recommended" sage badge before full list
- Verify embed=1 on ALL steps; document iframe test on saloncitrineindy.com
- Deploy prep: confirm build passes for salon-citrine-book Worker

Build: npm run build --workspace apps/web
Commit: "Sprint 2: guest book recommended times and card copy."
Push master. Return commit hash.
```

---

### Agent 9 — Watcher (Sprint 2)

```
Sprint 2 — Watcher / Creative strategist

Repo: C:\Users\Drew\Projects\salon-citrine-platform

READ: SPRINT_1_RETRO.md, VISUAL_QA_REPORT.md (after deploy), shipped Sprint 2 commits.

Mission:
- Update SPRINT_WATCHER_NOTES.md with post-Sprint-2 observations
- Flag any new anti-patterns from visual QA
- Propose 3 "Saturday-ready" acceptance criteria for Drew demo

Do NOT implement large features.
Commit: "Sprint 2: watcher post-deploy notes."
Push master.
```

---

### Agent 10 — Scrum Master (Sprint 2)

```
Sprint 2 — Scrum Master

Repo: C:\Users\Drew\Projects\salon-citrine-platform

Mission:
- Verify all Sprint 2 commits landed (grep "Sprint 2:")
- Update SPRINT_1_RETRO.md → add Sprint 2 section OR create SPRINT_2_RETRO.md
- Run build:alt + web build; document deploy checklist
- Coordinate Drew: deploy both Workers, run visual QA, provide test credentials

Commit: "Sprint 2: retro and deploy readiness."
Push master.
```

---

## Retrospective notes

**What worked:** Parallel screen ownership with frozen sidebar boundary prevented repeat of b02789d churn. Watcher delivered high-signal Sprint 2 backlog without code conflict.

**What didn't:** Book Worker deploy still undone — guest polish cannot be validated in prod until `salon-citrine-book` ships. Waitlist row actions and "Coming soon" teases remain (watcher anti-patterns).

**Action:** Drew redeploys **both** Workers, runs visual QA with staff auth, then spawns Sprint 2 group using retro copy-paste prompts.

---

*Updated at Sprint 1 close. Next mission: [SPRINT_2_BRIEF.md](./SPRINT_2_BRIEF.md)*
