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
│   └── team/         # Staff area — served at team.saloncitrineindy.com (/team in dev)
├── packages/
│   ├── theme/        # @saloncitrine/theme — brand tokens, fonts, UI stubs
│   ├── db/           # @saloncitrine/db — Supabase migrations + seed
│   └── shared/       # @saloncitrine/shared — Zod schemas + business constants
```

## Framework choice

Both apps are **Astro 7**:

- Matches the marketing site exactly — same framework, same Node baseline, one mental model across all Salon Citrine repos.
- First-class Cloudflare deployment via `@astrojs/cloudflare`.
- `apps/web` is static output today; `apps/team` uses server output for Supabase Auth sessions and middleware.
- The `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` env var name is kept verbatim from the project brief for compatibility with its docs; in Astro expose it as `PUBLIC_STRIPE_PUBLISHABLE_KEY` when wiring Stripe Elements (see `.env.example`).

Apps use `base: '/book'` (web) and `base: '/team'` (team) for routing:

```
saloncitrineindy.com/*              → marketing Pages (existing)
saloncitrineindy.com/book/*         → apps/web
team.saloncitrineindy.com/*         → apps/team (production subdomain)
localhost:4322/team/*               → apps/team (local dev)
saloncitrineindy.com/api/*          → Supabase Edge Functions / Worker proxy
```

## Getting started

```bash
npm install

# client booking app → http://localhost:4321/book/
# (Stop the marketing site dev server first — it also defaults to port 4321.)
npm run dev:web

# staff area → http://localhost:4322/team/
# Stop any other dev/preview server on port 4322 first (e.g. saloncitrineindy `astro preview --port 4322`).
npm run dev:team

# build everything
npm run build
```

Copy `.env.example` to `.env` and fill in Supabase keys before using the team app or live booking availability.

### Team test login setup

1. Enable **Email** provider in Supabase Auth.
2. Create a dev admin user and link to staff (requires `SUPABASE_SERVICE_ROLE_KEY` in `.env`):

```bash
node packages/db/scripts/create-dev-admin.mjs you@example.com
# optional: link a different staff slug (defaults to lily-gleitsman)
node packages/db/scripts/create-dev-admin.mjs you@example.com --link-staff=lily-gleitsman
```

The script prints a **one-time temporary password**, sets `user_metadata.must_change_password`, and assigns the staff row `role = 'owner'`. On first sign-in you are redirected to `/team/change-password` before the calendar.

Alternatively, create a user in Supabase Dashboard and link manually:

```sql
update public.staff
set supabase_user_id = '<auth.users.id>', role = 'owner'
where slug = 'lily-gleitsman';
```

3. Sign in at `http://localhost:4322/team/login` with that email/password.

**Team app 404?** If you see the marketing site message “Page not found … book your next appointment”, you are hitting the wrong server — usually port 4322 is occupied by the `saloncitrineindy` preview. Stop that process, run `npm run dev:team`, then open `http://localhost:4322/team/login` (not port 4321; the booking app lives at `http://localhost:4321/book/`).

**Roles:** `owner` and `front_desk` see the full salon calendar, can block time for anyone, and edit service durations. `stylist` and `esthetician` see only their schedule and own blocked time.

Apply role-scoped RLS with `migrations/0004_team_rls.sql`.

## Database (packages/db)

- `migrations/0001_init.sql` — core schema: staff, services, staff_services, staff_schedules, blocked_times, clients, appointments, appointment_services, email_logs, sms_logs, policies. RLS enabled on every table.
- `migrations/0002_public_read_staff_services.sql` — anon read on staff_services for booking catalog.
- `migrations/0003_public_read_availability.sql` — anon read on blocked_times + `appointment_availability` view for slot conflict checks.
- `migrations/0004_team_rls.sql` — role-scoped team app policies (appointments, blocked_times, services, clients).
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

| Area | Status |
|------|--------|
| Monorepo workspaces | Done |
| `@saloncitrine/theme` | tokens, fonts, Button/Modal/BookBar stubs |
| `@saloncitrine/shared` | business constants + Zod schemas |
| `@saloncitrine/db` | migrations + seed generator |
| `apps/web` | Multi-step booking flow + Supabase availability |
| `apps/team` | Auth, role-based calendar, block time, service durations |

### Booking flow (`apps/web`)

1. `/book/` — service selection (supports `?stylist=` deep link)
2. `/book/stylist/` — stylist selection
3. `/book/datetime/` — date & time (real availability from Supabase)
4. `/book/details/` — guest details + cancellation policy modal
5. `/book/confirm/` — placeholder confirmation

### Team (`apps/team`)

- `/team/login` — Supabase email/password sign-in
- `/team/change-password` — required on first login when `must_change_password` is set
- `/team/` — week calendar (all staff for owners/front desk; single-column “My schedule” for providers)
- `/team/block-time` — create `blocked_times` (scoped by RLS)
- `/team/services` — edit `duration_minutes` (owners/front desk only)

## Next steps (recommended order)

1. **Stripe test mode** — create account, add test keys to `.env`, wire SetupIntent on `/book/details`.
2. **Resend** — verify `saloncitrineindy.com` domain in Cloudflare DNS; build confirmation email template.
3. **Twilio** — start 10DLC registration early; add test credentials for confirmation SMS.
4. **Cloudflare Pages** — deploy `apps/web` → `/book`, `apps/team` → `team.saloncitrineindy.com`.
5. **Marketing site cutover** — flip `BOOKING_URL` to `/book` after parallel testing with GlossGenius.

## Conventions

- **Datetimes stored in UTC** (`timestamptz`); display in `America/Indiana/Indianapolis`.
- **Stripe only** for payments — no card data touches this system.
- **Mobile-first** UI matching `@saloncitrine/theme`.
- Add-on-only services, consultation prerequisites, and `$55+` variable-price display encoded on `services` rows.
