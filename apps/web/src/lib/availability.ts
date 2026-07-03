import { TIMEZONE } from "@saloncitrine/shared";
import { createSupabaseClient } from "./supabase";
import {
  addDaysToDateString,
  dayOfWeekInTimezone,
  formatSlotLabel,
  localDateTimeToUtc,
  localDayUtcBounds,
  minutesToTimeString,
  parseTimeToMinutes,
  todayInTimezone,
} from "./datetime-utils";

/** Minutes between candidate slot start times. */
export const SLOT_INTERVAL_MINUTES = 15;

/** Default booking horizon when querying available dates. */
export const DEFAULT_DAYS_AHEAD = 42;

export type TimeSlot = {
  /** Display label passed to the details step, e.g. "10:00 AM". */
  label: string;
  /** UTC ISO timestamp for the slot start. */
  startsAt: string;
};

type StaffScheduleRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  effective_from: string;
  effective_until: string | null;
};

type BlockedTimeRow = {
  starts_at: string;
  ends_at: string;
};

type AppointmentRow = {
  starts_at: string;
  ends_at: string;
};

type AvailabilityContext = {
  schedules: StaffScheduleRow[];
  blockedTimes: BlockedTimeRow[];
  appointments: AppointmentRow[];
  durationMinutes: number;
};

function scheduleForDate(
  schedules: StaffScheduleRow[],
  dateStr: string,
): StaffScheduleRow | undefined {
  const dow = dayOfWeekInTimezone(dateStr);
  return schedules.find((row) => {
    if (row.day_of_week !== dow) return false;
    if (dateStr < row.effective_from) return false;
    if (row.effective_until && dateStr > row.effective_until) return false;
    return true;
  });
}

function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function isSlotAvailable(
  slotStart: Date,
  slotEnd: Date,
  blockedTimes: BlockedTimeRow[],
  appointments: AppointmentRow[],
): boolean {
  const startMs = slotStart.getTime();
  const endMs = slotEnd.getTime();

  for (const block of blockedTimes) {
    const bStart = new Date(block.starts_at).getTime();
    const bEnd = new Date(block.ends_at).getTime();
    if (rangesOverlap(startMs, endMs, bStart, bEnd)) return false;
  }

  for (const appt of appointments) {
    const aStart = new Date(appt.starts_at).getTime();
    const aEnd = new Date(appt.ends_at).getTime();
    if (rangesOverlap(startMs, endMs, aStart, aEnd)) return false;
  }

  return true;
}

export function computeSlotsForDate(
  ctx: AvailabilityContext,
  dateStr: string,
  now: Date = new Date(),
): TimeSlot[] {
  const schedule = scheduleForDate(ctx.schedules, dateStr);
  if (!schedule) return [];

  const workStartMin = parseTimeToMinutes(schedule.start_time);
  const workEndMin = parseTimeToMinutes(schedule.end_time);
  const lastStartMin = workEndMin - ctx.durationMinutes;
  if (lastStartMin < workStartMin) return [];

  const { start: dayStart, end: dayEnd } = localDayUtcBounds(dateStr);
  const dayBlocked = ctx.blockedTimes.filter((b) => {
    const bStart = new Date(b.starts_at).getTime();
    const bEnd = new Date(b.ends_at).getTime();
    return bStart < dayEnd.getTime() && bEnd > dayStart.getTime();
  });
  const dayAppointments = ctx.appointments.filter((a) => {
    const aStart = new Date(a.starts_at).getTime();
    const aEnd = new Date(a.ends_at).getTime();
    return aStart < dayEnd.getTime() && aEnd > dayStart.getTime();
  });

  const slots: TimeSlot[] = [];
  const nowMs = now.getTime();

  for (
    let cursor = workStartMin;
    cursor <= lastStartMin;
    cursor += SLOT_INTERVAL_MINUTES
  ) {
    const timeStr = minutesToTimeString(cursor);
    const slotStart = localDateTimeToUtc(dateStr, timeStr);
    const slotEnd = new Date(slotStart.getTime() + ctx.durationMinutes * 60_000);

    if (slotStart.getTime() <= nowMs) continue;
    if (
      !isSlotAvailable(slotStart, slotEnd, dayBlocked, dayAppointments)
    ) {
      continue;
    }

    slots.push({
      label: formatSlotLabel(slotStart),
      startsAt: slotStart.toISOString(),
    });
  }

  return slots;
}

