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
      apiVersion: "2026-03-25.dahlia",
    });
  }
  return _stripe;
}

export async function createCheckoutSession(
  userId: string,
  email: string,
  plan: "monthly" | "annual" = "monthly",
  customerId?: string | null
) {
  const stripe = getStripe();

  const priceId =
    plan === "annual"
      ? process.env.STRIPE_ANNUAL_PRICE_ID ||
        process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID!
      : process.env.STRIPE_PRICE_ID ||
        process.env.NEXT_PUBLIC_STRIPE_PRICE_ID!;

  return stripe.checkout.sessions.create({
    // Reuse the existing Stripe customer when we already have one so a
    // re-subscribe (cancel → subscribe again) doesn't mint a duplicate
    // customer. Duplicates fragment billing history and, worse, cause later
    // subscription events keyed on the old customer id to match no profile
    // (so a cancellation never revokes access). Fall back to customer_email
    // only for a first-time checkout.
    ...(customerId ? { customer: customerId } : { customer_email: email }),
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
