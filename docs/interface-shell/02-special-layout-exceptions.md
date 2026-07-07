# Special layout exceptions

Agent 7 — Dashboard and Appointment Book justified deviations from the standard contextual header pattern.

## Dashboard (`pages/index.astro`)

**Decision:** No `PageContextHeader` / "Salon Overview" strip.

**Rationale:** The hero block (`dashboard__hero`) already establishes identity — staff name, salon name, booking link, and avatar. Adding a second "Salon Overview" heading would duplicate identity content and consume ~80px of vertical space on the primary landing view.

**What stays:**
- `TeamLayout title="Dashboard"` for document title and mobile nav compact title (`data-page-title`).
- Hero as implicit h1 (`dashboard__name` is the person; page purpose is clear from pulse + quick actions).
- Subtitle intent ("Today's appointments…") is expressed through Team Pulse metrics and upcoming appointments module, not a redundant sentence under a second heading.

**Future:** If analytics show confusion, a visually hidden h1 ("Salon Overview") may be added for screen readers without a visible band.

## Appointment Book (`pages/book.astro`)

**Decision:** No large contextual header above the calendar grid.

**Rationale:** Book is a dense operational surface. Date navigation, staff columns, view toggles, and waitlist entry in `DayCalendar` toolbar supply sufficient context. A visible "Appointment Book" heading would cost permanent desktop height on every view.

**What stays:**
- `TeamLayout title="Book"` with `fullBleed plain` — calendar fills viewport below nav.
- Visually hidden / screen-reader-only page title via `sr-only` class on an h1 inside the calendar shell if needed for outline (optional; document title suffices today).
- Subtitle copy from the naming system is informational only — not rendered on Book.

**Mobile:** Compact controls remain in calendar header; no additional title row.

## Other pages using legacy `title` only

These are out of scope for this sprint but keep the old short `TeamListLayout title=` until a future pass:

- `clients/[id].astro` — "Client profile" with back navigation
- `account.astro`, `my-book.astro`, `my-services.astro`, `block-time.astro`, `waitlist.astro`
- Manage sub-pages (`business.astro`, `employees.astro`, etc.) — section-specific titles with ← Manage back link

They inherit Sprint 2 shell changes (no desktop band) but retain their own contextual titles, not the hub naming table.
