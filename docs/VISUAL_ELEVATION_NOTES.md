# Visual Elevation Notes — Jul 6, 2026

One-commit pass to raise perceived quality from **B** (school-project template) to **B+** (considered salon brand). Focus: highest-visibility surfaces only; sidebar architecture frozen per [TAKEOVER_NOTE.md](./TAKEOVER_NOTE.md).

---

## What made it look like a B

1. **Wrong body font globally** — `body` used Cormorant serif at 18px while team UI spec calls for DM Sans 16px. Every list page, form, and table inherited marketing typography by accident.
2. **Login = generic SaaS template** — "Team sign in" headline, flat white box, no brand kicker or editorial hierarchy. Could be any Bootstrap admin theme.
3. **"Coming soon" tease controls** — Merge Clients button, Export sidebar button, and Manage hub rows fired toast spam. Reads as hackathon demo, not production software ([UX_INTELLIGENCE_FEED anti-patterns](./UX_INTELLIGENCE_FEED.md)).
4. **Nav bar felt default** — Tabs at 11.5px with loose spacing; inactive tabs too bright; logo harsh at 95% invert; notifications button visibly disabled with "(coming soon)" in aria-label.
5. **Bootstrap gray on Manage hub** — `#6b7280`, `#e5e7eb`, `#374151` on hub actions/descriptions — cold Tailwind defaults fighting warm citrine/stone tokens.

---

## What we fixed (this commit)

| Surface | Change |
|---------|--------|
| **global.css** | Body → `--font-body` / `--text-base`; login gets cream gradient, elevated card, display headline, stone form fields |
| **login.astro** | "Welcome back" + kicker "Salon Citrine · Staff" — luxury entry, not form template |
| **TeamSiteHeader** | Tighter tab rhythm (11px, 0.1em tracking), subtler inactive tabs, logo hover, muted disabled notification icon (no tease copy) |
| **TeamListLayout titles** | Display font at `--text-xl` for page sub-headers; buttons use `--text-xs` + wider tracking |
| **Dashboard** | Hero divider, display name/section titles, stone-bordered action tiles with SVG icons (not `+` `$` `⌁` glyphs) |
| **Coming soon** | Removed Merge Clients, Export buttons, toast handlers; Manage disabled rows show no action chip |
| **TeamManageLayout** | Hub action/desc colors → stone tokens + DM Sans uppercase buttons |

---

## Sprint 2 for A grade

| Priority | Item | Why it still reads amateur |
|----------|------|---------------------------|
| P0 | **Authenticated route audit** | Sidebar, tables, tasks notebook UI not verified in browser — likely still has density/hierarchy issues |
| P0 | **Guest book Worker** | `/book/` unreachable on team Worker — booking flow can't be judged |
| P1 | **Tasks / Docs notebook UI** | Still hackathon-demo energy per user brief — needs editorial list treatment |
| P1 | **Stock product cards** | Placeholder thumbs without intentional empty-state art |
| P1 | **Table polish pass** | Clients/waitlist/inventory — row height, link weight, empty states |
| P2 | **Team Pulse refinement** | Gradient box still slightly "widget dashboard"; could be inline stat strip |
| P2 | **Login split layout (desktop)** | Optional left brand panel with salon photography |
| P2 | **Notification bell** | Ship or remove from DOM entirely — ghost icon still visible |

---

## Verify after deploy

1. `/team/login` — cream gradient, card shadow, Cormorant "Welcome back", citrine CTA
2. `/team/` (auth) — display name, stone action tiles, no character icons
3. `/team/clients` — no Merge/Export; title in display font
4. `/team/manage` — no "Coming soon" on disabled rows; stone hub buttons
5. Top bar — citrine active inset, tighter tabs, no purple/blue anywhere

---

*Commit message: `Elevate team and book visuals above amateur template feel.`*
