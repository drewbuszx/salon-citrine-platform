# Mobile UX overhaul — 10-agent coordination



## Status board



| Agent | Branch | Fixes | Status |

|-------|--------|-------|--------|

| 1 Foundation | merged to master | 1, 19–26 | ✅ Done |

| 2 Appointment book | `mobile/appointment-book` | 2, 3, 43, 44 | ✅ Done (scroll + mobile column) |

| 3 Shell & nav | `mobile/shell-navigation` | 27–31 | ✅ Done |

| 4 Filters | merged via master | 6, 7, 42 | ✅ Done |

| 5 Clients | merged via master | 5, 33, 36 | ✅ Done |

| 6 Inventory | merged to master | 4, 34, 35 | ✅ Done |

| 7 Tasks | merged to master | 8, 9 | ✅ Done |

| 8 Docs & events | merged to master | 10–13, 47 | ✅ Done |

| 9 Reports & manage | merged to master | 14–18, 32, 37, 46 | ✅ Done |

| 10 QA & a11y | `mobile/qa-a11y` | 38–41, 42–49 | ✅ Done |



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



## Agent 10 — QA scripts & utilities



Run against a local dev server (`astro dev --background`) or deployed URL:



```bash

# Viewport overflow (320–430px) + 200% zoom at 390px

npm run qa:mobile-viewport --workspace apps/team



# Icon button labels, skip link, input labels

npm run qa:mobile-a11y --workspace apps/team



# Both

npm run qa:mobile --workspace apps/team



# Calendar 15-min grid unit tests

npm run test:calendar-grid --workspace apps/team

```



Authenticated routes: `TEAM_QA_STORAGE_STATE=team-auth.json` after `npx playwright codegen … --save-storage=team-auth.json`.



Shared libs: `lib/ui-states.ts`, `lib/submit-guard.ts`, `lib/focus-trap.ts`, `lib/network-status.ts`.



## Notes



- Page agents must import `Ui*` components or `.ui-*` classes — no new one-off button styles.

- Gold (`--color-action-primary`) is for primary CTAs only.

- Filter bottom sheet API: `TeamListLayout` + `list-filters.ts` (Agent 4).

