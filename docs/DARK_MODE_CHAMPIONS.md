# Dark Mode Champions

Parallel audit pass for team app dark mode (`[data-theme="dark"]`).

---

## Champion 1 — Header & Shell

**Agent:** Dark Mode Champion 1 of 3  
**Date:** 2026-07-07  
**Scope:** `TeamSiteHeader.astro`, `TeamLayout.astro`, `packages/theme/tokens.css`, `apps/team/src/styles/global.css`

### Root cause

Dark theme inverts stone neutrals (`--color-stone-800` → `#f3f0ea`) for readable text on dark page surfaces. The team top bar used `--team-bar-bg: var(--color-stone-800)`, so in dark mode the banner flipped to light cream while nav tabs kept hard-coded white text — unreadable. Profile/utility controls inherited the same mismatch.

### Theme mechanism

`TeamLayout.astro` sets `document.documentElement[data-theme]` from `localStorage.theme` (`"light"` | `"dark"`, default `"light"`). Toggle buttons use `[data-theme-toggle]` in the profile menu and mobile drawer. No `prefers-color-scheme` auto-switch on the team app.

### Fixes applied

1. **`packages/theme/tokens.css`** — Decoupled team bar from inverted stone tokens with explicit `--team-bar-*` tokens in `:root` and `[data-theme="dark"]` (`--team-bar-bg: #1a1a1a` in dark mode).
2. **`apps/team/src/components/TeamSiteHeader.astro`** — Nav tabs, utilities, profile button, and mobile menu consume `--team-bar-tab`, `--team-bar-tab-hover`, `--team-bar-tab-active-bg`, etc. Active nav pill: citrine text + inset bottom border on dark bar.
3. **Logo swap** — Light theme: `salon-citrine-primary-white.png`; dark theme: `assets/salon-citrine-logo-horiz-dark.png` (Horiz.png).
4. **`apps/team/src/styles/global.css`** — Dark-mode body/editorial shell gradients use dark cream tokens (`#141414` / `#1c1c1c`).

### Verify

Toggle dark mode on Dashboard, Tasks, Reports, Clients — top bar stays dark; nav labels readable; active tab citrine; avatar/menu controls visible; logo switches to Horiz. Light mode unchanged.

---

## Champion 2 — Tasks Page

**Scope:** `apps/team/src/pages/tasks.astro` (tasks-specific CSS only)

**Problem:** In dark mode the page shell is dark but the notebook paper stays a warm cream island. Global `[data-theme="dark"]` stone tokens invert to light values, so task titles (display serif), descriptions, meta lines, badges, and action buttons rendered pale gold / light gray on cream — nearly unreadable.

**Fix:**

- Introduced a scoped **paper palette** on `.tasks-page` in dark mode: dimmed warm cream paper (`#e8e0d2`) plus dark ink tokens (`--notebook-ink`, `--notebook-ink-muted`, `--notebook-ink-faint`).
- Overrode notebook typography (titles, descriptions, meta, empty/loading states) to use dark ink on paper.
- Re-tuned badges (AVAILABLE, HIGH, Overdue, due chips) and buttons (CLAIM, EDIT, CANCEL) with light-surface colors so they stay readable on cream.
- Light mode notebook look unchanged.

**Verify:** Toggle dark mode on `/team/tasks` — titles, descriptions, badges, and row actions should meet contrast on the cream paper; sidebar/tabs on the dark shell remain unchanged.

---

## Champion 3 — Cross-Page Audit

**Agent:** Dark Mode Champion 3 of 3  
**Date:** 2026-07-07  
**Scope:** Remaining team pages — reports, clients, inventory, events, manage, book, dashboard, login/account.

### Checklist

| Page | Status | Notes |
|------|--------|-------|
| `/team/reports` | **PASS** (fixed) | Subheader title now uses `--color-text` in dark; date preset pressed state uses `--color-stone-100` + sage ring; `color-scheme: dark` on date inputs |
| `/team/clients` | **PASS** | Already tokenized via `TeamListLayout` + `team-list-sidebar.css`; sidebar active link contrast improved globally |
| `/team/inventory` | **PASS** (fixed) | Modals/forms migrated off `#fff` / gray-500 hex; stock status badges use `--color-success` / `--color-dusty-rose`; toast uses inverted `--color-text` / `--color-bg` |
| `/team/events` | **PASS** | Calendar, legend, modal chrome already on stone/cream tokens; no light-on-light regressions found |
| `/team/manage` | **PASS** (fixed) | Subheader title + border tokens aligned via global dark overrides |
| `/team/book` | **PASS** (fixed) | Day calendar `--day-header-bg` set to `--color-stone-100` in dark; sticky staff row / time spacer stay opaque |
| `/team` (dashboard) | **PASS** | Existing `:global([data-theme="dark"])` rules for hero/actions; stone scale inverts correctly |
| Login / account | **PASS** (fixed) | Login `--login-border` tokens in dark; `auth/confirm` reads `localStorage` theme + imports tokens; account uses stone tokens throughout |

### Fixes applied

1. **`apps/team/src/styles/dark-mode-overrides.css`** (new) — centralized `[data-theme="dark"]` overrides:
   - `color-scheme: dark` + native date input support
   - Brighter `--color-link` / `--color-success` in dark (also in `packages/theme/tokens.css`)
   - Notice/badge error contrast
   - List/manage subheader + active nav link readability
   - Reports preset pressed state
   - Day calendar sticky header surfaces
   - Inventory modal backdrop + stock status tints
   - Login border token overrides

2. **`apps/team/src/styles/global.css`** — import `dark-mode-overrides.css`

3. **`apps/team/src/components/DayCalendar.astro`** — `--day-header-bg: var(--color-stone-100)` in dark block

4. **`apps/team/src/pages/inventory.astro`** — modal panel, form fields, scanner UI, status badges, toast → design tokens

5. **`apps/team/src/pages/auth/confirm.astro`** — theme bootstrap script + `tokens.css` variables (replaces hardcoded `#f3ede3` / `#3d3832`)

6. **`packages/theme/tokens.css`** — dark `--color-link`, `--color-success` tuning

### Build / deploy

- Build: `npm run build --workspace apps/team`
- Commit: `Dark mode: cross-page contrast and token fixes`
- Push `master` → Workers Builds redeploy team worker
