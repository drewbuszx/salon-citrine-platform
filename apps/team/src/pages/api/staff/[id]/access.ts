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
import {
  sendStaffInviteEmail,
  transitionStaffAccess,
} from "../../../../lib/staff-access-admin";
import {
  findAuthUserByEmail,
  reusablePendingInviteError,
} from "../../../../lib/auth-user-lookup";
import { parseAccessActionRequest } from "../../../../lib/api-contract";

export const POST: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;
  if (!isSalonManager(auth.staff)) return jsonError("Forbidden", 403);

  const staffId = context.params.id;
  if (!staffId) return jsonError("Missing employee id", 400);

  let rawBody: unknown;
  try {
    rawBody = await context.request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const parsed = parseAccessActionRequest(rawBody);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const { action } = parsed.value;
  const body = parsed.value;

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (error) {
    console.error("staff access admin configuration failed", error);
    return jsonError("Auth administration is not configured", 503);
  }

  const { data: target, error: targetError } = await admin
    .from("staff")
    .select("id, name, email, supabase_user_id, access_status")
    .eq("id", staffId)
    .maybeSingle();
  if (targetError || !target) return jsonError("Employee not found", 404);

  const email = String(target.email ?? "").trim().toLowerCase();
  const requestId = context.request.headers.get("X-Request-Id");

  if (action === "invite" || action === "resend") {
    if (!email) return jsonError("Add an employee email before inviting", 400);
    if (target.access_status === "disabled") {
      return jsonError("Reactivate this employee before inviting", 409);
    }
    if (target.supabase_user_id && action === "invite") {
      return jsonError("Employee already has a linked Auth account", 409);
    }

    let existingUser = null;
    if (action === "resend") {
      if (!target.supabase_user_id || target.access_status !== "invited") {
        return jsonError("Only pending invitations can be resent", 409);
      }
      const { data, error } = await admin.auth.admin.getUserById(
        target.supabase_user_id,
      );
      if (error || !data.user) return jsonError("Pending Auth user not found", 409);
      if (data.user.email?.trim().toLowerCase() !== email) {
        return jsonError("Pending Auth user email does not match employee email", 409);
      }
      if (data.user.last_sign_in_at) {
        return jsonError("This employee has already used the invitation", 409);
      }
      existingUser = data.user;
    } else {
      try {
        existingUser = await findAuthUserByEmail(admin, email);
      } catch (lookupError) {
        console.error("invite Auth user lookup failed", lookupError);
        return jsonError("Could not safely verify existing Auth users", 502);
      }
      if (existingUser) {
        const pendingError = reusablePendingInviteError(existingUser, staffId);
        if (pendingError === "existing_account") {
          return jsonError(
            "An existing Auth account uses this email. Verify it and use the explicit link action.",
            409,
          );
        }
        if (pendingError === "different_employee") {
          return jsonError("Pending Auth invitation belongs to another employee", 409);
        }
        const { data: conflict, error: conflictError } = await admin
          .from("staff")
          .select("id")
          .eq("supabase_user_id", existingUser.id)
          .neq("id", staffId)
          .maybeSingle();
        if (conflictError) {
          return jsonError("Could not verify pending Auth user ownership", 500);
        }
        if (conflict) {
          return jsonError("Pending Auth user is linked to another employee", 409);
        }
      }
    }

    const redirectTo = teamAbsoluteUrl("/auth/confirm?flow=invite", context.request);
    if (existingUser) {
      const { error: metadataError } = await admin.auth.admin.updateUserById(
        existingUser.id,
        {
          user_metadata: {
            ...existingUser.user_metadata,
            staff_id: staffId,
            invited_by_staff_id: auth.staff.id,
            must_change_password: true,
          },
        },
      );
      if (metadataError) {
        return jsonError("Could not prepare the pending Auth invitation", 502);
      }
    }
    const linkType = existingUser ? "magiclink" : "invite";
    const { data, error } = await admin.auth.admin.generateLink({
      type: linkType,
      email,
      options: {
        redirectTo,
        data: {
          staff_id: staffId,
          invited_by_staff_id: auth.staff.id,
          must_change_password: true,
        },
      },
    });
    const generatedUser = data?.user ?? existingUser;
    const actionLink = data?.properties?.action_link;
    if (error || !generatedUser || !actionLink) {
      if (!existingUser && data?.user) {
        const { error: rollbackError } = await admin.auth.admin.deleteUser(
          data.user.id,
          true,
        );
        if (rollbackError) {
          console.error("failed generated invite cleanup", rollbackError);
        }
      }
      return jsonError(
        "Could not generate employee invitation",
        502,
      );
    }

    try {
      await transitionStaffAccess(admin, {
        actorStaffId: auth.staff.id,
        targetStaffId: staffId,
        action: action === "invite" ? "invited" : "reinvited",
        authUserId: generatedUser.id,
        accessStatus: "invited",
        requestId,
      });
    } catch (transitionError) {
      if (!existingUser) {
        const { error: rollbackError } = await admin.auth.admin.deleteUser(
          generatedUser.id,
          true,
        );
        if (rollbackError) console.error("invite Auth rollback failed", rollbackError);
      }
      console.error("invite staff transition failed", transitionError);
      return jsonError("Invitation could not be linked", 500);
    }
    try {
      await sendStaffInviteEmail({
        to: email,
        employeeName: String(target.name),
        actionLink,
      });
    } catch (deliveryError) {
      console.error("invite email failed", deliveryError);
      return jsonError(
        "Invitation was created but email delivery failed. Fix email configuration and resend.",
        502,
      );
    }
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
    const { data: conflict, error: conflictError } = await admin
      .from("staff")
      .select("id")
      .eq("supabase_user_id", authUserId)
      .neq("id", staffId)
      .maybeSingle();
    if (conflictError) return jsonError("Could not verify Auth link uniqueness", 500);
    if (conflict) return jsonError("Auth user is already linked to another employee", 409);
    try {
      await transitionStaffAccess(admin, {
        actorStaffId: auth.staff.id,
        targetStaffId: staffId,
        action: "linked",
        authUserId,
        accessStatus: "active",
        requestId,
      });
    } catch (error) {
      console.error("staff link transition failed", error);
      return jsonError("Could not link employee access", 500);
    }
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
    try {
      await transitionStaffAccess(admin, {
        actorStaffId: auth.staff.id,
        targetStaffId: staffId,
        action: "deactivated",
        authUserId: target.supabase_user_id,
        accessStatus: "disabled",
        requestId,
      });
    } catch (error) {
      if (target.supabase_user_id) {
        await admin.auth.admin.updateUserById(target.supabase_user_id, {
          ban_duration: "none",
        });
      }
      console.error("staff deactivate transition failed", error);
      return jsonError("Could not persist deactivation", 500);
    }
    return jsonOk({ accessStatus: "disabled" });
  }

  if (target.supabase_user_id) {
    const { error } = await admin.auth.admin.updateUserById(target.supabase_user_id, {
      ban_duration: "none",
    });
    if (error) return jsonError("Could not reactivate Auth access", 502);
  }
  const accessStatus = target.supabase_user_id ? "active" : "uninvited";
  try {
    await transitionStaffAccess(admin, {
      actorStaffId: auth.staff.id,
      targetStaffId: staffId,
      action: "reactivated",
      authUserId: target.supabase_user_id,
      accessStatus,
      requestId,
    });
  } catch (error) {
    if (target.supabase_user_id) {
      await admin.auth.admin.updateUserById(target.supabase_user_id, {
        ban_duration: "876000h",
      });
    }
    console.error("staff reactivate transition failed", error);
    return jsonError("Could not persist reactivation", 500);
  }
  return jsonOk({ accessStatus });
};
