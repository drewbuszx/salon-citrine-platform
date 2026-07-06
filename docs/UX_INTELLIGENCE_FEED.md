# UX Intelligence Feed

> **Last updated:** July 6, 2026  
> **Sources scanned:** Boulevard, GlossGenius, Vagaro, Fresha, Square Appointments, Phorest  
> **Related docs:** [COMPETITOR_UX_RESEARCH.md](./COMPETITOR_UX_RESEARCH.md) · [BOULEVARD_FEATURE_GAP.md](./BOULEVARD_FEATURE_GAP.md) · [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) · [UX_AUDIT.md](./UX_AUDIT.md) · [TEAM_SIDEBAR_DECISION.md](./TEAM_SIDEBAR_DECISION.md)

**Agents: read this file FIRST before any team (`apps/team`) or guest booking (`apps/web`) UI work.** Apply the brief for the page you are touching. Do not duplicate competitor research already captured in linked docs — synthesize and ship.

---

## Executive summary (industry shifts, July 2026)

- **Boulevard doubled down on front-of-house mobile** — Professional App Front Desk View (horizontal status columns, long-press to move clients) and granular permissions launch in early 2026; their native app is still widely panned for missing reports, messaging, and checkout ([changelog](https://changelog.joinblvd.com/), [UserVoice](https://boulevard.uservoice.com/forums/949798-ideas-hub/suggestions/46480066-improved-mobile-app-capabilities)).
- **Frictionless guest booking is the bar** — GlossGenius and Boulevard both win praise for no client app download and minimal account friction; Fresha and marketplace-first tools lose trust when they force account creation + card-on-file before the guest understands why ([G2 GlossGenius](https://www.beautyplaybook.com/blog/glossgenius), [Fresha App Store reviews](https://apps.apple.com/us/app/fresha-for-customers/id1297230801)).
- **Embed beats redirect** — Boulevard overlay, Vagaro iframe widget, and Mangomint-style on-site booking convert better than sending guests to a third-party URL; Fresha's link-out-only model and 20% marketplace commission are explicit anti-patterns for Salon Citrine ([Vagaro widget docs](https://support.vagaro.com/hc/en-us/articles/204347860), [Fresha review 2026](https://thesalonbusiness.com/fresha-review/)).

---

## Actionable tips for agents (prioritized)

### P0 — ship this week

1. **Waitlist CTA when zero slots, card to secure spot** — Boulevard shows **Join Waitlist** on the datetime step when no times fit; client must add card before confirm (not charged until service complete). Our API exists; ensure web datetime step surfaces this CTA and copy explains card hold. *Source: [Boulevard waitlist](https://support.boulevard.io/en/articles/5941433-waitlist). Applies: `apps/web` datetime step, `apps/team` `/waitlist`.*
2. **Embeddable booking overlay on marketing site** — Boulevard Self-Booking Overlay slides in from the left over the salon website; closing returns guest to same page. Ship `/book?embed=1` minimal chrome + iframe snippet for saloncitrineindy.com. *Source: [Client booking experience](https://support.boulevard.io/en/articles/5941525-the-client-booking-experience). Applies: `apps/web` layout, marketing embed docs. See [BOULEVARD_FEATURE_GAP.md § Top gaps #1](./BOULEVARD_FEATURE_GAP.md).*
3. **Returning-client OTP, not password wall** — Boulevard identifies returning clients by email/phone, sends verification code, then continues booking; new guests finish without account until end. We already do guest book — mirror OTP step for returning lookup instead of forcing login. *Source: Boulevard booking experience article. Applies: `apps/web` details/lookup step.*
4. **Tip presets with custom validation** — Boulevard users report accidental **$0.10 instead of $10** tips when custom tip is a free-text field. Use preset chips (15/18/20/25%) + custom input with min $1 and decimal guard. *Source: [COMPETITOR_UX_RESEARCH.md](./COMPETITOR_UX_RESEARCH.md), G2 Boulevard. Applies: `apps/team` checkout.*
5. **Team waitlist inbox: Edit / Book / Remove per row** — Boulevard waitlist table shows client, phone, staff, services, preferred time, notes; each row has explicit actions. Wire our disabled waitlist button to this pattern (API done). *Source: [Boulevard waitlist dashboard screenshots](https://support.boulevard.io/en/articles/5941433-waitlist). Applies: `apps/team` `/waitlist`.*
6. **Sidebar active state = 3px citrine left border** — Regression called out in [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md); Boulevard uses left-accent nav. Do not ship list pages without `TeamSidebarNav` / `TeamSidebarFilter` tokens from [TEAM_SIDEBAR_DECISION.md](./TEAM_SIDEBAR_DECISION.md). *Applies: all `TeamListLayout` pages.*

### P1 — next sprint

7. **Front Desk status board** — Boulevard 2026 Front Desk View: columns for today's clients (expected → arrived → in service → done), swipe/long-press to advance. Mobile-first for iPad at reception. *Source: [changelog Front Desk](https://changelog.joinblvd.com/keep-track-of-today-s-clients-in-new-professional-app-front-desk-view-340677). Applies: new team route or calendar mode.*
8. **Recommended times before full slot grid** — Boulevard Precision Scheduling ranks "best" gaps (ideal 30/60/90 min) before showing every slot. Sort our slot list with gap-fill heuristic + "Recommended" label on 2–3 times. *Source: [BOULEVARD_FEATURE_GAP.md](./BOULEVARD_FEATURE_GAP.md). Applies: `apps/web` availability.*
9. **Intake/forms BEFORE confirm, not after** — Square Appointments users hate consent forms sent **after** booking (chase-down before appointment). Collect service-specific intake on book flow or block confirm until complete. *Source: [Google Play Square reviews](https://play.google.com/store/apps/details?id=com.squareup.apos). Applies: `apps/web` details step.*
10. **Prebook shortcuts at checkout** — Boulevard checkout offers **4 / 6 / 8 week** rebook jumps. We added links on success — ensure they are visible primary actions post-payment, not footer links. *Source: Boulevard POS reviews, [UX_AUDIT.md pass 3](./UX_AUDIT.md). Applies: checkout success.*
11. **Vagaro-style embed widget options** — Vagaro generates iframe, popup, or new-tab widget with per-location and provider variants; multi-location lists grouped by state. Document three embed modes for our `/book`. *Source: [Vagaro booking widget](https://support.vagaro.com/hc/en-us/articles/204347860). Applies: embed docs + web.*
12. **Express check-in kiosk mode** — Vagaro Check-In App: tablet kiosk, QR scan from reminder email or customer app, Guided Access / app pinning so guests can't exit. Optional same-day book + waitlist from kiosk. *Source: [Vagaro check-in](https://support.vagaro.com/hc/en-us/articles/360038981033). Applies: future team kiosk route.*
13. **Phorest-style "Rebook" on client home** — Logged-in clients see secondary **Rebook appointment** CTA from last visit (one tap to repeat service + staff). *Source: [Phorest branded app](https://www.phorest.com/us/blog/click-play-with-the-brand-new-phorest-salon-app/). Applies: future client portal.*
14. **Service search on long menus** — Phorest 2025 booking upgrade adds search field on service list; critical for 40+ services. *Source: [Phorest booking upgrade](https://www.phorest.com/updates/get-ready-for-an-online-booking-upgrade/). Applies: `apps/web` services step.*
15. **Dashboard waitlist notification badge** — Boulevard shows dashboard alert when client joins waitlist. Surface count on team dashboard + calendar waitlist button (number = clients waiting today). *Source: Boulevard waitlist notifications. Applies: `apps/team` dashboard.*

### P2 — watch list

16. **GlossGenius branded booking page templates** — Solo stylists praise out-of-box premium look (colors/fonts) without a designer; study their step spacing and hero typography, map to our cream/citrine tokens — never copy their purple-adjacent palette. *Source: [GlossGenius vs Booksy](https://pabau.com/blog/glossgenius-vs-booksy/).*
17. **Fresha marketplace commission trap** — 20% on "new" marketplace clients; salons must import existing clients first. Do **not** build a commission marketplace; optional discovery is long-term only. *Source: [Fresha review 2026](https://thesalonbusiness.com/fresha-review/).*
18. **Square modular app fragmentation** — Growing salons complain about switching between Square apps for marketing vs appointments. Keep team + web in one monorepo nav, one sign-in. *Source: [Square Appointments review 2026](https://thesalonbusiness.com/square-appointments-review/).*
19. **Boulevard "first available" stylist order** — UserVoice top request: salons can't control stylist sort order when client picks first available (staff morale issue). If we add "Any stylist", allow admin-defined priority order. *Source: [Boulevard UserVoice #50995132](https://boulevard.uservoice.com/forums/949798-ideas-hub/suggestions/50995132).*
20. **Phorest TreatCard / loyalty surfacing** — Branded app shows loyalty points on home; consider LTV/visit badges on client profile (partial today). *Source: Phorest app features.*

---

## Pattern library (steal responsibly)

| Pattern | Who does it best | Salon Citrine status | Agent tip |
| --- | --- | --- | --- |
| Booking progress indicator | GlossGenius | Have (`BookingSteps.astro`) | Keep 4–5 steps max; label each step; sage checkmarks on completed |
| Overlay embed (no redirect) | Boulevard | Missing | Ship `embed=1`; slide-in feel optional; must close back to marketing site |
| Guest book (no account) | GlossGenius / Boulevard | Have | Never require account creation; OTP for returning only |
| Cart-style multi-service | Phorest / Boulevard | Have | Allow edit/remove in cart before datetime; show running total |
| Waitlist + card hold | Boulevard | Partial (API, guest UI in progress) | Join from empty slot state; explain no charge until complete |
| Waitlist staff inbox | Boulevard | Partial | Table with Book/Edit/Remove; filter by day/staff/service |
| Preferred time chips | Boulevard (waitlist context) | Missing | For waitlist, offer Morning / Afternoon / Evening chips + optional note — not full datetime picker for "any time" |
| Precision / recommended slots | Boulevard | Missing | Highlight 2–3 slots; "More times" expands grid |
| Front desk columns | Boulevard (2026) | Missing | Horizontal scroll columns; status chips; iPad touch targets ≥44px |
| Check-in kiosk / QR | Vagaro | Missing | Tablet route; QR from SMS reminder; lock device to app |
| Tip presets + validation | Boulevard (gap) | Partial | Presets + min amount; prevent $0.10 typo |
| Prebook at checkout | Boulevard | Partial | 4/6/8 week buttons as primary post-checkout actions |
| Intake before confirm | Square (lesson) | Partial | Forms on book flow, not post-book email chase |
| Branded booking aesthetic | GlossGenius | Partial | Cream gradient, Cormorant headlines — see [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) |
| Sidebar filter collapsibles | Boulevard | Have | Use `TeamSidebarFilter`; 12px chevrons; `(N)` counts |
| Service search | Phorest | Missing | Add search input when services > 15 |
| Client rebook shortcut | Phorest | Missing | Client portal P2 |
| Consent/card copy transparency | Fresha (anti) | Partial | Explain *why* card is required (hold, deposit, waitlist) before Stripe field |
| Marketplace discovery | Fresha / Vagaro | Missing | Defer; no commission model |
| Month calendar view | Square (requested) | Missing | Week view P1; month P2 for managers |

---

## Anti-patterns to avoid

What users hate in reviews (G2, Reddit, App Store, UserVoice, Trustpilot):

| Anti-pattern | Where seen | Salon Citrine rule |
| --- | --- | --- |
| Force account creation to book | Fresha, some Vagaro flows | Guest path always available |
| Card required with no explanation | Fresha App Store ("I don't like adding my card just to book") | Policy ack + one-line reason before Stripe |
| Consent/forms after booking | Square Appointments Play Store | Forms before confirm or block confirm |
| Tip typo ($0.10 vs $10) | Boulevard G2 | Presets + validation |
| Booking widget redirect off brand site | Fresha | Embed on saloncitrineindy.com |
| 20% surprise marketplace fee | Fresha | No commission marketplace |
| Mobile app missing checkout/reports | Boulevard UserVoice | Full checkout in responsive team web |
| "First available" breaks stylist fairness | Boulevard UserVoice | Configurable stylist order when we ship it |
| Generic purple/blue SaaS chrome | Boulevard (competitor) | Citrine/sage/cream only — [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) |
| Giant unscoped sidebar SVGs | Our past bug | Global `team-list-sidebar.css` only |
| Disabled UI with no alternative | Our waitlist button was "Coming soon" | Ship or hide; never tease dead controls |
| Hidden fees / tier gating | Boulevard, Square add-ons | Transparent pricing in UI copy where relevant |

---

## Feed for other agents (copy-paste briefs)

### Brief: Clients page

**Do**
- Use `TeamListLayout` + `TeamSidebarFilter` with collapsible sections and `(N)` counts per [TEAM_SIDEBAR_DECISION.md](./TEAM_SIDEBAR_DECISION.md)
- Zebra table rows, sage hover, citrine 3px left border on sidebar active filter
- Show visit count + LTV in row or profile header (Boulevard CRM depth lite)
- Empty search state with hint ("Try phone or email") not blank table
- Profile timeline for appointments + notes (Boulevard client history pattern)

**Don't**
- Don't use checkbox filters for nav-style links (Tasks pattern on Clients)
- Don't concatenate label+count without space (`Category7`)
- Don't scope sidebar CSS in Astro component `<style>` blocks (breaks slotted content)
- Don't add marketing segments UI without schema
- Don't clone Boulevard purple accent

**Reference:** [Boulevard client profile docs](https://support.boulevard.io/en/articles/5941525-the-client-booking-experience) · [DESIGN_SYSTEM.md § Tables](./DESIGN_SYSTEM.md)

---

### Brief: Book flow

**Do**
- 4–5 step progress (`BookingSteps`); cream gradient background; one primary citrine CTA per step
- Guest book: email/phone only; returning client → OTP verification
- Cart: add/edit/remove services before datetime; show duration + price subtotal
- Zero slots → **Join waitlist** with card hold + Morning/Afternoon/Evening preference chips
- Returning slot reservation countdown visible (Boulevard reserve pattern)
- Support `?embed=1` for marketing site iframe

**Don't**
- Don't require password or app download (GlossGenius win condition)
- Don't send intake forms after confirmation (Square failure mode)
- Don't use datetime picker for open-ended waitlist preference
- Don't redirect to external booking domain
- Don't add gift cards/packages UI without backend schema

**Reference:** [Boulevard booking experience](https://support.boulevard.io/en/articles/5941525-the-client-booking-experience) · [BOULEVARD_BOOKING_BLUEPRINT.md](./BOULEVARD_BOOKING_BLUEPRINT.md)

---

### Brief: Checkout

**Do**
- Tip presets 15/18/20/25% + custom with **minimum $1** and 2-decimal validation
- Show deposit applied, retail tax row, running total (UX audit pass 3)
- Primary **Prebook in 4 / 6 / 8 weeks** actions on success screen
- Toast + inline error on Stripe failure; collect card if `hasCardOnFile === false`
- Service lines + retail add-ons in one scrollable pane (Boulevard POS)

**Don't**
- Don't allow $0.10 tip entry bug
- Don't hide tax until after charge
- Don't desktop-only checkout flows (Boulevard mobile gap = our advantage)
- Don't add BNPL/packages without schema
- Don't use purple or blue action colors

**Reference:** [COMPETITOR_UX_RESEARCH.md § Boulevard tipping](./COMPETITOR_UX_RESEARCH.md) · [UX_AUDIT.md pass 3](./UX_AUDIT.md)

---

### Brief: Dashboard

**Do**
- Upcoming appointments pulse + stat cards with display font numbers ([DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md))
- Waitlist count badge when entries exist (Boulevard dashboard notification)
- Quick links to calendar, waitlist, low stock (manager morning routine)
- Mobile-readable at iPad arm's length (16px body min on team)
- Owner vs stylist scoping already in roles — reflect in copy

**Don't**
- Don't build Boulevard-scale report library yet (feature gap doc says defer)
- Don't add marketing campaign widgets without comms schema
- Don't overcrowd — one citrine accent per viewport region
- Don't native-app-only assumptions; web-first
- Don't duplicate full Front Desk board on dashboard — link to it when built

**Reference:** [Boulevard changelog Front Desk](https://changelog.joinblvd.com/keep-track-of-today-s-clients-in-new-professional-app-front-desk-view-340677) · [BOULEVARD_FEATURE_GAP.md § Quick wins](./BOULEVARD_FEATURE_GAP.md)

---

## Changelog

| Date | Finding | Action taken by platform |
| --- | --- | --- |
| 2026-07-06 | Initial UX Intelligence Feed created from Boulevard/GlossGenius/Vagaro/Fresha/Square/Phorest research | Added `docs/UX_INTELLIGENCE_FEED.md`, `docs/AGENT_UX_INTELLIGENCE.md`, `.cursor/rules/ux-intelligence.mdc` |
| 2026-07-06 | Cross-linked existing competitor/gap/design docs | Synthesized into prioritized P0/P1/P2 tips; no duplicate of COMPETITOR_UX_RESEARCH tables |
| 2026-07-06 | Boulevard 2026 Front Desk + permissions launch | Flagged as P1 Front Desk board pattern for team app |

---

*Maintained by the UX Intelligence Agent. Update weekly or before UI sprints. Procedure: [AGENT_UX_INTELLIGENCE.md](./AGENT_UX_INTELLIGENCE.md)*
