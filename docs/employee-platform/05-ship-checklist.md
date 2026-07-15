# Soft-launch ship checklist (~10 staff)

Use this before handing Salon Citrine Team to a small staff cohort. It reflects **repo reality on `master` as of the PWA install ship**, not the older Wave status labels in `00-40-task-program.md` (those docs lag behind later commits for invites, profiles, time-off, roles, audit, etc.).

**Canonical install URL (today):**  
https://salon-citrine-team.dbuszx.workers.dev/team/install  

Custom host `team.saloncitrineindy.com` is documented but **DNS currently fails** — use workers.dev on printed QR / group texts until DNS is fixed. Details: [TEAM_PWA_INSTALL.md](../TEAM_PWA_INSTALL.md), [CLOUDFLARE_DEPLOY.md](../CLOUDFLARE_DEPLOY.md).

---

## Must (block soft launch)

Do not onboard ~10 people until every item below is checked.

### Deploy & reachability

- [ ] Team Worker built and deployed from current `master` (`npm run build --workspace apps/team` then `npx wrangler deploy` in `apps/team`)
- [ ] `https://salon-citrine-team.dbuszx.workers.dev/team/login` loads
- [ ] `https://salon-citrine-team.dbuszx.workers.dev/team/install` is **public** (no forced login redirect)
- [ ] `GET /team/manifest.webmanifest` returns JSON with `display: "standalone"`
- [ ] `/team/icons/icon-192.png`, `/team/icons/icon-512.png`, `/team/icons/apple-touch-icon.png` return 200
- [ ] Login page shows “Install app” / home-screen link → `/team/install`

### Home-screen install (PWA)

- [ ] QR on `/install` opens the same install URL (workers.dev while custom DNS is broken)
- [ ] **iPhone Safari:** Share → Add to Home Screen → crystal icon → opens standalone at login
- [ ] **Android Chrome:** Install app / Add to Home screen → crystal icon → standalone login
- [ ] Note for staff: iOS must use **Safari** (Chrome on iOS is not a full install path)

### Auth & first access (sample of real staff)

- [ ] At least one manager (owner or front_desk) can sign in
- [ ] At least one stylist/esthetician can sign in
- [ ] Invite → set password → first dashboard works for one new test account (live Auth)
- [ ] Deactivated staff cannot retain access after logout/re-login

### Staff day-one loops

- [ ] Dashboard loads without errors for manager and for provider
- [ ] Calendar: own appointments / own time-off visible; manager can Approve/Decline pending time-off
- [ ] Tasks: My / Available / Claim / Complete
- [ ] Docs: list opens; empty Upload CTA works for managers when applicable
- [ ] Account: profile/photo path does not error for a self-serve update

### Data / gate honesty

- [ ] Production migrations required for employee-platform features (`0030`–`0039` set) are applied **or** intentionally confirmed as already live before promising those UIs
- [ ] No reliance on disposable-only shim `legacy-seed-dependencies.sql` against production

---

## Should (same week as soft launch)

Important for confidence; can slip 24–72h if Must is green and owners accept risk.

- [ ] Fix Cloudflare DNS / custom domain so `team.saloncitrineindy.com` resolves; then update `TEAM_WORKERS_ORIGIN` preference in `apps/team/src/lib/pwa-install.ts`, regenerate QR (`npm run generate:pwa --workspace apps/team`), redeploy, reprint QR
- [ ] Smoke install + login on 2–3 actual staff phones (mix of iOS/Android)
- [ ] Resend invite path verified once against live email (Resend)
- [ ] Manager Create task + deep-link `?view=attention` from dashboard/alerts
- [ ] Roles page usable by owner (capability editor + anti-lockout callouts)
- [ ] Activity Log readable for managers with `view_activity`
- [ ] CI: `disposable-db-replay` required on protected branch; role-matrix secrets configured (fail-closed)
- [ ] Share one-pager with staff: install URL, Safari-on-iOS rule, who to ping for password help

---

## Defer (after soft launch / next waves)

Do **not** block ~10-staff launch on these.

| Item | Why defer |
|------|-----------|
| Native Expo employee app | Separate repo; web PWA covers phone soft launch |
| Offline-first SW caching | Current SW is network-only for installability only |
| Re-enable Book / Stock / Clients / Reports modules | Intentionally gated in employee-platform scaleback |
| Extra role capabilities beyond today’s floor | Only two real capabilities shipped; more invents product surface |
| Comments, acknowledgments, training, global search | Later program waves; not required for day-one ops |
| POS / Stripe client checkout polish | Out of soft-launch employee home-screen scope |
| Full Wave status rewrite in `00-40-task-program.md` | Docs lag; use this checklist + commit history as ship truth |
| Marketing-site embed / public booking UX redesign | Different app (`apps/web`) |

---

## Soft-launch day script (30 minutes)

1. Deploy Team Worker; hit `/team/install` and `/team/login` on phone data (not only Wi‑Fi).
2. Install PWA on one iPhone (Safari) and one Android (Chrome); confirm crystal icon + standalone.
3. Manager invites one real stylist if needed; stylist sets password and lands on dashboard.
4. Stylist claims/completes one task; manager approves or declines one time-off (or demos with a test request).
5. Paste install URL + Safari note into the staff group chat; keep printed QR on workers.dev until custom DNS is fixed.

## Rollback

- App: redeploy previous Team Worker version from Cloudflare history.
- Do not reverse additive migrations in panic; prefer forward-fix migrations.
- If install URL must change: regenerate QR and tell staff the old home-screen shortcut target may need re-adding.
