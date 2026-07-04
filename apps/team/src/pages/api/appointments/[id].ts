import type { APIRoute } from "astro";
import {
  canManageStaffColumn,
  jsonError,
  jsonResponse,
  requireTeamStaff,
} from "../../../lib/api-calendar";
import { parseDateTimeLocalInput } from "../../../lib/datetime";

async function loadAppointment(
  supabase: App.Locals["supabase"],
  id: string,
) {
  const { data, error } = await supabase
    .from("appointments")
    .select("id, staff_id, starts_at, ends_at, status, notes")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("appointment lookup failed", error);
    return { error: jsonError("Failed to load appointment", 500) as Response };
  }
  if (!data) {
    return { error: jsonError("Appointment not found", 404) as Response };
  }
  return { appointment: data };
}

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const auth = await requireTeamStaff(request, cookies);
  if ("error" in auth && auth.error) {
    return auth.error;
  }
  const { supabase, staff } = auth;
  const id = params.id;
  if (!id) {
    return jsonError("Missing appointment id", 400);
  }

  const loaded = await loadAppointment(supabase, id);
  if ("error" in loaded && loaded.error) {
    return loaded.error;
  }
  const existing = loaded.appointment!;

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

  if (body.notes !== undefined) {
    updates.notes = String(body.notes ?? "").trim() || null;
  }

  if (body.status !== undefined) {
    const status = String(body.status);
    const allowed = ["pending", "confirmed", "completed", "cancelled", "no_show"];
    if (!allowed.includes(status)) {
      return jsonError("Invalid status", 400);
    }
    updates.status = status;
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
    .from("appointments")
    .update(updates)
    .eq("id", id)
    .select("id, staff_id, starts_at, ends_at, status, notes")
    .single();

  if (error || !data) {
    console.error("appointment update failed", error);
    return jsonError("Failed to update appointment", 500);
  }

  return jsonResponse({ appointment: data });
};

export const DELETE: APIRoute = async ({ params, request, cookies }) => {
  const auth = await requireTeamStaff(request, cookies);
  if ("error" in auth && auth.error) {
    return auth.error;
  }
  const { supabase, staff } = auth;
  const id = params.id;
  if (!id) {
    return jsonError("Missing appointment id", 400);
  }

  const loaded = await loadAppointment(supabase, id);
  if ("error" in loaded && loaded.error) {
    return loaded.error;
  }
  const existing = loaded.appointment!;

  if (!canManageStaffColumn(staff, existing.staff_id)) {
    return jsonError("Forbidden", 403);
  }

  const { data, error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", id)
    .select("id, status")
    .single();

  if (error || !data) {
    console.error("appointment cancel failed", error);
    return jsonError("Failed to cancel appointment", 500);
  }

  return jsonResponse({ appointment: data });
};
