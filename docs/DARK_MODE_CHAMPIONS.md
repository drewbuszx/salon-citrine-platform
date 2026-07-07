# Dark Mode Champions

Parallel fix pass for team app dark-mode contrast issues. Each champion owns a page or surface; coordinate commit messages with `dark mode:` prefix.

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
