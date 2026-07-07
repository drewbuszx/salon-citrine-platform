import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";
import {
  defaultEventRange,
  endOfDayUtc,
  EVENT_SELECT,
  mapEvent,
  parseDateInput,
  parseDateTimeLocalInput,
  parseEventType,
  parseOptionalDateTimeLocalInput,
  parseOptionalIsoDate,
  requireManager,
  type EventRow,
} from "../../../lib/api-events";
import { birthdaysForRange, type BirthdayRow } from "../../../lib/api-birthdays";

type CreateEventBody = {
  title?: string;
  description?: string | null;
  event_type?: string;
  starts_at?: string;
  ends_at?: string | null;
  all_day?: boolean;
  staff_id?: string | null;
};

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const defaults = defaultEventRange();
  const from =
    String(context.url.searchParams.get("from") ?? defaults.from).trim() ||
    defaults.from;
  const to =
    String(context.url.searchParams.get("to") ?? defaults.to).trim() || defaults.to;

  const { supabase, staff } = auth;

  const { data, error } = await supabase
    .from("team_events")
    .select(EVENT_SELECT)
    .eq("is_active", true)
    .lte("starts_at", to)
    .order("starts_at", { ascending: true });

  if (error) {
    console.error("events list failed", error);
    return jsonError("Failed to load events", 500);
  }

  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  const rows = (data ?? []).filter((row) => {
    const startsMs = new Date(row.starts_at as string).getTime();
    const endsMs = row.ends_at
      ? new Date(row.ends_at as string).getTime()
      : startsMs;
    return startsMs <= toMs && endsMs >= fromMs;
  });

  const events = rows.map((row) => mapEvent(row as EventRow, staff));

  const birthdayRows: BirthdayRow[] = [];

  const { data: staffBirthdays, error: staffBirthdayError } = await supabase
    .from("staff")
    .select("id, name, birthday")
    .not("birthday", "is", null);

  if (staffBirthdayError) {
    console.warn("staff birthdays load failed", staffBirthdayError);
  } else {
    for (const row of staffBirthdays ?? []) {
      if (!row.birthday) continue;
      birthdayRows.push({
        id: row.id,
        name: row.name,
        birthday: String(row.birthday),
        source: "staff",
        staffId: row.id,
      });
    }
  }

  const { data: clientBirthdays, error: clientBirthdayError } = await supabase
    .from("clients")
    .select("id, first_name, last_name, birthday")
    .not("birthday", "is", null);

  if (clientBirthdayError) {
    console.warn("client birthdays load failed", clientBirthdayError);
  } else {
    for (const row of clientBirthdays ?? []) {
      if (!row.birthday) continue;
      const first = String(row.first_name ?? "").trim();
      if (!first) continue;
      birthdayRows.push({
        id: row.id,
        name: first,
        birthday: String(row.birthday),
        source: "client",
      });
    }
  }

  const birthdays = birthdaysForRange(birthdayRows, from, staff.id);

  return jsonOk({ events: [...events, ...birthdays], from, to });
};

export const POST: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  let body: CreateEventBody;
  try {
    body = (await context.request.json()) as CreateEventBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const title = String(body.title ?? "").trim();
  if (!title) {
    return jsonError("Title is required", 400);
  }

  const eventType = parseEventType(body.event_type);
  if (typeof eventType === "object" && "error" in eventType) {
    return jsonError(eventType.error, 400);
  }

  const manager = requireManager(auth.staff);
  if (!manager && eventType !== "time_off") {
    return jsonError("Only managers can create this event type", 403);
  }

  const allDay = Boolean(body.all_day);
  let startsAt: string | { error: string };
  let endsAt: string | null | { error: string };

  if (allDay) {
    const startDate = parseDateInput(body.starts_at);
    if (typeof startDate === "object" && "error" in startDate) {
      return jsonError(startDate.error, 400);
    }
    startsAt = startDate;

    if (body.ends_at) {
      const endDateRaw = String(body.ends_at).trim();
      const endDate = /^\d{4}-\d{2}-\d{2}$/.test(endDateRaw)
        ? endOfDayUtc(endDateRaw)
        : parseOptionalIsoDate(body.ends_at);
      if (typeof endDate === "object" && endDate !== null && "error" in endDate) {
        return jsonError(endDate.error, 400);
      }
      endsAt = endDate;
    } else {
      const startDateOnly = String(body.starts_at ?? "").trim().slice(0, 10);
      endsAt = endOfDayUtc(startDateOnly);
    }
  } else {
    startsAt = parseDateTimeLocalInput(body.starts_at);
    if (typeof startsAt === "object" && "error" in startsAt) {
      return jsonError(startsAt.error, 400);
    }
    endsAt = parseOptionalDateTimeLocalInput(body.ends_at);
    if (typeof endsAt === "object" && endsAt !== null && "error" in endsAt) {
      return jsonError(endsAt.error, 400);
    }
  }

  let staffId: string | null = null;
  if (eventType === "time_off") {
    if (manager && body.staff_id) {
      staffId = String(body.staff_id).trim();
    } else {
      staffId = auth.staff.id;
    }
    if (!staffId) {
      return jsonError("Staff member is required for time off", 400);
    }
  } else if (body.staff_id) {
    staffId = String(body.staff_id).trim() || null;
  }

  const description = String(body.description ?? "").trim() || null;
  const { supabase, staff } = auth;

  const { data, error } = await supabase
    .from("team_events")
    .insert({
      title,
      description,
      event_type: eventType,
      starts_at: startsAt,
      ends_at: endsAt,
      all_day: allDay,
      created_by_staff_id: staff.id,
      staff_id: staffId,
    })
    .select(EVENT_SELECT)
    .single();

  if (error || !data) {
    console.error("event insert failed", error);
    return jsonError("Failed to create event", 500);
  }

  return jsonOk({ event: mapEvent(data as EventRow, staff) });
};
