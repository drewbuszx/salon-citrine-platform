# Mobile UX overhaul — 10-agent coordination

## Status board

| Agent | Branch | Fixes | Status |
|-------|--------|-------|--------|
| 1 Foundation | `mobile/foundation-design-system` | 1, 19–26 | ✅ In progress |
| 2 Appointment book | `mobile/appointment-book` | 2, 3, 43, 44 | Partial (scroll anchoring on master) |
| 3 Shell & nav | `mobile/shell-navigation` | 27–31 | ⬜ Not started |
| 4 Filters | merged via master | 6, 7, 42 | ✅ Done |
| 5 Clients | merged via master | 5, 33, 36 | ✅ Done |
| 6 Inventory | `mobile/inventory` | 4, 34, 35 | ⬜ Not started |
| 7 Tasks | `mobile/tasks` | 8, 9 | ⬜ Not started |
| 8 Docs & events | `mobile/docs-events` | 10–13, 47 | ⬜ Not started |
| 9 Reports & manage | partial on master | 14–18, 32, 37, 46 | Partial |
| 10 QA & a11y | `mobile/qa-a11y` | 38–41, 42–49 | ⬜ Not started |

## Shared contracts (Agent 1)

Published in `docs/MOBILE_DESIGN_SYSTEM.md`:

- `--mobile-space-*` tokens
- `.ui-btn--primary|secondary|destructive|ghost`
- `.ui-card`, `.ui-badge`, `.ui-segmented`, `.ui-filter-chip`
- `.ui-empty`, `.ui-warning-panel`, `.ui-scroll-row`, `.ui-fab`
- Playwright script: `apps/team/scripts/mobile-viewport-qa.mjs`

## Merge order

1. **Agent 1** (foundation) → merge first
2. **Agents 3, 4, 7** (parallel) — shell, filters, tasks
3. **Agents 2, 5, 6, 8, 9** (parallel) — page overhauls
4. **Agent 10** — QA pass on integration branch

Integration target: `mobile-ux-overhaul` (optional) or direct to `master`.

## Fix coverage map

| Fixes | Agent |
|-------|-------|
| 1, 19–26 | 1 |
| 2, 3, 43, 44 | 2 |
| 27–31 | 3 |
| 6, 7, 42 | 4 |
| 5, 33, 36 | 5 |
| 4, 34, 35 | 6 |
| 8, 9 | 7 |
| 10–13, 47 | 8 |
| 14–18, 32, 37, 46 | 9 |
| 38–41, 42, 44–45, 48–49 | 10 |

## Notes

- Page agents must import `Ui*` components or `.ui-*` classes — no new one-off button styles.
- Gold (`--color-action-primary`) is for primary CTAs only.
- Filter bottom sheet API: `TeamListLayout` + `list-filters.ts` (Agent 4).
