import { isSalonManager } from "./auth";
import { localDateTimeToUtc } from "./datetime";
import type { StaffProfile } from "../env.d.ts";

export const EVENT_TYPES = [
  "event",
  "time_off",
  "closure",
  "announcement",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type EventRow = {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  created_by_staff_id: string;
  staff_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  visibility: "team" | "managers";
  approval_status: string | null;
  decided_at: string | null;
  created_by:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
  staff:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
  decided_by:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
};

export const EVENT_SELECT = `
  id,
  title,
  description,
  event_type,
  starts_at,
  ends_at,
  all_day,
  created_by_staff_id,
  staff_id,
  is_active,
  created_at,
  updated_at,
  visibility,
  approval_status,
  decided_at,
  created_by:staff!team_events_created_by_staff_id_fkey ( id, name ),
  staff:staff!team_events_staff_id_fkey ( id, name ),
  decided_by:staff!team_events_decided_by_staff_id_fkey ( id, name )
`;

function relOne<T extends { id: string; name: string }>(
  value: T | T[] | null | undefined,
) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function requireManager(staff: StaffProfile) {
  return isSalonManager(staff);
}

export function parseEventType(value: unknown): EventType | { error: string } {
  const type = String(value ?? "event").trim() as EventType;
  if (!EVENT_TYPES.includes(type)) {
    return { error: "Invalid event type" };
  }
  return type;
}

export function parseIsoDate(value: unknown, label: string): string | { error: string } {
  if (value === null || value === undefined || value === "") {
    return { error: `${label} is required` };
  }
  const raw = String(value).trim();
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return { error: `Invalid ${label.toLowerCase()}` };
  }
  return date.toISOString();
}

export function parseOptionalIsoDate(
  value: unknown,
): string | null | { error: string } {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const raw = String(value).trim();
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return { error: "Invalid end date" };
  }
  return date.toISOString();
}

export function parseDateTimeLocalInput(value: unknown): string | { error: string } {
  const raw = String(value ?? "").trim();
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(raw);
  if (!match) {
    return { error: "Invalid date/time" };
  }
  try {
    return localDateTimeToUtc(match[1]!, match[2]!).toISOString();
  } catch {
    return { error: "Invalid date/time" };
  }
}

/** Parse optional datetime-local (salon wall clock) or ISO string. */
export function parseOptionalDateTimeLocalInput(
  value: unknown,
): string | null | { error: string } {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
    return parseDateTimeLocalInput(raw);
  }
  return parseOptionalIsoDate(value);
}

export function parseDateInput(value: unknown): string | { error: string } {
  const raw = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { error: "Invalid date" };
  }
  try {
    return localDateTimeToUtc(raw, "00:00").toISOString();
  } catch {
    return { error: "Invalid date" };
  }
}

export function endOfDayUtc(dateStr: string): string {
  return localDateTimeToUtc(dateStr, "23:59").toISOString();
}

export function defaultEventRange() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0, 23, 59, 59));
  return { from: from.toISOString(), to: to.toISOString() };
}

export function canManageEvent(
  row: Pick<EventRow, "event_type" | "staff_id" | "created_by_staff_id">,
  staff: StaffProfile,
) {
  if (requireManager(staff)) return true;
  return (
    row.event_type === "time_off" &&
    row.staff_id === staff.id &&
    row.created_by_staff_id === staff.id
  );
}

export async function loadPrivateEventReason(
  supabase: App.Locals["supabase"],
  eventId: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_private_event_details", {
    p_event_id: eventId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return typeof row?.private_reason === "string" ? row.private_reason : null;
}

export function mapEvent(
  row: EventRow,
  currentStaff: StaffProfile,
  privateReason: string | null = null,
) {
  const createdBy = relOne(row.created_by);
  const subject = relOne(row.staff);
  const decidedBy = relOne(row.decided_by);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    privateReason,
    visibility: row.visibility,
    eventType: row.event_type,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: row.all_day,
    createdByStaffId: row.created_by_staff_id,
    createdByName: createdBy?.name ?? null,
    staffId: row.staff_id,
    staffName: subject?.name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isActive: row.is_active,
    approvalStatus: row.approval_status,
    decidedAt: row.decided_at,
    decidedByName: decidedBy?.name ?? null,
    canEdit: canManageEvent(row, currentStaff),
    canDelete: canManageEvent(row, currentStaff),
  };
}
