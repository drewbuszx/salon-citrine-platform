# Interface shell refinement — agent plan

Branch: `feat/contextual-page-shell`  
App: `apps/team` (Astro)  
Orchestrator: Agent 1 (Principal Product Designer & Frontend Architecture Lead)

## Goal

Remove the desktop full-width page-title band beneath global nav; replace with a contextual `PageContextHeader` inside each page's primary content pane. Standardize spacing, content widths, and sticky offsets without altering functionality or brand.

## Nine-role structure

| Role | Responsibility | File ownership |
|------|----------------|----------------|
| **1 — Lead** | Approve sprints, resolve conflicts, final visual sign-off | All shared files (serialized) |
| **2 — IA & naming** | Nav labels, contextual titles, subtitles, action labels | `lib/page-context.ts`, naming doc |
| **3 — Shared shell** | `PageContextHeader`, spacing tokens, layout shells, sticky safety | `components/PageContextHeader.astro`, `styles/shell-spacing.css`, `styles/page-context-header.css`, `TeamListLayout.astro`, `TeamManageLayout.astro`, `global.css` imports |
| **4 — Sidebar/workspace** | Sidebar alignment beneath nav, width/border/scroll | `styles/team-list-sidebar.css` (serialized with Agent 3) |
| **5 — Operational pages** | Tasks, Stock, Clients, Docs | Respective `pages/*.astro` only |
| **6 — Calendar/reporting/settings** | Events, Reports, Manage | Respective `pages/*.astro` only |
| **7 — Exceptions** | Dashboard, Book justified deviations | `pages/index.astro`, `pages/book.astro`, exceptions doc |
| **8 — Responsive & a11y** | Breakpoints, focus, heading levels, zoom | Cross-cutting CSS in shared + page scoped styles |
| **9 — Adversarial QA** | Reject incomplete work; regression gate per sprint | Review only |

## Shared vs restricted files

### Serialized (one editor at a time)

- `apps/team/src/components/TeamListLayout.astro`
- `apps/team/src/components/TeamManageLayout.astro`
- `apps/team/src/components/PageContextHeader.astro`
- `apps/team/src/styles/team-list-sidebar.css`
- `apps/team/src/styles/global.css` (import lines only)
- `apps/team/src/styles/shell-spacing.css`
- `apps/team/src/styles/page-context-header.css`

### Page-owned (parallel after Sprint 2)

| Page | Owner role | Primary file |
|------|------------|--------------|
| Tasks | 5 | `pages/tasks.astro` |
| Stock | 5 | `pages/inventory.astro` |
| Clients | 5 | `pages/clients/index.astro` |
| Docs | 5 | `pages/docs.astro` |
| Events | 6 | `pages/events.astro` |
| Reports | 6 | `pages/reports.astro` + `scripts/reports.ts` (sticky offset) |
| Manage hub | 6 | `pages/manage/index.astro` |
| Dashboard | 7 | `pages/index.astro` |
| Book | 7 | `pages/book.astro` |

Out of scope: Shopify, login/auth flows, client profile detail (`clients/[id].astro` keeps section title pattern), checkout, waitlist.

## Sprint sequence

| Sprint | Work | Gate |
|--------|------|------|
| **0** | Audit + architecture docs | Agent 1 + 9 approve audit |
| **1** | `PageContextHeader`, spacing/container tokens | Independent component review |
| **2** | Shell refactor: remove desktop band, headers in main pane, sidebar beneath nav | All sidebar pages smoke-tested |
| **3** | Tasks / Stock / Clients / Docs | Agent 9 regression |
| **4** | Events / Reports / Manage | Agent 9 regression; sticky offsets verified |
| **5** | Dashboard / Book exceptions | Documented in `02-special-layout-exceptions.md` |
| **6** | Responsive + a11y pass (320–ultrawide, 200% zoom) | Agent 8 checklist |
| **7** | Final adversarial QA | No ship blockers |

## Dependencies

```
Sprint 0 ──► Sprint 1 ──► Sprint 2 ──┬──► Sprint 3 (parallel pages)
                                      ├──► Sprint 4 (parallel pages)
                                      └──► Sprint 5 (after 2)
Sprint 3–5 ──► Sprint 6 ──► Sprint 7
```

Sprint 3 and 4 page work may run in parallel **only** after Sprint 2 lands and must not touch shared layout files.

## Conflict prevention

1. Pull latest `master` before branching; re-pull if Clients row-menu fix lands during work.
2. One agent edits shared shell files at a time.
3. Page agents use `contextTitle` / `contextSubtitle` props — do not fork layout markup.
4. Sticky `top` values use `--team-bar-height` only (subheader removed on desktop).
5. Reports scrollspy uses dynamic `stickyOffset()` — no hardcoded subheader height.

## Review gates

- **Sprint 0:** Audit complete, ownership clear, no implementation.
- **Sprint 1:** Component renders all variants; build passes; no page adoption yet.
- **Sprint 2:** Desktop band gone on list/manage layouts; sidebars start under nav; no global nav regression.
- **Sprints 3–4:** Per-page acceptance from brief; duplicate headings removed.
- **Sprint 7:** Agent 9 rejects any page with redundant title strip, detached primary action, or broken sticky.

## Rollback strategy

Each sprint is a discrete commit on `feat/contextual-page-shell`. Roll back by reverting the sprint commit hash. Shared shell changes in Sprint 2 are the highest-risk revert — keep Sprint 1 component isolated so Sprint 2 can be reverted without losing the component.

## Build & deploy

```bash
npm run build:alt --workspace apps/team
```

No `wrangler deploy` from this project. Ship = committed branch only.
