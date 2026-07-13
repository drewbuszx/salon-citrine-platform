import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { escapeHtml } from "../src/lib/safe-html.ts";
import {
  parseAccessActionRequest,
  parseCompleteTaskRequest,
} from "../src/lib/api-contract.ts";
import { disabledModuleForPath } from "../src/lib/modules.ts";
import { buildContentSecurityPolicy } from "../src/lib/security-headers.ts";
import { parsePhotoCrop } from "../src/lib/staff-photo.ts";
import {
  findAuthUserByEmail,
  reusablePendingInviteError,
} from "../src/lib/auth-user-lookup.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (relative) => readFile(path.join(root, relative), "utf8");

const payload = `<img src=x onerror="alert('stored-xss')">&`;
assert.equal(
  escapeHtml(payload),
  "&lt;img src=x onerror=&quot;alert(&#39;stored-xss&#39;)&quot;&gt;&amp;",
);

assert.deepEqual(parseCompleteTaskRequest({ completion_notes: " done " }), {
  ok: true,
  value: { completion_notes: "done" },
});
assert.equal(parseCompleteTaskRequest({ title: "tampered" }).ok, false);
assert.equal(parseCompleteTaskRequest({ due_at: "2099-01-01" }).ok, false);

assert.deepEqual(parseAccessActionRequest({ action: "invite" }), {
  ok: true,
  value: { action: "invite" },
});
assert.equal(parseAccessActionRequest({ action: "nope" }).ok, false);
assert.equal(parseAccessActionRequest({ action: "invite", role: "owner" }).ok, false);
assert.equal(parseAccessActionRequest({ action: "link" }).ok, false);
assert.equal(
  parseAccessActionRequest({ action: "link", authUserId: "not-a-uuid" }).ok,
  false,
);
assert.equal(
  parseAccessActionRequest({
    action: "invite",
    authUserId: "11111111-1111-4111-8111-111111111111",
  }).ok,
  false,
);
assert.deepEqual(
  parseAccessActionRequest({
    action: "link",
    authUserId: "11111111-1111-4111-8111-111111111111",
  }),
  { ok: true, value: { action: "link", authUserId: "11111111-1111-4111-8111-111111111111" } },
);

for (const route of [
  "/my-book",
  "/book",
  "/week",
  "/block-time",
  "/inventory",
  "/clients",
  "/reports",
  "/waitlist",
  "/checkout/abc",
  "/services",
  "/booking-policy",
  "/api/clients",
  "/api/inventory/products",
  "/api/reports",
  "/api/my-book/services",
]) {
  assert.ok(disabledModuleForPath(route), `${route} must be disabled server-side`);
}

const csp = buildContentSecurityPolicy("YWJjZGVmZ2hpamtsbW5vcA==");
assert.match(csp, /script-src 'self' 'nonce-YWJjZGVmZ2hpamtsbW5vcA=='/);
assert.match(csp, /script-src-attr 'none'/);
assert.ok(!/script-src[^;]*'unsafe-inline'/.test(csp));

assert.deepEqual(parsePhotoCrop({ x: 50, y: 50, scale: 1 }), {
  x: 50,
  y: 50,
  scale: 1,
});
assert.deepEqual(parsePhotoCrop({ x: -1, y: 101, scale: 4 }), {
  x: 0,
  y: 100,
  scale: 3,
});

const targetAuthUser = {
  id: "pending-user",
  email: "Pending@Example.invalid",
  invited_at: "2026-07-13T00:00:00Z",
  last_sign_in_at: null,
  user_metadata: { staff_id: "staff-1" },
};
const pagedAuthAdmin = {
  auth: {
    admin: {
      async listUsers({ page }) {
        return {
          data: {
            users:
              page === 1
                ? Array.from({ length: 100 }, (_, index) => ({
                    id: `filler-${index}`,
                    email: `filler-${index}@example.invalid`,
                  }))
                : [targetAuthUser],
          },
          error: null,
        };
      },
    },
  },
};
assert.equal(
  await findAuthUserByEmail(pagedAuthAdmin, " pending@example.INVALID "),
  targetAuthUser,
);
assert.equal(reusablePendingInviteError(targetAuthUser, "staff-1"), null);
assert.equal(
  reusablePendingInviteError(
    { ...targetAuthUser, last_sign_in_at: "2026-07-13T01:00:00Z" },
    "staff-1",
  ),
  "existing_account",
);
assert.equal(
  reusablePendingInviteError(targetAuthUser, "staff-2"),
  "different_employee",
);
for (const route of [
  "/",
  "/tasks",
  "/docs",
  "/events",
  "/manage/employees",
  "/api/tasks",
  "/api/documents",
  "/api/events",
  "/api/staff",
  "/api/business",
  "/api/account",
  "/api/alerts",
]) {
  assert.equal(disabledModuleForPath(route), null, `${route} must remain active`);
}

