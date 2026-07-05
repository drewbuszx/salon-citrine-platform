import {
  DEFAULT_BOOKING_POLICY,
  type BookingPolicy,
  type BookingPolicyDepositType,
} from "@saloncitrine/shared";

export type BookingPolicyRow = {
  id: string;
  slug: string;
  title: string;
  cancellation_window_hours: number;
  late_cancel_fee_percent: number;
  no_show_fee_percent: number;
  late_grace_minutes: number;
  same_week_reschedule_waives_fee: boolean;
  requires_card_on_file: boolean;
  deposit_type: BookingPolicyDepositType;
  deposit_value: number | null;
  is_active: boolean;
  updated_at: string;
};

export type BookingPolicySettings = BookingPolicy & {
  id: string;
  isActive: boolean;
  updatedAt: string;
};

export function mapPolicyRow(row: BookingPolicyRow): BookingPolicySettings {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    cancellationWindowHours: row.cancellation_window_hours,
    lateCancelFeePercent: row.late_cancel_fee_percent,
    noShowFeePercent: row.no_show_fee_percent,
    lateGraceMinutes: row.late_grace_minutes,
    sameWeekRescheduleWaivesFee: row.same_week_reschedule_waives_fee,
    requiresCardOnFile: row.requires_card_on_file,
    depositType: row.deposit_type,
    depositValue: row.deposit_value,
    isActive: row.is_active,
    updatedAt: row.updated_at,
  };
}

export function mapPolicyUpdates(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  if (typeof input.title === "string") updates.title = input.title.trim();
  if (typeof input.cancellationWindowHours === "number") {
    updates.cancellation_window_hours = input.cancellationWindowHours;
  }
  if (typeof input.lateCancelFeePercent === "number") {
    updates.late_cancel_fee_percent = input.lateCancelFeePercent;
  }
  if (typeof input.noShowFeePercent === "number") {
    updates.no_show_fee_percent = input.noShowFeePercent;
  }
  if (typeof input.lateGraceMinutes === "number") {
    updates.late_grace_minutes = input.lateGraceMinutes;
  }
  if (typeof input.sameWeekRescheduleWaivesFee === "boolean") {
    updates.same_week_reschedule_waives_fee = input.sameWeekRescheduleWaivesFee;
  }
  if (typeof input.requiresCardOnFile === "boolean") {
    updates.requires_card_on_file = input.requiresCardOnFile;
  }
  if (
    input.depositType === "none" ||
    input.depositType === "card_on_file" ||
    input.depositType === "fixed" ||
    input.depositType === "percent"
  ) {
    updates.deposit_type = input.depositType;
  }
  if (input.depositValue === null) {
    updates.deposit_value = null;
  } else if (typeof input.depositValue === "number") {
    updates.deposit_value = input.depositValue;
  }
  if (typeof input.isActive === "boolean") updates.is_active = input.isActive;

  if (updates.deposit_type === "none" || updates.deposit_type === "card_on_file") {
    updates.deposit_value = null;
  }

  return updates;
}

export const POLICY_SELECT =
  "id, slug, title, cancellation_window_hours, late_cancel_fee_percent, no_show_fee_percent, late_grace_minutes, same_week_reschedule_waives_fee, requires_card_on_file, deposit_type, deposit_value, is_active, updated_at";

export function defaultPolicyResponse(): Omit<BookingPolicySettings, "id"> & {
  id: null;
  updatedAt: null;
} {
  return {
    ...DEFAULT_BOOKING_POLICY,
    id: null,
    isActive: true,
    updatedAt: null,
  };
}
