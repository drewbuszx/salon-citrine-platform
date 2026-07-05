/**
 * Calendar overlap rules shared by client booking and team calendar APIs.
 * Active appointments block availability; cancelled/completed/no_show do not.
 */

export const CALENDAR_BLOCKING_APPOINTMENT_STATUSES = [
  "booked",
  "pending",
  "confirmed",
  "arrived",
] as const;

export type CalendarBlockingAppointmentStatus =
  (typeof CALENDAR_BLOCKING_APPOINTMENT_STATUSES)[number];

export function isBlockingAppointmentStatus(
  status: string,
): status is CalendarBlockingAppointmentStatus {
  return (CALENDAR_BLOCKING_APPOINTMENT_STATUSES as readonly string[]).includes(
    status,
  );
}

/** Half-open interval overlap: [start, end) */
export function rangesOverlap(
  aStart: Date | string,
  aEnd: Date | string,
  bStart: Date | string,
  bEnd: Date | string,
): boolean {
  const aS = new Date(aStart).getTime();
  const aE = new Date(aEnd).getTime();
  const bS = new Date(bStart).getTime();
  const bE = new Date(bEnd).getTime();
  if ([aS, aE, bS, bE].some(Number.isNaN)) return true;
  return aS < bE && aE > bS;
}

/** PostgreSQL exclusion / overlap violation (23P01) or known trigger messages. */
export function isOverlapConflictError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string };
  if (record.code === "23P01") return true;
  const message = (record.message ?? "").toLowerCase();
  return (
    message.includes("appointments_no_staff_overlap") ||
    message.includes("blocked_times_no_staff_overlap") ||
    message.includes("conflicts with blocked time") ||
    message.includes("exclusion")
  );
}

export const APPOINTMENT_CONFLICT_MESSAGE =
  "That time was just booked. Choose another slot.";

export const BLOCKED_TIME_CONFLICT_MESSAGE =
  "This time overlaps an existing block.";

export const APPOINTMENT_BLOCKED_MESSAGE =
  "That time is blocked and unavailable.";

export const OFF_HOURS_MESSAGE =
  "This time is outside working hours.";

export const PAST_TIME_MESSAGE = "Cannot book appointments in the past.";
