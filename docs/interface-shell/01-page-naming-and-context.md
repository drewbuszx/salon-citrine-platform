# Page naming and context system

Agent 2 — Information architecture audit. Nav labels stay concise; contextual headings are descriptive; primary actions use sentence case.

## Nav → contextual heading → subtitle

| Nav (global) | Contextual heading (`contextTitle`) | Subtitle (`contextSubtitle`) | Primary action |
|--------------|-------------------------------------|------------------------------|----------------|
| Dashboard | *(hero suffices — see exceptions)* | Today's appointments, team activity, and salon alerts. | — |
| Book | *(toolbar supplies context — see exceptions)* | Manage appointments, availability, blocks, and waitlist activity. | — |
| Tasks | Team Tasks & Checklists | Assign work, claim open tasks, and track salon checklists. | Create task |
| Stock | Inventory Tracker | Monitor salon products, stock levels, and reorder needs. | Add product |
| Clients | Client Directory | Search client profiles, appointment history, preferences, and contact details. | Add client |
| Docs | Documents & Resources | Store policies, training materials, forms, and salon references. | Upload document |
| Events | Team Calendar & Events | Track birthdays, time off, closures, meetings, and salon announcements. | Add event |
| Reports | Business Reports & Insights | Review appointments, revenue, client activity, and inventory trends. | Export (per active report) |
| Manage | Business Settings | Manage services, products, employees, policies, tags, and salon details. | — |

Constants live in `apps/team/src/lib/page-context.ts`.

## Section headings (demoted, not duplicate page titles)

| Page | Former duplicate | New section label |
|------|------------------|-------------------|
| Stock | — | Your Products (h2, section) |
| Clients | Your Clients (×2) | Client list (toolbar h2 with count) |
| Docs | Your documents | *(hidden — list follows filters)* |
| Events | Team calendar | *(removed — calendar is self-explanatory)* |
| Reports | Business summaries | Overview |
| Tasks | mainLead paragraph | *(merged into subtitle)* |

## Primary action labels (sentence case)

| Context | Label | Notes |
|---------|-------|-------|
| Tasks | Create task | Secondary: Create checklist, Browse open tasks (toolbar) |
| Stock | Add product | Stays in header, not inventory toolbar |
| Clients | Add client | Moved from toolbar to header |
| Docs | Upload document | Was "Upload" |
| Events | Add event | Non-managers: Request time off |
| Reports | Export | Shown when active report supports export |
| Manage | — | Hub uses row actions; sub-pages use ← Manage back link |

Uppercase reserved for eyebrows/metadata only (e.g. sidebar "SECTIONS", "VIEWS").

## `PageContextHeader` API

```astro
<PageContextHeader
  title="Team Tasks & Checklists"
  subtitle="Assign work, claim open tasks, and track salon checklists."
  eyebrow={optional}
  density="standard" | "compact"
  headingLevel={1}
  status={optional count string}
>
  <Fragment slot="primaryAction">...</Fragment>
  <Fragment slot="secondaryActions">...</Fragment>
  <Fragment slot="breadcrumbs">...</Fragment>
</PageContextHeader>
```

Integrated via `TeamListLayout` / `TeamManageLayout` props: `contextTitle`, `contextSubtitle`, `contextEyebrow`, `contextDensity`, plus existing `headerActions` slot mapped to primary action.

## Content width variants

| Variant | Token | Pages |
|---------|-------|-------|
| Operational (full) | `--shell-content-max-operational` (none) | Book, Stock, Clients, Events, Reports, Tasks |
| Reading | `--shell-content-max-reading` (48rem) | Docs body, Manage forms, policy pages |
| Balanced grid | dashboard max-width rules | Dashboard |

## Spacing tokens

Defined in `apps/team/src/styles/shell-spacing.css`:

- `--shell-gap-below-nav` — layout top (0; nav is fixed)
- `--shell-header-gap` — title row internal gap
- `--shell-header-subtitle-gap` — title → subtitle
- `--shell-header-toolbar-gap` — header → toolbar
- `--shell-toolbar-content-gap` — toolbar → content
- `--shell-section-gap` — between major sections
- `--shell-main-padding-*` — main pane insets
