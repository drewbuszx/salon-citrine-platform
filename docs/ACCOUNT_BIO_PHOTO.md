# Account settings, photo crop, and bio approval

## What shipped

- Redesigned `/team/account` with Profile / Photo / Bio / Contact / Password sections
- Fixed profile photo pan + zoom crop controls
- Bio submissions go to management for approval (not live on the marketing site automatically)

## Photo crop — root cause and fix

**Root causes**

1. Global `img { height: auto; max-width: 100% }` fought the circular avatar box, so crop transforms did not frame reliably.
2. `touch-action: none` / grab cursor lived in Astro **scoped** CSS on a class applied inside `StaffAvatar` — the scope attribute never matched, so mobile pan scrolled the page instead of moving the photo.
3. Listeners were on the `<img>`; pan is now on `[data-crop-surface]` (the frame) with pointer capture.
4. At zoom `1` on square photos, `object-position` pan is a no-op — first drag auto-bumps scale to `1.2`.

**Contract unchanged:** `{ x: 0–100, y: 0–100, scale: 1–3 }` via `update_own_staff_photo`.

## Bio approval workflow

| Field | Meaning |
|-------|---------|
| `staff.bio` | Last **approved** bio (copy this to the public site) |
| `staff.bio_pending` | Submitted text waiting for review |
| `staff.bio_status` | `none` \| `pending` \| `approved` \| `declined` |

- Staff submit via Account → Bio → `submit_own_staff_bio`
- Managers review at **Manage → Bio approvals** (`/team/manage/bios`) via `review_staff_bio`
- Dashboard shows a **Pending bios** chip for managers
- Approving updates `staff.bio` in the team app only

### Manual marketing-site step (required)

After approving a bio:

1. Open **Manage → Bio approvals → Approved bios**
2. Click **Copy bio**
3. Paste into `saloncitrineindy.com` → `src/data/site.ts` for that team member’s `bio` field
4. Deploy/publish the marketing site

There is **no** auto-push to the CMS.

## Migration

`packages/db/migrations/0040_staff_bio_approval.sql` is applied on production Supabase (recorded as `staff_bio_approval`). Staff bio columns (`bio`, `bio_pending`, `bio_status`, …) are live.

## Smoke checklist

- [ ] Account → Change photo / Edit position: zoom slider moves; drag repositions; header preview matches; Save persists after reload
- [ ] Account → Bio: submit shows “Pending approval”
- [ ] Manage → Bio approvals: Approve → bio appears under Approved with Copy
- [ ] After approve: paste into `saloncitrineindy.com` `src/data/site.ts` manually
- [ ] Decline + note shows on the employee Account bio section
- [ ] Dark mode: account section titles remain readable
- [ ] Dashboard manager chip “Pending bios” links to `/manage/bios`
