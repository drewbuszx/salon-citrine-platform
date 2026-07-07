# Client Booking Remodel — Program Brief

**Lead Architect:** Booking Remodel Coach  
**Updated:** 2026-07-07  
**Repo:** `salon-citrine-platform`  
**Scope:** Guest-facing booking only (`apps/web`) — **not** team sidebar/calendar

---

## Where the guest booking flow lives

| Item | Value |
| --- | --- |
| **App** | `apps/web` |
| **Worker** | `salon-citrine-book` (`apps/web/wrangler.toml`) |
| **Base path** | `/book` (`astro.config.mjs`) |
| **Production URL** | `https://book.saloncitrineindy.com/book` |
| **Timezone** | `America/Indiana/Indianapolis` |
| **Build** | `npm run build --workspace apps/web` |
| **Deploy** | `cd apps/web && npm run build && npx wrangler deploy` |

### Route map (funnel)

```
/book/              → index.astro          Services (ServiceBooking)
/book/cart/         → cart.astro           Cart + add-ons
/book/stylist/      → stylist.astro        Professional (when "Any Pro")
/book/datetime/     → datetime.astro       Calendar + slots + waitlist
/book/details/      → details.astro        Guest info + Stripe deposit
/book/confirm/      → confirm.astro        Confirmation + policy recap
/book/embed-demo/   → embed-demo.astro     iframe test harness
```

### Key shared files

| File | Role |
| --- | --- |
| `layouts/BookingLayout.astro` | Shell, theme bootstrap, embed mode |
| `components/BookingSteps.astro` | Progress stepper |
| `components/SiteHeader.astro` | Marketing nav + theme toggle |
| `styles/global.css` | Shared form/button/header styles |
| `packages/theme/tokens.css` | Design tokens (light + dark) |
| `lib/booking-flow.ts` | URL helpers, API paths, embed flags |
| `lib/booking-data.ts` | Catalog, pricing, staff/services |
| `lib/availability.ts` | Slot resolution |

### APIs used

- `api/availability/dates.json` — available dates
- `api/availability/slots.json` — time slots for a date
- `api/booking/cart/` — server cart (team parity)
- `api/booking/setup-intent` — Stripe card on file
- `api/booking/appointments` — book appointment
- `api/booking/waitlist.json` — guest waitlist join
- `api/booking/clients/lookup.json` — returning client

---

## Vision

The guest booking experience should feel like **the same premium product** as the team app: editorial cream/stone surfaces, citrine gold primary actions, rounded raised pill controls on recessed trays, intentional dark mode, and mobile-first delight. Boulevard-tier polish without purple/orange drift.

**North-star moments:**
1. **Zero friction start** — book without account; stylist deep-link; embed on marketing site
2. **Precision-lite** — ranked "best times" at top of slot picker (not just chronological)
3. **Trust at pay** — deposit/policy clarity before Stripe; card on file explained
4. **Confirmation that sells the next visit** — calendar add, directions, rebook CTA
5. **Waitlist when empty** — join waitlist feels premium, not a dead end
6. **Dark mode parity** — every step intentional in `data-theme="dark"`

---

## Current state (discovery)

### Strengths
- Full funnel implemented: services → cart → stylist → datetime → details → confirm
- Embed mode (`?embed=1`) strips header/footer; flags preserved through funnel
- Theme toggle + `data-theme` bootstrap in `BookingLayout`
- Tokens imported from `@saloncitrine/theme/tokens.css`
- Waitlist form on datetime when no availability
- Stripe deposit + intake on details; confirmation with policy snapshot
- Returning-client and not-accepting-new-clients modals

### Gaps / drift
- **No `dark-mode-overrides.css`** in web (team has one; booking steps/calendar/forms need dark-specific fixes)
- Body gradient backgrounds may clash in dark mode
- Service step lacks **search** on long menus (P2-7 in QA consensus)
- **Recommended times** not surfaced (find-openings exists on team API; guest slots API is chronological)
- Filter controls are plain `<select>` — not team-style pill trays
- Confirmation missing **Add to calendar** (.ics) and **rebook loop** CTA
- Embed demo uses hardcoded hex instead of tokens
- Guest worker deploy status uncertain (P0-1 QA: `/book/` may redirect to staff login if not deployed)
- `global.css` form styles partially tokenized; page-scoped styles in astro files vary

### Frozen zones (do not touch)
- `apps/team/**` — especially `DayCalendar.astro`, `team-list-sidebar.css`, `TeamListLayout`
- `packages/theme/tokens.css` — architect-only unless adding guest-specific tokens with team review

---

## Wave 1 roster (build-out)

Disjoint file ownership — **no agent edits another agent's files**.

