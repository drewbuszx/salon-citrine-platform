# Booking & Team Ship Checklist

Use before redeploying **web** (`/book`) and **team** Workers after UX sprint changes.

## Build verification

- [ ] Team: `npm run build:alt --workspace apps/team` (avoids Windows `dist/` EPERM)
- [ ] Web: `npm run build --workspace apps/web`
- [ ] No TypeScript errors in changed scripts

## Guest booking (`/book`)

- [ ] Services → cart → stylist (if any pro) → datetime → details → confirm
- [ ] Step indicator shows correct step for both booking paths
- [ ] Returning client lookup fills name/phone on details
- [ ] Card form loads after valid email; policy ack required
- [ ] Reservation countdown visible on details; expired hold shows clear error
- [ ] **Waitlist**: pick a fully booked stylist/date range → join waitlist form submits
- [ ] Confirmation email/SMS (if env configured)

## Team calendar & waitlist

- [ ] Dashboard loads upcoming appointments
- [ ] `/book` day calendar: book, block time, status changes
- [ ] **Waitlist** link opens `/waitlist` with active entries
- [ ] Manager can add waitlist entry manually

## Checkout

- [ ] Open checkout from completed/in-service appointment
- [ ] Retail products add to line items
- [ ] **Sales tax** row appears when retail products on ticket (default 7% on products)
- [ ] Tip presets highlight selection; custom tip works
- [ ] Complete checkout charges card on file
- [ ] Receipt shows; **prebook** shortcuts (4/6/8 weeks) visible
- [ ] Clear error when client has no card on file

## CRM & ops

- [ ] Clients list search + add client
- [ ] Client profile save shows toast confirmation
- [ ] Inventory low-stock banner → filter works; reports link to stock
- [ ] Reports load with skeleton; CSV export downloads

## Deploy

- [ ] Deploy team Worker (not legacy Pages project)
- [ ] Deploy web/book Worker when applicable
- [ ] Smoke test production URLs after deploy

## Known open items (post-sprint)

- Cash / card-present tender at checkout
- Collect card at checkout when none on file
- Week calendar view (day strip exists; full week grid TBD)
- Package/voucher redemption
- Embeddable booking widget on marketing site

## Env vars (reference)

| Var | App | Purpose |
| --- | --- | --- |
| `PUBLIC_RETAIL_TAX_RATE` | team | Retail sales tax (default `0.07`) |
| `PUBLIC_BOOK_URL` | team | Prebook links on checkout receipt |
| Stripe + Supabase + Twilio/Resend | both | Payments & comms |
