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
  profileMigration,
  staffManageSource,
  accountApi,
  staffIdApi,
  accountPage,
  timeOffMigration,
  apiEventsSource,
  eventIdApi,
  eventsScript,
  auditMigration,
  auditApi,
  auditPage,
  auditScript,
  auditLib,
  capabilityMigration,
  capabilitiesApi,
  rolesPage,
  rolesScript,
  capabilitiesLib,
  authSourceReload,
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
  read("packages/db/migrations/0035_wave5_employee_profiles.sql"),
  read("apps/team/src/lib/staff-manage.ts"),
  read("apps/team/src/pages/api/account.ts"),
  read("apps/team/src/pages/api/staff/[id].ts"),
  read("apps/team/src/pages/account.astro"),
  read("packages/db/migrations/0036_time_off_workflow.sql"),
  read("apps/team/src/lib/api-events.ts"),
  read("apps/team/src/pages/api/events/[id].ts"),
  read("apps/team/src/scripts/events.ts"),
  read("packages/db/migrations/0037_staff_audit_read.sql"),
  read("apps/team/src/pages/api/staff/audit.ts"),
  read("apps/team/src/pages/manage/audit.astro"),
  read("apps/team/src/scripts/manage-audit.ts"),
  read("apps/team/src/lib/staff-audit.ts"),
  read("packages/db/migrations/0038_role_capabilities.sql"),
  read("apps/team/src/pages/api/staff/capabilities.ts"),
  read("apps/team/src/pages/manage/roles.astro"),
  read("apps/team/src/scripts/manage-roles.ts"),
  read("apps/team/src/lib/capabilities.ts"),
  read("apps/team/src/lib/auth.ts"),
]);

assert.match(migration, /drop policy if exists "Staff update own profile"/);
assert.match(authSource, /hasStaffCapability/);
assert.match(authSource, /manage_team/);
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

