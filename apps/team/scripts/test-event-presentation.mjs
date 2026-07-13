import assert from "node:assert/strict";
import {
  BIRTHDAY_GOLD,
  EVENT_PRESENTATION_TYPES,
  EVENT_TOKENS,
  NEUTRAL_OTHER_COLOR,
  NEUTRAL_TIME_OFF_COLOR,
  normalizeEventType,
  resolveEventStyle,
  timeOffStatusLabel,
} from "../src/lib/event-presentation.ts";
import { STAFF_ACCENT_COLORS, staffAccentColor } from "../src/lib/staff-colors.ts";

// --- normalizeEventType -----------------------------------------------------
assert.equal(normalizeEventType("birthday"), "birthday");
assert.equal(normalizeEventType("time_off"), "time_off");
assert.equal(normalizeEventType("closure"), "closure");
assert.equal(normalizeEventType("announcement"), "announcement");
// Legacy DB value `event` is community.
assert.equal(normalizeEventType("event"), "community");
assert.equal(normalizeEventType("community"), "community");
assert.equal(normalizeEventType("training"), "training");
assert.equal(normalizeEventType("meeting"), "meeting");
// Unknown / empty / null never fall back to birthday.
assert.equal(normalizeEventType("wedding"), "other");
assert.equal(normalizeEventType(""), "other");
assert.equal(normalizeEventType(null), "other");
assert.equal(normalizeEventType(undefined), "other");
assert.notEqual(normalizeEventType("nonsense"), "birthday");

// --- birthday ---------------------------------------------------------------
const birthday = resolveEventStyle({ eventType: "birthday" });
assert.equal(birthday.type, "birthday");
assert.equal(birthday.color, BIRTHDAY_GOLD);
assert.equal(birthday.icon, "cake");
assert.equal(birthday.markerShape, "circle");
assert.equal(birthday.usesStaffColor, false);
assert.equal(birthday.staffColorMissing, false);
assert.equal(birthday.accessibleLabel, "Birthday");

// --- time_off WITH a staff color -------------------------------------------
const staffId = "11111111-2222-3333-4444-555555555555";
const timeOff = resolveEventStyle({ eventType: "time_off", staffId });
assert.equal(timeOff.type, "time_off");
assert.equal(timeOff.usesStaffColor, true);
assert.equal(timeOff.staffColorMissing, false);
// Uses the employee's configured (hash-derived) staff color, NOT birthday gold.
assert.equal(timeOff.color, staffAccentColor(staffId));
assert.ok(STAFF_ACCENT_COLORS.includes(timeOff.color));
assert.notEqual(timeOff.color, BIRTHDAY_GOLD);
assert.equal(timeOff.icon, "suitcase");
assert.equal(timeOff.markerShape, "pill");

// --- time_off WITHOUT a staff color (neutral fallback, never birthday) ------
for (const missing of [null, undefined, "", "   "]) {
  const t = resolveEventStyle({ eventType: "time_off", staffId: missing });
  assert.equal(t.color, NEUTRAL_TIME_OFF_COLOR, `missing=${JSON.stringify(missing)}`);
  assert.equal(t.staffColorMissing, true);
  assert.notEqual(t.color, BIRTHDAY_GOLD);
  assert.equal(t.icon, "suitcase");
}

// --- closure ----------------------------------------------------------------
const closure = resolveEventStyle({ eventType: "closure" });
assert.equal(closure.type, "closure");
assert.equal(closure.icon, "lock");
assert.equal(closure.color, EVENT_TOKENS.closure.baseColor);
assert.notEqual(closure.color, BIRTHDAY_GOLD);

// --- announcement -----------------------------------------------------------
const announcement = resolveEventStyle({ eventType: "announcement" });
assert.equal(announcement.type, "announcement");
assert.equal(announcement.icon, "megaphone");
assert.equal(announcement.color, EVENT_TOKENS.announcement.baseColor);

// --- community (both `community` and legacy `event`) ------------------------
for (const raw of ["community", "event"]) {
  const community = resolveEventStyle({ eventType: raw });
  assert.equal(community.type, "community");
  assert.equal(community.icon, "heart");
  assert.equal(community.color, EVENT_TOKENS.community.baseColor);
}

// --- training / meeting have their own consistent tokens --------------------
const training = resolveEventStyle({ eventType: "training" });
assert.equal(training.type, "training");
assert.equal(training.icon, "cap");
const meeting = resolveEventStyle({ eventType: "meeting" });
assert.equal(meeting.type, "meeting");
assert.equal(meeting.icon, "group");
assert.notEqual(training.color, meeting.color);

// --- unknown ----------------------------------------------------------------
const unknown = resolveEventStyle({ eventType: "surprise-party" });
assert.equal(unknown.type, "other");
assert.equal(unknown.color, NEUTRAL_OTHER_COLOR);
assert.notEqual(unknown.color, BIRTHDAY_GOLD);
assert.equal(unknown.staffColorMissing, false);

// --- invariants across the full enum ---------------------------------------
for (const type of EVENT_PRESENTATION_TYPES) {
  const style = resolveEventStyle({ eventType: type });
  assert.ok(style.label, `${type} has a label`);
  assert.ok(style.icon, `${type} has an icon`);
  assert.ok(style.color, `${type} has a color`);
  assert.ok(style.background.includes("color-mix"), `${type} has a background`);
  assert.ok(style.border.includes("color-mix"), `${type} has a border`);
  assert.ok(style.textColor.includes("color-mix"), `${type} has a text color`);
  assert.ok(style.markerShape, `${type} has a marker shape`);
  assert.ok(style.accessibleLabel, `${type} has an accessible label`);
  // Only time_off is allowed to use a staff color; nothing else, and birthday
  // is never the fallback for a non-birthday type.
  if (type !== "birthday") {
    assert.notEqual(style.color, BIRTHDAY_GOLD, `${type} must not be birthday gold`);
  }
  if (type !== "time_off") {
    assert.equal(style.usesStaffColor, false, `${type} must not use staff color`);
  }
}

// --- timeOffStatusLabel (task 25) -----------------------------------------
assert.equal(timeOffStatusLabel("pending"), "Pending");
assert.equal(timeOffStatusLabel("approved"), "Approved");
assert.equal(timeOffStatusLabel("declined"), "Declined");
assert.equal(timeOffStatusLabel("cancelled"), "Cancelled");
// not_required and unknown/empty produce no badge text.
assert.equal(timeOffStatusLabel("not_required"), "");
assert.equal(timeOffStatusLabel(null), "");
assert.equal(timeOffStatusLabel("bogus"), "");

console.log("event-presentation tests passed");
