# Deploy to Cloudflare Pages

Both apps in this monorepo are Astro 7 projects with `@astrojs/cloudflare`. Each app needs its **own** Cloudflare Pages project, with the app directory as the project root so Pages finds `wrangler.toml` and deploys the SSR worker (without it, the build succeeds but every route 404s with “No Wrangler configuration file found”).

## Prerequisites

- GitHub repo connected to Cloudflare Pages
- Supabase project with migrations applied (see [README](../README.md))
- Node **22** (matches `engines` in root `package.json`)

## Two Cloudflare Pages projects (same repo)

### Project A — Team (`apps/team`)

| Setting | Value |
|---------|--------|
| **Root directory** | `apps/team` |
| **Build command** | `cd ../.. && npm ci && npm run build --workspace apps/team` |
| **Build output directory** | `dist` (relative to root directory) |
| **NODE_VERSION** | `22` |
| **Custom domain** | `team.saloncitrineindy.com` |
| **Live path on `*.pages.dev`** | `/team/` (app uses `base: '/team'`) |

**Environment variables** (Production + Preview as needed):

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key (server + auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin operations |
| `TZ` | `America/Indiana/Indianapolis` |

### Project B — Book (`apps/web`)

| Setting | Value |
|---------|--------|
| **Root directory** | `apps/web` |
| **Build command** | `cd ../.. && npm ci && npm run build --workspace apps/web` |
| **Build output directory** | `dist` |
| **NODE_VERSION** | `22` |
| **Custom domain** | `book.saloncitrineindy.com` |
| **Live path on `*.pages.dev`** | `/book/` (app uses `base: '/book'`) |

**Environment variables** — copy from [`.env.example`](../.env.example):

| Variable | Required for |
|----------|----------------|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Booking + availability APIs |
| `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` | Client-side Supabase (if used in islands) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Payments |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | SMS |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Email |
| `CRON_SECRET` | `POST /book/api/cron/send-reminders` |
| `TZ` | `America/Indiana/Indianapolis` |
| `REMINDER_DRY_RUN`, `REMINDER_DEV_HOURS` | Optional reminder tuning |
| `APP_URL` | Absolute links in notifications |

See [PRODUCTION_COMMS.md](./PRODUCTION_COMMS.md) for Resend/Twilio domain setup and cron scheduling.

## Wrangler bindings

Each app ships a `wrangler.toml` in its directory with `pages_build_output_dir = "dist"`.

After a local build, `@astrojs/cloudflare` writes `dist/server/wrangler.json` listing bindings the worker expects. **Both apps currently require:**

| Binding | Type | Purpose |
|---------|------|---------|
| `SESSION` | KV namespace | Astro session storage (auth cookies, etc.) |
| `IMAGES` | Cloudflare Images | Image processing in production |

The committed `wrangler.toml` declares the **SESSION** KV namespace. You must either:

1. Replace `REPLACE_WITH_KV_NAMESPACE_ID` in `apps/team/wrangler.toml` and `apps/web/wrangler.toml` with your real namespace ID (do not commit real IDs if the repo is public), **or**
2. Leave the placeholder in git and bind **SESSION** in the Cloudflare dashboard: **Pages → your project → Settings → Functions → KV namespace bindings** → variable name `SESSION` → your namespace.

For **IMAGES**, Cloudflare Pages usually provisions the Images binding automatically when the adapter requests it. If image routes fail at runtime, confirm under **Settings → Functions** that an Images binding named `IMAGES` exists (or add it to `wrangler.toml`):

```toml
[images]
binding = "IMAGES"
```

### KV setup (manual, once per account)

1. Cloudflare dashboard → **Workers & Pages → KV** → **Create namespace** (e.g. `salon-citrine-session`).
2. Copy the namespace ID into each app’s `wrangler.toml` **or** bind `SESSION` in both Pages projects as above.
3. Redeploy both projects.

You may use one KV namespace for both apps or separate namespaces; one shared `salon-citrine-session` namespace is fine for a single salon deployment.

## Verify locally before deploy

From the repo root:

```bash
npm run build --workspace apps/team
npm run build --workspace apps/web
```

Each build should finish without errors and produce `apps/<app>/dist/` with `dist/server/` (worker) and static assets.

## After deploy — test URLs

Replace `<team-project>` and `<book-project>` with your Pages project names:

| App | pages.dev | Custom domain |
|-----|-----------|---------------|
| Team | `https://<team-project>.pages.dev/team/` | `https://team.saloncitrineindy.com/team/` |
| Book | `https://<book-project>.pages.dev/book/` | `https://book.saloncitrineindy.com/book/` |

Smoke checks:

- Team: `/team/login` loads; sign-in redirects to calendar.
- Book: `/book/` loads; `/book/api/health/notifications` returns JSON.
- Book cron (production): `POST https://book.saloncitrineindy.com/book/api/cron/send-reminders` with `Authorization: Bearer $CRON_SECRET`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Build OK, all routes 404 | Root directory must be `apps/team` or `apps/web`; `wrangler.toml` must exist there. Redeploy. |
| “No Wrangler configuration file found” | Same as above — Pages did not deploy the SSR worker. |
| Auth/session errors on team app | Bind `SESSION` KV; confirm Supabase env vars. |
| Wrong app on `/team` or `/book` | Custom domain attached to wrong Pages project, or marketing site routing conflict — point each subdomain to the correct project. |
