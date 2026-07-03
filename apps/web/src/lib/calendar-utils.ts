import { TIMEZONE } from "@saloncitrine/shared";
import { DEFAULT_DAYS_AHEAD } from "./availability";
import {
  addDaysToDateString,
  dayOfWeekInTimezone,
  todayInTimezone,
} from "./datetime-utils";

export const WEEKDAY_LABELS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

export type CalendarCell = {
  date: string;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
};

export function parseYearMonth(
  value: string | null | undefined,
  fallbackDate?: string,
): { year: number; month: number } {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m };
  }

  const ref = fallbackDate ?? todayInTimezone();
  const [y, m] = ref.split("-").map(Number);
  return { year: y, month: m };
}

export function formatMonthYear(year: number, month: number): string {
  const anchor = `${year}-${String(month).padStart(2, "0")}-15`;
  const utc = new Date(`${anchor}T12:00:00.000Z`);
  return utc.toLocaleDateString("en-US", {
    timeZone: TIMEZONE,
    month: "long",
    year: "numeric",
  });
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const dt = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1 };
}

export function monthToParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** First and last date in the 6-week calendar grid for a month (Sun-start). */
export function calendarGridBounds(
  year: number,
  month: number,
): { start: string; end: string } {
  const firstOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const dow = dayOfWeekInTimezone(firstOfMonth);
  const start = addDaysToDateString(firstOfMonth, -dow);
  const end = addDaysToDateString(start, 41);
  return { start, end };
}

export function buildCalendarGrid(
  year: number,
  month: number,
  today?: string,
): CalendarCell[] {
  const todayStr = today ?? todayInTimezone();
  const { start } = calendarGridBounds(year, month);
  const cells: CalendarCell[] = [];

  for (let i = 0; i < 42; i++) {
    const date = addDaysToDateString(start, i);
    const [y, m, d] = date.split("-").map(Number);
    cells.push({
      date,
      day: d,
      isCurrentMonth: y === year && m === month,
      isToday: date === todayStr,
      isPast: date < todayStr,
    });
  }

  return cells;
}

export function bookingHorizonEnd(
  fromDate?: string,
  daysAhead: number = DEFAULT_DAYS_AHEAD,
): string {
  const start = fromDate ?? todayInTimezone();
  return addDaysToDateString(start, daysAhead - 1);
}

export function isWithinBookingHorizon(
  dateStr: string,
  fromDate?: string,
  daysAhead: number = DEFAULT_DAYS_AHEAD,
): boolean {
  const start = fromDate ?? todayInTimezone();
  const end = bookingHorizonEnd(start, daysAhead);
  return dateStr >= start && dateStr <= end;
}
