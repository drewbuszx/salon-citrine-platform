# Sprint 0 — Shell audit

Date: 2026-07-07  
Branch: `feat/contextual-page-shell`

## Executive summary

Every standard sidebar page uses `TeamListLayout` or `TeamManageLayout` with a **full-width `__subheader` band** spanning sidebar + main. The band repeats the short nav label ("Tasks", "Stock", "Clients") and hosts the primary action far from content. This wastes ~52px+ vertical space and creates duplicate heading hierarchy when combined with `mainTitle` / `mainLead` / page-specific h2s.

**Proposed fix:** Remove desktop subheader band; insert `PageContextHeader` at top of main pane only; align sidebars directly beneath fixed global nav (`--team-bar-height: 3.25rem`).

## Title-strip inventory

| Component | Location | Spans | Desktop action |
|-----------|----------|-------|----------------|
| `team-list-layout__subheader` | `TeamListLayout.astro` | Full layout width | `headerActions` slot |
| `team-manage-layout__subheader` | `TeamManageLayout.astro` | Full layout width | `headerActions` slot |
| `team-page-header` | `global.css` | Legacy content pages | Rarely used |
| `dashboard__hero` | `index.astro` | Dashboard only | N/A (exception) |
| Day calendar toolbar | `DayCalendar.astro` | Book | Context (exception) |

## Page inventory

| Page | Layout | Subheader title | Duplicate headings | Primary action today | Sticky deps |
|------|--------|-----------------|-------------------|---------------------|-------------|
| Tasks | TeamListLayout | Tasks | mainLead duplicates subtitle | headerActions ✓ | — |
| Stock | TeamListLayout | Stock | mainTitle "Your Products" OK as section | headerActions ✓ | sidebar `top: --team-bar-height` |
| Clients | TeamListLayout | Clients | mainTitle hidden; toolbar h2 duplicates | toolbar (wrong) | sidebar sticky |
| Docs | TeamListLayout | Docs | mainTitle + mainLead duplicate | headerActions (label "Upload") | — |
| Events | TeamListLayout | Events | mainTitle "Team calendar" | headerActions ✓ | calendar `__sticky` at bar height |
| Reports | TeamListLayout | Reports | mainTitle + mainLead | none in header | sidebar sticky; scrollspy `stickyOffset()` |
| Manage hub | TeamManageLayout | Manage | — | none | — |
| Dashboard | TeamLayout cream | none | hero = identity | — | **exception** |
| Book | TeamLayout fullBleed | none | calendar toolbar | — | **exception** |

## White-space audit (classification)

| Area | Page | Classification | Action |
|------|------|----------------|--------|
| Full-width subheader | All list pages | Duplicate heading / oversized margin | Remove on desktop |
| `min-height: calc(100vh - bar)` | list layouts | Necessary empty state reserve | Keep |
| Tasks mainLead | Tasks | Duplicate description | Merge to subtitle |
| Clients toolbar h2 | Clients | Duplicate heading | Rename to "Client list" |
| Reports mainLead | Reports | Duplicate subtitle | Merge to context header |
| Events mainLead | Events | Duplicate subtitle | Merge to context header |
| Gap before summary cards | Clients | Oversized margin | Tighten via shell tokens |
| Gap before routines/cards | Tasks | Oversized margin | Tighten header→content gap |
| Reports nav stretch | Reports | Fixed in prior work | Verify after shell change |
| Inventory margin before products | Stock | Toolbar gap | Tighten |

## Content widths

| Type | Current | Target |
|------|---------|--------|
| Operational | Per-page max-width (clients 92rem) | Shared `--shell-content-max-operational` + page class |
| Reading | Ad hoc | `--shell-content-max-reading: 48rem` |
| Dashboard | Centered grid | Keep balanced grid |

## Sticky offset audit

All sticky elements use `top: var(--team-bar-height, 3.25rem)` — correct **after** subheader removal. No addition needed for removed band.

| Element | File | Current top | Post-change |
|---------|------|-------------|-------------|
| Stock sidebar | team-list-sidebar.css | bar height | unchanged ✓ |
| Reports sidebar | team-list-sidebar.css | bar height | unchanged ✓ |
| Events calendar sticky | events.astro | bar height | unchanged ✓ |
| Clients sidebar | clients/index.astro | bar height | unchanged ✓ |
| Reports scroll-margin | reports.astro | bar + 7rem | Reduce to bar + toolbar (~5rem) |
| Reports stickyOffset() | reports.ts | bar + toolbar + 12px | Dynamic ✓ |

## Shared vs page CSS

- **Shared:** `team-list-sidebar.css`, `TeamListLayout.astro`, `TeamManageLayout.astro`, `global.css`, new shell CSS
- **Page-scoped:** `tasks.astro`, `clients/index.astro`, `events.astro`, `reports.astro` style blocks — subheader overrides to delete after Sprint 2

## Proposed structure (desktop)

```
team-shell
├── TeamSiteHeader (fixed, z-100)
└── team-main--full-bleed
    └── team-list-layout
        └── team-list-layout__body (grid: sidebar | main)
            ├── aside.team-list-layout__sidebar  ← starts immediately below nav
            └── main.team-list-layout__main
                ├── PageContextHeader (title, subtitle, primary action)
                ├── toolbar / filters
                └── content
```

## Approval

- [x] Agent 1 — architecture approved
- [x] Agent 9 — audit complete; proceed to Sprint 1