const bioMigration = await read(
  "packages/db/migrations/0040_staff_bio_approval.sql",
);
const bioSubmitApi = await read("apps/team/src/pages/api/account/bio.ts");
const bioReviewApi = await read("apps/team/src/pages/api/manage/bios.ts");
assert.match(bioMigration, /create or replace function public\.submit_own_staff_bio/);
assert.match(bioMigration, /create or replace function public\.review_staff_bio/);
assert.match(bioMigration, /bio_status/);
assert.doesNotMatch(accountApi, /p_bio:\s*bio/);
assert.match(bioSubmitApi, /\.rpc\("submit_own_staff_bio"/);
assert.match(bioReviewApi, /\.rpc\("review_staff_bio"/);
assert.match(bioReviewApi, /isSalonManager/);

// Task claim is an atomic RPC; the broad direct-UPDATE claim policy is removed.
assert.match(claimApi, /\.rpc\("claim_task"/);
assert.doesNotMatch(claimApi, /\.from\("tasks"\)[\s\S]*\.update\(/);
assert.match(inviteHardeningMigration, /drop policy if exists "Staff claim open tasks"/);
assert.match(
  inviteHardeningMigration,
  /drop policy if exists "Staff claim task assignees"/,
);
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

// Wave 5 / task 23: profile fields plus isolated emergency contacts.
assert.match(profileMigration, /create table if not exists public\.staff_private_details/);
assert.match(profileMigration, /"Managers manage private details"/);
assert.match(profileMigration, /staff_id = public\.current_staff_id\(\)/);
assert.match(profileMigration, /revoke all on public\.staff_private_details from anon/);
assert.match(profileMigration, /start_date/);
assert.doesNotMatch(profileMigration, /add column if not exists bio/);
assert.match(staffManageSource, /start_date/);
assert.match(staffManageSource, /Start date must be formatted YYYY-MM-DD/);
assert.match(accountApi, /\.from\("staff_private_details"\)[\s\S]*upsert/);
assert.match(staffIdApi, /staff_private_details/);
assert.match(staffIdApi, /hasEmergency/);
assert.match(accountPage, /emergency_contact_name/);
assert.match(accountPage, /start_date/);

// Wave 5 / task 25: time-off approval lifecycle on approval_status.
assert.match(timeOffMigration, /enforce_time_off_approval_transition/);
assert.match(timeOffMigration, /not allowed to change approval status/);
assert.match(timeOffMigration, /grant select \(decided_by_staff_id, decided_at\)/);
assert.match(timeOffMigration, /add constraint team_events_approval_status_check[\s\S]*cancelled/);
// Employee self-approval is blocked at the data layer, not just the UI.
assert.match(timeOffMigration, /is_salon_manager\(\)[\s\S]*new.approval_status = 'cancelled'/);
assert.match(apiEventsSource, /approval_status/);
assert.match(apiEventsSource, /approvalStatus: row.approval_status/);
assert.match(eventIdApi, /approval_status/);
assert.match(eventIdApi, /!manager && status !== "cancelled"/);
assert.match(eventsScript, /data-time-off-decision/);
assert.match(eventsScript, /approval_status: decision/);

// Wave 8 / task 39: manager-only activity log over staff_security_audit.
assert.match(auditMigration, /grant select on public\.staff_security_audit to authenticated/);
assert.match(auditApi, /hasStaffCapability/);
assert.match(auditApi, /view_activity/);
assert.match(auditApi, /Forbidden/);
assert.match(auditApi, /target_staff_id/);
assert.doesNotMatch(auditApi, /service_role|SERVICE_ROLE/);
assert.match(auditPage, /hasStaffCapability\(staff, "view_activity"\)/);
assert.match(auditPage, /data-audit-row-template/);
assert.match(auditScript, /textContent/);
assert.doesNotMatch(auditScript, /innerHTML/);
assert.match(auditLib, /STAFF_AUDIT_SELECT/);

// Wave 5 / task 24: bounded role capabilities with owner anti-lockout.
assert.match(capabilityMigration, /create table if not exists public\.capabilities/);
assert.match(capabilityMigration, /create table if not exists public\.role_capabilities/);
assert.match(capabilityMigration, /create or replace function public\.staff_has_capability/);
assert.match(capabilityMigration, /create or replace function public\.is_salon_manager/);
assert.match(capabilityMigration, /select public\.staff_has_capability\('manage_team'\)/);
assert.match(capabilityMigration, /p_capability = 'manage_team' and s\.role = 'owner'/);
assert.match(capabilityMigration, /owners must retain manage_team/);
assert.match(capabilityMigration, /create or replace function public\.set_role_capability/);
assert.match(capabilityMigration, /current_staff_role\(\) <> 'owner'/);
assert.match(capabilityMigration, /staff_has_capability\('view_activity'\)/);
assert.match(capabilityMigration, /capability_changed/);
assert.match(capabilitiesApi, /staff\.role !== "owner"/);
assert.match(capabilitiesApi, /set_role_capability/);
assert.match(rolesPage, /staff\.role !== "owner"/);
assert.match(rolesPage, /isLockedOnGrant/);
assert.match(rolesScript, /textContent|JSON\.stringify/);
assert.doesNotMatch(rolesScript, /innerHTML/);
assert.match(capabilitiesLib, /LOCKED_ON_GRANTS/);
assert.match(authSourceReload, /hasStaffCapability/);
assert.match(authSourceReload, /manage_team/);
// Expand-contract: never assign [] on role_capabilities failure (locks out managers).
assert.match(authSourceReload, /grantsError/);
assert.match(authSourceReload, /Never assign \[\]/);
assert.match(capabilitiesApi, /parseCapabilityPatchRequest/);

const [tasksViewLib, tasksScript, evidenceDigest, capabilityHelper] = await Promise.all([
  read("apps/team/src/lib/tasks-view.ts"),
  read("apps/team/src/scripts/tasks.ts"),
  read("packages/db/scripts/migration-evidence.mjs"),
  read("apps/team/src/lib/staff-capability.ts"),
]);
assert.match(capabilityHelper, /Array\.isArray\(staff\.capabilities\)/);
assert.match(tasksViewLib, /parseTaskViewFromSearch/);
assert.match(tasksScript, /parseTaskViewFromSearch/);
assert.match(tasksScript, /setActiveTab\(currentView\)/);
assert.match(evidenceDigest, /boundPgTapFiles/);
assert.match(evidenceDigest, /readdir\(testDir\)/);
assert.doesNotMatch(
  evidenceDigest,
  /"tests\/0030_security_reliability_hardening\.sql"/,
);

const stageCanonical = await read("packages/db/scripts/stage-canonical-migrations.mjs");
assert.match(stageCanonical, /schema_bootstrap/);
assert.match(stageCanonical, /Supabase would skip/);

// Client scripts must never pull cloudflare:workers (via supabase-server / staff-access-admin).
const { readdirSync } = await import("node:fs");
const clientScriptsDir = path.join(root, "apps/team/src/scripts");
for (const name of readdirSync(clientScriptsDir).filter((n) => n.endsWith(".ts"))) {
  const source = await read(`apps/team/src/scripts/${name}`);
  assert.doesNotMatch(
    source,
    /cloudflare:workers/,
    `${name} must not import cloudflare:workers`,
  );
  assert.doesNotMatch(
    source,
    /supabase-server/,
    `${name} must not import supabase-server`,
  );
  assert.doesNotMatch(
    source,
    /staff-access-admin/,
    `${name} must not import staff-access-admin`,
  );
}

console.log("Security hardening regression checks passed.");
