# Booking & Team App Ship Checklist

Last updated: July 2026

Use this before promoting Workers deployments to production.

## Web booking (`apps/web`)

- [ ] `/book` cart → stylist → datetime → details → confirm completes with test card
- [ ] Guest can book without creating an account (email + phone only)
- [ ] Reservation countdown visible on details step; expired cart shows clear recovery
- [ ] New-client intake fields validate (referral source required for new clients)
- [ ] Returning client lookup fills name/phone from email blur
- [ ] Stripe setup intent loads after valid email; card errors show friendly copy
- [ ] Confirmation page shows appointment summary and salon contact info

## Team front desk (`apps/team`)

- [ ] Login → dashboard loads; nav links resolve (no 404s on Tasks, Stock, Clients, Events)
- [ ] Day calendar: create appointment, change status, block time
- [ ] Checkout: tip presets highlight selection; complete payment shows toast + receipt
- [ ] Client search: skeleton while loading; filters (tag, referral, provider) narrow results
- [ ] Stock: category/brand/stock-level filters work; square grid; low-stock banner → filter
- [ ] Tasks: sidebar views filter list; red badge shows real attention count
- [ ] Events: calendar shows markers only (no text in cells); list below has full details
- [ ] Reports: date range applies; low-stock section links to Stock with filter

## Infrastructure

- [ ] `npm run build` succeeds for team + web (use alternate `outDir` if Windows EPERM on `dist/`)
- [ ] Supabase migrations applied; RLS policies allow team staff roles
- [ ] Cloudflare Workers secrets set: Supabase, Stripe, etc. (see `docs/CLOUDFLARE_DEPLOY.md`)
- [ ] Smoke test on production URLs after deploy

## Known open items (not blocking smoke test)

- Week calendar view (separate from day front desk)
- Sales tax line in team checkout UI
- Cash / card-present tender
- Client blocked flag filter (schema pending)
- First/last appointment date filters on Clients
