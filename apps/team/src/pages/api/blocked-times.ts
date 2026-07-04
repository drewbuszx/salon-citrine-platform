import type { APIRoute } from "astro";
import {
  canManageStaffColumn,
  jsonError,
  jsonResponse,
  requireTeamStaff,
} from "../../lib/api-calendar";
import { parseDateTimeLocalInput } from "../../lib/datetime";

export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await requireTeamStaff(request, cookies);
  if ("error" in auth && auth.error) {
    return auth.error;
  }
  const { supabase, staff } = auth;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const staffId = String(body.staff_id ?? "");
  const startsRaw = String(body.starts_at ?? "");
  const endsRaw = String(body.ends_at ?? "");
  const reasonRaw = String(body.reason ?? "").trim();

  if (!staffId || !startsRaw || !endsRaw) {
    return jsonError("Missing required fields", 400);
  }

  if (!canManageStaffColumn(staff, staffId)) {
    return jsonError("Forbidden", 403);
  }

  try {
    const startsAt = parseDateTimeLocalInput(startsRaw);
    const endsAt = parseDateTimeLocalInput(endsRaw);

    if (startsAt >= endsAt) {
      return jsonError("End time must be after start time", 400);
    }

    const { data, error } = await supabase
      .from("blocked_times")
      .insert({
        staff_id: staffId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        reason: reasonRaw || null,
      })
      .select("id, staff_id, starts_at, ends_at, reason")
      .single();

    if (error || !data) {
      console.error("blocked_times insert failed", error);
      return jsonError("Failed to create blocked time", 500);
    }

    return jsonResponse({ blockedTime: data }, 201);
  } catch {
    return jsonError("Invalid date/time values", 400);
  }
};
