# Mobile design system — Team app

Foundation layer for the mobile UX overhaul. Page agents should use these tokens and components instead of one-off styles.

## CSS imports

Loaded from `apps/team/src/styles/global.css`:

1. `@saloncitrine/theme/tokens.css` — brand palette
2. `mobile-tokens.css` — spacing, touch targets, semantic roles
3. `mobile-ui.css` — shared `.ui-*` classes

## Spacing (8px grid)

| Token | Value |
|-------|-------|
| `--mobile-space-xs` | 8px |
| `--mobile-space-sm` | 12px |
| `--mobile-space-md` | 16px |
| `--mobile-space-lg` | 24px |
| `--mobile-space-xl` | 32px |

## Touch targets

Minimum interactive size: `--touch-target-min` (44px).

## Semantic colors

| Role | Token | Usage |
|------|-------|-------|
| Primary action | `--color-action-primary` (gold) | One primary CTA per view |
| Selection | `--color-selection` / `--color-selection-bg` | Tabs, chips, active filters |
| Warning | `--color-warning` | Low stock, cautions |
| Error | `--color-error` | Destructive / failures |
| Success | `--color-success` | Confirmations |

**Rule:** Reserve gold for primary actions only. Filters, selections, and badges use sage/stone.

## Typography roles

| Role | Token |
|------|-------|
| Page title | `--ui-page-title-size` |
| Section title | `--ui-section-title-size` |
| Card title | `--ui-card-title-size` |
| Label | `--ui-label-size` |
| Data value | `--ui-data-value-size` |

## Capitalization

- **Sentence case** for buttons, tabs, and filter labels (`Add client`, not `ADD CLIENT`)
- Title case for nav items and page titles
- ALL CAPS only for tiny stat labels (existing `.team-stat-card__label` pattern)

## Astro components

Import from `apps/team/src/components/ui/`:

| Component | Use for |
|-----------|---------|
| `UiButton` | All buttons / button-styled links |
| `UiCard` | List cards, panels |
| `UiBadge` | Status, category, counts |
| `UiEmptyState` | Compact empty views |
| `UiWarningPanel` | Low stock, policy warnings |
| `UiFilterChip` | Active filter chips |
| `UiScrollRow` | Horizontal chip/tab rows with edge fade |

Example:

```astro
---
import UiButton from "../components/ui/UiButton.astro";
---
<UiButton variant="primary" href="/team/clients/new">Add client</UiButton>
```

## Layout guards

Global rules in `global.css`:

- `overflow-x: clip` on `html` / `body`
- `min-width: 0` on shell, list layouts, and common content wrappers
- Tables use container scroll at ≤640px, not page scroll

## Viewport QA

```bash
# Terminal 1
npm run dev --workspace apps/team

# Terminal 2
npm run qa:mobile-viewport --workspace apps/team
```

Optional authenticated run:

```bash
npx playwright codegen http://localhost:4322/team/login --save-storage=team-auth.json
TEAM_QA_STORAGE_STATE=team-auth.json npm run qa:mobile-viewport --workspace apps/team
```

Target widths: **320, 360, 390, 412, 430** px.

## Selected states

Use **multiple signals** (not color alone):

- Background tint (`--color-selection-bg`)
- Inset border (`box-shadow: inset 0 0 0 2px var(--color-selection-border)`)
- `aria-selected` / `aria-current="page"` where applicable
