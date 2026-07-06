# Visual QA Checklist

Quick checkbox list for the Visual QA Agent. Run after UI changes or before demos.

**Live team base:** `https://salon-citrine-platform.dbuszx.workers.dev`  
**Instructions:** [AGENT_VISUAL_QA.md](./AGENT_VISUAL_QA.md) · **Report:** [VISUAL_QA_REPORT.md](./VISUAL_QA_REPORT.md)

---

## Global (every authenticated team page)

- [ ] Top bar stone-800 (`--color-stone-800`), not pure black
- [ ] Active nav tab: citrine text + muted bg + 2px citrine bottom inset
- [ ] DM Sans body text, min 13px on interactive UI
- [ ] No purple (`#7c3aed`) or SaaS blue (`#0096ff`) accents
- [ ] Skip link works (Tab → Skip to main content)
- [ ] Focus ring citrine (`--color-focus-ring`)
- [ ] Mobile ≤1100px: layout usable, no horizontal scroll on main content

---

## Route checklist

| Route | Audited | Sidebar | Table / grid | Nav active | Mobile | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/team/login` | ☐ | N/A | Form | N/A | ☐ | Public; no nav tabs |
| `/team/` | ☐ | N/A | Calendar grid | Book or Home | ☐ | Pulse strip, day view |
| `/team/book` | ☐ | N/A | Calendar | Book | ☐ | |
| `/team/clients` | ☐ | ☐ Filters 12px chevron | ☐ Data table | Clients | ☐ | `(N)` counts, search bar |
| `/team/inventory` | ☐ | ☐ Filters | ☐ Stock list/cards | Stock | ☐ | Low-stock banner |
| `/team/tasks` | ☐ | ☐ Nav buttons | ☐ Task list | Tasks | ☐ | Attention badge |
| `/team/events` | ☐ | ☐ Filters + month | ☐ Calendar | Events | ☐ | |
| `/team/waitlist` | ☐ | Hidden | ☐ Waitlist table | Waitlist | ☐ | Empty state + actions |
| `/team/manage` | ☐ | ☐ Link nav (reference) | ☐ Section content | Manage | ☐ | Reference sidebar chrome |

---

## Sidebar verification (TeamListLayout pages)

Apply to: Clients, Inventory, Tasks, Events, Docs, Reports (not Waitlist, not Manage).

- [ ] Background stone-50 (`--team-sidebar-bg`)
- [ ] Active item: 3px citrine left border + muted bg
- [ ] Chevrons **12px × 12px**, rotate when `<details open>`
- [ ] No oversized SVG icons (search, chevron)
- [ ] Filter labels spaced from counts: `Category (7)` not `Category7`
- [ ] Sidebar width aligned with main column grid

---

## Guest book (`/book/` — separate Worker)

- [ ] Cream gradient background (`--color-cream`)
- [ ] Cormorant display headlines on hero/step titles
- [ ] BookingSteps progress (sage completed checks)
- [ ] Primary CTA citrine, one accent per region
- [ ] Embed mode `?embed=1` minimal chrome (if deployed)
- [ ] Mobile: step flow readable, inputs full width

---

## Severity quick reference

| Level | Log when |
| --- | --- |
| **P0** | Broken layout, missing controls, unusable page |
| **P1** | Off-brand colors, giant icons, wrong active states |
| **P2** | Spacing, copy tone, minor hover inconsistencies |

---

## Session log (fill per run)

| Date | Auditor | Routes passed | P0 | P1 | P2 | Report updated |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-07-06 | Visual QA Agent | login only | 0 | 1 | 0 | ✅ |
