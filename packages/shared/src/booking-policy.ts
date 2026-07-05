export type BookingPolicyDepositType = "none" | "card_on_file" | "fixed" | "percent";

export type BookingPolicy = {
  slug: string;
  title: string;
  cancellationWindowHours: number;
  lateCancelFeePercent: number;
  noShowFeePercent: number;
  lateGraceMinutes: number;
  sameWeekRescheduleWaivesFee: boolean;
  requiresCardOnFile: boolean;
  depositType: BookingPolicyDepositType;
  depositValue: number | null;
};

export const DEFAULT_BOOKING_POLICY: BookingPolicy = {
  slug: "default-phase1",
  title: "Salon Citrine Booking Policy",
  cancellationWindowHours: 48,
  lateCancelFeePercent: 50,
  noShowFeePercent: 100,
  lateGraceMinutes: 15,
  sameWeekRescheduleWaivesFee: true,
  requiresCardOnFile: true,
  depositType: "card_on_file",
  depositValue: null,
};

export function formatBookingPolicySummary(policy: BookingPolicy): string {
  const base = `Cancel or reschedule at least ${policy.cancellationWindowHours} hours ahead to avoid a ${policy.lateCancelFeePercent}% late-cancel fee. No-shows are charged ${policy.noShowFeePercent}%.`;
  const grace = ` Arrivals ${policy.lateGraceMinutes}+ minutes late without contact may be treated as no-shows.`;
  const sameWeek = policy.sameWeekRescheduleWaivesFee
    ? " Fees are waived when rebooked within the same week."
    : "";

  const deposit =
    policy.depositType === "fixed" && typeof policy.depositValue === "number"
      ? ` A $${(policy.depositValue / 100).toFixed(policy.depositValue % 100 === 0 ? 0 : 2)} deposit is required.`
      : policy.depositType === "percent" && typeof policy.depositValue === "number"
        ? ` A ${policy.depositValue}% deposit is required.`
        : policy.depositType === "card_on_file" || policy.requiresCardOnFile
          ? " A card on file is required to secure your booking."
          : "";

  return `${base}${grace}${sameWeek}${deposit}`;
}

export function calculateRequiredDepositCents(
  policy: BookingPolicy,
  subtotalCents: number,
): number {
  if (policy.depositType === "fixed" && typeof policy.depositValue === "number") {
    return Math.max(0, Math.min(subtotalCents, policy.depositValue));
  }
  if (policy.depositType === "percent" && typeof policy.depositValue === "number") {
    const percent = Math.max(0, Math.min(100, policy.depositValue));
    return Math.round((subtotalCents * percent) / 100);
  }
  return 0;
}
