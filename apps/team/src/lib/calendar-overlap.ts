import {
  APPOINTMENT_BLOCKED_MESSAGE,
  APPOINTMENT_CONFLICT_MESSAGE,
  BLOCKED_TIME_CONFLICT_MESSAGE,
  CALENDAR_BLOCKING_APPOINTMENT_STATUSES,
  isBlockingAppointmentStatus,
  isOverlapConflictError,
  OFF_HOURS_MESSAGE,
  PAST_TIME_MESSAGE,
} from "@saloncitrine/shared";
import {
  formatDayParam,
  parseTimeToMinutes,
  scheduleForStaffOnDay,
  type StaffSchedule,
} from "./calendar";

type SupabaseClient = App.Locals["supabase"];

type TimeRangeRow = {
  id: string;
  starts_at: string;
  ends_at: string;
};

type ScheduleRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  effective_from: string;
  effective_until: string | null;
};

export type AppointmentValidationOptions = {
  staffId: string;
  startsAt: Date;
  endsAt: Date;
  excludeAppointmentId?: string;
  status?: string;
  isManager?: boolean;
  allowOffHours?: boolean;
};

export type BlockedTimeValidationOptions = {
  staffId: string;
  startsAt: Date;
  endsAt: Date;
  excludeBlockedId?: string;
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string; status: 400 | 409 };

function toStaffSchedules(rows: ScheduleRow[]): StaffSchedule[] {
  return rows.map((row) => ({
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until,
  }));
}

function fitsStaffSchedule(
  startsAt: Date,
  endsAt: Date,
  schedules: StaffSchedule[],
): boolean {
  const dateStr = formatDayParam(startsAt);
  const schedule = scheduleForStaffOnDay(schedules, dateStr);
  if (!schedule) return false;

  const workStart = parseTimeToMinutes(schedule.startTime);
  const workEnd = parseTimeToMinutes(schedule.endTime);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Indiana/Indianapolis",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const startParts = Object.fromEntries(
    formatter.formatToParts(startsAt).map((part) => [part.type, part.value]),
  );
  const endParts = Object.fromEntries(
    formatter.formatToParts(endsAt).map((part) => [part.type, part.value]),
  );
  const startMin =
    Number(startParts.hour === "24" ? "0" : startParts.hour) * 60 +
    Number(startParts.minute);
  const endMin =
    Number(endParts.hour === "24" ? "0" : endParts.hour) * 60 +
    Number(endParts.minute);

  if (startMin % 15 !== 0) return false;
  return startMin >= workStart && endMin <= workEnd;
}

async function loadOverlappingAppointments(
  supabase: SupabaseClient,
  staffId: string,
  startsAt: Date,
  endsAt: Date,
  excludeAppointmentId?: string,
): Promise<TimeRangeRow[]> {
  let query = supabase
    .from("appointments")
    .select("id, starts_at, ends_at")
    .eq("staff_id", staffId)
    .in("status", [...CALENDAR_BLOCKING_APPOINTMENT_STATUSES])
    .lt("starts_at", endsAt.toISOString())
    .gt("ends_at", startsAt.toISOString());

  if (excludeAppointmentId) {
    query = query.neq("id", excludeAppointmentId);
  }

  const { data, error } = await query.limit(1);
  if (error) throw error;
  return (data ?? []) as TimeRangeRow[];
}

async function loadOverlappingBlockedTimes(
  supabase: SupabaseClient,
  staffId: string,
  startsAt: Date,
  endsAt: Date,
  excludeBlockedId?: string,
): Promise<TimeRangeRow[]> {
  let query = supabase
    .from("blocked_times")
    .select("id, starts_at, ends_at")
    .eq("staff_id", staffId)
    .lt("starts_at", endsAt.toISOString())
    .gt("ends_at", startsAt.toISOString());

  if (excludeBlockedId) {
    query = query.neq("id", excludeBlockedId);
  }

  const { data, error } = await query.limit(1);
  if (error) throw error;
  return (data ?? []) as TimeRangeRow[];
}

export async function validateAppointmentTimeRange(
  supabase: SupabaseClient,
  options: AppointmentValidationOptions,
): Promise<ValidationResult> {
  const {
    staffId,
    startsAt,
    endsAt,
    excludeAppointmentId,
    status = "confirmed",
    isManager = false,
    allowOffHours = false,
  } = options;

  if (startsAt >= endsAt) {
    return { ok: false, message: "End time must be after start time", status: 400 };
  }

  if (!isManager && startsAt.getTime() < Date.now()) {
    return { ok: false, message: PAST_TIME_MESSAGE, status: 400 };
  }

  if (!isBlockingAppointmentStatus(status)) {
    return { ok: true };
  }

  if (!isManager && !allowOffHours) {
    const { data: schedules, error: scheduleError } = await supabase
      .from("staff_schedules")
      .select("day_of_week, start_time, end_time, effective_from, effective_until")
      .eq("staff_id", staffId);

    if (scheduleError) throw scheduleError;

    if (
      !fitsStaffSchedule(startsAt, endsAt, toStaffSchedules((schedules ?? []) as ScheduleRow[]))
    ) {
      return { ok: false, message: OFF_HOURS_MESSAGE, status: 400 };
    }
  }

  const [appointments, blockedTimes] = await Promise.all([
    loadOverlappingAppointments(
      supabase,
      staffId,
      startsAt,
      endsAt,
      excludeAppointmentId,
    ),
    loadOverlappingBlockedTimes(supabase, staffId, startsAt, endsAt),
  ]);

  if (appointments.length > 0) {
    return { ok: false, message: APPOINTMENT_CONFLICT_MESSAGE, status: 409 };
  }

  if (blockedTimes.length > 0) {
    return { ok: false, message: APPOINTMENT_BLOCKED_MESSAGE, status: 409 };
  }

  return { ok: true };
}

export async function validateBlockedTimeRange(
  supabase: SupabaseClient,
  options: BlockedTimeValidationOptions,
): Promise<ValidationResult> {
  const { staffId, startsAt, endsAt, excludeBlockedId } = options;

  if (startsAt >= endsAt) {
    return { ok: false, message: "End time must be after start time", status: 400 };
  }

  const [blockedTimes, appointments] = await Promise.all([
    loadOverlappingBlockedTimes(
      supabase,
      staffId,
      startsAt,
      endsAt,
      excludeBlockedId,
    ),
    loadOverlappingAppointments(supabase, staffId, startsAt, endsAt),
  ]);

  if (blockedTimes.length > 0) {
    return { ok: false, message: BLOCKED_TIME_CONFLICT_MESSAGE, status: 409 };
  }

  if (appointments.length > 0) {
    return {
      ok: false,
      message: "Cannot block time that overlaps an existing appointment",
      status: 409,
    };
  }

  return { ok: true };
}

export function mapOverlapDbError(error: unknown): ValidationResult | null {
  if (!isOverlapConflictError(error)) return null;
  const message = (error as { message?: string }).message?.toLowerCase() ?? "";
  if (message.includes("blocked")) {
    return { ok: false, message: APPOINTMENT_BLOCKED_MESSAGE, status: 409 };
  }
  if (message.includes("blocked_times")) {
    return { ok: false, message: BLOCKED_TIME_CONFLICT_MESSAGE, status: 409 };
  }
  return { ok: false, message: APPOINTMENT_CONFLICT_MESSAGE, status: 409 };
}

export { isOverlapConflictError };
