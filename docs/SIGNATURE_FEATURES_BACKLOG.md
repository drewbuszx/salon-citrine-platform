# Signature Features Backlog

Prioritized by impact on salon professionals. Effort: **S** (≤3 days), **M** (1–2 weeks), **L** (2–4 weeks).

Legend quotes explain why each feature matters — not to stakeholders, to the people in the chair.

---

## P0 — Ship in Phase 1 (Front desk can't live without it)

| # | Feature | Effort | Depends on | Legend quote |
|---|---------|--------|------------|--------------|
| 1 | **Team Pulse strip** | S | Appointments, waitlist, inventory APIs | *"The owner should open the app once and know if today's going to be a good day — not run a report."* |
| 2 | **Waitlist auto-match (v1)** | L | Waitlist API, appointments, notifications | *"A cancellation at 2 PM isn't a problem. It's an opportunity — if the software does the matching instead of the receptionist."* |
| 3 | **Check-in board** | M | Appointment statuses, real-time updates | *"Front desk needs to see the room — who's waiting, who's late, who's out — not a spreadsheet with timestamps."* |
| 4 | **Embed book widget** | M | Public book flow, branding tokens | *"The booking experience should feel like the salon's website, not like logging into someone else's SaaS."* |
| 5 | **Sidebar + list page polish** | M | TeamSidebarNav, TeamSidebarFilter | *"If the sidebar looks broken, nobody trusts the rest of the product. Polish is credibility."* |
| 6 | **Silent confirmations + reminders** | M | SMS/email provider, appointment triggers | *"The phone shouldn't ring at 9 AM because someone forgot they had a 10 AM."* |

---

## P1 — Ship in Phase 2 (Stylist love)

| # | Feature | Effort | Depends on | Legend quote |
|---|---------|--------|------------|--------------|
| 7 | **Formula vault** | L | Client profiles, photo storage, search | *"Stylists will leave software that loses their formulas. They'll tattoo software that keeps them."* |
| 8 | **One-tap rebook loop** | M | Checkout flow, calendar, client cadence | *"The highest-ROI moment in a salon is checkout. Every competitor treats it like an ending. It's the beginning."* |
| 9 | **Client memory panel** | M | Visit history, notes, formula vault | *"When Sarah sits down, the stylist should know what happened last time without opening three tabs."* |
| 10 | **Intelligent gap-fill suggestions** | L | Calendar, waitlist, client rebook cadence | *"Empty cells are lazy UX. Show me the three best clients for this slot and let me tap once."* |
| 11 | **Stylist book link + availability rules** | M | Staff profiles, schedules, my-book | *"Every pro is a micro-brand. Admin shouldn't be the bottleneck for blocking lunch on Thursday."* |
| 12 | **Processing time / double-book windows** | M | Calendar overlap logic, service durations | *"Color processing time is free money if the calendar understands it. Most software doesn't."* |

---

## P2 — Ship in Phase 3 (Owner love)

| # | Feature | Effort | Depends on | Legend quote |
|---|---------|--------|------------|--------------|
| 13 | **Team pulse dashboard (full)** | L | Revenue data, utilization, waitlist heat | *"Owners don't need 47 reports. They need one screen that tells them if they're winning today."* |
| 14 | **Retail intelligence at checkout** | M | Inventory, purchase history, service context | *"Suggesting Olaplex after a balayage isn't upselling. It's consulting. Do it right and retail margin doubles."* |
| 15 | **Commission-ready reports** | M | Checkout attribution, stylist revenue | *"If the owner is still exporting to Excel for commissions, we've failed."* |
| 16 | **Deposit + no-show protection** | M | Stripe, booking policy | *"Card on file isn't aggressive. It's respect for the stylist's time."* |
| 17 | **Client self-reschedule** | M | Public book, policy rules | *"Every reschedule call is a phone tag tax. Let the client move themselves within policy."* |

---

## P3 — Future (Post 90-day)

| # | Feature | Effort | Depends on | Legend quote |
|---|---------|--------|------------|--------------|
| 18 | **Packages + gift cards** | L | Payments, inventory | *"Revenue products are how salons smooth seasonality. Build them after the spine works."* |
| 19 | **Google/Apple calendar sync** | L | OAuth, block-time API | *"Stylists live in two calendars. We either sync or we lose."* |
| 20 | **Precision scheduling (rank best gaps)** | M | Availability engine, client prefs | *"Don't show me every open slot. Show me the ones that actually make sense for this client."* |
| 21 | **Digital intake forms** | M | Client profiles, notifications | *"Discovering an allergy mid-service is a lawsuit. Discover it before they sit down."* |
| 22 | **Add-on upsells in booking flow** | S | Service catalog, cart API | *"The client already has their wallet open. Offer the treatment upgrade before checkout, not after."* |

---

## Explicitly deferred (not on roadmap)

| Feature | Why deferred |
|---------|--------------|
| Payroll | ADP/Gusto exist; not our fight |
| Client marketplace | Platform play, not salon OS |
| Multi-location enterprise | One salon, done perfectly first |
| Contact center / VoIP | Silent ops, not another phone system |
| 50+ integrations | Each one is a maintenance contract |

---

## Recommended "approve next" bets for Drew

1. **Waitlist auto-match (v1)** — Highest daily painkiller for front desk; differentiator vs. Boulevard's manual hunt.
2. **Formula vault** — Stylist lock-in feature; no competitor does it well; compounds with client memory.
3. **One-tap rebook loop** — Highest ROI per line of code; turns checkout into retention engine.

---

*Last updated: July 2026*
