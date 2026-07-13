import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.LOCAL_SUPABASE_URL;
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY;
const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY;
assert.ok(
  url && anonKey && serviceKey,
  "Local invite integration requires LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, and LOCAL_SUPABASE_SERVICE_ROLE_KEY",
);

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const email = `invite-${crypto.randomUUID()}@example.invalid`;
let userId;
try {
  const initial = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo: "http://127.0.0.1:4322/team/auth/confirm?flow=invite",
      data: {
        staff_id: "f1000000-0000-4000-8000-000000000099",
        invited_by_staff_id: "f1000000-0000-4000-8000-000000000098",
        must_change_password: true,
      },
    },
  });
  assert.ifError(initial.error);
  assert.ok(initial.data.user && initial.data.properties?.action_link);
  userId = initial.data.user.id;

  const resend = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: "http://127.0.0.1:4322/team/auth/confirm?flow=invite",
    },
  });
  assert.ifError(resend.error);
  assert.equal(resend.data.user?.id, userId, "resend must reuse pending Auth user");

  const actionUrl = new URL(initial.data.properties.action_link);
  const tokenHash = actionUrl.searchParams.get("token");
  const type = actionUrl.searchParams.get("type");
  assert.ok(tokenHash);
  assert.equal(type, "invite");

  const invitedClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verified = await invitedClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: "invite",
  });
  assert.ifError(verified.error);
  assert.equal(verified.data.user?.id, userId);
  const password = `Local-${crypto.randomUUID()}!`;
  const passwordResult = await invitedClient.auth.updateUser({
    password,
    data: { must_change_password: false },
  });
  assert.ifError(passwordResult.error);

  const loginClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const login = await loginClient.auth.signInWithPassword({ email, password });
  assert.ifError(login.error);
  assert.equal(login.data.user?.id, userId);
  console.log("Local invite, resend, OTP, password setup, and login passed.");
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId);
}
