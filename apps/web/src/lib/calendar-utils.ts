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

export type IcsAppointmentInput = {
  uid: string;
  startsAt: string;
  endsAt: string;
  summary: string;
  description?: string;
  location?: string;
  organizerEmail?: string;
};

const VTIMEZONE_INDIANAPOLIS = [
  "BEGIN:VTIMEZONE",
  "TZID:America/Indiana/Indianapolis",
  "X-LIC-LOCATION:America/Indiana/Indianapolis",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0400",
  "TZNAME:EDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0400",
  "TZOFFSETTO:-0500",
  "TZNAME:EST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
].join("\r\n");

function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatIcsUtcTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** Format an ISO instant as local wall time for ICS DTSTART/DTEND (YYYYMMDDTHHMMSS). */
export function formatIcsLocalTimestamp(
  iso: string,
  timeZone: string = TIMEZONE,
): string {
  const date = new Date(iso);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}${parts.month}${parts.day}T${hour}${parts.minute}${parts.second}`;
}

/** Build a downloadable .ics file for a confirmed salon appointment. */
export function generateIcsFile(
  appointment: IcsAppointmentInput,
  timeZone: string = TIMEZONE,
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Salon Citrine//Guest Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    VTIMEZONE_INDIANAPOLIS,
    "BEGIN:VEVENT",
    `UID:${icsEscape(appointment.uid)}`,
    `DTSTAMP:${formatIcsUtcTimestamp(new Date())}`,
    `DTSTART;TZID=${timeZone}:${formatIcsLocalTimestamp(appointment.startsAt, timeZone)}`,
    `DTEND;TZID=${timeZone}:${formatIcsLocalTimestamp(appointment.endsAt, timeZone)}`,
    `SUMMARY:${icsEscape(appointment.summary)}`,
  ];

  if (appointment.description) {
    lines.push(`DESCRIPTION:${icsEscape(appointment.description)}`);
  }
  if (appointment.location) {
    lines.push(`LOCATION:${icsEscape(appointment.location)}`);
  }
  if (appointment.organizerEmail) {
    lines.push(
      `ORGANIZER;CN=Salon Citrine:mailto:${icsEscape(appointment.organizerEmail)}`,
    );
  }

  lines.push("STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}
