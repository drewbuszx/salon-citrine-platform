# Product / UX pass (employee platform)

Short note on the Product/UX backlog pass on `fix/security-reliability-hardening` (items 1–15), plus the follow-up that targets clearing **Product/UX ≥ 80**. This is a UX/IA polish note only — it does not claim new security guarantees beyond what the Wave 1–5 hardening commits already shipped.

## What changed (initial pass)

- Manage: status-aware employee access actions, human access badges/filters, booking leftovers hidden while Book is scaled back, hub/nav reframed around people/access/roles.
- Calendar: manager pending time-off inbox with inline Approve/Decline; mobile day agenda under the month grid.
- Dashboard + alerts: real pending time-off and pending-invite counts for managers; bell alerts for those queues (waitlist/stock stay module-gated).
- Invite → password → first login copy polish; Roles intentionality + soft deny; destructive confirms; Tasks mobile CTA consistency; Docs empty/category honesty; Activity Log scanability; Manage list skeletons.

## Follow-up (clear 80)

Must-fix from adversarial regrade + high-leverage polish:

1. **Docs empty Upload CTA** — fixed malformed `data-doc-upload-open-inline"` attribute; empty-state Upload also wires via list click delegation so manager empty opens the modal.
2. **Pending invites deep-link** — dashboard chip + bell alert land on Employees with `?access=invited` prefilter (URL syncs when filters change).
3. **Roles page** — capability cards with concrete surfaces (Employees / Manage / Calendar approvals / Activity Log), owner-floor callout, comparison table, per-role summaries, stronger soft-deny for non-owners; still only the two real capabilities (no invented waves).
4. **Deep-link smoke** — pending time-off chip/alert → Calendar `#pending` (scrolls/focuses inbox); attention tasks → `?view=attention` unchanged.
5. **Staff-facing polish** — Dashboard “Your work” (not manager-only ops framing); Calendar “My time off” status panel for non-managers; Tasks/Calendar copy leans “your” assignments/time off.
6. **Access lifecycle** — clearer Invite sent persistence copy; reactivate explicitly restores existing password (no new invite).
7. **Booking-copy leak** — Employees lead no longer mentions Book while booking is scaled back.

### Expected Product/UX impact

Honest target: **81–83** if the auditor re-checks the three prior caps (broken Upload CTA, unfiltered invites, stubby Roles). Residual dings likely: still only two capabilities, Book/Stock/Clients still gated, no comments/acks/training/search.

## Smoke-test

1. Manager: Manage → Employees — filter by access status; Invite/Resend/Deactivate only when valid; confirm deactivate copy. Open `…/manage/employees?access=invited` from dashboard/bell and confirm Invite sent filter is active.
2. Manager: Calendar — pending inbox Approve/Decline; from dashboard pending time-off chip, land on `#pending` inbox. On a phone-width viewport, day agenda under the grid (visual cohesion with inbox).
3. Manager: Dashboard chips + header bell for pending time off / invites (only when counts &gt; 0).
4. Invite flow: open invite link → set password steps → land on dashboard with welcome notice; after Invite/Resend, dialog copy stays on Invite sent until they finish.
5. Owner: Roles — capability unlock examples + comparison table + owner floor; confirm when removing a permission; non-owner sees soft deny with Employees CTA.
6. Staff: Docs empty copy (no broken Upload); Tasks “Create task” + Change view on mobile; Calendar shows **My time off** with status when they have requests; Dashboard **Your work** metrics.
7. Reactivate disabled employee — success copy says existing password is restored.
