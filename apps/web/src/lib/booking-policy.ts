import {
  DEFAULT_BOOKING_POLICY,
  formatBookingPolicySummary,
  type BookingPolicy,
  type BookingPolicyDepositType,
} from "@saloncitrine/shared";
import { createSupabaseClient } from "./supabase";

type BookingPolicyRow = {
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
};

function mapPolicyRow(row: BookingPolicyRow): BookingPolicy {
  return {
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
  };
}

export async function fetchActiveBookingPolicy(): Promise<BookingPolicy> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("booking_policy_settings")
    .select("*")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("fetchActiveBookingPolicy", error);
    }
    return DEFAULT_BOOKING_POLICY;
  }

  return mapPolicyRow(data as BookingPolicyRow);
}

export function bookingPolicySummary(policy: BookingPolicy): string {
  return formatBookingPolicySummary(policy);
}
