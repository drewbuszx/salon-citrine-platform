# UX Audit — Salon Citrine Platform

Last updated: July 2026 — **five-pass UX sprint completed**

Legend: ✅ Fixed · 🔄 Improved · ⬜ Open · 📋 Documented

---

## Sprint commits (UX passes 1–5)

| Pass | Focus | Status |
| --- | --- | --- |
| 1 | Audit blockers: toasts, low-stock action, empty states | ✅ |
| 2 | Visual cohesion: TeamListLayout across list pages | ✅ |
| 3 | Flow polish: checkout tax/tips/prebook, web waitlist | ✅ |
| 4 | Feature depth: waitlist page/API, sales tax, reports link | ✅ |
| 5 | Ship: BOOKING_SHIP_CHECKLIST, build:alt, audit close-out | ✅ |

---

## Pass 1 — Audit & quick wins

| # | Area | Issue | Status |
| --- | --- | --- | --- |
| 1 | Build | Team `dist/` EPERM on Windows | ✅ `npm run build:alt` |
| 2 | Nav | Week view | ⬜ Day strip only |
| 3 | Nav | Tasks tab label | ✅ Renamed from Messages |
| 4 | Clients | Loading / empty search | ✅ Table + hints |
| 5 | Inventory | Low-stock banner | ✅ Filter shortcut |
| 6 | Team | Global toast | ✅ `lib/toast.ts` |
| 7 | Checkout | Errors easy to miss | ✅ Toast + inline |
| 8 | Client profile | Silent save | ✅ Toast confirmation |
| 9 | Booking web | Generic validation | ✅ Field-level on details |

---

## Pass 2 — Visual cohesion

| # | Area | Issue | Status |
| --- | --- | --- | --- |
| 10 | List pages | Inconsistent chrome | ✅ TeamListLayout (clients, stock, tasks, waitlist) |
| 11 | Buttons | Disabled state | ✅ global.css |
| 12 | Loading | Plain text | ✅ Skeleton pattern |
| 13 | Skip link | Missing | ✅ TeamLayout |
| 14 | Tables | Row hover | ✅ team-data-table |

---

## Pass 3 — Flow polish

| # | Area | Issue | Status |
| --- | --- | --- | --- |
| 15 | Checkout | Tip preset selection | ✅ Active pill state |
| 16 | Checkout | Receipt abrupt | ✅ Toast + scroll |
| 17 | Checkout | Sales tax hidden | ✅ Retail tax row |
| 18 | Checkout | No rebook prompt | ✅ 4/6/8 week prebook links |
| 19 | Booking | No slots = dead end | ✅ Guest waitlist form |
| 20 | Calendar | Waitlist disabled | ✅ `/waitlist` page |

---

## Pass 4 — Feature depth

| # | Area | Issue | Status |
| --- | --- | --- | --- |
| 21 | Waitlist | API only, no team UI | ✅ Page + GET/POST/PATCH API |
| 22 | Reports | Low stock isolated | ✅ Link to Stock with filter |
| 23 | Reports | Loading pop-in | ✅ Skeleton on fetch |
| 24 | Inventory | Scan errors technical | 🔄 Friendly copy in scanner |
| 25 | Sales tax | Backend only | ✅ 7% default on retail products |

---

## Pass 5 — Ship pass

| # | Area | Issue | Status |
| --- | --- | --- | --- |
| 26 | Docs | Ship checklist | ✅ BOOKING_SHIP_CHECKLIST.md |
| 27 | Docs | Competitor research | ✅ COMPETITOR_UX_RESEARCH.md |
| 28 | Docs | Feature gap | ✅ BOULEVARD_FEATURE_GAP.md |
| 29 | A11y | Form labels | 🔄 Most forms labeled |
| 30 | Deploy | dist artifacts untracked | 📋 gitignored |

---

## Open issues (prioritized)

1. **Collect card at checkout** when client has no card on file
2. **Cash / card-present** tender
3. **Full week calendar grid** (strip exists)
4. **Embeddable booking widget** on saloncitrineindy.com
5. **Package/voucher** checkout accounting
6. **Tasks** filter sidebar placeholders ("coming soon")
7. **Two-way SMS** client threads

---

## Before / after

| Dimension | Before (~2/10) | After sprint |
| --- | --- | --- |
| Error feedback | Inline only | Toasts + friendly copy |
| Waitlist | API stub, disabled button | Guest form + team page |
| Checkout | Tips only | Tax, tips, prebook shortcuts |
| List pages | Mixed layouts | Boulevard-style TeamListLayout |
| Ship readiness | Ad hoc | BOOKING_SHIP_CHECKLIST.md |
