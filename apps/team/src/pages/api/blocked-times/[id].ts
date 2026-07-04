import type { APIRoute } from "astro";
import {
  canManageStaffColumn,
  jsonError,
  jsonOk,
  requireApiAuth,
} from "../../../lib/api-calendar";
import { parseDateTimeLocalInput } from "../../../lib/datetime";

type PatchBlockedTimeBody = {
  starts_at?: string;
  ends_at?: string;
  reason?: string;
};

export const PATCH: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const blockedId = context.params.id;
  if (!blockedId) {
    return jsonError("Missing blocked time id", 400);
  }

  const { supabase, staff } = auth;

  const { data: existing, error: loadError } = await supabase
    .from("blocked_times")
    .select("id, staff_id, starts_at, ends_at, reason")
    .eq("id", blockedId)
    .maybeSingle();

  if (loadError || !existing) {
    return jsonError("Blocked time not found", 404);
  }

  if (!canManageStaffColumn(staff, existing.staff_id)) {
    return jsonError("Not allowed to edit this block", 403);
  }

  let body: PatchBlockedTimeBody;
  try {
    body = (await context.request.json()) as PatchBlockedTimeBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const updates: Record<string, string | null> = {};

  if (body.starts_at !== undefined) {
    try {
      updates.starts_at = parseDateTimeLocalInput(String(body.starts_at)).toISOString();
    } catch {
      return jsonError("Invalid starts_at", 400);
    }
  }

  if (body.ends_at !== undefined) {
    try {
      updates.ends_at = parseDateTimeLocalInput(String(body.ends_at)).toISOString();
    } catch {
      return jsonError("Invalid ends_at", 400);
    }
  }

  if (body.reason !== undefined) {
    updates.reason = String(body.reason).trim() || null;
  }

  const nextStarts = updates.starts_at ?? existing.starts_at;
  const nextEnds = updates.ends_at ?? existing.ends_at;
  if (new Date(nextStarts) >= new Date(nextEnds)) {
    return jsonError("End time must be after start time", 400);
  }

  if (Object.keys(updates).length === 0) {
    return jsonError("No updates provided", 400);
  }

  const { error } = await supabase
    .from("blocked_times")
    .update(updates)
    .eq("id", blockedId);

  if (error) {
    console.error("blocked_times update failed", error);
    return jsonError("Could not update blocked time", 500);
  }

  return jsonOk();
};

export const DELETE: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const blockedId = context.params.id;
  if (!blockedId) {
    return jsonError("Missing blocked time id", 400);
  }

  const { supabase, staff } = auth;

  const { data: existing, error: loadError } = await supabase
    .from("blocked_times")
    .select("id, staff_id")
    .eq("id", blockedId)
    .maybeSingle();

  if (loadError || !existing) {
    return jsonError("Blocked time not found", 404);
  }

  if (!canManageStaffColumn(staff, existing.staff_id)) {
    return jsonError("Not allowed to delete this block", 403);
  }

  const { error } = await supabase
    .from("blocked_times")
    .delete()
    .eq("id", blockedId);

  if (error) {
    console.error("blocked_times delete failed", error);
    return jsonError("Could not delete blocked time", 500);
  }

  return jsonOk();
};
