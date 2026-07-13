import assert from "node:assert/strict";
import { request } from "playwright";
import { createClient } from "@supabase/supabase-js";

const baseURL = process.env.TEAM_E2E_BASE_URL?.replace(/\/$/, "");
if (!baseURL) {
  console.log("SKIP role-matrix E2E: TEAM_E2E_BASE_URL is not configured.");
  process.exit(0);
}

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
assert.ok(supabaseUrl && anonKey, "Configured E2E requires SUPABASE_URL and SUPABASE_ANON_KEY");

const roles = ["OWNER", "FRONT_DESK", "STYLIST", "ESTHETICIAN", "UNLINKED"];
const principals = new Map();
for (const role of roles) {
  const email = process.env[`TEAM_E2E_${role}_EMAIL`];
  const password = process.env[`TEAM_E2E_${role}_PASSWORD`];
  assert.ok(email && password, `Configured E2E is missing ${role} credentials`);
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  assert.ok(data.session?.access_token, `${role} did not receive an access token`);
  principals.set(role, data.session.access_token);
}

const api = await request.newContext({ baseURL, maxRedirects: 0 });
const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });
const activeRoutes = ["/", "/tasks", "/docs", "/events", "/account"];
const disabledRoutes = [
  "/my-book",
  "/inventory",
  "/clients",
  "/reports",
  "/waitlist",
  "/booking-policy",
  "/api/my-book/services",
  "/api/inventory/products",
  "/api/clients",
  "/api/reports",
];

for (const role of roles.slice(0, 4)) {
  const headers = authHeaders(principals.get(role));
  for (const route of activeRoutes) {
    const response = await api.get(route, { headers });
    assert.equal(response.status(), 200, `${role} ${route} must be authenticated, not redirected`);
    assert.ok(!response.headers().location?.includes("/login"), `${role} ${route} hit login`);
  }
  const summary = await api.get("/api/tasks/summary", { headers });
  assert.equal(summary.status(), 200, `${role} task API failed`);
}

for (const role of [...roles, "ANONYMOUS"]) {
  const headers = role === "ANONYMOUS" ? {} : authHeaders(principals.get(role));
  for (const route of disabledRoutes) {
    const response = await api.get(route, { headers });
    assert.equal(response.status(), 404, `${role} ${route} leaked disabled module`);
  }
}

for (const role of ["OWNER", "FRONT_DESK"]) {
  const response = await api.get("/api/business", {
    headers: authHeaders(principals.get(role)),
  });
  assert.equal(response.status(), 200, `${role} must manage business`);
}
for (const role of ["STYLIST", "ESTHETICIAN"]) {
  const response = await api.get("/api/business", {
    headers: authHeaders(principals.get(role)),
  });
  assert.equal(response.status(), 403, `${role} must not manage business`);
}

const unlinked = await api.get("/api/tasks/summary", {
  headers: authHeaders(principals.get("UNLINKED")),
});
assert.equal(unlinked.status(), 403, "unlinked user must be forbidden");
const anonymous = await api.get("/api/tasks/summary");
assert.equal(anonymous.status(), 401, "anonymous user must be unauthorized");

await api.dispose();
console.log("Authenticated role-matrix E2E passed.");
