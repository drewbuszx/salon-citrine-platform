import assert from "node:assert/strict";
import {
  addDays,
  dayOfWeek,
  defaultReportRangeDates,
  formatReportRangeLabel,
  isValidDateOnly,
  lastDayOfMonth,
  localWallClockToUtc,
  reportRangeFilenameSuffix,
  resolveReportRange,
  salonLocalDate,
  SALON_TIME_ZONE,
} from "../src/lib/report-range.ts";

// --- calendar helpers ------------------------------------------------------
assert.equal(addDays("2026-07-06", 1), "2026-07-07");
assert.equal(addDays("2026-07-06", -30), "2026-06-06");
assert.equal(addDays("2026-01-01", -1), "2025-12-31");
assert.equal(addDays("2024-02-28", 1), "2024-02-29"); // leap year
assert.equal(addDays("2026-02-28", 1), "2026-03-01");

assert.equal(dayOfWeek("2026-07-06"), 1); // Monday
assert.equal(dayOfWeek("2026-07-05"), 0); // Sunday

assert.equal(lastDayOfMonth(2026, 2), 28);
assert.equal(lastDayOfMonth(2024, 2), 29);
assert.equal(lastDayOfMonth(2026, 6), 30);

assert.equal(isValidDateOnly("2026-06-06"), true);
assert.equal(isValidDateOnly("2026-13-01"), false);
assert.equal(isValidDateOnly("2026-02-30"), false);
assert.equal(isValidDateOnly("2026-6-6"), false);
assert.equal(isValidDateOnly(null), false);
assert.equal(isValidDateOnly(""), false);

// --- salon-local midnight → UTC (DST aware) --------------------------------
// June: Indianapolis is EDT (UTC-4) → local midnight is 04:00Z.
assert.equal(
  localWallClockToUtc("2026-06-06", "00:00").toISOString(),
  "2026-06-06T04:00:00.000Z",
);
// January: Indianapolis is EST (UTC-5) → local midnight is 05:00Z.
assert.equal(
  localWallClockToUtc("2026-01-15", "00:00").toISOString(),
  "2026-01-15T05:00:00.000Z",
);

// --- resolveReportRange: the off-by-one fix --------------------------------
const june = resolveReportRange("2026-06-06", "2026-07-06");
assert.equal(june.fromDate, "2026-06-06");
assert.equal(june.toDate, "2026-07-06");
// Inclusive lower bound = local midnight of the first day.
assert.equal(june.startUtc, "2026-06-06T04:00:00.000Z");
// Exclusive upper bound = local midnight of the day AFTER the last day (Jul 7).
assert.equal(june.endExclusiveUtc, "2026-07-07T04:00:00.000Z");

// Reversed inputs are swapped into order.
const reversed = resolveReportRange("2026-07-06", "2026-06-06");
assert.equal(reversed.fromDate, "2026-06-06");
assert.equal(reversed.toDate, "2026-07-06");

// Invalid / missing inputs fall back to trailing-30-day default.
const fixedNow = new Date("2026-07-06T15:00:00.000Z");
const fallback = resolveReportRange("nonsense", null, { now: fixedNow });
const expectedDefault = defaultReportRangeDates(fixedNow);
assert.equal(fallback.fromDate, expectedDefault.fromDate);
assert.equal(fallback.toDate, expectedDefault.toDate);
assert.equal(expectedDefault.toDate, "2026-07-06");
assert.equal(expectedDefault.fromDate, "2026-06-06");

// salonLocalDate rolls correctly around UTC midnight (00:30Z on Jul 6 is still
// Jul 5 in Indianapolis).
assert.equal(salonLocalDate(new Date("2026-07-06T00:30:00.000Z")), "2026-07-05");
assert.equal(salonLocalDate(new Date("2026-07-06T15:00:00.000Z")), "2026-07-06");

// --- display label matches the input dates in every US timezone ------------
// This is the crux of the off-by-one bug: the label must read "Jun 6", never
// "Jun 5", regardless of the viewer's timezone.
const range = { fromDate: "2026-06-06", toDate: "2026-07-06" };
for (const tz of [
  SALON_TIME_ZONE,
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Pacific/Honolulu",
  "UTC",
]) {
  const label = formatReportRangeLabel(range, tz);
  assert.match(label, /Jun 6/, `expected "Jun 6" in label for ${tz}, got "${label}"`);
  assert.match(label, /Jul 6, 2026/, `expected "Jul 6, 2026" in label for ${tz}, got "${label}"`);
  assert.doesNotMatch(label, /Jun 5|Jul 5/, `off-by-one leaked into label for ${tz}: "${label}"`);
}

// Single-day range renders one formatted date.
assert.equal(
  formatReportRangeLabel({ fromDate: "2026-07-06", toDate: "2026-07-06" }),
  "Jul 6, 2026",
);

// Cross-year range shows the year on both ends.
const crossYear = formatReportRangeLabel({ fromDate: "2025-12-30", toDate: "2026-01-02" });
assert.match(crossYear, /Dec 30, 2025/);
assert.match(crossYear, /Jan 2, 2026/);

// --- filename suffix -------------------------------------------------------
assert.equal(reportRangeFilenameSuffix(range), "2026-06-06_2026-07-06");

console.log("report-range tests passed");
