# Production email & SMS (Resend + Twilio)

Setup checklist for Salon Citrine booking notifications: confirmations on book, 48h and 24h reminders via cron.

## Resend (transactional email)

### Development (no verified domain)

1. Create a [Resend](https://resend.com) API key → `RESEND_API_KEY` in repo root `.env`.
2. Use sandbox sender: `RESEND_FROM_EMAIL=onboarding@resend.dev`
3. Emails only deliver to addresses on your Resend account until the domain is verified.

### Production

1. In Resend → **Domains** → add `saloncitrineindy.com`.
2. Add the DNS records Resend provides in **Cloudflare DNS** (same zone as the marketing site).
3. Wait for verification (usually minutes once DNS propagates).
4. Set in Cloudflare Pages / Workers env:
   ```env
   RESEND_FROM_EMAIL=bookings@saloncitrineindy.com
   ```
5. Zoho Mail MX records for staff inboxes (`sayhello@`) are separate — do not change MX for Resend sending.

### Smoke test

```bash
# From repo root (loads .env)
node apps/web/scripts/test-booking-notification.mjs you@your-resend-account.com
```

Or check config without sending secrets:

```bash
curl http://localhost:4321/book/api/health/notifications
```

---

## Twilio (client SMS)

### Development / trial

1. Create a Twilio account and add to `.env`:
   ```env
   TWILIO_ACCOUNT_SID=
   TWILIO_AUTH_TOKEN=
   TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
   ```
2. Trial accounts can only SMS **verified recipient numbers** until upgraded.
3. Clients must opt in (`sms_opt_in`) at booking for confirmation and reminder SMS.

### Production

1. Purchase or port a US number (or configure a **Messaging Service** SID as `TWILIO_PHONE_NUMBER=MG...`).
2. Complete **10DLC brand + campaign registration** before high-volume US SMS (allow several weeks).
3. Honor STOP/opt-out (TCPA). Reminder SMS include “STOP to opt out.”
4. Replace trial credentials in Cloudflare env with production values.

---

## Appointment reminders (48h + 24h)

### How it works

- Hourly cron calls `POST /book/api/cron/send-reminders` with `Authorization: Bearer $CRON_SECRET`.
- Queries **confirmed** / **pending** appointments starting in ~48h or ~24h (±1h window, `America/Indiana/Indianapolis` display).
- Skips cancelled appointments and rows already marked `reminder_48h_sent_at` / `reminder_24h_sent_at`.
- Email: client has email and `email_opt_in` is not false.
- SMS: `sms_opt_in` and valid phone only.
- Logs to `email_logs` / `sms_logs`.

### Environment

```env
CRON_SECRET=                        # long random string; required for cron endpoint
REMINDER_DRY_RUN=false              # true = log only, no sends or DB marks
REMINDER_DEV_HOURS=                 # optional: e.g. 48 to test window without waiting
```

### Cloudflare Cron Trigger

In Cloudflare dashboard → Workers/Pages → your booking project → **Triggers** → **Cron Triggers**:

| Schedule | Expression (hourly) |
|----------|---------------------|
| Every hour | `0 * * * *` |

Configure the cron to `POST` your deployed URL:

```
https://saloncitrineindy.com/book/api/cron/send-reminders
```

Header: `Authorization: Bearer <CRON_SECRET>`

For Astro on Cloudflare Pages, you may use a **Worker route** or Pages **Functions** cron binding that forwards to this endpoint with the secret. Document the secret in Cloudflare **Encrypted environment variables**, not in git.

### Local testing

**Option A — script (no dev server):**

```bash
# Dry run: find due appointments, no sends
node apps/web/scripts/send-reminders.mjs --dry-run

# Dev window: appointments ~48h from now
REMINDER_DEV_HOURS=48 node apps/web/scripts/send-reminders.mjs --dry-run

# Live send (requires Resend/Twilio + test appointment in window)
node apps/web/scripts/send-reminders.mjs --no-dry-run --hours=48 --kind=48h
```

**Option B — cron API (dev server on :4321):**

```bash
curl -X POST http://localhost:4321/book/api/cron/send-reminders \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

**Create a test appointment:** Book via `/book` with `starts_at` ~48h or ~24h ahead, or insert a row in Supabase and set `reminder_48h_sent_at` / `reminder_24h_sent_at` to `NULL`.

---

## End-to-end test checklist

- [ ] `node apps/web/scripts/test-booking-notification.mjs` — Resend OK
- [ ] `GET /book/api/health/notifications` — `resend.configured` and `twilio.configured` as expected
- [ ] Complete a test booking → confirmation email (and SMS if opted in) within ~60s
- [ ] Check `email_logs` / `sms_logs` for `booking_confirmation` template
- [ ] `node apps/web/scripts/send-reminders.mjs --dry-run` — finds test appointment in window
- [ ] Trigger reminder send → check Resend/Twilio dashboards and log tables
- [ ] Verify `reminder_48h_sent_at` / `reminder_24h_sent_at` updated on appointment row
- [ ] Re-run job → no duplicate reminders for same appointment/kind

---

## Manual steps (you must do in dashboards)

| Service | Action |
|---------|--------|
| **Resend** | Add DNS records, verify `saloncitrineindy.com`, set prod `RESEND_FROM_EMAIL` |
| **Twilio** | Buy/verify number, 10DLC registration for production SMS volume |
| **Cloudflare** | Set env vars, schedule cron with `CRON_SECRET` |
