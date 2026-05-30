import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateVideoAd, type Tone } from "@/lib/openai";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/logger";
import { trackEvent } from "@/lib/analytics";
import { isProSubscription, textQuotaFor } from "@/lib/subscription";
import { reserveGeneration, refundGeneration } from "@/lib/quota";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success: withinLimit } = await rateLimit(user.id, "/api/generate-video-ad");
    if (!withinLimit) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { topic, tone, language, product } = body as {
      topic: string;
      tone: Tone;
      language: string;
      product: string;
    };

    if (!topic || !tone || !product) {
      return NextResponse.json(
        { error: "Missing required fields: topic, tone, product" },
        { status: 400 }
      );
    }
    if (typeof topic !== "string" || topic.length > 2000 ||
        typeof product !== "string" || product.length > 500) {
      return NextResponse.json(
        { error: "Topic or product too long (topic max 2000, product max 500)" },
        { status: 400 }
      );
    }

    // Check generation limit
    const { data: profile } = await supabase
      .from("profiles")
      .select("generation_count, subscription_status, brand_voice, preferred_model")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (!isProSubscription(profile.subscription_status)) {
      return NextResponse.json(
        { error: "Video ad generation requires a Pro subscription." },
        { status: 403 }
      );
    }

    // This endpoint consumes the shared text-generation quota (it increments the
    // same generation_count counter), so the limit comes from subscription.ts —
    // never hardcoded — exactly like /api/generate.
    const limit = textQuotaFor(profile.subscription_status);

    // Reserve BEFORE the expensive OpenAI call to close the TOCTOU gap: the RPC
    // atomically increments only if still under the limit, so concurrent
    // requests can't both pass a stale read and over-spend. false = at/over
    // limit → 429, without calling OpenAI.
    const reserved = await reserveGeneration(supabase, user.id, limit);
    if (!reserved) {
      return NextResponse.json(
        { error: `Monthly limit reached (${limit}). Upgrade to Pro for more.` },
        { status: 429 }
      );
    }

    // Pro-only endpoint (guarded above) — always honor preferred_model
    const model = profile.preferred_model || "gpt-4o-mini";

    let result;
    try {
      result = await generateVideoAd({
        topic,
        tone,
        language: language || "English",
        product,
        brandVoice: profile.brand_voice || undefined,
        model,
      });
    } catch (genError) {
      // Refund the reserved slot so a failed generation doesn't burn quota.
      await refundGeneration(supabase, user.id).catch((err) =>
        captureError("Failed to refund generation count", err, { userId: user.id })
      );
      throw genError;
    }

    trackEvent({ event: "generate_video_ad", userId: user.id, properties: { tone } });

    return NextResponse.json(result);
  } catch (error) {
    captureError("Generate video ad error", error);
    return NextResponse.json(
      { error: "Failed to generate video ad storyboard" },
      { status: 500 }
    );
  }
}
