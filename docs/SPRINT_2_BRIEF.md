# Sprint 2 Brief — Ops Intelligence + Visual QA Fixes

> **For:** Fresh group of 10 agents (8 screen owners + watcher + scrum master)  
> **Date:** July 6, 2026  
> **Prerequisites:** Sprint 1 polish commits landed; read [SPRINT_1_RETRO.md](./SPRINT_1_RETRO.md) and [SPRINT_WATCHER_NOTES.md](./SPRINT_WATCHER_NOTES.md)

---

## Mission statement

Sprint 1 was **surface polish** (citrine tokens, empty states, typography). Sprint 2 is **ops intelligence + credibility** — turn demo-able UI into Saturday-ready tools stylists trust.

**Ship features that reduce front-desk phone time**, not report-library breadth. Fix visual QA blockers. Deploy guest book Worker.

---

## Sprint 2 goals (ranked)

| Priority | Goal | Primary owner | Source |
|----------|------|---------------|--------|
| **P0** | Deploy `salon-citrine-book` Worker; verify `book.saloncitrineindy.com` + `?embed=1` | Guest book + Drew | VISUAL_QA_REPORT P1 |
| **P0** | Waitlist row actions: Book / Edit / Remove | Waitlist | UX_INTELLIGENCE_FEED P0 #5 |
| **P0** | Remove "Coming soon" teases (merge, export, dead filters) | Clients | Watcher anti-pattern #1 |
| **P1** | Dashboard checkout link → real checkout path, not calendar | Dashboard | Watcher anti-pattern #3 |
| **P1** | Clients list: visit count + LTV; empty search hint | Clients | UX feed Brief: Clients |
| **P1** | Guest book: card-hold copy + Recommended times on slot picker | Guest book | UX feed P0 #1, P1 #8 |
| **P1** | Complete Sprint 1 gaps: Stock + Tasks polish | Stock, Tasks | SPRINT_1_RETRO |
| **P2** | Front desk status board toggle on calendar | Book | UX feed P1 #7 |
| **P2** | Formula vault teaser panel on client profile | Clients | Watcher bold idea |
| **P2** | Full visual QA pass with staff auth | Watcher + Drew | AGENT_VISUAL_QA |

---

## Non-goals (do not build in Sprint 2)

- Marketing campaigns, payroll, full report library
- Native iOS/Android apps
- Gift cards, memberships, BNPL
- Sidebar architecture changes
- New competitor research docs
- Purple or SaaS blue accents

---

## Per-screen Sprint 2 deliverables

Summaries — full copy-paste agent prompts live in [SPRINT_1_RETRO.md § HANDOFF](./SPRINT_1_RETRO.md#handoff-to-fresh-group-of-10--copy-paste-prompts).

### Dashboard
Fix checkout quick action. Waitlist alert copy on pulse. Copy-to-clipboard booking link. Relative "In 25 min" on upcoming cards.

### Book calendar
Today-scoped waitlist badge. Front desk status board toggle (v1 columns OK). Week view expectation managed.

### Clients
Hide fake controls. LTV + visit count in list. Client memory panel on profile. Empty search hint.

### Stock
Finish Sprint 1 card/scan polish. Mobile scan FAB. Align low-stock copy with pulse. Optional checkout stock badge.

### Tasks
Finish Sprint 1 notebook polish. Completed timestamp + claimer. Real filters or remove placeholders. Attention badge citrine pulse.

### Events
Token-aligned event colors. Closure → booking block sync (v1). Nav deduplication.

### Waitlist (**highest product value**)
Row actions wired. Preferred time chips in table. Book pre-fills calendar.

### Guest book
Card transparency copy. Recommended slots. Embed verified on all steps. **Deploy Worker.**

---

## Watcher focus (Sprint 2)

1. Re-read [VISUAL_QA_REPORT.md](./VISUAL_QA_REPORT.md) after deploy — append session with authenticated routes
2. Validate watcher anti-patterns #1–#5 are resolved or explicitly deferred
3. Update [SPRINT_WATCHER_NOTES.md](./SPRINT_WATCHER_NOTES.md) with post-deploy section
4. Propose 3 Drew demo acceptance criteria ("Saturday-ready")

---

## Definition of done (Sprint 2)

- [ ] All 8 screen owners committed `Sprint 2: …` messages
- [ ] `npm run build:alt --workspace apps/team` green
- [ ] `npm run build --workspace apps/web` green
- [ ] Book Worker deployed to `book.saloncitrineindy.com`
- [ ] Team Worker redeployed with latest `master`
- [ ] Visual QA: no P0/P1 on demo paths (with auth)
- [ ] Waitlist Book/Edit/Remove functional in staging/prod
- [ ] No "Coming soon" toasts on primary list pages
- [ ] Retro updated by Scrum Master

---

## Build / deploy (mandatory)

```bash
# Local verification
npm run build:alt --workspace apps/team
npm run build --workspace apps/web
```

**Deploy order:**
1. Push all Sprint 2 commits to `master`
2. Workers Builds auto-deploy team Worker
3. Manually verify book Worker build (`apps/web`) — see [CLOUDFLARE_DEPLOY.md](./CLOUDFLARE_DEPLOY.md)
4. Smoke test [BOOKING_SHIP_CHECKLIST.md](./BOOKING_SHIP_CHECKLIST.md)
5. Run visual QA — [AGENT_VISUAL_QA.md](./AGENT_VISUAL_QA.md)

**Blockers to escalate to Drew:**
- Staff test credentials for visual QA
- Cloudflare secrets (`STRIPE_SECRET_KEY`, Supabase keys) on both Workers
- Marketing site iframe embed test on saloncitrineindy.com

---

## Success metrics (Drew demo)

1. Guest completes book flow on `book.saloncitrineindy.com` (or embed iframe) without auth bleed
2. Front desk opens waitlist → taps Book on a row → lands in calendar with client pre-filled
3. Dashboard pulse reflects live counts; checkout action does not dump user on calendar grid
4. Clients search empty state guides; list shows visit depth
5. Visual QA checklist: citrine nav, 12px sidebar chevrons, no purple — all authenticated list pages

---

## Related docs

| Doc | Use |
|-----|-----|
| [SPRINT_1_HANDOFF.md](./SPRINT_1_HANDOFF.md) | Sprint 1 roster + frozen files |
| [SPRINT_1_RETRO.md](./SPRINT_1_RETRO.md) | Sprint 1 status + Sprint 2 agent prompts |
| [SPRINT_WATCHER_NOTES.md](./SPRINT_WATCHER_NOTES.md) | Creative backlog + anti-patterns |
| [UX_INTELLIGENCE_FEED.md](./UX_INTELLIGENCE_FEED.md) | P0/P1 tips per page |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Citrine tokens — law |
| [TAKEOVER_NOTE.md](./TAKEOVER_NOTE.md) | What Drew should stop doing |

---

*Sprint 2 mission brief — Scrum Master. Spawn agents using retro copy-paste prompts.*
