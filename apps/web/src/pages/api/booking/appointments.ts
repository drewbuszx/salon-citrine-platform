export const prerender = false;

import type { APIRoute } from "astro";
import {
  APPOINTMENT_CONFLICT_MESSAGE,
  calculateRequiredDepositCents,
  createAppointmentInputSchema,
  formatBookingPolicySummary,
  isOverlapConflictError,
  type CreateAppointmentInput,
} from "@saloncitrine/shared";
import { isBookingSlotAvailableByStartsAt } from "../../../lib/availability";
import { getStaffBySlug } from "../../../lib/booking-data";
import {
  completeBookingCart,
  getDefaultLocationId,
  validateReservedCart,
} from "../../../lib/booking-cart";
import { jsonError, jsonOk } from "../../../lib/api-booking";
import { getStripeClient } from "../../../lib/stripe-server";
import { createSupabaseServiceClient } from "../../../lib/supabase-server";
import { formatDateInTimezone } from "../../../lib/datetime-utils";
import { fetchActiveBookingPolicy } from "../../../lib/booking-policy";
import { sendBookingConfirmations } from "../../../lib/notifications/booking-confirmation";
import { captureBookingDeposit } from "../../../lib/stripe-deposits";

function stripeErrorMessage(error: unknown): string | undefined {
  if (
    error instanceof Error &&
    "type" in error &&
    typeof (error as { type?: string }).type === "string"
  ) {
    const stripeError = error as Error & { type?: string; code?: string };
    return stripeError.message || stripeError.code;
  }
  return undefined;
}

