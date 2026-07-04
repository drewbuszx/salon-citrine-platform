import type { APIRoute } from "astro";
import {
  canManageStaffColumn,
  jsonError,
  jsonOk,
  requireApiAuth,
} from "../../../lib/api-calendar";

type ScheduleRow = {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type PatchSchedulesBody = {
  staff_id?: string;
  schedules?: ScheduleRow[];
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

function normalizeTime(value: string): string {
  const trimmed = value.trim();
  if (TIME_PATTERN.test(trimmed)) {
    return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
  }
  throw new Error("invalid time");
}

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const { supabase, staff } = auth;
  const staffId = context.url.searchParams.get("staff_id") ?? staff.id;

  if (!canManageStaffColumn(staff, staffId)) {
    return jsonError("Forbidden", 403);
  }

  const { data, error } = await supabase
    .from("staff_schedules")
    .select("id, day_of_week, start_time, end_time")
    .eq("staff_id", staffId)
    .order("day_of_week");

  if (error) {
    console.error("staff_schedules load failed", error);
    return jsonError("Failed to load schedules", 500);
  }

  return jsonOk({ schedules: data ?? [] });
};

export const PATCH: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const { supabase, staff } = auth;
  let body: PatchSchedulesBody;

  try {
    body = (await context.request.json()) as PatchSchedulesBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const staffId = String(body.staff_id ?? staff.id);
  const schedules = Array.isArray(body.schedules) ? body.schedules : [];

  if (!canManageStaffColumn(staff, staffId)) {
    return jsonError("Forbidden", 403);
  }

  for (const row of schedules) {
    const day = Number(row.day_of_week);
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      return jsonError("day_of_week must be 0–6", 400);
    }

    let startTime: string;
    let endTime: string;
    try {
      startTime = normalizeTime(String(row.start_time ?? ""));
      endTime = normalizeTime(String(row.end_time ?? ""));
    } catch {
      return jsonError(`Invalid time for day ${day}`, 400);
    }

    if (startTime >= endTime) {
      return jsonError(`End time must be after start for day ${day}`, 400);
    }

    const { data: existing, error: lookupError } = await supabase
      .from("staff_schedules")
      .select("id")
      .eq("staff_id", staffId)
      .eq("day_of_week", day)
      .maybeSingle();

    if (lookupError) {
      console.error("staff_schedules lookup failed", lookupError);
      return jsonError("Failed to update schedules", 500);
    }

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("staff_schedules")
        .update({ start_time: startTime, end_time: endTime })
        .eq("id", existing.id);

      if (updateError) {
        console.error("staff_schedules update failed", updateError);
        return jsonError("Failed to update schedules", 500);
      }
    } else {
      const { error: insertError } = await supabase.from("staff_schedules").insert({
        staff_id: staffId,
        day_of_week: day,
        start_time: startTime,
        end_time: endTime,
      });

      if (insertError) {
        console.error("staff_schedules insert failed", insertError);
        return jsonError("Failed to update schedules", 500);
      }
    }
  }

  const { data, error } = await supabase
    .from("staff_schedules")
    .select("id, day_of_week, start_time, end_time")
    .eq("staff_id", staffId)
    .order("day_of_week");

  if (error) {
    console.error("staff_schedules reload failed", error);
    return jsonError("Schedules saved but reload failed", 500);
  }

  return jsonOk({ schedules: data ?? [] });
};

export const DELETE: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const { supabase, staff } = auth;
  let body: { staff_id?: string; day_of_week?: number };

  try {
    body = (await context.request.json()) as { staff_id?: string; day_of_week?: number };
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const staffId = String(body.staff_id ?? staff.id);
  const day = Number(body.day_of_week);

  if (!canManageStaffColumn(staff, staffId)) {
    return jsonError("Forbidden", 403);
  }

  if (!Number.isInteger(day) || day < 0 || day > 6) {
    return jsonError("day_of_week must be 0–6", 400);
  }

  const { error } = await supabase
    .from("staff_schedules")
    .delete()
    .eq("staff_id", staffId)
    .eq("day_of_week", day);

  if (error) {
    console.error("staff_schedules delete failed", error);
    return jsonError("Failed to remove schedule", 500);
  }

  return jsonOk();
};
