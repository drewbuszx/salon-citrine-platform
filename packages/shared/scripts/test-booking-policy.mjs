import assert from "node:assert/strict";
import {
  DEFAULT_BOOKING_POLICY,
  calculateLateCancelFeeCents,
  calculateRequiredDepositCents,
  evaluateCancellationFee,
  formatBookingPolicySummary,
  hoursUntilAppointment,
  isLateCancellation,
} from "../src/booking-policy.ts";

const summary = formatBookingPolicySummary(DEFAULT_BOOKING_POLICY);
assert.match(summary, /48 hours/);
assert.match(summary, /card on file/i);

assert.equal(calculateRequiredDepositCents(DEFAULT_BOOKING_POLICY, 10_000), 0);

const percentPolicy = {
  ...DEFAULT_BOOKING_POLICY,
  depositType: "percent",
  depositValue: 25,
};
assert.equal(calculateRequiredDepositCents(percentPolicy, 10_000), 2_500);

const fixedPolicy = {
  ...DEFAULT_BOOKING_POLICY,
  depositType: "fixed",
  depositValue: 5_000,
};
assert.equal(calculateRequiredDepositCents(fixedPolicy, 10_000), 5_000);
assert.equal(calculateRequiredDepositCents(fixedPolicy, 2_000), 2_000);

const startsAt = new Date("2026-07-10T18:00:00.000Z");
const withinWindow = new Date("2026-07-08T10:00:00.000Z");
const lateCancel = new Date("2026-07-10T10:00:00.000Z");

assert.equal(hoursUntilAppointment(startsAt, withinWindow), 56);
assert.equal(isLateCancellation(DEFAULT_BOOKING_POLICY, startsAt, withinWindow), false);
assert.equal(isLateCancellation(DEFAULT_BOOKING_POLICY, startsAt, lateCancel), true);
assert.equal(calculateLateCancelFeeCents(DEFAULT_BOOKING_POLICY, 10_000), 5_000);

const earlyCancel = evaluateCancellationFee({
  policy: DEFAULT_BOOKING_POLICY,
  startsAt,
  depositRequiredCents: 5_000,
  depositChargedCents: 5_000,
  subtotalCents: 10_000,
  now: withinWindow,
});
assert.equal(earlyCancel.isLate, false);
assert.equal(earlyCancel.feeCents, 0);
assert.equal(earlyCancel.feeDueCents, 0);

const lateWithDeposit = evaluateCancellationFee({
  policy: DEFAULT_BOOKING_POLICY,
  startsAt,
  depositRequiredCents: 5_000,
  depositChargedCents: 5_000,
  subtotalCents: 10_000,
  now: lateCancel,
});
assert.equal(lateWithDeposit.isLate, true);
assert.equal(lateWithDeposit.feeCents, 2_500);
assert.equal(lateWithDeposit.feeDueCents, 0);

const lateCardOnFile = evaluateCancellationFee({
  policy: DEFAULT_BOOKING_POLICY,
  startsAt,
  depositRequiredCents: 0,
  depositChargedCents: 0,
  subtotalCents: 10_000,
  now: lateCancel,
});
assert.equal(lateCardOnFile.feeCents, 5_000);
assert.equal(lateCardOnFile.feeDueCents, 5_000);

console.log("booking-policy tests passed");
