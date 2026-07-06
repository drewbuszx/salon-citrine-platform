# Boulevard Feature Gap Analysis

**Date:** July 2026  
**Sources:** [The Salon Business Boulevard review](https://thesalonbusiness.com/boulevard-software-review/), [Boulevard Developer Portal](https://developers.joinblvd.com/), internal codebase audit (`apps/team`, `apps/web`, `packages/db`, `packages/shared`)  
**Merged prior work:** `docs/COMPETITOR_UX_RESEARCH.md`, `docs/UX_AUDIT.md`, `docs/BOULEVARD_BOOKING_BLUEPRINT.md`

---

## Executive summary

Salon Citrine Platform has a **credible Boulevard-shaped booking spine** (cart → stylist → datetime → reserve → pay → confirm) and a **usable team day calendar with checkout**, but Boulevard is an enterprise all-in-one: marketing suite, contact center, payroll, dozens of reports, integrations, and operational depth we have not built.

**Honest overall parity estimate: ~35–40%** of Boulevard’s full feature surface.  
**Launch-critical slice (online book + team calendar + basic checkout + CRM): ~45–50%.**

The user is “still way off” because the gaps that *feel* like Boulevard day-to-day are mostly **marketing/comms**, **front-desk ops**, **retail/revenue products** (packages, gift cards, memberships), and **polish** (embed widget, precision slots, waitlist UX, self-reschedule) — not because the cart API mapping is wrong.

---

## Boulevard capabilities extracted from the review

### Positioning & platform

| Capability | Notes from review |
| --- | --- |
| Marketing-focused salon management | Premium positioning; growth through web tools |
| Plans: Essentials / Premier / Prestige / Enterprise | Feature gating by tier |
| 12-month contract, demo-only trial | Sales-led onboarding |
| Integrated Boulevard Payments (Duo) | EMV reader, Offset fee pass-through, cards on file |
| Professional mobile app (iOS/Android) | Supplemental; buggy per reviews |
| Web browser (Chrome recommended) | Full desktop experience |
| Business dashboard | KPIs at a glance |
| Help center | Well-designed documentation |

### Online booking

| Capability | Notes |
| --- | --- |
| Website booking widget / overlay | Embeds self-booking on salon site |
| Branding control | Customize look/feel of booking |
| No-show protection | Card on file, deposits |
| Service customization | Client adapts service → price/duration change |
| Book without account | Guest booking |
| Integrated gift cards (digital) | Sell during booking |
| Add-on offers in booking flow | Upsells during online book |
| Precision Scheduling™ | Rank “best” gaps first; configurable ideal gap (30/60/90 min) |
| Client self-reschedule | Online without calling front desk |
| Selective service visibility | Control what is bookable online |
| Waitlist | Client joins from booking; card required; staff manually fits |
| Client marketplace | Discovery platform for new clients |

### Calendar & appointment management

| Capability | Notes |
| --- | --- |
| Day / Today / 4 Day / Week views | Multi-view calendar |
| Staff color coding | Visual distinction per provider |
| Filters by staff | Multi-select |
| Booking pane from calendar | Bottom sheet booking |
| Time blocks | Block calendar |
| Repeat / recurring appointments | — |
| Processing time / double booking | Book during processing windows |
| Duration & price by staff | Per-provider overrides |
| Rooms & resource scheduling | Rooms, tools, beds, machines |
| Client waitlist management | Dashboard alerts; filter by client/service |
| Customize notification messages | Location-level client instructions |
| Customize notification timings | 2 days before, 1 day before, same day (limited) |
| Automated check-in | Client self check-in |
| Front Desk view | Waiting / late / checked-out columns |
| Walk-ins & groups (Duo) | Premier+ front desk iPad |
| Google / Apple Calendar 2-way sync | Personal blocks → Boulevard blocks |

### Client data & communication

| Capability | Notes |
| --- | --- |
| Client profiles | History, purchases, tags (VIP, loyal, banned) |
| Client-specific pricing | Stored and auto-applied |
| Advanced client search | Referral source, provider, location, first/last appt |
| Client notes | — |
| Client files & images | Attachments on profile |
| Forms & Charts add-on | Intake, SOAP notes, e-sign ($55/mo) |
| SMS notifications | Appointment reminders |
| Email notifications | Confirmations + reminders |
| Dedicated business SMS number | Contact Center |
| Two-way SMS | Contact Center add-on ($25+/mo) |
| Caller ID / booking line | Contact Center |

### Point of sale / checkout

| Capability | Notes |
| --- | --- |
| Checkout from calendar | Pane workflow |
| Retail products at checkout | Scan/type products |
| Gratuity | Presets + custom |
| Prebook at checkout | 4 / 6 / 8 week jump buttons |
| Tablet-compatible POS | iPad + Duo reader |
| Dedicated POS hardware | Boulevard Duo EMV reader |
| Self checkout | Client checks out themselves |
| Cards on file | Charge later |
| Integrated payments | First-party processing |
| Multi-merchant / booth renter routing | Split payments to DBAs |
| Booking deposits | Premier+ |

### Inventory & retail

| Capability | Notes |
| --- | --- |
| Inventory tracking | Stock levels, reorder alerts |
| Purchase orders | Premier+; auto PO creation |
| Retail products | Toggle per location for checkout |
| Usage-based pricing | Medspa injectable units |
| Packages | Vouchers with expiration |
| Memberships | Auto-renew subscriptions |
| Gift cards | Digital + physical via partner |

### Staff & payroll

| Capability | Notes |
| --- | --- |
| Staff accounts & permissions | Privilege groups, granular ACL |
| Service assignability per staff | Per-service (tedious in Boulevard too) |
| Commission support | Service + retail |
| Payroll reports | — |
| Fully integrated payroll | Cut paychecks in-app |
| 3rd party payroll integration | Gusto, ADP, Paychex |
| Booth renter support | Rent collection, payment routing |
| Multi-location support | Chains / franchises |

### Marketing

| Capability | Notes |
| --- | --- |
| Email marketing | Automated campaigns, drag-drop builder |
| SMS marketing | Campaigns from dedicated number |
| Audience segmentation | Tags, appt dates, referral source |
| Automated campaigns | Slow days, rebook, birthday |
| One-time blast emails | Tier-based free allowance |
| Website builder | — |
| Attribution billing | $2 per appt within 7 days of email |

### Reporting

| Capability | Notes |
| --- | --- |
| Basic reporting | Essentials |
| Custom / beta reports | Premier+; highly customizable |
| Sales summaries | — |
| Staff performance | — |
| Inventory on-hand | — |
| Booking forecasts | — |
| Account liability | Packages/memberships |
| Reporting API / Snowflake | Enterprise BI export |

### Integrations (native)

| Integration | Tier notes |
| --- | --- |
| Reserve with Google | Premier+ |
| Facebook / Instagram Book Now | — |
| QuickBooks Online | Nightly sync |
| Zapier | — |
| Shopify | Enterprise |
| Google / Apple Calendar | 2-way sync |
| Custom integrations / API / Webhooks | Enterprise |
| Okta SSO, Green Circle | Enterprise |

### Developer portal (supplement)

| Area | Capability |
| --- | --- |
| Client API | Cart-based booking SDK (`@boulevard/blvd-book-sdk`) |
| Admin API | Staff, clients, appointments, inventory sync |
| Marketing | Custom client segments |
| Reporting API | Bulk export to BI |
| Tokenization API | PCI-safe card collection |
| Magic Tags → Zapier | Event automation |

---

## Salon Citrine Platform — what exists today

Audit scope: `apps/team`, `apps/web`, `packages/db`, `packages/shared` (July 2026).

### Implemented (honest “We have”)

| Area | What works |
| --- | --- |
| **Web booking** | Cart flow, multi-service, add-ons, stylist pick, availability dates/slots, slot reservation + expiry, guest details, returning client lookup, Stripe card on file, deposits, policy ack, confirmation email/SMS |
| **Web booking data** | Locations table, booking carts/reservations, waitlist API (`POST /api/booking/waitlist.json`) |
| **Team calendar** | Day view + week strip, multi-staff manager view, book/block from grid, status lifecycle (`booked`, `confirmed`, `arrived`, `completed`, cancelled, `no_show`), overlap prevention |
| **Team checkout** | Service lines, retail products, tip presets, Stripe charge card on file, deposit applied, receipt |
| **Clients** | Search, profile, tags, formula/staff notes, intake fields, referral sources, visit count, LTV, timeline, referrals |
| **Inventory** | Products, barcode scan check-in, low-stock banner/filter, receive/use/count/adjust, manager CRUD |
| **Reports** | 30-day revenue, appointments by staff, cancellation/no-show rates, low stock, CSV export |
| **Comms (transactional)** | Booking confirmation + 48h/24h reminder cron (Resend + Twilio) |
| **Staff** | Roles (`owner`, `stylist`, `esthetician`, `front_desk`), manager vs stylist scoping, my-services, schedules, events/time-off |
| **Other team** | Tasks (internal), events calendar, docs, booking policy admin, dashboard with upcoming appts |

### Partial (“Partial”)

| Feature | Boulevard | Us |
| --- | --- | --- |
| Online booking UX | Branded embed overlay | Standalone `/book` app; Salon Citrine branding; not embedded in marketing site |
| No-show protection | Deposits + card | Deposits + card on file ✅; late cancel/no-show fee **policy stored** but **not charged automatically** |
| Waitlist | Full guest + staff workflow | DB + API ✅; **no guest UI**; team button **disabled (“Coming soon”)** |
| Intake / forms | Form builder + SOAP | Structured intake on book + profile ✅; **no form builder, e-sign, or charting** |
| Notifications | Custom copy + timing | Fixed 48h email / 24h SMS pattern; location instructions **not admin-editable** |
| Calendar views | Day/4-day/week | **Day only** (+ week day-picker strip); `/week` route **not built** |
| Duration/price by staff | Per staff | `staff_services.price_override` ✅; duration override **not per staff** |
| Checkout retail | Full POS | Add products ✅; **no sales tax UI**, **no cash/terminal**, **no barcode at checkout** |
| Inventory | PO + auto reorder | Track + alert ✅; **no purchase orders** |
| Client CRM depth | Files, segments, CLV dashboards | LTV + tags + search ✅; **no attachments**, **no marketing segments**, limited search facets |
| Staff permissions | Granular privilege groups | **Owner/front_desk vs stylist** only |
| Reports | Dozens + custom | **4 report blocks** + CSV |
| Mobile | Native Professional app | Responsive **web** team app; no App Store listing |
| API / integrations | Open API, webhooks | **None exposed** |

### Missing (“Missing”)

Precision Scheduling™ slot ranking · embeddable booking widget · client self-reschedule/cancel portal · gift cards at booking · service options that change price/duration · rooms/resource scheduling · processing-time double booking · recurring appointments · front desk status board · walk-in/group check-in · kiosk mode · two-way SMS / Contact Center · dedicated business phone · email/SMS **marketing** campaigns · audience builder · website builder · client marketplace · packages · memberships · gift cards (any channel) · voucher redemption at checkout · prebook shortcuts at checkout · multi-merchant/booth renter payment routing · integrated payroll · commission engine · QuickBooks/Zapier/Google/FB/IG/Reserve with Google · Google/Apple calendar sync · custom reports / forecasting · Snowflake/API · multi-location admin · white-label · HIPAA tier · native iOS/Android apps · EMV hardware program · Offset-style fee pass-through UI

---

## Feature matrix (grouped)

Legend: **Have** · **Partial** · **Missing** · Priority: **P0** launch · **P1** competitive · **P2** nice-to-have

### Booking (guest web)

| Feature | Boulevard | Us | Priority |
| --- | --- | --- | --- |
| Online booking | Have | Have | P0 |
| Multi-service cart | Have | Have | P0 |
| Staff selection | Have | Have | P0 |
| Add-ons in flow | Have | Have | P0 |
| Card on file | Have | Have | P0 |
| Deposits | Have | Have | P0 |
| Guest book (no account) | Have | Have | P0 |
| Branded experience | Have | Partial | P0 |
| Website embed widget | Have | Missing | P0 |
| Precision Scheduling™ | Have | Missing | P1 |
| Waitlist (guest) | Have | Partial | P0 |
| Self-reschedule | Have | Missing | P1 |
| Service customization (price/duration) | Have | Missing | P2 |
| Gift cards in booking | Have | Missing | P2 |
| Add-on upsell prompts | Have | Partial (cart suggestions) | P1 |
| Reserve with Google / social Book Now | Have | Missing | P2 |
| Client marketplace | Have | Missing | P2 |

### Calendar & scheduling (team)

| Feature | Boulevard | Us | Priority |
| --- | --- | --- | --- |
| Day calendar | Have | Have | P0 |
| Week / multi-day views | Have | Partial | P1 |
| Book from calendar | Have | Have | P0 |
| Time blocks | Have | Have (`/block-time`) | P0 |
| Staff colors | Have | Have | P1 |
| Status workflow | Have | Have | P0 |
| Waitlist management | Have | Partial | P0 |
| Front desk board | Have | Missing | P1 |
| Check-in / walk-ins / groups | Have | Missing | P1 |
| Recurring appointments | Have | Missing | P2 |
| Processing time / double book | Have | Missing | P2 |
| Resource / room scheduling | Have | Missing | P2 |
| Calendar sync (Google/Apple) | Have | Missing | P2 |

### Clients & CRM

| Feature | Boulevard | Us | Priority |
| --- | --- | --- | --- |
| Client profiles | Have | Have | P0 |
| Notes & tags | Have | Have | P0 |
| Visit history / timeline | Have | Have | P0 |
| LTV / visit metrics | Have | Partial | P1 |
| Referral tracking | Have | Partial | P1 |
| Advanced search / segments | Have | Missing | P1 |
| Client-specific pricing | Have | Missing | P2 |
| Files & images | Have | Missing | P2 |
| Form builder / SOAP / e-sign | Have | Missing | P2 |

### POS & checkout

| Feature | Boulevard | Us | Priority |
| --- | --- | --- | --- |
| Checkout from appointment | Have | Have | P0 |
| Tips | Have | Have | P0 |
| Retail add-ons | Have | Have | P0 |
| Cards on file charge | Have | Have | P0 |
| Deposit apply at checkout | Have | Have | P0 |
| Sales tax | Have | Partial (backend, no UI) | P0 |
| Cash / card-present | Have | Missing | P1 |
| Prebook at checkout | Have | Missing | P1 |
| Package/voucher redemption | Have | Missing | P1 |
| Self checkout | Have | Missing | P2 |
| Multi-merchant / booth split | Have | Missing | P2 |
| Dedicated POS hardware | Have | Missing | P2 |

### Marketing & communications

| Feature | Boulevard | Us | Priority |
| --- | --- | --- | --- |
| Email confirmations | Have | Have | P0 |
| SMS/email reminders | Have | Partial | P0 |
| Custom reminder timing/copy | Have | Missing | P1 |
| Two-way SMS | Have | Missing | P1 |
| Dedicated business number | Have | Missing | P1 |
| Email marketing campaigns | Have | Missing | P2 |
| SMS marketing | Have | Missing | P2 |
| Birthday / rebook automation | Have | Missing | P2 |

### Inventory

| Feature | Boulevard | Us | Priority |
| --- | --- | --- | --- |
| Stock tracking | Have | Have | P1 |
| Low-stock alerts | Have | Have | P1 |
| Barcode receive | Have | Have | P1 |
| Purchase orders | Have | Missing | P2 |
| Usage-based / decimal units | Have | Partial | P2 |
| Retail at POS | Have | Partial | P1 |

### Staff & admin

| Feature | Boulevard | Us | Priority |
| --- | --- | --- | --- |
| Staff accounts | Have | Have | P0 |
| Schedules | Have | Have | P0 |
| Service ↔ staff mapping | Have | Have | P0 |
| Granular permissions | Have | Partial | P1 |
| Commission tracking | Have | Missing | P2 |
| Payroll | Have | Missing | P2 |
| Multi-location | Have | Partial (schema only) | P2 |

### Reports

| Feature | Boulevard | Us | Priority |
| --- | --- | --- | --- |
| Revenue summary | Have | Have | P1 |
| Staff performance | Have | Partial | P1 |
| Cancellation / no-show | Have | Have | P1 |
| Inventory report | Have | Partial | P1 |
| Custom / beta reports | Have | Missing | P2 |
| Period comparison | Have | Missing | P2 |
| Export | Have | Have (CSV) | P1 |
| API / BI export | Have | Missing | P2 |

### Integrations & platform

| Feature | Boulevard | Us | Priority |
| --- | --- | --- | --- |
| Stripe payments | Have (Duo) | Have | P0 |
| Public booking API shape | Have | Partial (internal REST) | P1 |
| Webhooks / Open API | Have | Missing | P2 |
| QuickBooks / Zapier / social | Have | Missing | P2 |
| Native mobile apps | Have | Missing | P2 |

### Revenue products

| Feature | Boulevard | Us | Priority |
| --- | --- | --- | --- |
| Packages | Have | Missing | P1 |
| Memberships | Have | Missing | P2 |
| Gift cards | Have | Missing | P2 |

---

## Parity estimate by area

| Area | Est. parity | Notes |
| --- | ---: | --- |
| Guest online booking (core flow) | **55–65%** | Cart/reserve/pay solid; missing embed, precision, waitlist UI, self-serve changes |
| Team calendar & booking | **40–50%** | Strong day view; missing front desk, week view, waitlist ops |
| POS / checkout | **35–45%** | Card checkout works; tax, cash, packages, prebook gaps |
| Client CRM | **45–55%** | Good profile; missing files, segments, form builder |
| Marketing & comms | **10–15%** | Transactional only |
| Inventory | **40–50%** | Ops tracking without PO/retail depth |
| Staff / permissions | **30–40%** | Basic roles only |
| Reporting | **25–35%** | Starter dashboard vs Boulevard’s report library |
| Integrations | **5–10%** | Stripe + Supabase only |
| **Overall platform** | **~35–40%** | Weighted across Boulevard’s full suite |

---

## Top 10 gaps to close next (ordered)

1. **Embeddable booking on saloncitrineindy.com** — iframe/chromeless `/book` so guests never leave the brand site. *(P0 — biggest perceived “not Boulevard” gap for clients)*  
2. **Waitlist end-to-end** — guest UI when no slots + team waitlist inbox (schema/API exist; button is disabled). *(P0)*  
3. **Front desk / check-in board** — columns for expected / arrived / in service / done; quick status chips. *(P1 — Boulevard “Front Desk view”)*  
4. **Sales tax + tender options** — tax line in checkout; cash recording; card-on-file when missing. *(P0/P1 — UX audit items 32–34)*  
5. **Client self-service reschedule/cancel** — magic link from confirmation email with policy enforcement. *(P1)*  
6. **Precision-style slot ranking** — surface “recommended times” before full slot list. *(P1)*  
7. **Notification admin** — editable reminder copy + timing (Boulevard: 2-day / 1-day / same-day). *(P1)*  
8. **Two-way client messaging** — Twilio thread per client in team app (Contact Center lite). *(P1)*  
9. **Packages / prepaid vouchers** — sell + redeem at checkout without distorting revenue reports. *(P1)*  
10. **Week calendar view** — dedicated `/week` or view toggle (nav currently conflates dashboard/calendar). *(P1)*  

---

## Quick wins (1–2 days each)

| Win | Effort | Impact |
| --- | --- | --- |
| Wire team **Waitlist** button → list/filter `waitlist_entries`, book from entry | 1–2 d | Unblocks staff workflow; API done |
| **Waitlist CTA** on web datetime when zero slots | 1 d | Guest parity |
| **Sales tax row** in checkout UI (wire existing backend) | 1 d | POS credibility |
| **`/book?embed=1`** minimal chrome + embed snippet for marketing site | 1–2 d | Brand continuity |
| **Prebook shortcuts** (4/6/8 weeks) on checkout success screen | 1 d | Boulevard checkout delight |
| **Reminder timing** env/admin (24h/48h/custom) | 1 d | Ops flexibility |
| **Week view route** using existing calendar data loader | 2 d | Manager scheduling |
| **Collect card at checkout** when `hasCardOnFile === false` | 1–2 d | Close failed checkouts |
| **Recommended times** sort (gap-fill heuristic on existing slots) | 2 d | Precision Scheduling lite |
| **Client photo upload** on profile (reuse product image storage pattern) | 2 d | CRM depth |

---

## Merged findings from prior agent work

From **`COMPETITOR_UX_RESEARCH.md`** (agent 245b0083 lineage):

- Boulevard **cart booking SDK** validated our `/book` flow mapping — architecture direction is correct.  
- User praise: booking flow, POS checkout, stylist reports — we should **not** over-build reports early; nail checkout + book first.  
- Boulevard weaknesses to exploit: **buggy mobile app** (our responsive web + full browser checkout is an advantage), **hidden fees/tiers**, **support friction**, **package accounting pain**.  
- GlossGenius/Vagaro cherry-picks still apply: passwordless book ✅, embed widget ⬜, kiosk check-in ⬜, decimal inventory partial.

From **`UX_AUDIT.md`**:

- Open P0/P1: week calendar, sales tax, cash/card-present, card-at-checkout, package accounting, skip link.  
- Recent sprint improved toasts, skeletons, checkout tips — **polish is catching up; feature breadth is not**.

From **`BOULEVARD_BOOKING_BLUEPRINT.md`**:

- Documented parity: cart, reserve, deposits ✅; waitlist API ✅; intake/forms **partial**.

---

## Recommended next sprint focus

**Theme: “Guest book feels production; front desk can run the day.”**

| Sprint goal | Deliverables |
| --- | --- |
| **Guest parity** | Embed widget + waitlist guest UI + recommended time slots |
| **Front desk** | Check-in status board on `/book` + enable waitlist management |
| **Checkout hardening** | Sales tax UI, collect card if missing, prebook shortcut |
| **Defer** | Marketing campaigns, payroll, gift cards, API/webhooks, multi-location |

This gets the platform from “demo-able booking” to “salon can operate Saturday” without attempting Boulevard’s entire $300+/mo enterprise surface.

---

## References

- Review: https://thesalonbusiness.com/boulevard-software-review/  
- Developers: https://developers.joinblvd.com/  
- Internal: `docs/BOULEVARD_BOOKING_BLUEPRINT.md`, `docs/COMPETITOR_UX_RESEARCH.md`, `docs/UX_AUDIT.md`
