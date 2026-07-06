# Competitor UX Research

Research date: July 2026. Sources: Boulevard developer portal, G2/Capterra/Trustpilot reviews, salon software comparison articles.

## Boulevard — capability scan (developers.joinblvd.com)

### Client API (customer-facing booking)
- Cart-based booking: create cart → add bookable items → pick dates/times → reserve slot → client details → card on file → checkout
- Custom branded self-booking experiences
- Staff selection, add-ons, location context
- `@boulevard/blvd-book-sdk` JS SDK for custom flows

### Admin API (team dashboard)
- Sync staff, clients, appointments, inventory, payment details
- Custom client segments for marketing
- Custom dashboard workflows

### Reporting & data
- Native customizable brand/location reports
- Reporting API for bulk export to BI (Tableau, Power BI)
- Snowflake Data Share (Enterprise) for direct SQL access

### Integrations & automation
- Open API for third-party tools (Shopify, Zapier)
- Magic Tags → Zapier workflows on client/order/appointment tags
- Tokenization API for PCI-safe card collection

### POS & operations (from product reviews)
- Front Desk View with status columns (check-in, waiting, complete)
- Precision scheduling with multi-service, resource rules
- Streamlined checkout with tips, retail add-ons, packages/vouchers
- Inventory with decimal quantities (medspa pain point in reviews)
- SMS/email marketing automation
- HIPAA compliance tier for medspas

### Boulevard strengths users praise
- Best-in-class client booking flow
- Intuitive POS checkout
- Clean stylist performance reports (not bloated)
- Seamless scheduling for complex appointments

### Boulevard complaints (opportunities for us)
| Issue | User impact | Our response |
| --- | --- | --- |
| Mobile app buggy, can't checkout on mobile | Managers stuck at desk | Team checkout works in browser; mobile-first polish |
| Confusing service/product setup navigation | Training overhead | Clear Manage section, single services page |
| Hidden fees, expensive add-ons | Budget frustration | Transparent flat stack, no surprise tiers |
| Support hard to reach | Downtime panic | Self-hosted control, clear error messages |
| System crashes block scheduling + checkout | Client embarrassment | Graceful offline messaging, retry toasts |
| Package checkout distorts month-end numbers | Accounting pain | Track voucher redemption separately (future) |
| Tipping UI allows $0.10 vs $10 | Staff tip loss | Preset tips + validation on custom tip |
| Inventory decimals missing (medspa) | Wrong dose tracking | Decimal qty support in inventory API |

---

## GlossGenius — what users prefer

- **Frictionless booking**: no app download, no password required to book
- **Premium booking page aesthetic** — looks like a real brand, not a generic form
- **Flat 2.6% processing** — predictable costs
- **Card on file at booking** — reduces no-shows
- **Genius Forms** (2024): service-specific intake auto-attached to appointments
- **Payroll + commission** for small teams without enterprise complexity
- **Buy Now, Pay Later** for high-ticket services
- **Mobile-first** for solo/boutique stylists on the go

### GlossGenius gaps users want
- More website customization
- Online retail / multi-location
- Recurring memberships

---

## Vagaro — what users prefer

- **Built-in consumer marketplace** — discovery/booking from new clients
- **Express check-in kiosks** — ~35% front-desk time savings
- **Modular pricing** — pay only for features needed
- **Three embeddable widgets** (booking, products, gifts) — ~18% better conversion vs redirect-only
- **Family/friend package sharing**
- **Deep feature set**: payroll, inventory, forms, memberships in one ecosystem
- **Drag-drop calendar** with status colors for 20+ staff

### Vagaro complaints
- Steeper learning curve
- Complex dashboard for small teams

---

## Salon Citrine positioning

We adopt **Boulevard UX patterns** (cart booking, front desk, checkout steps, reports) with **Salon Citrine branding** (citrine, sage, dusty rose — not Boulevard purple). Cherry-pick GlossGenius simplicity where it beats Boulevard complexity, and Vagaro depth where Boulevard is enterprise-only.

---

## Ask Drew — features worth adopting

Check the boxes you want prioritized in a future sprint:

### From GlossGenius
- [ ] **Passwordless guest booking** — email/phone only, no account creation required
- [ ] **Genius-style intake forms** — auto-attach service-specific questions to appointments
- [ ] **BNPL at checkout** (Affirm/Klarna) for color/chemical packages over $200
- [ ] **Flat-rate processing display** — show single rate on booking payment step
- [ ] **Team clock-in/out on mobile** — stylists punch in from phone

### From Vagaro
- [ ] **Express check-in kiosk mode** — tablet-friendly front desk check-in screen
- [ ] **Embeddable booking widget** — iframe for saloncitrineindy.com without redirect
- [ ] **Client marketplace listing** — optional Vagaro-style discovery (long-term)
- [ ] **Package/membership sharing** — family can share prepaid packages
- [ ] **Payroll + commission module** — automated stylist payouts

### From Boulevard gaps (beat them at their weak spots)
- [ ] **Full mobile checkout** — complete POS on phone/tablet, not desktop-only
- [ ] **Decimal inventory** — 0.25 mg / fractional product units
- [ ] **Offline-tolerant mode** — queue actions when connection drops, sync when back
- [ ] **Human-readable error recovery** — every API failure gets a toast + retry action

---

## References

- [Boulevard Developer Portal](https://developers.joinblvd.com/getting-started/introduction)
- [Boulevard Client API booking guide](https://developers.joinblvd.com/2020-01/client-api/guides/booking-an-appointment)
- [Boulevard Open API features](https://www.joinblvd.com/features/api)
- G2/Capterra Boulevard reviews (2024–2025)
- Trustpilot Boulevard reviews
- hairsalonpro.com, thesalonbusiness.com, goodcall.com comparison articles
