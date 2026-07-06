import type Stripe from "stripe";

export async function captureCheckoutPayment(params: {
  stripe: Stripe;
  customerId: string;
  amountCents: number;
  orderId: string;
  appointmentId: string;
}): Promise<{ paymentIntentId: string; chargedCents: number }> {
  if (params.amountCents <= 0) {
    return { paymentIntentId: "", chargedCents: 0 };
  }

  const customer = await params.stripe.customers.retrieve(params.customerId);
  if (customer.deleted) {
    throw new Error("Client payment profile is unavailable");
  }

  const defaultPaymentMethod =
    typeof customer.invoice_settings?.default_payment_method === "string"
      ? customer.invoice_settings.default_payment_method
      : customer.invoice_settings?.default_payment_method?.id;

  if (!defaultPaymentMethod) {
    throw new Error("No card on file for this client. Collect payment at checkout.");
  }

  const paymentIntent = await params.stripe.paymentIntents.create(
    {
      amount: params.amountCents,
      currency: "usd",
      customer: params.customerId,
      payment_method: defaultPaymentMethod,
      confirm: true,
      off_session: true,
      capture_method: "automatic",
      metadata: {
        source: "salon-citrine-checkout",
        order_id: params.orderId,
        appointment_id: params.appointmentId,
      },
    },
    { idempotencyKey: `checkout-order-${params.orderId}` },
  );

  if (paymentIntent.status !== "succeeded") {
    throw new Error("Checkout payment did not succeed");
  }

  return {
    paymentIntentId: paymentIntent.id,
    chargedCents: paymentIntent.amount_received ?? params.amountCents,
  };
}
