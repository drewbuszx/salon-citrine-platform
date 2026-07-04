import type { APIRoute } from "astro";
import {
  canManageStaffColumn,
  jsonError,
  jsonResponse,
  requireTeamStaff,
} from "../../../lib/api-calendar";
import { parseDateTimeLocalInput } from "../../../lib/datetime";

async function loadBlockedTime(
  supabase: App.Locals["supabase"],
  id: string,
) {
  const { data, error } = await supabase
    .from("blocked_times")
    .select("id, staff_id, starts_at, ends_at, reason")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("blocked_times lookup failed", error);
    return { error: jsonError("Failed to load blocked time", 500) as Response };
  }
  if (!data) {
    return { error: jsonError("Blocked time not found", 404) as Response };
  }
  return { blockedTime: data };
}

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const auth = await requireTeamStaff(request, cookies);
  if ("error" in auth && auth.error) {
    return auth.error;
  }
  const { supabase, staff } = auth;
  const id = params.id;
  if (!id) {
    return jsonError("Missing blocked time id", 400);
  }

  const loaded = await loadBlockedTime(supabase, id);
  if ("error" in loaded && loaded.error) {
    return loaded.error;
  }
  const existing = loaded.blockedTime!;

  if (!canManageStaffColumn(staff, existing.staff_id)) {
    return jsonError("Forbidden", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const updates: Record<string, string | null> = {};

  if (body.reason !== undefined) {
    updates.reason = String(body.reason ?? "").trim() || null;
  }

  let startsAt = new Date(existing.starts_at);
  let endsAt = new Date(existing.ends_at);

  if (body.starts_at !== undefined) {
    try {
      startsAt = parseDateTimeLocalInput(String(body.starts_at));
      updates.starts_at = startsAt.toISOString();
    } catch {
      return jsonError("Invalid start time", 400);
    }
  }

  if (body.ends_at !== undefined) {
    try {
      endsAt = parseDateTimeLocalInput(String(body.ends_at));
      updates.ends_at = endsAt.toISOString();
    } catch {
      return jsonError("Invalid end time", 400);
    }
  }

  if (startsAt >= endsAt) {
    return jsonError("End time must be after start time", 400);
  }

  if (Object.keys(updates).length === 0) {
    return jsonError("No updates provided", 400);
  }

  const { data, error } = await supabase
    .from("blocked_times")
    .update(updates)
    .eq("id", id)
    .select("id, staff_id, starts_at, ends_at, reason")
    .single();

  if (error || !data) {
    console.error("blocked_times update failed", error);
    return jsonError("Failed to update blocked time", 500);
  }

  return jsonResponse({ blockedTime: data });
};

export const DELETE: APIRoute = async ({ params, request, cookies }) => {
  const auth = await requireTeamStaff(request, cookies);
  if ("error" in auth && auth.error) {
    return auth.error;
  }
  const { supabase, staff } = auth;
  const id = params.id;
  if (!id) {
    return jsonError("Missing blocked time id", 400);
  }

  const loaded = await loadBlockedTime(supabase, id);
  if ("error" in loaded && loaded.error) {
    return loaded.error;
  }
  const existing = loaded.blockedTime!;

  if (!canManageStaffColumn(staff, existing.staff_id)) {
    return jsonError("Forbidden", 403);
  }

  const { error } = await supabase.from("blocked_times").delete().eq("id", id);

  if (error) {
    console.error("blocked_times delete failed", error);
    return jsonError("Failed to delete blocked time", 500);
  }

  return jsonResponse({ ok: true });
};
