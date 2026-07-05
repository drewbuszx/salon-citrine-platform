import {
  evaluateCancellationFee,
  formatLateCancelMessage,
  policyFromSnapshot,
} from "@saloncitrine/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chargeCancelFee } from "./stripe-deposits";
import { getStripeClient } from "./stripe-server";

type AppointmentCancelRow = {
  id: string;
  status: string;
  starts_at: string;
  policy_snapshot: Record<string, unknown> | null;
  deposit_required_cents: number;
  deposit_charged_cents: number;
  client_id: string;
  clients:
    | { stripe_customer_id: string | null }
    | Array<{ stripe_customer_id: string | null }>
    | null;
  appointment_services:
    | Array<{ price_cents: number | null }>
    | null;
};

export type CancelAppointmentResult =
  | { ok: true; cancelFeeCents: number; feeChargedCents: number }
  | { ok: false; message: string; status: number };

function readClientStripeId(
  clients: AppointmentCancelRow["clients"],
): string | null {
  const row = Array.isArray(clients) ? clients[0] : clients;
  return row?.stripe_customer_id ?? null;
}

function sumSubtotalCents(row: AppointmentCancelRow): number {
  return (row.appointment_services ?? []).reduce(
    (total, service) => total + Math.max(0, service.price_cents ?? 0),
    0,
  );
}

export async function cancelAppointmentWithPolicy(
  supabase: SupabaseClient,
  appointmentId: string,
): Promise<CancelAppointmentResult> {
  const { data, error } = await supabase
    .from("appointments")
    .select(
      `
      id,
      status,
      starts_at,
      policy_snapshot,
      deposit_required_cents,
      deposit_charged_cents,
      client_id,
      clients(stripe_customer_id),
      appointment_services(price_cents)
    `,
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, message: "Appointment not found", status: 404 };
  }

  const appointment = data as AppointmentCancelRow;
  if (appointment.status === "cancelled") {
    return { ok: true, cancelFeeCents: 0, feeChargedCents: 0 };
  }

  const policy = policyFromSnapshot(appointment.policy_snapshot);
  const evaluation = evaluateCancellationFee({
    policy,
    startsAt: new Date(appointment.starts_at),
    depositRequiredCents: appointment.deposit_required_cents ?? 0,
    depositChargedCents: appointment.deposit_charged_cents ?? 0,
    subtotalCents: sumSubtotalCents(appointment),
  });

  let cancelFeeStripePaymentIntentId: string | null = null;
  let feeChargedCents = 0;

  if (evaluation.feeDueCents > 0) {
    const stripeCustomerId = readClientStripeId(appointment.clients);
    if (!stripeCustomerId) {
      return {
        ok: false,
        message:
          "Cannot cancel with fee: client has no card on file. Contact the salon.",
        status: 402,
      };
    }

    try {
      const stripe = getStripeClient();
      const charge = await chargeCancelFee({
        stripe,
        customerId: stripeCustomerId,
        amountCents: evaluation.feeDueCents,
        appointmentId,
      });
      cancelFeeStripePaymentIntentId = charge.paymentIntentId;
      feeChargedCents = charge.chargedCents;
    } catch (chargeError) {
      console.error("cancel fee charge failed", chargeError);
      const message =
        chargeError instanceof Error
          ? chargeError.message
          : "Could not charge cancellation fee";
      return {
        ok: false,
        message: evaluation.isLate
          ? `${formatLateCancelMessage(policy)} ${message}`
          : message,
        status: 402,
      };
    }
  }

  const { error: updateError } = await supabase
    .from("appointments")
    .update({
      status: "cancelled",
      cancel_fee_cents: evaluation.feeCents,
      cancel_fee_stripe_payment_intent_id: cancelFeeStripePaymentIntentId,
    })
    .eq("id", appointmentId);

  if (updateError) {
    console.error("appointment cancel update failed", updateError);
    return {
      ok: false,
      message: "Could not cancel appointment",
      status: 500,
    };
  }

  return {
    ok: true,
    cancelFeeCents: evaluation.feeCents,
    feeChargedCents,
  };
}
