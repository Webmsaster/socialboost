import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateCarousel, type Platform, type Tone } from "@/lib/openai";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/logger";
import { trackEvent } from "@/lib/analytics";
import { isProSubscription } from "@/lib/subscription";

const PRO_LIMIT = 100;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success: withinLimit } = await rateLimit(user.id, "/api/generate-carousel");
    if (!withinLimit) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { topic, tone, language, platform, slideCount } = body as {
      topic: string;
      tone: Tone;
      language: string;
      platform: Platform;
      slideCount: number;
    };

    if (!topic || !tone || !platform) {
      return NextResponse.json(
        { error: "Missing required fields: topic, tone, platform" },
        { status: 400 }
      );
    }

    const validSlideCount = Math.min(10, Math.max(3, slideCount || 5));

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
        { error: "Carousel generation requires a Pro subscription." },
        { status: 403 }
      );
    }

    const limit = PRO_LIMIT;

    if (profile.generation_count >= limit) {
      return NextResponse.json(
        { error: `Monthly limit reached (${limit}). Upgrade to Pro for more.` },
        { status: 403 }
      );
    }

    // Pro-only endpoint (guarded above) — always honor preferred_model
    const model = profile.preferred_model || "gpt-4o-mini";

    const result = await generateCarousel({
      topic,
      tone,
      language: language || "English",
      platform,
      slideCount: validSlideCount,
      brandVoice: profile.brand_voice || undefined,
      model,
    });

    await supabase.rpc("increment_generation_count", {
      p_user_id: user.id,
      p_limit: limit,
    });

    trackEvent({ event: "generate_carousel", userId: user.id, properties: { platform, tone, slideCount: validSlideCount } });

    return NextResponse.json(result);
  } catch (error) {
    captureError("Generate carousel error", error);
    return NextResponse.json(
      { error: "Failed to generate carousel" },
      { status: 500 }
    );
  }
}
