# Product / UX pass (employee platform)

Short note on the Product/UX backlog pass on `fix/security-reliability-hardening` (items 1–15). This is a UX/IA polish note only — it does not claim new security guarantees beyond what the Wave 1–5 hardening commits already shipped.

## What changed

- Manage: status-aware employee access actions, human access badges/filters, booking leftovers hidden while Book is scaled back, hub/nav reframed around people/access/roles.
- Calendar: manager pending time-off inbox with inline Approve/Decline; mobile day agenda under the month grid.
- Dashboard + alerts: real pending time-off and pending-invite counts for managers; bell alerts for those queues (waitlist/stock stay module-gated).
- Invite → password → first login copy polish; Roles intentionality + soft deny; destructive confirms; Tasks mobile CTA consistency; Docs empty/category honesty; Activity Log scanability; Manage list skeletons.

## Smoke-test

1. Manager: Manage → Employees — filter by access status; Invite/Resend/Deactivate only when valid; confirm deactivate copy.
2. Manager: Calendar — pending inbox Approve/Decline; on a phone-width viewport, day agenda under the grid.
3. Manager: Dashboard chips + header bell for pending time off / invites (only when counts &gt; 0).
4. Invite flow: open invite link → set password steps → land on dashboard with welcome notice.
5. Owner: Roles explanations + confirm when removing a permission; non-owner sees soft deny.
6. Staff: Docs empty copy; Tasks “Create task” + Change view on mobile.
