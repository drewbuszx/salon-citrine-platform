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
  const matching = schedules.filter((row) => {
    if (row.day_of_week !== dow) return false;
    if (dateStr < row.effective_from) return false;
    if (row.effective_until && dateStr > row.effective_until) return false;
    return true;
  });
  if (matching.length === 0) return undefined;
  return matching.reduce((best, row) =>
    row.effective_from > best.effective_from ? row : best,
  );
}

/** Round up to the next 15-minute boundary (unchanged if already aligned). */
export function alignToSlotInterval(minutes: number): number {
  const remainder = minutes % SLOT_INTERVAL_MINUTES;
  if (remainder === 0) return minutes;
  return minutes + (SLOT_INTERVAL_MINUTES - remainder);
}

/** True when a slot start + service duration fits entirely within schedule hours. */
export function slotFitsScheduleWindow(
  slotStartMin: number,
  durationMinutes: number,
  workStartMin: number,
  workEndMin: number,
): boolean {
  if (slotStartMin < workStartMin) return false;
  if (slotStartMin % SLOT_INTERVAL_MINUTES !== 0) return false;
  return slotStartMin + durationMinutes <= workEndMin;
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
  const firstSlotMin = alignToSlotInterval(workStartMin);
  const lastStartMin = workEndMin - ctx.durationMinutes;
  if (lastStartMin < firstSlotMin) return [];

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
    let cursor = firstSlotMin;
    cursor <= lastStartMin;
    cursor += SLOT_INTERVAL_MINUTES
  ) {
    if (
      !slotFitsScheduleWindow(
        cursor,
        ctx.durationMinutes,
        workStartMin,
        workEndMin,
      )
    ) {
      continue;
    }

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

function normalizeServiceIds(serviceIds: string | string[]): string[] {
  const ids = Array.isArray(serviceIds) ? serviceIds : [serviceIds];
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) {
    throw new Error("At least one service id is required");
  }
  return unique;
}

async function fetchAvailabilityContext(
  staffId: string,
  serviceIds: string | string[],
  rangeStart: Date,
  rangeEnd: Date,
): Promise<AvailabilityContext> {
  const ids = normalizeServiceIds(serviceIds);
  const supabase = createSupabaseClient();

  const [schedulesResult, servicesResult, blockedResult, appointmentsResult] =
    await Promise.all([
      supabase
        .from("staff_schedules")
        .select("day_of_week, start_time, end_time, effective_from, effective_until")
        .eq("staff_id", staffId),
      supabase
        .from("services")
        .select("duration_minutes")
        .in("id", ids),
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
  if (servicesResult.error) throw servicesResult.error;
  if (blockedResult.error) throw blockedResult.error;
  if (appointmentsResult.error) throw appointmentsResult.error;
  if (!servicesResult.data?.length) {
    throw new Error(`Services not found: ${ids.join(", ")}`);
  }

  const durationMinutes = (servicesResult.data as { duration_minutes: number }[]).reduce(
    (sum, row) => sum + row.duration_minutes,
    0,
  );

  return {
    schedules: schedulesResult.data as StaffScheduleRow[],
    blockedTimes: blockedResult.data as BlockedTimeRow[],
    appointments: appointmentsResult.data as AppointmentRow[],
    durationMinutes,
  };
}

export async function getAvailableSlots(
  staffId: string,
  serviceIds: string | string[],
  dateStr: string,
): Promise<TimeSlot[]> {
  const { start, end } = localDayUtcBounds(dateStr);
  const ctx = await fetchAvailabilityContext(staffId, serviceIds, start, end);
  return computeSlotsForDate(ctx, dateStr);
}

/**
 * Server-side guard: true when the selected display label matches a slot
 * that is within staff hours and free of blocks/appointments.
 */
export async function isBookingSlotAvailable(
  staffId: string,
  serviceIds: string | string[],
  dateStr: string,
  timeLabel: string,
): Promise<boolean> {
  const slots = await getAvailableSlots(staffId, serviceIds, dateStr);
  return slots.some((slot) => slot.label === timeLabel);
}

/** Server-side guard using the UTC ISO slot start from availability. */
export async function isBookingSlotAvailableByStartsAt(
  staffId: string,
  serviceIds: string | string[],
  dateStr: string,
  startsAtIso: string,
): Promise<boolean> {
  const requestedStartMs = new Date(startsAtIso).getTime();
  if (Number.isNaN(requestedStartMs)) return false;

  const slots = await getAvailableSlots(staffId, serviceIds, dateStr);
  return slots.some((slot) => {
    const slotStartMs = new Date(slot.startsAt).getTime();
    return (
      !Number.isNaN(slotStartMs) &&
      (slot.startsAt === startsAtIso || slotStartMs === requestedStartMs)
    );
  });
}

/** Resolve display label + UTC start for a selected slot. */
export async function resolveBookingSlot(
  staffId: string,
  serviceIds: string | string[],
  dateStr: string,
  timeLabel: string | null,
  startsAtIso: string | null,
): Promise<TimeSlot | undefined> {
  const slots = await getAvailableSlots(staffId, serviceIds, dateStr);
  if (startsAtIso) {
    const requestedStartMs = new Date(startsAtIso).getTime();
    return slots.find((slot) => {
      if (slot.startsAt === startsAtIso) return true;
      if (Number.isNaN(requestedStartMs)) return false;
      const slotStartMs = new Date(slot.startsAt).getTime();
      return !Number.isNaN(slotStartMs) && slotStartMs === requestedStartMs;
    });
  }
  if (timeLabel) {
    return slots.find((slot) => slot.label === timeLabel);
  }
  return undefined;
}

export async function getAvailableDatesInRange(
  staffId: string,
  serviceIds: string | string[],
  startDate: string,
  endDate: string,
): Promise<string[]> {
  if (startDate > endDate) return [];

  const rangeStart = localDateTimeToUtc(startDate, "00:00");
  const rangeEnd = localDateTimeToUtc(addDaysToDateString(endDate, 1), "00:00");

  const ctx = await fetchAvailabilityContext(
    staffId,
    serviceIds,
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
  serviceIds: string | string[],
  fromDate?: string,
  daysAhead: number = DEFAULT_DAYS_AHEAD,
): Promise<string[]> {
  const startDate = fromDate ?? todayInTimezone();
  const endDate = addDaysToDateString(startDate, daysAhead - 1);
  return getAvailableDatesInRange(staffId, serviceIds, startDate, endDate);
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
