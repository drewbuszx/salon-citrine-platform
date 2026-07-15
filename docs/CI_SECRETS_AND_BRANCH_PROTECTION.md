# CI secrets and branch protection (Security CI)

Workflow: [`.github/workflows/security-ci.yml`](../.github/workflows/security-ci.yml)

Jobs on push/PR to `master` and `fix/**`:

| Job | Purpose | Should be Required on `master`? |
|-----|---------|----------------------------------|
| `required` | migrations verify/stage, `npm test`, team build | Yes |
| `disposable-db-replay` | disposable Postgres replay + pgTAP + deployment evidence | Yes |
| `authenticated-role-matrix` | Playwright role matrix against a live Team base URL | Yes (once secrets exist; fail-closed if missing) |

## Make jobs required (GitHub)

Agent could not run `gh` (not logged in). On GitHub:

1. Repo **Settings → Branches → Branch protection** for `master` (or Rulesets).
2. Enable **Require status checks to pass before merging**.
3. Add required checks (exact job names from Actions):
   - `Required build and security checks`
   - `Disposable migration replay and pgTAP (required on protected branches)`
   - `Authenticated role matrix (required on protected branches)`
4. Do **not** allow skipping these on protected branches.

CLI (after `gh auth login`):

```bash
gh api repos/drewbuszx/salon-citrine-platform/branches/master/protection \
  --method PUT \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Required build and security checks",
      "Disposable migration replay and pgTAP (required on protected branches)",
      "Authenticated role matrix (required on protected branches)"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null
}
EOF
```

(Adjust payload if the repo already uses Rulesets instead of classic protection.)

## GitHub Actions secrets

Repo **Settings → Secrets and variables → Actions**. Configure:

| Secret | Example / notes |
|--------|-----------------|
| `TEAM_E2E_BASE_URL` | `https://team.saloncitrineindy.com` (or workers.dev) |
| `TEAM_E2E_SUPABASE_URL` | Same project URL as production |
| `TEAM_E2E_SUPABASE_ANON_KEY` | Anon key (not service role) |
| `TEAM_E2E_OWNER_EMAIL` / `TEAM_E2E_OWNER_PASSWORD` | Disposable owner |
| `TEAM_E2E_FRONT_DESK_EMAIL` / `TEAM_E2E_FRONT_DESK_PASSWORD` | Disposable front desk |
| `TEAM_E2E_STYLIST_EMAIL` / `TEAM_E2E_STYLIST_PASSWORD` | Disposable stylist |
| `TEAM_E2E_ESTHETICIAN_EMAIL` / `TEAM_E2E_ESTHETICIAN_PASSWORD` | Disposable esthetician |
| `TEAM_E2E_UNLINKED_EMAIL` / `TEAM_E2E_UNLINKED_PASSWORD` | Auth user **not** linked to `staff` |

Use **disposable** accounts only. Do not put real staff passwords in CI.

## Local role-matrix

Copy keys into root `.env` (see `.env.example`). Then:

```bash
npm run test:e2e:role-matrix
```

If `TEAM_E2E_BASE_URL` is unset locally, the script skips with an explicit SKIP (not a silent green). In CI on protected branches, missing `TEAM_E2E_BASE_URL` **fails** the job.
