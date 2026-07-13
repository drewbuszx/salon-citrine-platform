import type { APIRoute } from "astro";
import { isSalonManager } from "../../../../lib/auth";
import {
  jsonError,
  jsonOk,
  requireApiAuth,
} from "../../../../lib/api-calendar";
import {
  createSupabaseAdminClient,
  teamAbsoluteUrl,
} from "../../../../lib/supabase-server";

type AccessAction = "invite" | "resend" | "link" | "deactivate" | "reactivate";

export const POST: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;
  if (!isSalonManager(auth.staff)) return jsonError("Forbidden", 403);

  const staffId = context.params.id;
  if (!staffId) return jsonError("Missing employee id", 400);

  let body: { action?: AccessAction; authUserId?: string };
  try {
    body = (await context.request.json()) as typeof body;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const action = body.action;
  if (!action || !["invite", "resend", "link", "deactivate", "reactivate"].includes(action)) {
    return jsonError("Invalid access action", 400);
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (error) {
    console.error("staff access admin configuration failed", error);
    return jsonError("Auth administration is not configured", 503);
  }

  const { data: target, error: targetError } = await admin
    .from("staff")
    .select("id, email, supabase_user_id, access_status")
    .eq("id", staffId)
    .maybeSingle();
  if (targetError || !target) return jsonError("Employee not found", 404);

  const email = String(target.email ?? "").trim().toLowerCase();
  const audit = async (
    auditAction: "invited" | "reinvited" | "linked" | "deactivated" | "reactivated",
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ) =>
    admin.from("staff_security_audit").insert({
      actor_staff_id: auth.staff.id,
      target_staff_id: staffId,
      action: auditAction,
      before_state: before,
      after_state: after,
      request_id: context.request.headers.get("X-Request-Id"),
    });

  if (action === "invite" || action === "resend") {
    if (!email) return jsonError("Add an employee email before inviting", 400);
    if (target.access_status === "disabled") {
      return jsonError("Reactivate this employee before inviting", 409);
    }
    if (target.supabase_user_id && action === "invite") {
      return jsonError("Employee already has a linked Auth account", 409);
    }

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: teamAbsoluteUrl("/auth/confirm", context.request),
      data: { staff_id: staffId, must_change_password: true },
    });
    if (error || !data.user) {
      const conflict = /already|registered|exists/i.test(error?.message ?? "");
      return jsonError(
        conflict
          ? "An Auth user already exists for this email. Verify it and use the explicit link action."
          : "Could not send employee invitation",
        conflict ? 409 : 502,
      );
    }

    const { error: updateError } = await admin
      .from("staff")
      .update({
        supabase_user_id: data.user.id,
        access_status: "invited",
        auth_invited_at: new Date().toISOString(),
        deactivated_at: null,
      })
      .eq("id", staffId);
    if (updateError) {
      await admin.auth.admin.deleteUser(data.user.id, true);
      return jsonError("Invitation could not be linked; Auth invite was rolled back", 500);
    }
    await audit(action === "invite" ? "invited" : "reinvited", target, {
      access_status: "invited",
      supabase_user_id: data.user.id,
    });
    return jsonOk({ accessStatus: "invited" });
  }

  if (action === "link") {
    const authUserId = String(body.authUserId ?? "").trim();
    if (!authUserId || !email) return jsonError("Auth user id and employee email are required", 400);
    const { data, error } = await admin.auth.admin.getUserById(authUserId);
    if (error || !data.user) return jsonError("Auth user not found", 404);
    if (data.user.email?.trim().toLowerCase() !== email) {
      return jsonError("Auth user email does not match employee email", 409);
    }
    const { data: conflict } = await admin
      .from("staff")
      .select("id")
      .eq("supabase_user_id", authUserId)
      .neq("id", staffId)
      .maybeSingle();
    if (conflict) return jsonError("Auth user is already linked to another employee", 409);
    await admin
      .from("staff")
      .update({ supabase_user_id: authUserId, access_status: "active", deactivated_at: null })
      .eq("id", staffId);
    await audit("linked", target, { access_status: "active", supabase_user_id: authUserId });
    return jsonOk({ accessStatus: "active" });
  }

  if (action === "deactivate") {
    if (staffId === auth.staff.id) return jsonError("You cannot deactivate your own account", 409);
    if (target.supabase_user_id) {
      const { error } = await admin.auth.admin.updateUserById(target.supabase_user_id, {
        ban_duration: "876000h",
      });
      if (error) return jsonError("Could not revoke Auth access", 502);
    }
    await admin
      .from("staff")
      .update({ access_status: "disabled", deactivated_at: new Date().toISOString() })
      .eq("id", staffId);
    await audit("deactivated", target, { access_status: "disabled" });
    return jsonOk({ accessStatus: "disabled" });
  }

  if (target.supabase_user_id) {
    const { error } = await admin.auth.admin.updateUserById(target.supabase_user_id, {
      ban_duration: "none",
    });
    if (error) return jsonError("Could not reactivate Auth access", 502);
  }
  const accessStatus = target.supabase_user_id ? "active" : "uninvited";
  await admin
    .from("staff")
    .update({ access_status: accessStatus, deactivated_at: null })
    .eq("id", staffId);
  await audit("reactivated", target, { access_status: accessStatus });
  return jsonOk({ accessStatus });
};
