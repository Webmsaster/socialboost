import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generatePost, type Platform, type Tone } from "@/lib/openai";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/logger";
import { trackEvent } from "@/lib/analytics";
import { sendLimitReachedEmail } from "@/lib/email";
import { isProSubscription } from "@/lib/subscription";

const FREE_LIMIT = 10;
const PRO_LIMIT = 100;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResult = await rateLimit(user.id, "/api/generate");
    const rateLimitHeaders = {
      "X-RateLimit-Limit": String(rateLimitResult.limit),
      "X-RateLimit-Remaining": String(rateLimitResult.remaining),
      ...(rateLimitResult.reset ? { "X-RateLimit-Reset": String(rateLimitResult.reset) } : {}),
    };
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429, headers: rateLimitHeaders }
      );
    }

    const body = await request.json();
    const { platform, topic, tone, language } = body as {
      platform: Platform;
      topic: string;
      tone: Tone;
      language: string;
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

    // Check generation limit
    const { data: profile } = await supabase
      .from("profiles")
      .select("generation_count, subscription_status, email, brand_voice, preferred_model")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const limit = profile.subscription_status === "active" ? PRO_LIMIT : FREE_LIMIT;

    if (profile.generation_count >= limit) {
      // Notify user (fire-and-forget, don't block response)
      sendLimitReachedEmail(profile.email || user.email!, profile.subscription_status, limit).catch(
        (err) => captureError("Failed to send limit reached email", err)
      );
      return NextResponse.json(
        { error: `Monthly limit reached (${limit}). Upgrade to Pro for more.` },
        { status: 403 }
      );
    }

    const model = isProSubscription(profile.subscription_status)
      ? (profile.preferred_model || "gpt-4o-mini")
      : "gpt-4o-mini";

    const result = await generatePost({
      platform,
      topic,
      tone,
      language: language || "English",
      brandVoice: profile.brand_voice || undefined,
      model,
    });

    // Increment generation count
    const { error: incError } = await supabase.rpc("increment_generation_count", {
      p_user_id: user.id,
      p_limit: limit,
    });
    if (incError) {
      captureError("Failed to increment generation count", incError, { userId: user.id });
    }

    trackEvent({ event: "generate_post", userId: user.id, properties: { platform, tone, language: language || "English" } });

    return NextResponse.json(result);
  } catch (error) {
    captureError("Generate post error", error);
    return NextResponse.json(
      { error: "Failed to generate post" },
      { status: 500 }
    );
  }
}
