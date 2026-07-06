# Deploy Now — Salon Citrine Platform

Exact steps to ship the **portfolio-grade first impression** pass to production.

**Prerequisite:** Node 22, repo at latest `master`, Supabase secrets already on Workers.

---

## 1. Verify builds locally (required)

From repo root:

```bash
npm ci
npm run build:alt --workspace apps/team
npm run build --workspace apps/web
```

Both must exit 0. Fix errors before pushing.

Optional dry-run:

```bash
cd apps/team && npx wrangler deploy --dry-run
cd ../web && npx wrangler deploy --dry-run
```

---

## 2. Commit and push

```bash
git add -A
git commit -m "New lead: portfolio-grade first impression pass."
git push origin master
```

Workers Builds on `master` redeploy automatically if Git integration is connected.

---

## 3. Team Worker (`salon-citrine-team`)

| Setting | Value |
|---------|--------|
| Build | `npm run build --workspace apps/team` |
| Deploy | `cd apps/team && npx wrangler deploy` |
| Login URL | `https://salon-citrine-team.<account>.workers.dev/team/login` |
| Custom domain | `team.saloncitrineindy.com` |

**Smoke test after deploy:**

- [ ] `/team/login` — split layout, citrine sign-in button  
- [ ] Sign in → dashboard Team Pulse with live counts  
- [ ] Sale/Checkout → first upcoming appointment checkout (not `/book`)  
- [ ] `/team/clients` — visits + LTV columns, search spinner  
- [ ] `/team/waitlist` — Book / Remove row actions  

---

## 4. Book Worker (`salon-citrine-book`) — if missing

Guest embed **will not work** until this Worker exists. See [CLOUDFLARE_DEPLOY.md](./CLOUDFLARE_DEPLOY.md).

| Setting | Value |
|---------|--------|
| Worker name | `salon-citrine-book` |
| Build | `cd ../.. && npm ci && npm run build --workspace apps/web` |
| Deploy | `npx wrangler deploy` (from `apps/web`) |
| Custom domain | `book.saloncitrineindy.com` |
| Embed URL | `https://book.saloncitrineindy.com/book?embed=1` |

Replace `REPLACE_WITH_KV_NAMESPACE_ID` in `apps/web/wrangler.toml` before first deploy.

**Smoke test:**

- [ ] `/book/` loads without staff login redirect  
- [ ] `/book?embed=1` — no marketing header, cream panel  
- [ ] `/book/embed-demo` — iframe demo page (for stakeholder review)  

Copy iframe snippet from [EMBED_BOOK.md](./EMBED_BOOK.md) onto saloncitrineindy.com when book Worker is live.

---

## 5. Secrets checklist (both Workers)

| Secret | Team | Book |
|--------|------|------|
| `SUPABASE_ANON_KEY` | ✓ | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | ✓ |
| `STRIPE_SECRET_KEY` | ✓ | ✓ |
| `RESEND_API_KEY` | ✓ | ✓ |
| `TWILIO_AUTH_TOKEN` | optional | optional |

Non-secrets (`SUPABASE_URL`, `TZ`, `PUBLIC_BOOK_URL`) live in `wrangler.toml` `[vars]`.

---

## 6. If something breaks

| Symptom | Fix |
|---------|-----|
| `/book/` redirects to team login | Book app on wrong Worker — deploy `apps/web` to `salon-citrine-book` |
| Assets 404 at `/client/team/_astro/*` | Deployed via Pages, not Workers — recreate as Worker per CLOUDFLARE_DEPLOY |
| Auth/session errors | SESSION KV binding + Supabase secrets on team Worker |
| Purple nav accent | Should be gone — hard refresh; verify latest commit on Worker |

Full troubleshooting: [CLOUDFLARE_DEPLOY.md](./CLOUDFLARE_DEPLOY.md)

---

*Build locally → push master → smoke test login, dashboard, clients, waitlist, embed.*
