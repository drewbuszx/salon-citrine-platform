import type { APIRoute } from "astro";
import { z } from "zod";
import { calculateCheckoutTotals, type CheckoutLineItem } from "@saloncitrine/shared";
import { jsonError, jsonOk, requireApiAuth, canManageStaffColumn } from "../../../lib/api-calendar";
import {
  completeCheckoutOrder,
  getOrCreateCheckoutOrder,
  loadAppointmentForCheckout,
  loadCheckoutOrder,
  loadRetailProducts,
  syncCheckoutOrderLines,
} from "../../../lib/checkout";
import { getStripeClient } from "../../../lib/stripe-server";
import { captureCheckoutPayment } from "../../../lib/stripe-checkout";

const lineItemSchema = z.object({
  kind: z.enum(["service", "product", "tip", "discount"]),
  serviceId: z.string().uuid().optional().nullable(),
  productId: z.string().uuid().optional().nullable(),
  name: z.string().min(1),
  quantity: z.number().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
});

const patchSchema = z.object({
  lineItems: z.array(lineItemSchema).min(1),
  tipCents: z.number().int().nonnegative().default(0),
});

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const appointmentId = context.params.appointmentId;
  if (!appointmentId) return jsonError("Missing appointment id", 400);

  try {
    const appointment = await loadAppointmentForCheckout(auth.supabase, appointmentId);
    if (!appointment) return jsonError("Appointment not found", 404);

    if (!canManageStaffColumn(auth.staff, appointment.staff_id)) {
      return jsonError("Not allowed to checkout this appointment", 403);
    }

    if (appointment.status === "cancelled") {
      return jsonError("Cannot checkout a cancelled appointment", 400);
    }

    const order = await getOrCreateCheckoutOrder(auth.supabase, appointment);
    const products = await loadRetailProducts(auth.supabase);

    const client = appointment.clients;
    return jsonOk({
      appointment: {
        id: appointment.id,
        status: appointment.status,
        startsAt: appointment.starts_at,
        endsAt: appointment.ends_at,
        staffName: appointment.staff?.name ?? "",
      },
      client: client
        ? {
            id: client.id,
            firstName: client.first_name,
            lastName: client.last_name,
            email: client.email,
            phone: client.phone,
            hasCardOnFile: Boolean(client.stripe_customer_id),
          }
        : null,
      order,
      products,
    });
  } catch (error) {
    console.error("checkout GET", error);
    return jsonError("Failed to load checkout", 500);
  }
};

export const PATCH: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const appointmentId = context.params.appointmentId;
  if (!appointmentId) return jsonError("Missing appointment id", 400);

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message ?? "Invalid request", 400);
  }

  try {
    const appointment = await loadAppointmentForCheckout(auth.supabase, appointmentId);
    if (!appointment) return jsonError("Appointment not found", 404);
    if (!canManageStaffColumn(auth.staff, appointment.staff_id)) {
      return jsonError("Not allowed", 403);
    }

    const order = await getOrCreateCheckoutOrder(auth.supabase, appointment);
    const updated = await syncCheckoutOrderLines(
      auth.supabase,
      order.id,
      parsed.data.lineItems as CheckoutLineItem[],
      parsed.data.tipCents,
    );

    return jsonOk({ order: updated });
  } catch (error) {
    console.error("checkout PATCH", error);
    return jsonError("Failed to update checkout", 500);
  }
};

export const POST: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const appointmentId = context.params.appointmentId;
  if (!appointmentId) return jsonError("Missing appointment id", 400);

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message ?? "Invalid request", 400);
  }

  try {
    const appointment = await loadAppointmentForCheckout(auth.supabase, appointmentId);
    if (!appointment) return jsonError("Appointment not found", 404);
    if (!canManageStaffColumn(auth.staff, appointment.staff_id)) {
      return jsonError("Not allowed", 403);
    }

    const order = await getOrCreateCheckoutOrder(auth.supabase, appointment);
    const synced = await syncCheckoutOrderLines(
      auth.supabase,
      order.id,
      parsed.data.lineItems as CheckoutLineItem[],
      parsed.data.tipCents,
    );

    const fresh = await loadCheckoutOrder(auth.supabase, synced.id);
    if (fresh?.status === "completed") {
      return jsonOk({ order: fresh, alreadyCompleted: true });
    }

    if (fresh?.status !== "open") {
      return jsonError("Checkout order is not open", 409);
    }

    const totals = calculateCheckoutTotals({
      lineItems: synced.lineItems,
      tipCents: synced.tipCents,
      taxCents: synced.taxCents,
      depositAppliedCents: synced.depositAppliedCents,
    });

    let paymentIntentId: string | null = null;
    let amountPaid = synced.depositAppliedCents;

    if (totals.amountDueCents > 0) {
      const client = appointment.clients;
      if (!client?.stripe_customer_id) {
        return jsonError(
          "Client has no card on file. Add a payment method before completing checkout.",
          402,
        );
      }

      const stripe = getStripeClient();
      const payment = await captureCheckoutPayment({
        stripe,
        customerId: client.stripe_customer_id,
        amountCents: totals.amountDueCents,
        orderId: synced.id,
        appointmentId,
      });
      paymentIntentId = payment.paymentIntentId || null;
      amountPaid += payment.chargedCents;
    }

    await completeCheckoutOrder(auth.supabase, {
      orderId: synced.id,
      appointmentId,
      amountPaidCents: amountPaid,
      stripePaymentIntentId: paymentIntentId,
      staffId: auth.staff.id,
      productLineItems: synced.lineItems.filter((item) => item.kind === "product"),
    });

    const completed = await loadCheckoutOrder(auth.supabase, synced.id);
    if (!completed) {
      return jsonError("Checkout completed but could not reload order", 500);
    }
    return jsonOk({ order: completed });
  } catch (error) {
    console.error("checkout POST", error);
    const message =
      error instanceof Error ? error.message : "Checkout failed";
    return jsonError(message, 500);
  }
};
