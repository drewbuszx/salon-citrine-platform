import type { SupabaseClient, User } from "@supabase/supabase-js";
import { env as workerEnv } from "cloudflare:workers";

type AccessAction = "invited" | "reinvited" | "linked" | "deactivated" | "reactivated";
type AccessStatus = "uninvited" | "invited" | "active" | "disabled";

function serverEnv(name: string): string | undefined {
  const values = [
    (import.meta.env as Record<string, string | undefined>)[name],
    (workerEnv as Record<string, string | undefined>)[name],
    typeof process !== "undefined" ? process.env[name] : undefined,
  ];
  return values.find((value) => typeof value === "string" && value.length > 0);
}

export async function transitionStaffAccess(
  admin: SupabaseClient,
  input: {
    actorStaffId: string;
    targetStaffId: string;
    action: AccessAction;
    authUserId: string | null;
    accessStatus: AccessStatus;
    requestId?: string | null;
  },
) {
  const { data, error } = await admin.rpc("admin_transition_staff_access", {
    p_actor_staff_id: input.actorStaffId,
    p_target_staff_id: input.targetStaffId,
    p_action: input.action,
    p_auth_user_id: input.authUserId,
    p_access_status: input.accessStatus,
    p_request_id: input.requestId ?? null,
  });
  if (error || !data) {
    throw new Error(error?.message ?? "Staff access transition failed");
  }
  return data;
}

// Activates a pending invited staff member using only server-controlled database
// state and the authenticated Auth UUID/email. It is intentionally metadata-free:
// mutable user_metadata is never trusted for authorization. Returns the staff id
// when a pending row was activated (or was already active), otherwise null.
export async function isPendingInvite(
  admin: SupabaseClient,
  authUserId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("staff")
    .select("id")
    .eq("supabase_user_id", authUserId)
    .eq("access_status", "invited")
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

export async function confirmStaffInvite(
  admin: SupabaseClient,
  user: Pick<User, "id" | "email">,
  requestId?: string | null,
): Promise<string | null> {
  const { data, error } = await admin.rpc("confirm_staff_invite", {
    p_auth_user_id: user.id,
    p_email: user.email ?? "",
    p_request_id: requestId ?? null,
  });
  if (error) {
    throw new Error(error.message ?? "Invite confirmation failed");
  }
  return (data as string | null) ?? null;
}

export async function sendStaffInviteEmail(input: {
  to: string;
  employeeName: string;
  actionLink: string;
}) {
  const apiKey = serverEnv("RESEND_API_KEY");
  const from = serverEnv("RESEND_FROM_EMAIL");
  if (!apiKey || !from) {
    throw new Error("Invite email delivery is not configured");
  }
  const actionUrl = new URL(input.actionLink);
  if (!["https:", "http:"].includes(actionUrl.protocol)) {
    throw new Error("Invalid invite action URL");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: "Set up your Salon Citrine team account",
      text: `Hi ${input.employeeName},\n\nSet your Salon Citrine team password using this one-time link:\n${actionUrl.toString()}\n\nIf you were not expecting this invitation, ignore this email.`,
    }),
  });
  if (!response.ok) {
    throw new Error(`Invite email delivery failed (${response.status})`);
  }
}
