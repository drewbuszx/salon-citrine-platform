import type { APIRoute } from "astro";
import {
  canManageStaffColumn,
  jsonError,
  jsonOk,
  requireApiAuth,
} from "../../../lib/api-calendar";
import { parseDateTimeLocalInput } from "../../../lib/datetime";

type CreateBlockedTimeBody = {
  staff_id?: string;
  starts_at?: string;
  ends_at?: string;
  reason?: string;
};

export const POST: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const { supabase, staff } = auth;
  let body: CreateBlockedTimeBody;

  try {
    body = (await context.request.json()) as CreateBlockedTimeBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const staffId = String(body.staff_id ?? "");
  const startsRaw = String(body.starts_at ?? "");
  const endsRaw = String(body.ends_at ?? "");
  const reason = String(body.reason ?? "").trim() || null;

  if (!staffId || !startsRaw || !endsRaw) {
    return jsonError("staff_id, starts_at, and ends_at are required", 400);
  }

  if (!canManageStaffColumn(staff, staffId)) {
    return jsonError("Not allowed to block time for this provider", 403);
  }

  let startsAt: Date;
  let endsAt: Date;
  try {
    startsAt = parseDateTimeLocalInput(startsRaw);
    endsAt = parseDateTimeLocalInput(endsRaw);
  } catch {
    return jsonError("Invalid start or end time", 400);
  }

  if (startsAt >= endsAt) {
    return jsonError("End time must be after start time", 400);
  }

  const { data, error } = await supabase
    .from("blocked_times")
    .insert({
      staff_id: staffId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      reason,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("blocked_times insert failed", error);
    return jsonError("Could not block time", 500);
  }

  return jsonOk({ id: data.id });
};
