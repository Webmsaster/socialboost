import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error(
        "STRIPE_SECRET_KEY is not configured. Set it in your .env.local file."
      );
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-02-25.clover",
    });
  }
  return _stripe;
}

export async function createCheckoutSession(
  userId: string,
  email: string,
  plan: "monthly" | "annual" = "monthly"
) {
  const stripe = getStripe();

  const priceId =
    plan === "annual"
      ? process.env.STRIPE_ANNUAL_PRICE_ID ||
        process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID!
      : process.env.STRIPE_PRICE_ID ||
        process.env.NEXT_PUBLIC_STRIPE_PRICE_ID!;

  return stripe.checkout.sessions.create({
    customer_email: email,
    mode: "subscription",
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    metadata: {
      userId,
      plan,
    },
  });
}

export async function createPortalSession(customerId: string) {
  const stripe = getStripe();
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  });
}
