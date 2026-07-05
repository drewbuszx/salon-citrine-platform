import assert from "node:assert/strict";
import {
  DEFAULT_BOOKING_POLICY,
  calculateRequiredDepositCents,
  formatBookingPolicySummary,
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

console.log("booking-policy tests passed");
