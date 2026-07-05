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

export function hoursUntilAppointment(startsAt: Date, now = new Date()): number {
  return (startsAt.getTime() - now.getTime()) / 3_600_000;
}

export function isLateCancellation(
  policy: BookingPolicy,
  startsAt: Date,
  now = new Date(),
): boolean {
  return hoursUntilAppointment(startsAt, now) < policy.cancellationWindowHours;
}

export function calculateLateCancelFeeCents(
  policy: BookingPolicy,
  basisCents: number,
): number {
  if (basisCents <= 0) return 0;
  const percent = Math.max(0, Math.min(100, policy.lateCancelFeePercent));
  return Math.round((basisCents * percent) / 100);
}

export type CancelFeeEvaluation = {
  isLate: boolean;
  feeCents: number;
  feeDueCents: number;
  basisCents: number;
};

export function evaluateCancellationFee(input: {
  policy: BookingPolicy;
  startsAt: Date;
  depositRequiredCents: number;
  depositChargedCents: number;
  subtotalCents: number;
  now?: Date;
}): CancelFeeEvaluation {
  const isLate = isLateCancellation(input.policy, input.startsAt, input.now);
  const basisCents =
    input.depositRequiredCents > 0
      ? input.depositRequiredCents
      : Math.max(0, input.subtotalCents);
  const feeCents = isLate
    ? calculateLateCancelFeeCents(input.policy, basisCents)
    : 0;
  const coveredByDeposit = Math.min(feeCents, Math.max(0, input.depositChargedCents));
  const feeDueCents = Math.max(0, feeCents - coveredByDeposit);

  return {
    isLate,
    feeCents,
    feeDueCents,
    basisCents,
  };
}

export function formatLateCancelMessage(policy: BookingPolicy): string {
  return `Cancellations within ${policy.cancellationWindowHours} hours of the appointment incur a ${policy.lateCancelFeePercent}% fee per salon policy.`;
}

export function policyFromSnapshot(
  snapshot: Record<string, unknown> | null | undefined,
): BookingPolicy {
  if (!snapshot || typeof snapshot !== "object") {
    return DEFAULT_BOOKING_POLICY;
  }

  return {
    slug:
      typeof snapshot.slug === "string"
        ? snapshot.slug
        : DEFAULT_BOOKING_POLICY.slug,
    title:
      typeof snapshot.title === "string"
        ? snapshot.title
        : DEFAULT_BOOKING_POLICY.title,
    cancellationWindowHours:
      typeof snapshot.cancellationWindowHours === "number"
        ? snapshot.cancellationWindowHours
        : DEFAULT_BOOKING_POLICY.cancellationWindowHours,
    lateCancelFeePercent:
      typeof snapshot.lateCancelFeePercent === "number"
        ? snapshot.lateCancelFeePercent
        : DEFAULT_BOOKING_POLICY.lateCancelFeePercent,
    noShowFeePercent:
      typeof snapshot.noShowFeePercent === "number"
        ? snapshot.noShowFeePercent
        : DEFAULT_BOOKING_POLICY.noShowFeePercent,
    lateGraceMinutes:
      typeof snapshot.lateGraceMinutes === "number"
        ? snapshot.lateGraceMinutes
        : DEFAULT_BOOKING_POLICY.lateGraceMinutes,
    sameWeekRescheduleWaivesFee:
      typeof snapshot.sameWeekRescheduleWaivesFee === "boolean"
        ? snapshot.sameWeekRescheduleWaivesFee
        : DEFAULT_BOOKING_POLICY.sameWeekRescheduleWaivesFee,
    requiresCardOnFile:
      typeof snapshot.requiresCardOnFile === "boolean"
        ? snapshot.requiresCardOnFile
        : DEFAULT_BOOKING_POLICY.requiresCardOnFile,
    depositType:
      snapshot.depositType === "none" ||
      snapshot.depositType === "card_on_file" ||
      snapshot.depositType === "fixed" ||
      snapshot.depositType === "percent"
        ? snapshot.depositType
        : DEFAULT_BOOKING_POLICY.depositType,
    depositValue:
      typeof snapshot.depositValue === "number" ? snapshot.depositValue : null,
  };
}
