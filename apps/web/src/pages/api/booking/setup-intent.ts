export const prerender = false;

import type { APIRoute } from "astro";
import { createSetupIntentInputSchema } from "@saloncitrine/shared";
import { jsonError, jsonOk } from "../../../lib/api-booking";
import { getStripeClient } from "../../../lib/stripe-server";
import { createSupabaseServiceClient } from "../../../lib/supabase-server";

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = createSetupIntentInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message ?? "Invalid request", 400);
  }

  const { email, firstName, lastName } = parsed.data;

  try {
    const stripe = getStripeClient();
    let customerId: string | undefined;

    if (email) {
      const supabase = createSupabaseServiceClient();
      const normalizedEmail = email.trim().toLowerCase();

      const { data: existingClient } = await supabase
        .from("clients")
        .select("stripe_customer_id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (existingClient?.stripe_customer_id) {
        customerId = existingClient.stripe_customer_id;
      } else {
        const existingCustomers = await stripe.customers.list({
          email: normalizedEmail,
          limit: 1,
        });
        if (existingCustomers.data[0]) {
          customerId = existingCustomers.data[0].id;
        } else {
          const customer = await stripe.customers.create({
            email: normalizedEmail,
            name:
              firstName && lastName
                ? `${firstName.trim()} ${lastName.trim()}`
                : undefined,
          });
          customerId = customer.id;
        }
      }
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: {
        source: "salon-citrine-booking",
      },
    });

    if (!setupIntent.client_secret) {
      return jsonError("Failed to initialize card collection", 500);
    }

    return jsonOk({
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
    });
  } catch (error) {
    console.error("booking/setup-intent", error);
    return jsonError("Failed to initialize card collection", 500);
  }
};
