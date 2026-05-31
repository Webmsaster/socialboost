import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession } from "@/lib/stripe";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success: withinLimit } = await rateLimit(user.id, "/api/stripe/checkout");
    if (!withinLimit) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    if (!user.email) {
      return NextResponse.json(
        { error: "No email address associated with your account" },
        { status: 400 }
      );
    }

    let plan: "monthly" | "annual" = "monthly";
    try {
      const body = await request.json();
      if (body.plan === "annual") plan = "annual";
    } catch {
      // No body or invalid JSON — default to monthly
    }

    // Reuse an existing Stripe customer if this user already has one, so a
    // re-subscribe (cancel → subscribe again) doesn't mint a duplicate customer.
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    const session = await createCheckoutSession(
      user.id,
      user.email,
      plan,
      profile?.stripe_customer_id ?? null,
    );
    return NextResponse.json({ url: session.url });
  } catch (error) {
    captureError("Checkout error", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