const [
  migration,
  photoMigration,
  middleware,
  authSource,
  manageEmployees,
  eventsApi,
  bookingData,
  completeApi,
  photoApi,
  claimApi,
  exchangeApi,
  resetApi,
  confirmPage,
  inviteHardeningMigration,
  identityMigration,
  availabilitySource,
] = await Promise.all([
  read("packages/db/migrations/0030_security_reliability_hardening.sql"),
  read("packages/db/migrations/0031_staff_photo_profile_rpc.sql"),
  read("apps/team/src/middleware.ts"),
  read("apps/team/src/lib/auth.ts"),
  read("apps/team/src/scripts/manage-employees.ts"),
  read("apps/team/src/pages/api/events/index.ts"),
  read("apps/web/src/lib/booking-data.ts"),
  read("apps/team/src/pages/api/tasks/[id]/complete.ts"),
  read("apps/team/src/pages/api/account/photo.ts"),
  read("apps/team/src/pages/api/tasks/[id]/claim.ts"),
  read("apps/team/src/pages/api/auth/exchange.ts"),
  read("apps/team/src/pages/api/auth/reset-password.ts"),
  read("apps/team/src/pages/auth/confirm.astro"),
  read("packages/db/migrations/0033_wave1_invite_task_hardening.sql"),
  read("packages/db/migrations/0034_identity_public_privacy_closure.sql"),
  read("apps/web/src/lib/availability.ts"),
]);

assert.match(migration, /drop policy if exists "Staff update own profile"/);
assert.match(authSource, /staff\?\.role === "owner" \|\| staff\?\.role === "front_desk"/);
assert.match(migration, /revoke update on public\.staff from authenticated/);
assert.match(migration, /set search_path = pg_catalog/g);
assert.match(migration, /create view public\.public_staff_profiles/);
const projection = migration.slice(
  migration.indexOf("create view public.public_staff_profiles"),
  migration.indexOf("-- Staff completion"),
);
const projectionColumns = projection.slice(0, projection.indexOf("from public.staff"));
for (const forbidden of ["phone", "birthday", "supabase_user_id", "access_status"]) {
  assert.ok(!projectionColumns.includes(forbidden), `public projection leaked ${forbidden}`);
}
assert.match(migration, /create or replace function public\.complete_task/);
assert.match(photoMigration, /create or replace function public\.update_own_staff_photo/);
assert.doesNotMatch(manageEmployees, /\.innerHTML\s*=/);
assert.doesNotMatch(eventsApi, /from\("clients"\)[\s\S]*birthday/);
assert.match(bookingData, /\.from\("public_staff_profiles"\)/);
assert.match(completeApi, /\.rpc\("complete_task"/);
assert.match(photoApi, /\.rpc\("update_own_staff_photo"/);
assert.match(middleware, /getRequestUser/);
assert.match(middleware, /Content-Security-Policy/);
assert.doesNotMatch(middleware, /unsafe-eval/);

// Photo RPC no longer returns the whole staff row and validates crop JSON types.
assert.match(photoMigration, /returns void/);
assert.doesNotMatch(photoMigration, /returns public\.staff/);
assert.match(photoMigration, /jsonb_typeof\(p_photo_crop->'x'\)/);

// Task claim is an atomic RPC; the broad direct-UPDATE claim policy is removed.
assert.match(claimApi, /\.rpc\("claim_task"/);
assert.doesNotMatch(claimApi, /\.from\("tasks"\)[\s\S]*\.update\(/);
assert.match(inviteHardeningMigration, /drop policy if exists "Staff claim open tasks"/);
assert.match(inviteHardeningMigration, /create or replace function public\.claim_task/);

// Invite activation must derive its subject from DB state, never mutable metadata,
// and must only run after password setup inside a verified setup context.
assert.match(inviteHardeningMigration, /create or replace function public\.confirm_staff_invite/);
assert.doesNotMatch(exchangeApi, /user_metadata/);
assert.doesNotMatch(confirmPage, /activateInvitedStaff/);
assert.match(resetApi, /hasPasswordSetupContext/);
assert.match(resetApi, /confirmStaffInvite/);
assert.match(middleware, /hasPasswordSetupContext/);

// Wave 2/3 identity + public-data closure.
assert.match(identityMigration, /create unique index[\s\S]*supabase_user_id/);
assert.match(identityMigration, /booking_carts/);
assert.match(identityMigration, /public_blocked_intervals/);
assert.doesNotMatch(identityMigration, /using \(true\)/i);
assert.match(availabilitySource, /public_blocked_intervals/);
assert.doesNotMatch(availabilitySource, /\.from\("blocked_times"\)/);

// Wave 3 event visibility: non-managers only see team or their own events, and the
// private reason is gated to managers/creator.
assert.match(eventsApi, /visibility\.eq\.team,created_by_staff_id\.eq\./);
assert.match(eventsApi, /canReadPrivate/);

console.log("Security hardening regression checks passed.");
