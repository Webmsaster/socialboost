import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/logger";
import { sanitizeInput } from "@/lib/openai";
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

    const raw = response.choices[0].message.content;
    if (!raw) throw new Error("Empty response");

    return NextResponse.json(JSON.parse(raw));
  } catch (error) {
    captureError("Hashtag research error", error);
    return NextResponse.json({ error: "Failed to research hashtags" }, { status: 500 });
  }
}
