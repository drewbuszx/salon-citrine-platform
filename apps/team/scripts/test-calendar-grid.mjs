#!/usr/bin/env node
/**
 * Calendar grid alignment — 15-minute slot math for event blocks (Fix #44).
 * Self-contained (no shared package imports) — mirrors calendar.ts eventBlockStyle.
 */
import assert from "node:assert/strict";

const TIMEZONE = "America/Indiana/Indianapolis";
const CALENDAR_START_HOUR = 4;
const CALENDAR_END_HOUR = 24;
const CALENDAR_SLOT_MINUTES = 15;
const CALENDAR_ROW_HEIGHT_REM = 1.25;

function minutesFromDayStart(iso) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  );
  const hour = Number(parts.hour === "24" ? "0" : parts.hour);
  const minute = Number(parts.minute);
  return hour * 60 + minute;
}

function eventBlockStyle(startsAt, endsAt) {
  const gridStart = CALENDAR_START_HOUR * 60;
  const gridEnd = CALENDAR_END_HOUR * 60;
  const rawStart = minutesFromDayStart(startsAt);
  let rawEnd = minutesFromDayStart(endsAt);
  if (rawEnd <= rawStart) {
    rawEnd = gridEnd;
  }
  const startMin = Math.min(Math.max(rawStart, gridStart), gridEnd);
  const clampedEnd = Math.min(Math.max(rawEnd, gridStart), gridEnd);
  const endMin = Math.max(clampedEnd, startMin + CALENDAR_SLOT_MINUTES);
  const slotOffset = (startMin - gridStart) / CALENDAR_SLOT_MINUTES;
  const slotSpan = (endMin - startMin) / CALENDAR_SLOT_MINUTES;
  const top = Math.round(slotOffset * CALENDAR_ROW_HEIGHT_REM * 1000) / 1000;
  const height = Math.round(Math.max(slotSpan, 1) * CALENDAR_ROW_HEIGHT_REM * 1000) / 1000;
  return {
    top: `${Math.max(top, 0)}rem`,
    height: `${Math.max(height, CALENDAR_ROW_HEIGHT_REM)}rem`,
  };
}

function expectedTop(hour, minute) {
  const startMin = hour * 60 + minute;
  const gridStart = CALENDAR_START_HOUR * 60;
  const slots = (startMin - gridStart) / CALENDAR_SLOT_MINUTES;
  return `${slots * CALENDAR_ROW_HEIGHT_REM}rem`;
}

function expectedHeight(startHour, startMin, endHour, endMin) {
  const start = startHour * 60 + startMin;
  const end = endHour * 60 + endMin;
  const span = Math.max(end - start, CALENDAR_SLOT_MINUTES) / CALENDAR_SLOT_MINUTES;
  return `${Math.max(span, 1) * CALENDAR_ROW_HEIGHT_REM}rem`;
}

const TEN_AM = "2026-07-06T14:00:00.000Z";
const TEN_FIFTEEN = "2026-07-06T14:15:00.000Z";
const TEN_THIRTY = "2026-07-06T14:30:00.000Z";
const NOON = "2026-07-06T16:00:00.000Z";
const TEN_OH_FIVE = "2026-07-06T14:05:00.000Z";

const thirtyMin = eventBlockStyle(TEN_AM, TEN_THIRTY);
assert.equal(thirtyMin.top, expectedTop(10, 0));
assert.equal(thirtyMin.height, expectedHeight(10, 0, 10, 30));

const quarter = eventBlockStyle(TEN_FIFTEEN, TEN_THIRTY);
assert.equal(quarter.top, expectedTop(10, 15));

const twoHour = eventBlockStyle(TEN_AM, NOON);
assert.equal(twoHour.height, expectedHeight(10, 0, 12, 0));

const short = eventBlockStyle(TEN_AM, TEN_OH_FIVE);
assert.equal(short.height, `${CALENDAR_ROW_HEIGHT_REM}rem`);

// All-day / midnight-crossing band (e.g. clamped time off) must span the full
// grid, not collapse to a stub pinned at the top. Local midnight -> next
// local midnight (EDT = UTC-4 in July).
const LOCAL_MIDNIGHT = "2026-07-07T04:00:00.000Z";
const NEXT_LOCAL_MIDNIGHT = "2026-07-08T04:00:00.000Z";
const fullGridSpanRem =
  ((CALENDAR_END_HOUR - CALENDAR_START_HOUR) * 60 / CALENDAR_SLOT_MINUTES) *
  CALENDAR_ROW_HEIGHT_REM;
const allDay = eventBlockStyle(LOCAL_MIDNIGHT, NEXT_LOCAL_MIDNIGHT);
assert.equal(allDay.top, "0rem");
assert.equal(allDay.height, `${fullGridSpanRem}rem`);

console.log("Calendar grid alignment tests passed.");
