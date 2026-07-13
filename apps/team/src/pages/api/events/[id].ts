import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";
import {
  canManageEvent,
  endOfDayUtc,
  EVENT_SELECT,
  loadPrivateEventReason,
  mapEvent,
  parseDateInput,
  parseDateTimeLocalInput,
  parseEventType,
  parseOptionalDateTimeLocalInput,
  parseOptionalIsoDate,
  requireManager,
  type EventRow,
} from "../../../lib/api-events";

type PatchBody = {
  title?: string;
  description?: string | null;
  event_type?: string;
  starts_at?: string;
  ends_at?: string | null;
  all_day?: boolean;
  staff_id?: string | null;
  is_active?: boolean;
  visibility?: "team" | "managers";
  approval_status?: string;
};

export const PATCH: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const eventId = context.params.id;
  if (!eventId) {
    return jsonError("Missing event id", 400);
  }

  const { supabase, staff } = auth;

  const { data: existing, error: loadError } = await supabase
    .from("team_events")
    .select(EVENT_SELECT)
    .eq("id", eventId)
    .maybeSingle();

  if (loadError || !existing) {
    return jsonError("Event not found", 404);
  }

  if (!canManageEvent(existing as EventRow, staff)) {
    return jsonError("Forbidden", 403);
  }

  let body: PatchBody;
  try {
    body = (await context.request.json()) as PatchBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const manager = requireManager(staff);
  const updates: Record<string, unknown> = {};
  let allDay = existing.all_day;

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) {
      return jsonError("Title is required", 400);
    }
    updates.title = title;
  }

  if (body.description !== undefined) {
    const description = String(body.description ?? "").trim() || null;
    if (existing.event_type === "time_off") {
      updates.private_reason = description;
      updates.description = null;
    } else {
      updates.description = description;
    }
  }

  if (body.event_type !== undefined) {
    if (!manager) {
      return jsonError("Forbidden", 403);
    }
    const eventType = parseEventType(body.event_type);
    if (typeof eventType === "object" && "error" in eventType) {
      return jsonError(eventType.error, 400);
    }
    updates.event_type = eventType;
  }

  if (body.all_day !== undefined) {
    allDay = Boolean(body.all_day);
    updates.all_day = allDay;
  }

  if (body.starts_at !== undefined || body.ends_at !== undefined) {
    if (allDay) {
      if (body.starts_at !== undefined) {
        const startDate = parseDateInput(body.starts_at);
        if (typeof startDate === "object" && "error" in startDate) {
          return jsonError(startDate.error, 400);
        }
        updates.starts_at = startDate;
      }
      if (body.ends_at !== undefined) {
        if (body.ends_at === null || body.ends_at === "") {
          updates.ends_at = null;
        } else {
          const endDateRaw = String(body.ends_at).trim();
          const endDate = /^\d{4}-\d{2}-\d{2}$/.test(endDateRaw)
            ? endOfDayUtc(endDateRaw)
            : parseOptionalIsoDate(body.ends_at);
          if (typeof endDate === "object" && endDate !== null && "error" in endDate) {
            return jsonError(endDate.error, 400);
          }
          updates.ends_at = endDate;
        }
      }
    } else {
      if (body.starts_at !== undefined) {
        const startsAt = parseDateTimeLocalInput(body.starts_at);
        if (typeof startsAt === "object" && "error" in startsAt) {
          return jsonError(startsAt.error, 400);
        }
        updates.starts_at = startsAt;
      }
      if (body.ends_at !== undefined) {
        const endsAt = parseOptionalDateTimeLocalInput(body.ends_at);
        if (typeof endsAt === "object" && endsAt !== null && "error" in endsAt) {
          return jsonError(endsAt.error, 400);
        }
        updates.ends_at = endsAt;
      }
    }
  }

  if (body.staff_id !== undefined) {
    const eventType = (updates.event_type as string | undefined) ?? existing.event_type;
    if (eventType === "time_off") {
      if (manager) {
        updates.staff_id = body.staff_id ? String(body.staff_id).trim() : null;
      } else {
        updates.staff_id = staff.id;
      }
    } else if (manager) {
      updates.staff_id = body.staff_id ? String(body.staff_id).trim() : null;
    }
  }

  if (body.is_active !== undefined) {
    if (!manager) {
      return jsonError("Forbidden", 403);
    }
    updates.is_active = Boolean(body.is_active);
  }
  if (body.visibility !== undefined) {
    if (!manager || !["team", "managers"].includes(body.visibility)) {
      return jsonError("Forbidden", 403);
    }
    updates.visibility = body.visibility;
  }

  if (body.approval_status !== undefined) {
    const status = String(body.approval_status).trim();
    if (!["pending", "approved", "declined", "cancelled"].includes(status)) {
      return jsonError("Invalid time off status", 400);
    }
    if (existing.event_type !== "time_off") {
      return jsonError("Only time off has an approval status", 400);
    }
    if (!manager && status !== "cancelled") {
      return jsonError("Forbidden", 403);
    }
    updates.approval_status = status;
  }

  if (Object.keys(updates).length === 0) {
    return jsonError("No updates provided", 400);
  }

  const { data, error } = await supabase
    .from("team_events")
    .update(updates)
    .eq("id", eventId)
    .select(EVENT_SELECT)
    .single();

  if (error || !data) {
    console.error("event update failed", error);
    return jsonError("Failed to update event", 500);
  }

  const privateReason =
    manager || data.created_by_staff_id === staff.id
      ? await loadPrivateEventReason(supabase, eventId)
      : null;
  return jsonOk({ event: mapEvent(data as EventRow, staff, privateReason) });
};

export const DELETE: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const eventId = context.params.id;
  if (!eventId) {
    return jsonError("Missing event id", 400);
  }

  const { supabase, staff } = auth;

  const { data: existing, error: loadError } = await supabase
    .from("team_events")
    .select(EVENT_SELECT)
    .eq("id", eventId)
    .maybeSingle();

  if (loadError || !existing) {
    return jsonError("Event not found", 404);
  }

  if (!canManageEvent(existing as EventRow, staff)) {
    return jsonError("Forbidden", 403);
  }

  const soft = context.url.searchParams.get("soft") === "1";

  if (soft) {
    const { error } = await supabase
      .from("team_events")
      .update({ is_active: false })
      .eq("id", eventId);

    if (error) {
      console.error("event soft delete failed", error);
      return jsonError("Failed to cancel event", 500);
    }

    return jsonOk({ id: eventId, cancelled: true });
  }

  const { error } = await supabase.from("team_events").delete().eq("id", eventId);

  if (error) {
    console.error("event delete failed", error);
    return jsonError("Failed to delete event", 500);
  }

  return jsonOk({ id: eventId, deleted: true });
};
