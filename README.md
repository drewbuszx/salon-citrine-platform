# Salon Citrine Platform

Custom salon booking and operations platform for **Salon Citrine** (Indianapolis, Irvington). Replaces GlossGenius with a first-party system: online booking, SMS/email notifications, staff calendar, client CRM, service checkout, and (later) back-bar inventory.

This is a **separate repo** from the marketing site (`saloncitrineindy`, Astro static site on Cloudflare Pages). Both live on the same domain via Cloudflare routing.

## Stack

| Concern | Tool |
|---------|------|
| Database, staff auth, edge functions | Supabase (Postgres + Auth + Edge Functions) |
| Service payments | Stripe (card-on-file via SetupIntent; no raw card storage) |
| Client SMS | Twilio |
| Transactional email | Resend (`bookings@saloncitrineindy.com`) |
| Retail + gift cards | Shopify |
| Hosting | Cloudflare Pages/Workers |

## Monorepo layout (npm workspaces)

```
salon-citrine-platform/
├── apps/
│   ├── web/          # Client booking UI — served at saloncitrineindy.com/book
│   └── admin/        # Staff dashboard — served at saloncitrineindy.com/admin
├── packages/
│   ├── theme/        # @saloncitrine/theme — brand tokens, fonts, UI stubs
│   ├── db/           # @saloncitrine/db — Supabase migrations + seed
│   └── shared/       # @saloncitrine/shared — Zod schemas + business constants
```

## Framework choice

Both apps are **Astro 7** (`output: 'static'` for now):

- Matches the marketing site exactly — same framework, same Node baseline, one mental model across all Salon Citrine repos.
- First-class Cloudflare deployment (`@astrojs/cloudflare` adapter can be added when server rendering is needed; static output deploys to Pages as-is today).
- Islands architecture: the multi-step booking flow and admin calendar will be interactive islands (React or vanilla) inside otherwise static, fast, mobile-first pages.
- The `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` env var name is kept verbatim from the project brief for compatibility with its docs; in Astro expose it as `PUBLIC_STRIPE_PUBLISHABLE_KEY` when wiring Stripe Elements (see `.env.example`).

Apps use `base: '/book'` (web) and `base: '/admin'` (admin) for same-domain Cloudflare routing:

```
saloncitrineindy.com/*       → marketing Pages (existing)
saloncitrineindy.com/book/*  → apps/web
saloncitrineindy.com/admin/* → apps/admin
saloncitrineindy.com/api/*   → Supabase Edge Functions / Worker proxy
```

## Getting started

```bash
npm install

# client booking app → http://localhost:4321/book/
# (Stop the marketing site dev server first — it also defaults to port 4321.)
npm run dev:web

# staff dashboard → http://localhost:4322/admin
npm run dev:admin

# build everything
npm run build
```

Copy `.env.example` to `.env` and fill in keys as integrations are wired (not required for the placeholder UI).

## Database (packages/db)

- `migrations/0001_init.sql` — core schema: staff, services, staff_services, staff_schedules, blocked_times, clients, appointments, appointment_services, email_logs, sms_logs, policies. RLS enabled on every table.
- `migrations/0002_public_read_staff_services.sql` — anon read on staff_services for booking catalog.
- `migrations/0003_public_read_availability.sql` — anon read on blocked_times + `appointment_availability` view for slot conflict checks.
- `seed/seed.sql` — generated seed: 7 staff (GlossGenius tokens + slugs), business hours, policies, full service menu from `menu-services.json`.
- Regenerate after editing `seed/data/menu-services.json`:

```bash
npm run db:generate-seed
```

Apply against a Supabase project with the Supabase CLI or `psql`.

Dev helper — clear test appointments so availability shows full schedules:

```bash
# Supabase SQL editor, or:
psql $DATABASE_URL -f packages/db/scripts/wipe-test-appointments.sql
```

## Current status

**Scaffold + Phase 1 placeholders (no live API keys required):**

| Area | Status |
|------|--------|
| Monorepo workspaces | Done |
| `@saloncitrine/theme` | tokens, fonts, Button/Modal/BookBar stubs |
| `@saloncitrine/shared` | business constants + Zod schemas |
| `@saloncitrine/db` | migration + seed generator |
| `apps/web` | Multi-step booking flow with mock data + policy modal |
| `apps/admin` | Week calendar shell for 7 providers |

### Booking flow (`apps/web`)

Static placeholder pages wired to `@saloncitrine/theme`:

1. `/book/` — service selection (supports `?stylist=` deep link)
2. `/book/stylist/` — stylist selection
3. `/book/datetime/` — date & time (real availability from Supabase)
4. `/book/details/` — guest details + cancellation policy modal (Escape closes, focus trap)
5. `/book/confirm/` — placeholder confirmation

Stripe SetupIntent placeholder on details page; Resend/Twilio hooks documented but not implemented.

### Admin (`apps/admin`)

- `/admin/` — week calendar grid for all 7 staff with sample appointments
- Supabase Auth sign-in button stubbed (disabled until project is created)

## Next steps (recommended order)

1. **Create Supabase project** — run `migrations/0001_init.sql` then `seed/seed.sql`; map staff `supabase_user_id` after inviting owners.
2. **Copy licensed fonts** — from marketing site `public/fonts/` into each app's `public/fonts/` (Serling Galleria, Basic Title).
3. **Stripe test mode** — create account, add test keys to `.env`, wire SetupIntent on `/book/details`.
4. **Resend** — verify `saloncitrineindy.com` domain in Cloudflare DNS; build confirmation email template.
5. **Twilio** — start 10DLC registration early; add test credentials for confirmation SMS.
6. **Replace mock data** — `GET /api/services`, `/api/staff`, availability endpoints via Supabase Edge Functions.
7. **Supabase Auth** — enable email login for `/admin`; protect admin RLS policies by staff role.
8. **Cloudflare Pages** — two projects or monorepo build targets: `apps/web` → `/book`, `apps/admin` → `/admin`.
9. **Marketing site cutover** — flip `BOOKING_URL` to `/book` after parallel testing with GlossGenius.

## Conventions

- **Datetimes stored in UTC** (`timestamptz`); display in `America/Indiana/Indianapolis`.
- **Stripe only** for payments — no card data touches this system.
- **Mobile-first** UI matching `@saloncitrine/theme`.
- Add-on-only services, consultation prerequisites, and `$55+` variable-price display encoded on `services` rows.
