import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateVariants, type Platform, type Tone } from "@/lib/openai";
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

    const { success: withinLimit } = await rateLimit(user.id, "/api/generate-variants");
    if (!withinLimit) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { platform, topic, tone, language, count } = body as {
      platform: Platform;
      topic: string;
      tone: Tone;
      language: string;
      count: number;
    };

    if (!platform || !topic || !tone) {
      return NextResponse.json(
        { error: "Missing required fields: platform, topic, tone" },
        { status: 400 }
      );
    }
    if (typeof topic !== "string" || topic.length > 2000) {
      return NextResponse.json(
        { error: "Topic too long (max 2000 chars)" },
        { status: 400 }
      );
    }

    const validCount = Math.min(5, Math.max(2, count || 3));

    // Check generation limit
    const { data: profile } = await supabase
      .from("profiles")
      .select("generation_count, subscription_status, brand_voice, preferred_model, bonus_generations")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (!isProSubscription(profile.subscription_status)) {
      return NextResponse.json(
        { error: "A/B variant generation requires a Pro subscription." },
        { status: 403 }
      );
    }

    // Same limit derivation as /api/generate: base plan quota (never hardcoded)
    // plus referral bonus_generations. A variant request counts as 1 generation.
    const limit = textQuotaFor(profile.subscription_status) + (profile.bonus_generations ?? 0);

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

    let variants;
    try {
      variants = await generateVariants({
        platform,
        topic,
        tone,
        language: language || "English",
        count: validCount,
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

    trackEvent({ event: "generate_variants", userId: user.id, properties: { platform, tone, count: validCount } });

    return NextResponse.json({ variants });
  } catch (error) {
    captureError("Generate variants error", error);
    return NextResponse.json(
      { error: "Failed to generate variants" },
      { status: 500 }
    );
  }
}
