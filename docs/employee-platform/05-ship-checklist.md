# Soft-launch ship checklist (~10 staff)

Use this before handing Salon Citrine Team to a small staff cohort. It reflects **repo + production reality after the soft-ship automation pass** (custom domain DNS, install URL, staff guide, migration verification).

**Canonical install URL:**  
https://team.saloncitrineindy.com/team/install

**Staff one-pager:**  
https://team.saloncitrineindy.com/team/staff-guide  
Doc mirror: [STAFF_ONE_PAGER.md](./STAFF_ONE_PAGER.md)

Fallback workers.dev still deploys: https://salon-citrine-team.dbuszx.workers.dev/team/install  
Details: [TEAM_PWA_INSTALL.md](../TEAM_PWA_INSTALL.md), [CLOUDFLARE_DEPLOY.md](../CLOUDFLARE_DEPLOY.md).

---

## Must (block soft launch)

Do not onboard ~10 people until every item below is checked.

### Deploy & reachability

- [x] Team Worker built and deployed from current `master` (`npm run build --workspace apps/team` then `npx wrangler deploy` in `apps/team`)
- [x] `https://salon-citrine-team.dbuszx.workers.dev/team/login` loads
- [x] `https://salon-citrine-team.dbuszx.workers.dev/team/install` is **public** (no forced login redirect)
- [x] `GET /team/manifest.webmanifest` returns JSON with `display: "standalone"`
- [x] `/team/icons/icon-192.png`, `/team/icons/icon-512.png`, `/team/icons/apple-touch-icon.png` return 200
- [x] Login page shows “Install app” / home-screen link → `/team/install`
- [x] Custom domain `https://team.saloncitrineindy.com/team/login` and `/team/install` return 200

### Home-screen install (PWA)

- [x] QR on `/install` encodes the canonical install URL (regenerated for `team.saloncitrineindy.com`)
- [x] Desktop / automation: manifest + SW + apple meta present on login/install; install page public with Safari/Android copy
- [ ] **iPhone Safari (Drew / staff phone):** Share → Add to Home Screen → crystal icon → opens standalone at login
- [ ] **Android Chrome (Drew / staff phone):** Install app / Add to Home screen → crystal icon → standalone login
- [x] Note for staff: iOS must use **Safari** (Chrome on iOS is not a full install path) — on install page + staff guide

### Auth & first access (sample of real staff)

- [ ] At least one manager (owner or front_desk) can sign in *(needs live manager credentials — not in local `.env`; agent could not run authenticated smokes)*
- [ ] At least one stylist/esthetician can sign in *(same blocker)*
- [ ] Invite → set password → first dashboard works for one new test account (live Auth)
- [ ] Deactivated staff cannot retain access after logout/re-login

**Automation done without credentials:** unauth APIs return 401 (not 500); protected pages 302 → login; unit tests (security, manage-security, staff-bio-photo, calendar-grid) pass. Role-matrix Playwright requires `TEAM_E2E_*` GitHub/local secrets — see [CI_SECRETS_AND_BRANCH_PROTECTION.md](../CI_SECRETS_AND_BRANCH_PROTECTION.md).

### Staff day-one loops

- [ ] Dashboard loads without errors for manager and for provider *(auth-gated — human/E2E)*
- [ ] Calendar: own appointments / own time-off visible; manager can Approve/Decline pending time-off *(auth-gated)*
- [ ] Tasks: My / Available / Claim / Complete *(auth-gated; unauth `/team/api/tasks` → 401)*
- [ ] Docs: list opens; empty Upload CTA works for managers when applicable *(auth-gated; unauth `/team/api/documents` → 401)*
- [ ] Account: profile/photo path does not error for a self-serve update *(auth-gated; unauth `/team/api/account` → 401)*

### Data / gate honesty

- [x] Production migrations `0030`–`0040` (`staff_bio_approval`) confirmed applied on Supabase via MCP (`list_migrations` / schema)
- [x] No reliance on disposable-only shim `legacy-seed-dependencies.sql` against production
- [x] Roles / Activity / Bios surfaces exist: `/team/manage/roles`, `/team/manage/audit`, `/team/manage/bios` (unauth → login); prod has `capabilities` (2), `role_capabilities` (4), `staff_security_audit`, staff bio approval columns

---

## Should (same week as soft launch)

Important for confidence; can slip 24–72h if Must is green and owners accept risk.

- [x] Fix Cloudflare DNS / custom domain so `team.saloncitrineindy.com` resolves; regenerate QR; redeploy (`wrangler.toml` `routes` custom domain + `TEAM_CUSTOM_ORIGIN` install URL)
- [ ] Smoke install + login on 2–3 actual staff phones (mix of iOS/Android) — **human-only**
- [ ] Resend invite path verified once against live email (Resend) — **human / manager**
- [ ] Manager Create task + deep-link `?view=attention` from dashboard/alerts — **auth-gated**
- [x] Roles page present and auth-walled (owner usability still needs live owner session)
- [x] Activity Log page present and auth-walled (`view_activity` still needs live manager session)
- [ ] CI: mark `disposable-db-replay` + `authenticated-role-matrix` as **required** on protected `master` (`gh` not authenticated in agent; secrets docs written)
- [x] Staff one-pager: install URL, Safari-on-iOS rule, who to ping — `/team/staff-guide` + login/install links

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
| `book.saloncitrineindy.com` DNS | Booking Worker custom domain still NXDOMAIN; out of team soft-ship |

---

## Soft-launch day script (30 minutes)

1. Confirm `team.saloncitrineindy.com/team/install` + `/team/login` on phone data (not only Wi‑Fi).
2. Install PWA on one iPhone (Safari) and one Android (Chrome); confirm crystal icon + standalone.
3. Manager invites one real stylist if needed; stylist sets password and lands on dashboard.
4. Stylist claims/completes one task; manager approves or declines one time-off (or demos with a test request).
5. Paste install URL + Safari note (or `/team/staff-guide`) into the staff group chat; keep printed QR current after any URL change.

## Rollback

- App: redeploy previous Team Worker version from Cloudflare history.
- Do not reverse additive migrations in panic; prefer forward-fix migrations.
- If install URL must change: regenerate QR (`npm run generate:pwa --workspace apps/team`) and tell staff the old home-screen shortcut target may need re-adding.

## Soft-ship automation log (2026-07-14)

| Area | Result |
|------|--------|
| Deploy | Fresh `wrangler deploy` of `salon-citrine-team`; workers.dev + custom domain live |
| DNS | Zone on CF account; Workers custom domain `team.saloncitrineindy.com` attached; resolves |
| Migrations 0030–0040 | Applied on production Supabase |
| PWA public checks | Pass (manifest standalone, icons, SW, install public) |
| Unauth API / page walls | Pass (401 / 302, no 500 on day-one APIs) |
| Phone A2HS | **Not smoked** — agent cannot tap device; Drew/staff only |
| Live auth / day-one loops | **Blocked** — no `TEAM_E2E_*` / manager passwords in env |
| CI required checks | Workflow jobs exist; branch protection + GH secrets need Drew (`gh auth` missing) |
