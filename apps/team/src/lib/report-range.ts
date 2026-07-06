/**
 * Report date-range resolution in the salon's local calendar.
 *
 * Report filters are calendar dates (YYYY-MM-DD), not instants. The salon lives
 * in America/Indiana/Indianapolis, but the Worker runtime is UTC, so parsing a
 * date-only string with `new Date("2026-06-06")` yields UTC midnight, which then
 * displays as the *previous* day in a US timezone — the off-by-one bug.
 *
 * This module treats the inputs as salon-local calendar dates and converts them
 * to the correct UTC instants for querying:
 *   - startUtc         = local midnight of the first day
 *   - endExclusiveUtc  = local midnight of the day AFTER the last day
 * Queries should use `>= startUtc AND < endExclusiveUtc`.
 *
 * Intentionally dependency-free (only `Intl` + `Date`) so it is safe to bundle
 * for the browser and to unit-test directly with `node --experimental-strip-types`.
 */

export const SALON_TIME_ZONE = "America/Indiana/Indianapolis";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export type ReportRange = {
  /** Inclusive first day, salon-local calendar date (YYYY-MM-DD). */
  fromDate: string;
  /** Inclusive last day, salon-local calendar date (YYYY-MM-DD). */
  toDate: string;
  /** UTC instant of local midnight on `fromDate` (inclusive lower bound). */
  startUtc: string;
  /** UTC instant of local midnight the day AFTER `toDate` (exclusive upper bound). */
  endExclusiveUtc: string;
};

/** True when the value is a well-formed, real YYYY-MM-DD calendar date. */
export function isValidDateOnly(value: string | null | undefined): value is string {
  if (!value || !DATE_ONLY.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

/** Add `n` calendar days to a YYYY-MM-DD string (pure date arithmetic). */
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + n));
  return isoDate(next);
}

/** Day of week for a YYYY-MM-DD string: 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Last day-of-month number for a given year/month (1-indexed month). */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Today's salon-local calendar date as YYYY-MM-DD. */
export function salonLocalDate(
  now: Date = new Date(),
  timeZone: string = SALON_TIME_ZONE,
): string {
  // en-CA renders as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Convert a salon-local wall-clock (date + HH:MM) to the equivalent UTC instant.
 * Mirrors the proven algorithm in lib/datetime.ts but kept local so this module
 * stays dependency-free and directly testable.
 */
export function localWallClockToUtc(
  dateStr: string,
  timeStr: string,
  timeZone: string = SALON_TIME_ZONE,
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

/** Default range: the trailing 30 days ending today, in salon-local dates. */
export function defaultReportRangeDates(
  now: Date = new Date(),
  timeZone: string = SALON_TIME_ZONE,
): { fromDate: string; toDate: string } {
  const toDate = salonLocalDate(now, timeZone);
  return { fromDate: addDays(toDate, -30), toDate };
}

/**
 * Resolve raw from/to inputs into a fully specified salon-local range.
 * Invalid or missing inputs fall back to the default trailing-30-day range.
 * If the inputs are reversed, they are swapped so the range is always ordered.
 */
export function resolveReportRange(
  fromParam: string | null | undefined,
  toParam: string | null | undefined,
  opts: { timeZone?: string; now?: Date } = {},
): ReportRange {
  const timeZone = opts.timeZone ?? SALON_TIME_ZONE;
  const now = opts.now ?? new Date();

  let fromDate: string;
  let toDate: string;

  if (isValidDateOnly(fromParam) && isValidDateOnly(toParam)) {
    fromDate = fromParam;
    toDate = toParam;
    if (fromDate > toDate) {
      [fromDate, toDate] = [toDate, fromDate];
    }
  } else {
    ({ fromDate, toDate } = defaultReportRangeDates(now, timeZone));
  }

  const startUtc = localWallClockToUtc(fromDate, "00:00", timeZone).toISOString();
  const endExclusiveUtc = localWallClockToUtc(
    addDays(toDate, 1),
    "00:00",
    timeZone,
  ).toISOString();

  return { fromDate, toDate, startUtc, endExclusiveUtc };
}

function isoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Human label for a range, e.g. "Jun 6 – Jul 6, 2026".
 * Anchors each date at local noon so the calendar day is preserved regardless
 * of timezone offset.
 */
export function formatReportRangeLabel(
  range: Pick<ReportRange, "fromDate" | "toDate">,
  timeZone: string = SALON_TIME_ZONE,
): string {
  const from = noonAnchor(range.fromDate);
  const to = noonAnchor(range.toDate);

  const sameYear = range.fromDate.slice(0, 4) === range.toDate.slice(0, 4);
  const fromFmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const toFmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (range.fromDate === range.toDate) {
    return toFmt.format(to);
  }
  return `${fromFmt.format(from)} – ${toFmt.format(to)}`;
}

/** Filename-safe range suffix, e.g. "2026-06-06_2026-07-06". */
export function reportRangeFilenameSuffix(
  range: Pick<ReportRange, "fromDate" | "toDate">,
): string {
  return `${range.fromDate}_${range.toDate}`;
}

function noonAnchor(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00Z`);
}
