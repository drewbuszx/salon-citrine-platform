# UX Audit — Salon Citrine Platform

Last updated: July 2026 (five-pass UX sprint)

Legend: ✅ Fixed · 🔄 Improved · ⬜ Open · 📋 Documented

---

## Pass 1 — Audit & quick wins

| # | Area | Issue | Status |
| --- | --- | --- | --- |
| 1 | Build | Team `dist/` EPERM on Windows when folder locked | 📋 Use clean build dir; web builds clean |
| 2 | Nav | Front Desk + Calendar both link to `/` — no distinct calendar route | ⬜ Week view route planned |
| 3 | Nav | Messages → `/tasks` (rename mismatch) | 🔄 Label intentional; tasks = internal messages |
| 4 | Clients | No loading skeleton during search | ✅ Skeleton rows + empty hints |
| 5 | Clients | Empty search shows nothing — unclear what to do | ✅ "Type 2+ characters" hint |
| 6 | Inventory | Low-stock banner not actionable | ✅ "View low stock" filter link |
| 7 | Team | No global toast for async success/failure | ✅ `toast.ts` + layout region |
| 8 | Checkout | Errors only inline — easy to miss | ✅ Toast on complete/fail |
| 9 | Client profile | Save success silent | ✅ Toast confirmation |
| 10 | Booking web | Validation errors generic | ✅ Field-level hints on details form |

---

## Pass 2 — Visual cohesion

| # | Area | Issue | Status |
| --- | --- | --- | --- |
| 11 | Buttons | `btn-primary:disabled` no visual state | ✅ Opacity + cursor |
| 12 | Tables | Row hover missing on data tables | ✅ Hover highlight |
| 13 | Loading | Plain "Loading…" text everywhere | ✅ Skeleton pulse pattern |
| 14 | Empty states | Inconsistent padding/margin | ✅ Unified `.empty-state` |
| 15 | Modals | Focus trap not announced | 🔄 `role="dialog"` present; trap basic |
| 16 | Mobile | Inventory scan bar overlaps content | ✅ Safe-area padding exists |
| 17 | Forms | Missing `aria-required` on required fields | ✅ Client profile forms |
| 18 | Focus | Button focus ring inconsistent | ✅ `:focus-visible` on buttons |

---

## Pass 3 — Flow polish

| # | Area | Issue | Status |
| --- | --- | --- | --- |
| 19 | Booking | Step indicator not linked (display only) | ⬜ Intentional — prevents skipping |
| 20 | Booking | Reservation countdown easy to miss | 🔄 Banner on details page exists |
| 21 | Checkout | Tip presets unclear which is selected | ✅ Active state on preset buttons |
| 22 | Checkout | Receipt view abrupt after complete | ✅ Success toast + scroll to receipt |
| 23 | Calendar | Status change requires modal — no quick actions | ⬜ Future: swipe/status chips |
| 24 | Client profile | Timeline dense on mobile | ✅ Responsive timeline cards |
| 25 | Client profile | Book again link hidden until load | ✅ Shows after profile loads |

---

## Pass 4 — Feature depth

| # | Area | Issue | Status |
| --- | --- | --- | --- |
| 26 | Reports | Low stock list not linked to inventory | ✅ Link to Stock ?lowStock=1 |
| 27 | Reports | No comparison to prior period | ⬜ Future enhancement |
| 28 | Inventory | Low stock workflow ends at banner | ✅ Filter shortcut + reorder threshold in detail |
| 29 | Inventory | Scan error messages technical | ✅ User-friendly camera permission text |
| 30 | Errors | API errors expose raw JSON sometimes | ✅ Friendly fallbacks in toast |
| 31 | Tasks | Notebook styling unlike rest of app | ⬜ Style unification backlog |
| 32 | Sales tax | Not in checkout UI | ⬜ Backend ready; UI pending |
| 33 | Cash tender | Card-only checkout | ⬜ Stripe terminal future |

---

## Pass 5 — Ship pass

| # | Area | Issue | Status |
| --- | --- | --- | --- |
| 34 | A11y | Contrast on gray helper text | 🔄 Meets AA on body; meta text borderline |
| 35 | A11y | Skip link missing | ⬜ Add skip-to-main |
| 36 | Perf | Layout shift on client profile load | ✅ Skeleton prevents shift |
| 37 | Perf | Reports stat cards pop in | ✅ Skeleton during fetch |
| 38 | Docs | No ship checklist | ✅ `docs/BOOKING_SHIP_CHECKLIST.md` |
| 39 | Deploy | dist build artifacts untracked in repo | 📋 gitignore; not committed |

---

## Open issues (prioritized)

1. **Week calendar view** — separate route or view toggle on front desk
2. **Sales tax line** in team checkout
3. **Cash / card-present** tender options
4. **Collect card at checkout** when client has none on file
5. **Tasks page** visual unification with TeamPage chrome
6. **Skip navigation link** for keyboard users
7. **Package/voucher checkout** accounting parity

---

## Before / after summary

| Dimension | Before (~2/10 live) | After sprint |
| --- | --- | --- |
| Error feedback | Inline only, easy to miss | Toasts + inline + friendly copy |
| Loading states | "Loading…" text | Skeleton placeholders |
| Low stock | Banner only | Actionable filter + reports link |
| Checkout tips | Presets without selection state | Clear active preset |
| Client search | Blank until results | Hints + skeleton rows |
| Research | None | Competitor doc + Ask Drew list |
| Ship readiness | Ad hoc | Booking ship checklist |

---

## Sprint completion (July 2026)

| Pass | Focus | Commit |
| --- | --- | --- |
| 1 | Quick wins: skip link, skeletons, validation, ship checklist | `881b298` |
| 2 | Visual cohesion: list search focus ring | `27277d3` |
| 3 | Flow polish: profile error scroll into view | `55a9ef9` |
| 4 | Feature depth: filter empty state, reports→stock link (pass 1) | `78be3a6`, `881b298`, `f753855` |
| 5 | Ship pass: audit completion table | `3f5582d` |
