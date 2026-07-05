import type Stripe from "stripe";

export async function chargeCancelFee(params: {
  stripe: Stripe;
  customerId: string;
  amountCents: number;
  appointmentId: string;
}): Promise<{ paymentIntentId: string; chargedCents: number }> {
  const customer = await params.stripe.customers.retrieve(params.customerId);
  if (customer.deleted) {
    throw new Error("Client payment profile is unavailable");
  }

  const defaultPaymentMethod =
    typeof customer.invoice_settings?.default_payment_method === "string"
      ? customer.invoice_settings.default_payment_method
      : customer.invoice_settings?.default_payment_method?.id;

  if (!defaultPaymentMethod) {
    throw new Error("No card on file to charge the cancellation fee");
  }

  const paymentIntent = await params.stripe.paymentIntents.create({
    amount: params.amountCents,
    currency: "usd",
    customer: params.customerId,
    payment_method: defaultPaymentMethod,
    confirm: true,
    off_session: true,
    capture_method: "automatic",
    metadata: {
      source: "salon-citrine-cancel-fee",
      appointment_id: params.appointmentId,
    },
  });

  if (paymentIntent.status !== "succeeded") {
    throw new Error("Cancellation fee payment did not succeed");
  }

  return {
    paymentIntentId: paymentIntent.id,
    chargedCents: paymentIntent.amount_received ?? params.amountCents,
  };
}