| Agent | Codename | Owns exclusively | Mission |
| --- | --- | --- | --- |
| W1-01 | **Nightfall** | `apps/web/src/styles/dark-mode-overrides.css` (new), `global.css` (import line + body dark gradient only) | First-class dark mode: color-scheme, calendar slots, form sections, notices, embed shell |
| W1-02 | **Frame** | `BookingLayout.astro`, `BookingSteps.astro` | Editorial shell: recessed content tray, sticky step bar, embed compact mode |
| W1-03 | **Threshold** | `SiteHeader.astro`, `LocationContext.astro` | Header cohesion with team; location chip; mobile nav + theme toggle polish |
| W1-04 | **Menu** | `index.astro`, `ServiceBooking.astro` | Service search, pill category chips, scannable mobile list, empty state |
| W1-05 | **Cart** | `cart.astro`, `scripts/booking-cart-client.ts` | Cart editorial cards, add-on upsells tray, running total pill, loading states |
| W1-06 | **Cast** | `stylist.astro` | Staff selection cards, photos, citrine selected state, any-pro path |
| W1-07 | **Clock** | `datetime.astro`, `scripts/datetime-booking.ts`, `scripts/waitlist-offer.ts` | Calendar pill controls, **recommended times** strip, waitlist UX, skeleton loading |
| W1-08 | **Vault** | `details.astro`, `scripts/details-booking.ts`, `PolicyModal.astro` | Deposit/policy trust panel, Stripe citrine appearance, intake form sections |
| W1-09 | **Seal** | `confirm.astro`, `lib/calendar-utils.ts`, `lib/appointment-confirmation.ts` | Hero confirmation, Add to Calendar (.ics), directions, rebook CTA |
| W1-10 | **Portal** | `ReturningClientsModal.astro`, `NotAcceptingNewClientsModal.astro`, `embed-demo.astro` | Modal polish + embed demo tokenized; iframe resize hint |

**Build/deploy:** Agents commit locally; **architect runs batched build + single wrangler deploy** after Wave 1 integration.

---

## Wave 2 agenda (fresh-perspective critique)

Wave 2 agents receive the **deployed Wave 1** as baseline. They must **critique, not rubber-stamp**.

| Agent | Codename | Focus | Critique remit |
| --- | --- | --- | --- |
| W2-01 | **Eagle** | Cross-step visual QA | Screenshot-level consistency light/dark; flag off-brand colors |
| W2-02 | **Thumb** | Mobile 375px pass | Touch targets, sticky CTAs, keyboard overlap on forms |
| W2-03 | **A11y** | Accessibility | Focus order, aria-live, contrast, reduced motion |
| W2-04 | **Speed** | Performance | Hydration weight, lazy images, slot API debounce |
| W2-05 | **Copy** | Microcopy & trust | Policy/deposit language, error messages, empty states |
| W2-06 | **Flow** | Funnel logic | Back button, deep links, embed flag preservation, cart edge cases |
| W2-07 | **Pay** | Stripe edge cases | Deposit $0, card decline, setup intent retry |
| W2-08 | **Time** | Datetime intelligence | Recommended times quality, timezone labels, waitlist validation |
| W2-09 | **Finish** | Confirmation & post-book | ICS correctness, rebook links, share/book-again |
| W2-10 | **Embed** | Marketing embed | iframe chromeless feel, postMessage height, cream edge blend |

Wave 2 may edit any `apps/web` file but must **coordinate via commits sequenced by architect** if touching shared layout/styles.

---

## Initiative improvements (beyond literal ask)

Included in Wave 1/2 scope without owner request:
- Service search on long menus
- Precision-lite recommended times on guest datetime step
- Add to Calendar (.ics) on confirmation
- Rebook CTA on confirmation (link to same stylist/services)
- Dark mode overrides matching team champion patterns
- Loading/skeleton states on slot fetch
- Deposit/policy "trust panel" before pay
- Embed demo tokenized (no hardcoded hex)
- Returning-client modal UX polish (OTP deferred; improve copy/layout)
- Mobile sticky "Continue" bars where missing

**Deferred (needs product decision or backend):**
- Returning-client OTP (P1-8)
- Self-reschedule/cancel from confirmation
- Client memory surfacing for recognized guests
- Waitlist auto-match notifications (team-side)

---

## Program log

### 2026-07-07 — Discovery + Wave 1 launch

- Mapped guest flow to `apps/web` @ `/book/*`, worker `salon-citrine-book`
- Published this brief; launching Wave 1 (10 agents, disjoint scopes)
- Architect retains: `tokens.css`, batched deploy, integration review

| Wave | Status | Deploy version | Notes |
| --- | --- | --- | --- |
| Wave 1 | **In progress** | — | 10 agents launched |
| Wave 2 | Pending | — | After W1 checkpoint deploy |

---

## Remaining opportunities (honest backlog)

1. Guest worker production deploy + marketing iframe live
2. Returning-client OTP (passwordless)
3. Self-reschedule / cancel from confirmation email
4. Client memory panel for recognized phone/email
5. Gift card / package redemption in guest cart
6. Service customization (duration/price variants) in flow
7. Post-book SMS with manage link
8. Analytics on funnel drop-off per step

---

## Agent instructions (all waves)

1. **Only edit files in your ownership table** (Wave 1) or your critique area (Wave 2).
2. Use `--color-*` tokens from `tokens.css`; citrine primary; stone/cream surfaces; no purple/orange.
3. Study `apps/team` for patterns: `DayCalendar.astro`, `TeamSiteHeader.astro`, `Button.astro` from theme package.
4. Support `[data-theme="dark"]` for every style you add.
5. Run `npm run build --workspace apps/web` before commit; fix errors.
6. Commit: `feat(web-book): <short description>` — small, coherent commits.
7. Do **not** run `wrangler deploy` — architect batches deploys.
8. Do **not** edit `apps/team/**` or `packages/theme/tokens.css` unless architect approves.
