import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;

  const secretKey = import.meta.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "Missing STRIPE_SECRET_KEY. Add it to the repo root .env (see .env.example).",
    );
  }

  stripeClient = new Stripe(secretKey);

  return stripeClient;
}
