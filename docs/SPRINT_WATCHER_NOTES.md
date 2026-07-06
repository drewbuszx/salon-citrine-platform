# Sprint Watcher Notes — Creative Strategist Handoff

> **Role:** Watcher / Creative strategist (10-minute sprint)  
> **Date:** July 6, 2026  
> **Repo:** `salon-citrine-platform`  
> **Sources read:** `UX_INTELLIGENCE_FEED.md`, `SALON_CITRINE_VISION.md`, `BOULEVARD_FEATURE_GAP.md`, `VISUAL_QA_REPORT.md`, codebase browse of 8 screen areas

**For the next implementation group:** This is observation and suggestion only — no large features shipped here. Prioritize P0 items that turn "demo-able" into "Saturday-ready."

---

## 10 feature suggestions competitors don't do well

These are specific, exciting, and aligned with the vision doc — not Boulevard checkbox parity.

| # | Feature | Why competitors fail | Salon Citrine angle |
|---|---------|---------------------|---------------------|
| 1 | **Auto waitlist match with cascade** | Boulevard: join waitlist → staff manually hunts. Fresha/Vagaro: list-only, no scoring. | When a slot opens, rank waitlist by stylist pref + service + time flexibility + days waiting + LTV; SMS top match with 15-min hold; auto-cascade on decline. Front desk sees *"Matched: Elena, 3 PM color"* — one tap confirm. |
| 2 | **Formula vault with photo proof** | GlossGenius: no formula depth. Boulevard: notes exist but no visual search. Phorest: basic notes. | Searchable color/chemical history tied to visit date + result photo. *"Show me Sarah's last balayage"* → formula, developer ratio, processing time, thumbnail. Teaser UI on client profile now; full vault Phase 2. |
| 3 | **Gap-fill intelligence on day board** | Everyone shows empty cells. Nobody ranks *who* fits the hole. | On cancellation, surface 3 ranked fits: rebook-due clients, waitlist matches, processing-time nests (blowout inside color). One-tap book from calendar — not a phone tree. |
| 4 | **Stylist micro-brand book links** | Boulevard: salon-centric book URL. Admin bottleneck for availability. | `book.salon.com/jamie` with stylist-owned rules (no Tuesdays, request-only services, portfolio hero). Revenue attribution without commission spreadsheet hell. Partially exists (`?staff=slug` on dashboard) — extend to full micro-brand page. |
| 5 | **Retail intelligence at checkout** | Square/Boulevard: generic product search. No service-context brain. | After balayage: *"Clients like Sarah bought Olaplex No. 3."* Suppress if out of stock or bought last visit; suggest companion SKU instead. Tied to inventory + purchase history. |
| 6 | **Silent ops with transparent card copy** | Fresha: card required, no explanation (App Store rage). Square: forms *after* booking. | Card hold with one-line *why* before Stripe (deposit / waitlist / no-show protection). Intake collected *before* confirm, not post-book email chase. Reminders at configurable intervals — zero 9 AM "did I book?" calls. |
| 7 | **One-tap rebook loop at checkout** | Boulevard has 4/6/8 week buttons but buried; most tools treat checkout as terminal. | Primary post-payment actions: **Book again in 4 / 6 / 8 weeks** with stylist + service stack pre-filled from visit. Learn cadence (Sarah always 6 weeks with Jamie → that's default). |
| 8 | **Front desk status board (not calendar)** | Boulevard 2026 Front Desk is new and mobile-app-only; team web still weak. Vagaro kiosk is separate product. | Horizontal columns: Expected → Arrived → In service → Done. Swipe/long-press to advance. iPad at reception, arm's length. Link from dashboard pulse — don't duplicate full calendar. |
| 9 | **Precision scheduling lite** | Boulevard Precision Scheduling™ is marketing-heavy; others list slots chronologically. | Highlight 2–3 "Recommended" times (gap-fill heuristic: ideal 30/60/90 min gaps) before "More times" expands full grid. Guest sees curation, not a wall of buttons. |
| 10 | **Client memory panel at chair-side** | CRM cards everywhere; *context at moment of service* nowhere. | Single panel on checkout + client profile: last visit summary, formula snippet, allergy flags, preferred beverage, retail history, typical rebook interval. Compounds every visit — tenth visit feels effortless. |

---

## 5 "wow moments" for salon professionals

Moments that make a stylist or front-desk pro say *"finally"* — not *"nice dashboard."*

1. **Cancellation → booked in 8 seconds** — Slot opens at 2:30 PM; phone buzzes with top waitlist match; front desk taps Confirm; client gets SMS before the stylist finishes the current blowout.

2. **Formula in one search** — Color client returns after 8 weeks; stylist types "balayage" in client profile; last formula + result photo appears without opening Notes, Instagram, or a paper card.

3. **Checkout → next appointment before cape comes off** — Tap "6 weeks" on success screen; calendar holds the slot; confirmation SMS sends while client is still at the mirror.

4. **Morning pulse glance** — Owner opens dashboard at 11 AM: *"Pacing ahead · Jess fully booked · 3 on waitlist want afternoon color · Shampoo low"* — no report builder, no export.

5. **Guest books on salon site, not vendor portal** — Embed overlay on saloncitrineindy.com; cream gradient, Cormorant headlines, passwordless return; guest never feels like they left the salon brand.

---

## 5 anti-patterns to fix next sprint

Observed in current code/UI — fix before adding breadth.

| # | Anti-pattern | Where seen | Fix |
|---|--------------|------------|-----|
| 1 | **"Coming soon" tease buttons** | Clients "Merge Clients" (`data-coming-soon` → toast); `TeamListExportButton` same pattern; disabled location filters | Ship or hide. Never tease dead controls ([UX_INTELLIGENCE_FEED anti-patterns](UX_INTELLIGENCE_FEED.md)). Remove export/merge until wired. |
| 2 | **Waitlist table is read-only** | `/team/waitlist` — no Book / Edit / Remove row actions despite P0 brief | Add action column per Boulevard pattern; wire to book flow + PATCH/DELETE API. Table without actions is a todo list with extra steps. |
| 3 | **Dashboard "Sale / Checkout" goes to `/book`** | `index.astro` line 96–98 — both quick actions link to calendar | Checkout action should deep-link to today's first open appointment checkout or a walk-in sale entry — not the booking grid. |
| 4 | **Clients list hides CRM depth** | Index table shows name/phone/email only — LTV, visit count, tags exist in API/profile but not list rows | Surface visit count + LTV in table or row subtitle; empty search should hint "Try phone or email" not blank table. |
| 5 | **Book Worker not deployed / auth bleed** | [VISUAL_QA_REPORT](VISUAL_QA_REPORT.md): `/book/` on team Worker redirects to staff login; book subdomain 404 | Deploy `apps/web` to `salon-citrine-book` Worker; verify `embed=1` on marketing site. Biggest guest-facing credibility gap. |

---

## Cross-screen consistency gaps

| Gap | Screens affected | Expected (DESIGN_SYSTEM + TEAM_SIDEBAR_DECISION) |
|-----|------------------|--------------------------------------------------|
| **Sidebar filter vs nav pattern** | Clients/Stock use checkbox/radio filters; Tasks uses `TeamSidebarNav` buttons; Waitlist has `showSidebar={false}` | Nav-style views → `TeamSidebarNav` + citrine 3px left border. Refine-style filters → `TeamListFilter` + `(N)` counts. Don't mix checkbox nav on Clients. |
| **Waitlist nav active state** | Waitlist page uses `activeNav="book"` not a dedicated tab | Waitlist is operational — either add sub-nav highlight under Book or badge-only (calendar has badge; waitlist page feels orphaned). |
| **Header action verb consistency** | "Add New Client" vs "Add product" vs "Add To Waitlist" vs "+ New entry" | Pick one pattern: `+ Add client` / `+ Add product` / `+ Add to waitlist` — sentence case, no Title Case inconsistency. |
| **Empty state illustration language** | Waitlist uses ☁ cloud; Tasks uses notebook metaphor; Clients generic table empty | Unify: icon circle on stone-100 + strong title + hint line (waitlist empty state is the template). |
| **Manager vs stylist scoping copy** | Team Pulse says "Salon-wide · today" vs "Your book · today" — good | Extend same scoping language to Clients filters, Waitlist add button (manager-only), Events staff filter — stylist should never wonder "is this mine or everyone's?" |
| **Booking link URL drift** | Dashboard uses `PUBLIC_BOOK_URL`; client profile uses `saloncitrineindy.com/book` fallback | Single env-driven book origin everywhere; stylist micro-link should copy-to-clipboard with toast. |
| **List page export** | Clients + Stock have export button (coming soon) | Either wire CSV export (reports pattern exists) or remove from both — don't ship one working and one fake. |

---

## Bold ideas (teasers for roadmap comms)

### Formula vault teaser
- **Now:** Client profile has plain "Formula notes" textarea + note type "Formula" in timeline — functional but invisible as a product story.
- **Teaser:** Add a locked "Formula Vault" panel on profile: *"Coming soon — searchable formulas with photos. Your color history, one tap."* Greyed mock of search + photo grid. Builds stylist anticipation; seeds schema (`formula_entries` with photo_url, visit_id, brand, mix_ratio).
- **Why bold:** Stylists will switch software for this. No competitor owns it.

### Auto waitlist match
- **Now:** Guest can join waitlist on datetime when no slots; team sees table; no matching engine.
- **Teaser:** When staff opens waitlist or a cancellation fires, show a **"Suggested matches"** strip above the table: ranked cards with score badge (*"92% fit — prefers afternoon, waited 4 days"*). v1 can be manual "Notify" button; v2 auto-SMS with hold timer.
- **Why bold:** Turns Boulevard's biggest ops insult ("manual hunt") into Salon Citrine's headline.

### Stylist micro-brand
- **Now:** Dashboard shows "Your booking link" with `?staff=slug`; `my-book.astro` exists for self-service.
- **Teaser:** Public stylist page at `/book/stylist/jamie` — hero photo, portfolio strip, specialties, Instagram handle, personal availability blurb. Book CTA pre-selects stylist. Admin sets guardrails; stylist edits bio + portfolio in `my-book`.
- **Why bold:** GlossGenius wins solo stylists on aesthetics; we win the *collective salon* where each pro is still a brand. Salon is micro-brands, not staff rows.

---

## Per-screen notes (2 polish tips + 1 feature for NEXT group)

### 1. Dashboard (`/team/` — `index.astro`)

**Polish**
- Upcoming cards link to checkout — good — but add relative urgency: *"In 25 min"* for today's appointments using pulse-style live dot on first card.
- "Your booking link" should be copy-to-clipboard button with success toast, not just a link that opens new tab (stylists share via text/DM constantly).

**Feature (next group)**
- Add **waitlist notification badge** on dashboard hero or pulse when `waitlistActive > 0` with link — pulse already counts waitlist; surface push-style alert copy: *"2 clients waiting for openings today."*

---

### 2. Book / Calendar (`/team/book` — `DayCalendar.astro`)

**Polish**
- Waitlist subbar button + badge exists — ensure badge shows **today-relevant** count, not all-time active entries (filter by preferred date window).
- Week day-picker strip exists but no full week grid — add visible "Week view" label or disable with tooltip until `/week` ships (avoid dead-end expectation).

**Feature (next group)**
- **Front desk status board mode** — toggle on calendar subbar: switch from time grid to horizontal status columns (Expected / Arrived / In service / Done) for today's appointments only.

---

### 3. Clients (`/team/clients` — list + `[id].astro` profile)

**Polish**
- Remove or hide "Merge Clients" and disabled location filters until implemented — they erode trust ([anti-pattern #1](#5-anti-patterns-to-fix-next-sprint)).
- Client list table: add **visit count + LTV** columns or subtitle under name (data available on profile API — expose in list query).

**Feature (next group)**
- **Client memory panel** on profile header: collapsible card with last visit, formula snippet, allergies from intake, rebook cadence — single glance before "Book again."

---

### 4. Stock / Inventory (`/team/inventory`)

**Polish**
- Low-stock banner + filter shortcut exist — link banner CTA copy to match Team Pulse hint text (*"3 products below reorder point"*) for cross-screen vocabulary consistency.
- "Scan to check in" hidden on mobile (`stock-page__scan-desktop`) — add FAB or toolbar scan on mobile; front desk scans from phone in stockroom.

**Feature (next group)**
- **Checkout-aware low stock**: when product is under reorder threshold, show badge on checkout retail search — *"Only 2 left"* — prevents selling air.

---

### 5. Tasks (`/team/tasks`)

**Polish**
- Notebook metaphor is charming but **sidebar filter placeholders** still marked coming soon in UX audit — either add Due date / Assignee filters or remove empty filter sections.
- "Needs attention" badge on sidebar nav — verify it pulses or uses citrine when count > 0 (Tasks is the reference for `TeamSidebarNav` — make it the gold standard).

**Polish (2)**
- Completed view should show completion timestamp + who claimed — accountability for salon checklists (opening/closing duties).

**Feature (next group)**
- **Auto-task from ops events**: when waitlist match fails or low-stock triggers, create optional task (*"Reorder Olaplex No. 3"*, *"Call Elena — waitlist slot declined"*) — connects Tasks to Pulse.

---

### 6. Events (`/team/events`)

**Polish**
- Month shortcuts in sidebar (Today / Previous / Next) duplicate header navigation — consolidate or make shortcuts sticky on scroll for long event lists.
- Legend for event types (closure / community / announcement / time off) — ensure color tokens match DESIGN_SYSTEM sage/citrine/rose — not arbitrary hues per type.

**Feature (next group)**
- **Closure → booking block sync**: when manager adds salon closure event, auto-block bookable slots on web datetime for that date range — silent ops, no double-book on holiday.

---

### 7. Waitlist (`/team/waitlist`)

**Polish**
- Empty state (☁ + copy) is best-in-class — reuse this pattern on Clients/Tasks empty states.
- Add **preferred time chips** display (Morning / Afternoon / Evening) in table column instead of raw time ranges when guest selected chip — matches web waitlist form.

**Feature (next group)**
- **Row actions: Book / Edit / Remove** — P0 from UX_INTELLIGENCE_FEED. Book opens calendar with client + service pre-filled; Remove archives entry; Edit opens modal. Without this, waitlist is display-only.

---

### 8. Web book (`apps/web` — `/book` flow)

**Polish**
- Waitlist offer on datetime when no slots — good progress — add **card-on-file explanation** before Stripe (*"Card secures your spot — not charged until service"* per Fresha anti-pattern lesson).
- `embed=1` layout exists in `BookingLayout` — document + test on saloncitrineindy.com iframe; hide header/footer in embed mode consistently on all steps (cart, stylist, details).

**Feature (next group)**
- **Recommended times** on slot picker: sort 2–3 slots with "Recommended" sage badge using gap-fill heuristic before showing full list — Precision Scheduling lite without enterprise complexity.

---

## Watcher summary for Drew

**Platform state:** Booking spine and team list chrome are real. Vision doc is sharp. Gap is *ops intelligence* (waitlist actions, gap-fill, front desk board) and *guest embed deploy* — not cart API correctness.

**Top 3 most exciting suggestions:**
1. **Auto waitlist match with cascade** — highest daily painkiller; Boulevard's manual hunt is the insult we answer.
2. **Formula vault with photo proof** — stylist lock-in; nobody owns it; teaser on profile builds hype.
3. **Gap-fill intelligence on day board** — empty cells become ranked opportunities; combines waitlist + rebook + processing time in one motion.

**Next group should NOT:** add marketing campaigns, payroll, or report library. **Should:** wire waitlist row actions, deploy book Worker + embed, fix dashboard checkout link, remove coming-soon teases.

---

*Watcher sprint complete. Hand off to implementation group.*
