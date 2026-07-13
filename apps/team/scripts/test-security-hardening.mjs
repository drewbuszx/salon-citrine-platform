import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { escapeHtml } from "../src/lib/safe-html.ts";
import { parseCompleteTaskRequest } from "../src/lib/api-contract.ts";
import { disabledModuleForPath } from "../src/lib/modules.ts";

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

for (const route of [
  "/my-book",
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

const [migration, middleware, authSource, manageEmployees, eventsApi, bookingData, completeApi] =
  await Promise.all([
    read("packages/db/migrations/0030_security_reliability_hardening.sql"),
    read("apps/team/src/middleware.ts"),
    read("apps/team/src/lib/auth.ts"),
    read("apps/team/src/scripts/manage-employees.ts"),
    read("apps/team/src/pages/api/events/index.ts"),
    read("apps/web/src/lib/booking-data.ts"),
    read("apps/team/src/pages/api/tasks/[id]/complete.ts"),
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
assert.doesNotMatch(manageEmployees, /\.innerHTML\s*=/);
assert.doesNotMatch(eventsApi, /from\("clients"\)[\s\S]*birthday/);
assert.match(bookingData, /\.from\("public_staff_profiles"\)/);
assert.match(completeApi, /\.rpc\("complete_task"/);
assert.match(middleware, /getRequestUser/);
assert.match(middleware, /Content-Security-Policy/);
assert.doesNotMatch(middleware, /unsafe-eval/);

console.log("Security hardening regression checks passed.");
