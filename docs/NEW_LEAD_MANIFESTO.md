# New Lead Manifesto — Jul 6, 2026

**Owner:** Platform lead (this run)  
**Audience:** Drew, stylists, anyone shipping UI after this

---

## What the old approach got wrong

1. **Parallel agents on the same surface.** Three sidebar “fixes” in 48 hours. Docs multiplied; deploy quality didn’t.
2. **Boulevard cosplay without a spine.** Competitor gap spreadsheets while login still felt like a template and waitlist was read-only.
3. **Two accent systems.** Purple manage nav + citrine lists = two products stitched together.
4. **Tease buttons.** “Coming soon” on export, merge, and dead filters erodes trust faster than missing features.
5. **Redeploy theater.** Push Workers without `build:alt` / book build = regressions shipped as progress.

---

## What impressing a salon owner actually means

Not a vision deck. Not “we have parity with Boulevard on paper.”

**Show don't tell:**

- Sign in → dashboard feels like *their* salon (photo, pulse, today’s book), not a SaaS trial.
- Clients list feels like $300/mo software — search responds instantly, rows breathe, CRM depth visible.
- Waitlist → Book in two taps, not a phone tree.
- Guest booking embeds on saloncitrineindy.com without leaving the brand.

If a stylist wouldn’t demo it to a friend on Saturday, it’s not done.

---

## Non-negotiables (enforce ruthlessly)

| Rule | Why |
|------|-----|
| **Citrine only** — no `#7c3aed`, no `#0096ff` | One product, one accent ([DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)) |
| **No “Coming soon” on user-facing buttons** | Ship, hide, or cut |
| **Build before push** | `npm run build:alt --workspace apps/team` + `npm run build --workspace apps/web` |
| **Sidebar architecture frozen** | `team-list-sidebar.css` / `TeamListLayout` — tokens only unless production breaks |
| **One doc hierarchy** | DESIGN_SYSTEM (visual) · VISION (product) · BOULEVARD_FEATURE_GAP (reference only) |

---

## 72-hour plan

### Day 1 — First impression (this run)

- [x] Split login + editorial brand panel
- [x] Dashboard: Team Pulse live, checkout deep-link, copy booking link
- [x] Clients: visits + LTV columns, instant search feedback
- [x] Waitlist: Book / Remove row actions wired
- [x] Kill coming-soon teases; fix checkout link
- [x] `DEPLOY_NOW.md` with exact Worker steps

### Day 2 — Guest + ops

- Deploy **book Worker** (`salon-citrine-book`) — embed on marketing site
- Calendar: clickable gap-fill → pre-filled new appointment
- Remove dead sidebar filter sections (not placeholder copy)
- CSV export on Clients **or** remove export affordance everywhere

### Day 3 — Demo-ready

- Browser QA on login, dashboard, clients, waitlist, `/book?embed=1`
- Stylist micro-link copy-to-clipboard on dashboard (done this run)
- Front desk status board spike — link from pulse, don’t duplicate calendar

---

## What we are NOT doing this week

- Marketing campaigns, payroll, report library
- New competitor research docs
- Sidebar refactors for aesthetics
- Spawning 10 agents on the same page

---

## Success = founder opens these after redeploy

1. `/team/login` — split layout, citrine CTA  
2. `/team/` — Team Pulse + upcoming with urgency  
3. `/team/clients` — search + LTV/visits  
4. `/team/waitlist` — Book / Remove on rows  
5. `book.saloncitrineindy.com/book?embed=1` — after book Worker deploy

---

*One coherent visual language. Features that work. Portfolio-grade where it counts.*
