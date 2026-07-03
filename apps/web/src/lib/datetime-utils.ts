import { TIMEZONE } from "@saloncitrine/shared";

/** Parse "HH:MM" or "HH:MM:SS" to minutes from midnight. */
export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Format minutes from midnight as "HH:MM" (24h). */
export function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Convert a local salon date + wall-clock time to UTC.
 * Uses iterative offset correction via Intl (handles DST).
 */
export function localDateTimeToUtc(
  dateStr: string,
  timeStr: string,
  timeZone: string = TIMEZONE,
): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);

  let utcMs = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]),
    );
    const tzYear = Number(parts.year);
    const tzMonth = Number(parts.month);
    const tzDay = Number(parts.day);
    const tzHour = Number(parts.hour === "24" ? "0" : parts.hour);
    const tzMin = Number(parts.minute);

    const diffMinutes =
      (y - tzYear) * 525600 +
      (m - tzMonth) * 43800 +
      (d - tzDay) * 1440 +
      (hh - tzHour) * 60 +
      (mm - tzMin);

    if (diffMinutes === 0) break;
    utcMs += diffMinutes * 60 * 1000;
  }

  return new Date(utcMs);
}

/** YYYY-MM-DD for a calendar day in the salon timezone. */
export function formatDateInTimezone(date: Date, timeZone: string = TIMEZONE): string {
  return date.toLocaleDateString("en-CA", { timeZone });
}

/** JS day-of-week (0=Sun) for a YYYY-MM-DD date in the salon timezone. */
export function dayOfWeekInTimezone(dateStr: string, timeZone: string = TIMEZONE): number {
  const noonUtc = localDateTimeToUtc(dateStr, "12:00", timeZone);
  const weekday = noonUtc.toLocaleDateString("en-US", { timeZone, weekday: "short" });
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? 0;
}

/** Display label for a UTC instant in salon local time. */
export function formatSlotLabel(utcDate: Date, timeZone: string = TIMEZONE): string {
  return utcDate.toLocaleTimeString("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Start/end of a local calendar day as UTC bounds. */
export function localDayUtcBounds(
  dateStr: string,
  timeZone: string = TIMEZONE,
): { start: Date; end: Date } {
  const start = localDateTimeToUtc(dateStr, "00:00", timeZone);
  const nextDay = addDaysToDateString(dateStr, 1);
  const end = localDateTimeToUtc(nextDay, "00:00", timeZone);
  return { start, end };
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Today as YYYY-MM-DD in salon timezone. */
export function todayInTimezone(timeZone: string = TIMEZONE): string {
  return formatDateInTimezone(new Date(), timeZone);
}
