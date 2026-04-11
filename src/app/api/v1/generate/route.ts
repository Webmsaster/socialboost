import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateApiKey } from "@/lib/api-keys";
import { generatePost, type Platform, type Tone } from "@/lib/openai";
import { captureError } from "@/lib/logger";

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

    const { platform, topic, tone, language } = await request.json() as {
      platform: string;
      topic: string;
      tone?: string;
      language?: string;
    };

    if (!platform || !topic) {
      return NextResponse.json({ error: "Missing platform or topic" }, { status: 400 });
    }

    const validPlatforms = ["linkedin", "facebook", "instagram", "pinterest", "twitter"];
    if (!validPlatforms.includes(platform)) {
      return NextResponse.json({ error: `Invalid platform. Use: ${validPlatforms.join(", ")}` }, { status: 400 });
    }

    // Check limits
    const supabase = getAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status, generation_count, brand_voice, preferred_model")
      .eq("id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const limit = profile.subscription_status === "active" ? 100 : 10;
    if (profile.generation_count >= limit) {
      return NextResponse.json({ error: `Monthly limit reached (${limit})` }, { status: 403 });
    }

    const result = await generatePost({
      platform: platform as Platform,
      topic,
      tone: (tone || "professional") as Tone,
      language: language || "English",
      brandVoice: profile.brand_voice || undefined,
      model: profile.subscription_status === "active"
        ? (profile.preferred_model || "gpt-4o-mini")
        : "gpt-4o-mini",
    });

    await supabase.rpc("increment_generation_count", { p_user_id: userId, p_limit: limit });

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
