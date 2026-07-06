# Team app sidebar architecture

## Problem

Left sidebar was broken on every list page except **Manage**: giant chevron/search SVGs, smashed filter labels (`Category7`), inconsistent mix of nav links vs checkbox filters, and Manage-quality chrome missing everywhere else.

## Root cause (verified)

1. **Astro scoped CSS leak** — `TeamListLayout.astro` used scoped `<style>` blocks. Slotted content (`sidebarFilters`, `searchBar`) renders as child DOM nodes, so scoped attribute selectors never matched. Sidebar SVGs, chevrons, and search icons inherited unconstrained dimensions.
2. **No shared sidebar primitives** — filter pages and nav pages reused one markup pattern with different semantics.
3. **Count formatting** — `label` + `count` concatenated in templates without spacing.

## Decision: **Option B** — `TeamSidebarNav` + `TeamSidebarFilter` sharing CSS tokens

| Component | Use on |
|-----------|--------|
| `TeamSidebarNav.astro` | Tasks, Docs, Account, client detail, my-book — Manage-style vertical links |
| `TeamSidebarFilter.astro` | Clients, Stock, Events — Boulevard `<details>` collapsible filters |
| `TeamListFilter.astro` | Thin re-export of `TeamSidebarFilter` for backwards compatibility |
| `team-list-sidebar.css` | Global sidebar chrome (imported from `global.css`) matching Manage tokens |

`TeamListLayout.astro` stays the page shell (header, grid, slots). Manage (`TeamManageLayout.astro`) is **unchanged** — it remains the visual reference.

## Alternatives rejected

- **A. Single `TeamSidebar` with `mode` prop** — Would work, but nav vs filter markup differs enough that a unified component risks prop/slot explosion and harder page readability.
- **C. Migrate all pages to `TeamManageLayout`** — Manage sidebar is link-only; Clients/Stock need collapsible filter sections. Wrong fit.
- **D. CSS-only fix on `TeamListFilter`** — Fixes giant SVGs but not the Tasks-as-checkboxes pattern mismatch or long-term maintainability.
- **E. Radix/shoelace `<details>`** — Native `<details>` is accessible, zero dependency, and matches Boulevard. No new package.

## Ship criteria met

- Manage unchanged
- Tasks: nav links + breach badge, Manage styling
- Clients/Stock: collapsible filters, 12px chevrons, `(N)` counts
- Events/Docs/Reports: appropriate sidebar, same chrome
- All sidebar/search SVGs have explicit `width`/`height` + CSS constraints
- Polish: dashboard stats row, waitlist empty state, book waitlist badge, client row hover, stock card hover
