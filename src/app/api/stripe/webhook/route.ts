import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { captureError } from "@/lib/logger";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function withRetry<T>(
  fn: () => PromiseLike<{ data: T; error: unknown }>,
  maxAttempts = 3
): Promise<{ data: T; error: unknown }> {
  let lastResult: { data: T; error: unknown } = { data: null as T, error: null };
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    lastResult = await fn();
    if (!lastResult.error) return lastResult;
    if (attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt)));
    }
  }
  return lastResult;
}

function mapSubscriptionStatus(stripeStatus: Stripe.Subscription.Status): string {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "canceled";
    default:
      return "inactive";
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    captureError("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const stripe = getStripe();
  const supabaseAdmin = getSupabaseAdmin();
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    captureError("Webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: reject if this event id was already processed.
  // Insert first; a duplicate PK means we've already handled it.
  const { error: dedupeError } = await supabaseAdmin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });
  if (dedupeError) {
    const code = (dedupeError as { code?: string }).code;
    if (code === "23505") {
      // Duplicate — already processed. Ack success so Stripe stops retrying.
      return NextResponse.json({ received: true, duplicate: true });
    }
    // If the stripe_events table doesn't exist yet (pre-migration), continue
    // without idempotency instead of failing webhook delivery entirely.
    if (code !== "42P01") {
      captureError("stripe_events insert failed", dedupeError, { eventId: event.id });
    }
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (userId) {
        // Verify user exists before updating
        const { data: existingProfile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("id", userId)
          .single();

        if (!existingProfile) {
          captureError("Webhook: userId from checkout metadata not found in profiles", null, { userId });
          return NextResponse.json({ error: "User not found" }, { status: 400 });
        }

        const { error } = await withRetry(() =>
          supabaseAdmin
            .from("profiles")
            .update({
              stripe_customer_id: session.customer as string,
              subscription_status: "active",
            })
            .eq("id", userId)
        );
        if (error) {
          captureError("Failed to update profile after checkout", error);
          return NextResponse.json({ error: "Database update failed" }, { status: 500 });
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const status = mapSubscriptionStatus(subscription.status);
      const { error } = await withRetry(() =>
        supabaseAdmin
          .from("profiles")
          .update({ subscription_status: status })
          .eq("stripe_customer_id", customerId)
      );
      if (error) {
        captureError("Failed to update subscription status", error);
        return NextResponse.json({ error: "Database update failed" }, { status: 500 });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const { error } = await withRetry(() =>
        supabaseAdmin
          .from("profiles")
          .update({ subscription_status: "canceled" })
          .eq("stripe_customer_id", customerId)
      );
      if (error) {
        captureError("Failed to update canceled subscription", error);
        return NextResponse.json({ error: "Database update failed" }, { status: 500 });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
