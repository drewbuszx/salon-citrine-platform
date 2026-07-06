# Visual QA Report

Living audit log for Salon Citrine Platform. Each session appends findings; dev agents fix P0/P1 before demos.

**How to run:** See [AGENT_VISUAL_QA.md](./AGENT_VISUAL_QA.md) · Checklist: [VISUAL_QA_CHECKLIST.md](./VISUAL_QA_CHECKLIST.md)

---

## Audit session — 2026-07-06 (initial)

| Field | Value |
| --- | --- |
| **Date** | July 6, 2026 |
| **Environment** | `https://salon-citrine-platform.dbuszx.workers.dev` |
| **Baseline commits** | `3926b84` (design system + polish), `12feea3` (citrine accent system) |
| **Method** | HTTP route probe + deployed CSS token verification; browser MCP attempted (tab session failed — see Blockers) |
| **Auth** | No staff credentials provided |

### Summary

| Severity | Count | Notes |
| --- | --- | --- |
| P0 | 0 | No confirmed broken UI on pages we could render |
| P1 | 1 | Book app not reachable on audited Worker |
| P2 | 0 | Login page structure OK; title middot not verified in browser |

**Blocked routes:** 8 team routes + book path — all require authentication or separate Worker deploy.

---

### `/team/login` — Audited (public)

**Status:** ✅ Reachable (HTTP 200)

**Wins**

- Skip link present (`Skip to main content` → `#team-main-content`)
- Login shell uses compact header with logo linking to marketing site
- Form stack: email, password, citrine primary button (`btn-primary`)
- Deployed bundle includes design-system tokens: `--color-citrine` / `#e7ac46`, `team-sidebar`, `filter-chevron` rules
- Sidebar chevron constraint confirmed in production CSS: `.team-list-layout__filter-chevron { width: 12px; height: 12px; ... }` (matches 3926b84 / TEAM_SIDEBAR_DECISION)

**Issues**

| Sev | Issue | Expected | Selector / note |
| --- | --- | --- | --- |
| — | None confirmed on login | DESIGN_SYSTEM login uses DM Sans, form-stack, btn-primary | `.login-page`, `.btn-primary` |

**Screenshot-describe:** Centered narrow form on light background; minimal top bar with Salon Citrine compact logo; no nav tabs on login (correct for `loginPage` layout). *Browser screenshot not captured — MCP tab lost between calls.*

---

### `/team/` (dashboard / calendar)

**Status:** ⛔ Blocked — HTTP 302 → `/team/login`

**Expected checks (when authenticated):** Stone-800 top bar, citrine active tab inset, Team Pulse strip, day calendar grid, no layout overflow at 1100px.

**Cannot verify:** Sidebar N/A on home; calendar chrome, waitlist badge, citrine accents.

---

### `/team/book`

**Status:** ⛔ Blocked — HTTP 302 → `/team/login`

**Expected checks:** Same top bar as dashboard; booking calendar or day view; active **Book** nav state.

---

### `/team/clients`

**Status:** ⛔ Blocked — HTTP 302 → `/team/login`

**Expected checks (3926b84 sidebar fix):**

- Left sidebar stone-50, "Refine Your Search" title
- Collapsible filters with **12px chevrons**, counts as `(N)` not concatenated
- No giant search/chevron SVGs
- Active filter/nav: 3px citrine left border
- Data table zebra, link color warm gold-brown

---

### `/team/inventory` (Stock)

**Status:** ⛔ Blocked — HTTP 302 → `/team/login`

**Expected checks:** Same sidebar filter pattern as Clients; stock cards; low-stock banner if applicable; export button in sidebar footer.

---

### `/team/tasks`

**Status:** ⛔ Blocked — HTTP 302 → `/team/login`

**Expected checks:** `TeamSidebarNav` view buttons (not checkboxes); active view citrine left border; attention badge on "Needs attention" if count > 0.

---

### `/team/events`

**Status:** ⛔ Blocked — HTTP 302 → `/team/login`

**Expected checks:** Filter sidebar + month shortcuts; calendar main area; collapsible Event type / Staff filters.

---

### `/team/waitlist`

**Status:** ⛔ Blocked — HTTP 302 → `/team/login`

**Expected checks:** `showSidebar={false}` layout; waitlist table or empty state; row actions per UX_INTELLIGENCE_FEED P0 #5.

---

### `/team/manage`

**Status:** ⛔ Blocked — HTTP 302 → `/team/login`

**Expected checks:** Reference sidebar (`TeamManageLayout`); vertical nav links; citrine active border — this is the visual reference for list pages.

---

### `/book/` (guest booking)

**Status:** ⛔ Blocked — HTTP 302 → `/team/login` on team Worker

| Sev | Issue | Expected | Action |
| --- | --- | --- | --- |
| **P1** | Guest book not served at `/book/` on `salon-citrine-platform` Worker | Separate `salon-citrine-book` Worker per [CLOUDFLARE_DEPLOY.md](./CLOUDFLARE_DEPLOY.md) | Deploy book Worker or provide book URL; re-audit cream gradient, BookingSteps, service cards |

Alternate URLs tested: `salon-citrine-book.dbuszx.workers.dev/book/` → 404; book app not deployed to account subdomain yet.

---

## Blockers for next audit

1. **Staff login** — Provide test credentials or run Visual QA locally after `create-dev-admin.mjs` (see README). Required to verify sidebar fixes on Clients, Stock, Tasks, Events, Manage.
2. **Browser MCP** — Tab created (`browser_tabs` new) but `browser_navigate` returned "Browser view not found" on subsequent calls. Retry with user-visible browser or single-session lock.
3. **Book Worker** — Deploy `apps/web` to `salon-citrine-book` Worker for guest-flow visual QA.

---

## Dev agent action queue

```
@dev fix: P1 /book/ — Guest booking URL on team Worker redirects to staff login. Expected: public book at book Worker or /book/ without auth. Deploy: apps/web per CLOUDFLARE_DEPLOY.md.

@dev verify: P0 sidebar (when auth available) — On /team/clients and /team/inventory, confirm 12px chevrons and citrine active border per DESIGN_SYSTEM.md and commit 3926b84. Selectors: .team-list-layout__filter-chevron, .team-list-layout__sidebar-link.is-active.
```

---

## Changelog

| Date | Session | Routes audited | Top findings |
| --- | --- | --- | --- |
| 2026-07-06 | Initial | `/team/login` only (8 team + book blocked) | Book not on Worker; CSS tokens deployed; auth blocks sidebar verification |
