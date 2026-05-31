import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/logger";
import { trackEvent } from "@/lib/analytics";
import { isProSubscription, TEXT_QUOTA_PRO } from "@/lib/subscription";
import { reserveGeneration, refundGeneration } from "@/lib/quota";
import { analyzeBrandVoice, brandVoiceProfileToText } from "@/lib/openai";

const MAX_EXAMPLES = 20;
const MIN_EXAMPLES = 1;
const MAX_TOTAL_CHARS = 30_000;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success } = await rateLimit(user.id, "/api/brand-voice/analyze");
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status, preferred_model, generation_count, bonus_generations")
      .eq("id", user.id)
      .single();

    if (!profile || !isProSubscription(profile.subscription_status)) {
      return NextResponse.json(
        { error: "Brand voice training is a Pro feature." },
        { status: 403 },
      );
    }

    // Voice extraction is a paid OpenAI call → count it against the monthly
    // quota. Pro-only route, so the base is always the Pro text limit.
    const limit = TEXT_QUOTA_PRO + (profile.bonus_generations ?? 0);

    const body = await request.json();
    const examplesRaw: unknown = body?.examples;
    const source: "manual" | "history" = body?.source === "history" ? "history" : "manual";

    if (!Array.isArray(examplesRaw)) {
      return NextResponse.json(
        { error: "Field `examples` must be an array of post texts." },
        { status: 400 },
      );
    }

    const examples = examplesRaw
      .filter((e): e is string => typeof e === "string")
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    if (examples.length < MIN_EXAMPLES) {
      return NextResponse.json(
        { error: "Provide at least one example post." },
        { status: 400 },
      );
    }
    if (examples.length > MAX_EXAMPLES) {
      return NextResponse.json(
        { error: `Provide at most ${MAX_EXAMPLES} examples.` },
        { status: 400 },
      );
    }

    const totalChars = examples.reduce((sum, e) => sum + e.length, 0);
    if (totalChars > MAX_TOTAL_CHARS) {
      return NextResponse.json(
        { error: `Total example text too long (max ${MAX_TOTAL_CHARS} chars).` },
        { status: 400 },
      );
    }

    // Reserve before the OpenAI call (TOCTOU-safe). false = over limit → 429.
    const reserved = await reserveGeneration(supabase, user.id, limit);
    if (!reserved) {
      return NextResponse.json({ error: `Monthly limit reached (${limit}).` }, { status: 429 });
    }

    // Use the Pro user's chosen model — voice extraction is exactly where the
    // higher-quality model matters most, and the result feeds every later
    // generation that uses this profile.
    const model = profile.preferred_model || "gpt-4o-mini";
    let analyzed;
    let text;
    try {
      analyzed = await analyzeBrandVoice({ examples, model });
      text = brandVoiceProfileToText(analyzed);
    } catch (genError) {
      await refundGeneration(supabase, user.id).catch((err) =>
        captureError("brand-voice analyze: refund_generation failed", err, { userId: user.id })
      );
      throw genError;
    }

    trackEvent({
      event: "brand_voice_trained",
      userId: user.id,
      properties: { source, exampleCount: examples.length },
    });

    return NextResponse.json({ profile: analyzed, text });
  } catch (error) {
    captureError("Brand voice analyze error", error);
    return NextResponse.json(
      { error: "Failed to analyze brand voice" },
      { status: 500 },
    );
  }
}
