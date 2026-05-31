import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateApiKey } from "@/lib/api-keys";
import { generatePost, PLATFORMS, TONES, type Platform, type Tone } from "@/lib/openai";
import { captureError } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { isProSubscription, textQuotaFor } from "@/lib/subscription";
import { reserveGeneration, refundGeneration } from "@/lib/quota";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Public API endpoint for generating posts via API key.
 * Requires Authorization: Bearer sb_xxx header.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing API key. Use Authorization: Bearer sb_xxx" }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const userId = await validateApiKey(apiKey);

    if (!userId) {
      return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 });
    }

    const limited = await rateLimit(userId, "/api/v1/generate");
    if (!limited.success) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(limited.limit),
            "X-RateLimit-Remaining": String(limited.remaining),
          },
        }
      );
    }

    const { platform, topic, tone, language } = await request.json() as {
      platform: string;
      topic: string;
      tone?: string;
      language?: string;
    };

    if (!platform || !topic) {
      return NextResponse.json({ error: "Missing platform or topic" }, { status: 400 });
    }
    if (typeof topic !== "string" || topic.length > 2000) {
      return NextResponse.json({ error: "Topic too long (max 2000 chars)" }, { status: 400 });
    }

    if (!(PLATFORMS as readonly string[]).includes(platform)) {
      return NextResponse.json({ error: `Invalid platform. Use: ${PLATFORMS.join(", ")}` }, { status: 400 });
    }
    // Validate tone when provided (previously accepted any string and passed it
    // straight to the model). Omitted tone still defaults to "professional".
    if (tone !== undefined && !(TONES as readonly string[]).includes(tone)) {
      return NextResponse.json({ error: `Invalid tone. Use: ${TONES.join(", ")}` }, { status: 400 });
    }

    // Check limits
    const supabase = getAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status, generation_count, brand_voice, preferred_model, bonus_generations")
      .eq("id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const limit = textQuotaFor(profile.subscription_status) + (profile.bonus_generations ?? 0);

    // Reserve atomically before the OpenAI call (TOCTOU-safe). false = over
    // limit → 429 without spending.
    const reserved = await reserveGeneration(supabase, userId, limit);
    if (!reserved) {
      return NextResponse.json({ error: `Monthly limit reached (${limit})` }, { status: 429 });
    }

    let result;
    try {
      result = await generatePost({
        platform: platform as Platform,
        topic,
        tone: (tone || "professional") as Tone,
        language: language || "English",
        brandVoice: profile.brand_voice || undefined,
        model: isProSubscription(profile.subscription_status)
          ? (profile.preferred_model || "gpt-4o-mini")
          : "gpt-4o-mini",
      });
    } catch (genError) {
      await refundGeneration(supabase, userId).catch((err) =>
        captureError("v1 generate: refund_generation failed", err, { userId })
      );
      throw genError;
    }

    return NextResponse.json({
      content: result.content,
      hashtags: result.hashtags,
      platform,
      tone: tone || "professional",
    });
  } catch (error) {
    captureError("Public API generate error", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