function buildClientIntakeFields(
  client: CreateAppointmentInput["client"],
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  if (client.birthday) fields.birthday = client.birthday;
  if (client.addressLine1?.trim()) fields.address_line1 = client.addressLine1.trim();
  if (client.addressLine2?.trim()) fields.address_line2 = client.addressLine2.trim();
  if (client.addressCity?.trim()) fields.address_city = client.addressCity.trim();
  if (client.addressState?.trim()) {
    fields.address_state = client.addressState.trim().toUpperCase();
  }
  if (client.addressZip?.trim()) fields.address_zip = client.addressZip.trim();
  if (client.preferredContactMethod) {
    fields.preferred_contact_method = client.preferredContactMethod;
  }
  if (client.referralSources?.length) {
    fields.referral_sources = client.referralSources;
  }

  return fields;
}

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = createAppointmentInputSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.errors[0]?.message ?? "Invalid request";
    console.error("booking/appointments: validation failed", parsed.error.flatten());
    return jsonError(message, 400);
  }

  const input = parsed.data;

  let supabase;
  try {
    supabase = createSupabaseServiceClient();
  } catch (error) {
    console.error("booking/appointments: supabase config", error);
    return jsonError("Booking is temporarily unavailable", 503);
  }

  try {
    const staff = await getStaffBySlug(input.staffSlug);
    if (!staff) {
      console.error("booking/appointments: stylist not found", input.staffSlug);
      return jsonError("Stylist not found", 400);
    }

    const startsAt = new Date(input.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      console.error("booking/appointments: invalid startsAt", input.startsAt);
      return jsonError("Invalid appointment time", 400);
    }

    const dateStr = formatDateInTimezone(startsAt);
    const slotAvailable = await isBookingSlotAvailableByStartsAt(
      staff.id,
      input.serviceIds,
      dateStr,
      input.startsAt,
    );
    if (!slotAvailable) {
      console.error(
        "booking/appointments: slot unavailable",
        input.staffSlug,
        dateStr,
        input.startsAt,
      );
      return jsonError("That time is no longer available", 409);
    }

    if (input.cartId) {
      const cartValid = await validateReservedCart({
        cartId: input.cartId,
        staffId: staff.id,
        startsAt: input.startsAt,
      });
      if (!cartValid) {
        return jsonError(
          "Your time hold has expired. Please choose a new time.",
          409,
        );
      }
    }

    let locationId: string | null = null;
    try {
      locationId = await getDefaultLocationId();
    } catch (locationError) {
      console.error("booking/appointments: location lookup", locationError);
    }

    const stripe = getStripeClient();
    const setupIntent = await stripe.setupIntents.retrieve(input.setupIntentId);

    if (setupIntent.status !== "succeeded") {
      console.error(
        "booking/appointments: setup intent not succeeded",
        input.setupIntentId,
        setupIntent.status,
      );
      return jsonError("Card verification incomplete", 400);
    }

    const paymentMethodId =
      typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method?.id;

    let stripeCustomerId =
      typeof setupIntent.customer === "string"
        ? setupIntent.customer
        : setupIntent.customer?.id ?? null;

    if (!paymentMethodId) {
      console.error(
        "booking/appointments: setup intent missing payment_method",
        input.setupIntentId,
      );
      return jsonError("Missing payment method", 400);
    }

    const phone = input.client.phone.trim();
    const email = input.client.email.trim().toLowerCase();

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email,
        name: `${input.client.firstName.trim()} ${input.client.lastName.trim()}`,
        phone: phone || undefined,
      });
      stripeCustomerId = customer.id;
    }

    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomerId,
    }).catch((error: unknown) => {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code?: string }).code === "resource_already_exists"
      ) {
        return;
      }
      throw error;
    });
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    const { data: staffServices, error: staffServicesError } = await supabase
      .from("staff_services")
      .select(
        "service_id, client_booking_block, services(id, name, duration_minutes, base_price_cents)",
      )
      .eq("staff_id", staff.id)
      .in("service_id", input.serviceIds);

    if (staffServicesError) {
      console.error("staff_services lookup failed", staffServicesError);
      return jsonError("Failed to load services", 500);
    }

    const matched = staffServices ?? [];
    if (matched.length !== input.serviceIds.length) {
      console.error(
        "booking/appointments: services not offered by stylist",
        input.staffSlug,
        input.serviceIds,
      );
      return jsonError("One or more services are not offered by this provider", 400);
    }

    let totalMinutes = 0;
    let subtotalCents = 0;
    const serviceRows: Array<{ service_id: string; price_cents: number | null }> = [];
    const serviceNames: string[] = [];

    for (const serviceId of input.serviceIds) {
      const row = matched.find((item) => item.service_id === serviceId);
      if (!row || (row.client_booking_block ?? "none") !== "none") {
        console.error("booking/appointments: blocked or missing service", serviceId);
        return jsonError("Invalid service selection", 400);
      }

      const raw = row.services as
        | {
            id: string;
            name: string;
            duration_minutes: number;
            base_price_cents: number | null;
          }
        | Array<{
            id: string;
            name: string;
            duration_minutes: number;
            base_price_cents: number | null;
          }>
        | null;
      const svc = Array.isArray(raw) ? raw[0] : raw;
      if (!svc) {
        return jsonError("Invalid service selection", 400);
      }

      totalMinutes += svc.duration_minutes;
      subtotalCents += svc.base_price_cents ?? 0;
      serviceNames.push(svc.name);
      serviceRows.push({
        service_id: serviceId,
        price_cents: svc.base_price_cents,
      });
    }

    const endsAt = new Date(startsAt.getTime() + totalMinutes * 60_000);
    const activePolicy = await fetchActiveBookingPolicy();
    const policySummary = formatBookingPolicySummary(activePolicy);
    const depositRequiredCents = calculateRequiredDepositCents(
      activePolicy,
      subtotalCents,
    );

    let clientId: string | null = null;

    if (phone) {
      const { data } = await supabase
        .from("clients")
        .select("id, stripe_customer_id")
        .eq("phone", phone)
        .maybeSingle();
      if (data) clientId = data.id;
    }

    if (!clientId && email) {
      const { data } = await supabase
        .from("clients")
        .select("id, stripe_customer_id")
        .eq("email", email)
        .maybeSingle();
      if (data) clientId = data.id;
    }

    if (clientId) {
      const { error: clientUpdateError } = await supabase
        .from("clients")
        .update({
          first_name: input.client.firstName.trim(),
          last_name: input.client.lastName.trim(),
          phone,
          email,
          sms_opt_in: input.client.smsOptIn,
          intake_notes: input.client.intakeNotes?.trim() || null,
          booking_preferences: input.client.bookingPreferences?.trim() || null,
          stripe_customer_id: stripeCustomerId,
          ...buildClientIntakeFields(input.client),
        })
        .eq("id", clientId);

      if (clientUpdateError) {
        console.error("client update failed", clientUpdateError);
        return jsonError("Failed to update client", 500);
      }
    } else {
      const { data: createdClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          first_name: input.client.firstName.trim(),
          last_name: input.client.lastName.trim(),
          phone,
          email,
          sms_opt_in: input.client.smsOptIn,
          intake_notes: input.client.intakeNotes?.trim() || null,
          booking_preferences: input.client.bookingPreferences?.trim() || null,
          stripe_customer_id: stripeCustomerId,
          ...buildClientIntakeFields(input.client),
        })
        .select("id")
        .single();

      if (clientError || !createdClient) {
        console.error("client insert failed", clientError);
        return jsonError("Failed to create client", 500);
      }
      clientId = createdClient.id;
    }

    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .insert({
        client_id: clientId,
        staff_id: staff.id,
        location_id: locationId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "booked",
        notes: input.client.intakeNotes?.trim() || null,
        client_message: input.clientMessage?.trim() || null,
        referral_source:
          input.referralSource?.trim() ||
          input.client.referralSources?.join(", ") ||
          null,
        policy_acknowledged_at: new Date().toISOString(),
        policy_snapshot: activePolicy,
        deposit_required_cents: depositRequiredCents,
      })
      .select("id")
      .single();

    if (appointmentError || !appointment) {
      console.error("appointment insert failed", appointmentError);
      if (isOverlapConflictError(appointmentError)) {
        return jsonError(APPOINTMENT_CONFLICT_MESSAGE, 409);
      }
      return jsonError("Failed to create appointment", 500);
    }

    const { error: servicesError } = await supabase.from("appointment_services").insert(
      serviceRows.map((row) => ({
        appointment_id: appointment.id,
        service_id: row.service_id,
        price_cents: row.price_cents,
      })),
    );

    if (servicesError) {
      console.error("appointment_services insert failed", servicesError);
      await supabase.from("appointments").delete().eq("id", appointment.id);
      return jsonError("Failed to attach services", 500);
    }

    let depositChargedCents = 0;
    let depositPaymentIntentId: string | null = null;

    if (depositRequiredCents > 0) {
      try {
        const deposit = await captureBookingDeposit({
          stripe,
          customerId: stripeCustomerId,
          paymentMethodId,
          amountCents: depositRequiredCents,
          appointmentId: appointment.id,
        });
        depositChargedCents = deposit.chargedCents;
        depositPaymentIntentId = deposit.paymentIntentId;

        const { error: depositUpdateError } = await supabase
          .from("appointments")
          .update({
            stripe_payment_intent_id: depositPaymentIntentId,
            deposit_charged_cents: depositChargedCents,
          })
          .eq("id", appointment.id);

        if (depositUpdateError) {
          console.error("deposit update failed", depositUpdateError);
          await supabase.from("appointments").delete().eq("id", appointment.id);
          return jsonError("Failed to record deposit payment", 500);
        }
      } catch (depositError) {
        console.error("booking/appointments: deposit capture failed", depositError);
        await supabase.from("appointments").delete().eq("id", appointment.id);
        const message =
          depositError instanceof Error
            ? depositError.message
            : "Deposit payment failed";
        return jsonError(message, 402);
      }
    }

    if (input.cartId) {
      try {
        await completeBookingCart(input.cartId);
      } catch (cartError) {
        console.error("booking/appointments: cart completion failed", cartError);
      }
    }

    const depositNote =
      depositChargedCents > 0
        ? ` A $${(depositChargedCents / 100).toFixed(depositChargedCents % 100 === 0 ? 0 : 2)} deposit has been charged to your card.`
        : "";

    try {
      await sendBookingConfirmations({
        clientFirstName: input.client.firstName.trim(),
        clientLastName: input.client.lastName.trim(),
        clientEmail: email,
        clientPhone: phone,
        stylistName: staff.name,
        startsAt: startsAt.toISOString(),
        services: serviceNames.map((name) => ({ name })),
        smsOptIn: input.client.smsOptIn,
        appointmentId: appointment.id,
        policySummary: `${policySummary}${depositNote}`,
        depositChargedCents,
      });
    } catch (error) {
      console.error("booking/appointments: confirmation notifications failed", error);
    }

    return jsonOk({ id: appointment.id });
  } catch (error) {
    console.error("booking/appointments", error);
    const stripeMessage = stripeErrorMessage(error);
    if (stripeMessage) {
      return jsonError(stripeMessage, 502);
    }
    return jsonError("Failed to create appointment", 500);
  }
};
