import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/logger";
import { sanitizeInput } from "@/lib/openai";
import { textQuotaFor } from "@/lib/subscription";
import { reserveGeneration, refundGeneration } from "@/lib/quota";
import OpenAI from "openai";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { success } = await rateLimit(user.id, "/api/hashtags");
    if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const { topic, platform } = await request.json() as { topic: string; platform: string };
    if (!topic) return NextResponse.json({ error: "Missing topic" }, { status: 400 });
    if (typeof topic !== "string" || topic.length > 2000) {
      return NextResponse.json({ error: "Topic too long (max 2000 chars)" }, { status: 400 });
    }

    // Hashtag research is an OpenAI call → count it against the monthly quota
    // (previously only the per-minute limiter gated it, which degrades to a
    // per-instance Map in prod → effectively unbounded gpt-4o-mini spend).
    const { data: profile } = await supabase
      .from("profiles")
      .select("generation_count, subscription_status, bonus_generations")
      .eq("id", user.id)
      .single();
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    const limit = textQuotaFor(profile.subscription_status) + (profile.bonus_generations ?? 0);

    // Reserve before the OpenAI call (TOCTOU-safe). false = over limit → 429.
    const reserved = await reserveGeneration(supabase, user.id, limit);
    if (!reserved) {
      return NextResponse.json({ error: `Monthly limit reached (${limit}).` }, { status: 429 });
    }

    let raw: string | null;
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a social media hashtag research expert. Given a topic and platform, suggest the best hashtags.
Return JSON: { "trending": ["5 currently popular hashtags"], "niche": ["5 niche/specific hashtags"], "broad": ["5 broad reach hashtags"] }`,
          },
          { role: "user", content: `Topic: ${sanitizeInput(topic)}\nPlatform: ${platform || "general"}` },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      raw = response.choices[0].message.content;
      if (!raw) throw new Error("Empty response");
    } catch (genError) {
      // Refund the reserved slot on OpenAI failure / empty response.
      await refundGeneration(supabase, user.id).catch((err) =>
        captureError("hashtags: refund_generation failed", err, { userId: user.id })
      );
      throw genError;
    }

    return NextResponse.json(JSON.parse(raw));
  } catch (error) {
    captureError("Hashtag research error", error);
    return NextResponse.json({ error: "Failed to research hashtags" }, { status: 500 });
  }
}