async function fetchAvailabilityContext(
  staffId: string,
  serviceId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<AvailabilityContext> {
  const supabase = createSupabaseClient();

  const [schedulesResult, serviceResult, blockedResult, appointmentsResult] =
    await Promise.all([
      supabase
        .from("staff_schedules")
        .select("day_of_week, start_time, end_time, effective_from, effective_until")
        .eq("staff_id", staffId),
      supabase
        .from("services")
        .select("duration_minutes")
        .eq("id", serviceId)
        .maybeSingle(),
      supabase
        .from("blocked_times")
        .select("starts_at, ends_at")
        .eq("staff_id", staffId)
        .lt("starts_at", rangeEnd.toISOString())
        .gt("ends_at", rangeStart.toISOString()),
      supabase
        .from("appointment_availability")
        .select("starts_at, ends_at")
        .eq("staff_id", staffId)
        .lt("starts_at", rangeEnd.toISOString())
        .gt("ends_at", rangeStart.toISOString()),
    ]);

  if (schedulesResult.error) throw schedulesResult.error;
  if (serviceResult.error) throw serviceResult.error;
  if (blockedResult.error) throw blockedResult.error;
  if (appointmentsResult.error) throw appointmentsResult.error;
  if (!serviceResult.data) {
    throw new Error(`Service not found: ${serviceId}`);
  }

  return {
    schedules: schedulesResult.data as StaffScheduleRow[],
    blockedTimes: blockedResult.data as BlockedTimeRow[],
    appointments: appointmentsResult.data as AppointmentRow[],
    durationMinutes: serviceResult.data.duration_minutes,
  };
}

export async function getAvailableSlots(
  staffId: string,
  serviceId: string,
  dateStr: string,
): Promise<TimeSlot[]> {
  const { start, end } = localDayUtcBounds(dateStr);
  const ctx = await fetchAvailabilityContext(staffId, serviceId, start, end);
  return computeSlotsForDate(ctx, dateStr);
}

export async function getAvailableDatesInRange(
  staffId: string,
  serviceId: string,
  startDate: string,
  endDate: string,
): Promise<string[]> {
  if (startDate > endDate) return [];

  const rangeStart = localDateTimeToUtc(startDate, "00:00");
  const rangeEnd = localDateTimeToUtc(addDaysToDateString(endDate, 1), "00:00");

  const ctx = await fetchAvailabilityContext(
    staffId,
    serviceId,
    rangeStart,
    rangeEnd,
  );

  const dates: string[] = [];
  let cursor = startDate;

  while (cursor <= endDate) {
    const daySlots = computeSlotsForDate(ctx, cursor);
    if (daySlots.length > 0) dates.push(cursor);
    cursor = addDaysToDateString(cursor, 1);
  }

  return dates;
}

export async function getAvailableDates(
  staffId: string,
  serviceId: string,
  fromDate?: string,
  daysAhead: number = DEFAULT_DAYS_AHEAD,
): Promise<string[]> {
  const startDate = fromDate ?? todayInTimezone();
  const endDate = addDaysToDateString(startDate, daysAhead - 1);
  return getAvailableDatesInRange(staffId, serviceId, startDate, endDate);
}

/** Format a date string for the date picker UI. */
export function formatAvailableDateLabel(dateStr: string): string {
  const utc = localDateTimeToUtc(dateStr, "12:00");
  return utc.toLocaleDateString("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Resolve selected date: must be in available set or fall back to first. */
export function resolveSelectedDate(
  availableDates: string[],
  requested: string | null,
): string | undefined {
  if (availableDates.length === 0) return undefined;
  if (requested && availableDates.includes(requested)) return requested;
  return availableDates[0];
}
