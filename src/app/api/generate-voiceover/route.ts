import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/logger";
import { generateVoiceover, type TTSVoice } from "@/lib/openai-tts";
import { isProSubscription, TEXT_QUOTA_PRO } from "@/lib/subscription";
import { reserveGeneration, refundGeneration } from "@/lib/quota";

const VALID_VOICES: TTSVoice[] = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { success } = await rateLimit(user.id, "/api/generate-voiceover");
    if (!success) {
      return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
    }

    // Pro-only feature.
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status, generation_count, bonus_generations")
      .eq("id", user.id)
      .single();

    if (!profile || !isProSubscription(profile.subscription_status)) {
      return NextResponse.json(
        { error: "Voiceover generation is a Pro feature." },
        { status: 403 }
      );
    }

    // Count the TTS call against the monthly quota (it's a paid OpenAI call).
    // Pro-only route, so the base is always the Pro text limit.
    const limit = TEXT_QUOTA_PRO + (profile.bonus_generations ?? 0);

    const body = await request.json();
    const text = typeof body.text === "string" ? body.text : "";
    const voice: TTSVoice = VALID_VOICES.includes(body.voice) ? body.voice : "nova";

    if (!text.trim()) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }
    if (text.length > 4000) {
      return NextResponse.json({ error: "Text too long (max 4000 chars)" }, { status: 400 });
    }

    // Reserve before the TTS call (TOCTOU-safe). false = over limit → 429.
    const reserved = await reserveGeneration(supabase, user.id, limit);
    if (!reserved) {
      return NextResponse.json({ error: `Monthly limit reached (${limit}).` }, { status: 429 });
    }

    let audio;
    try {
      audio = await generateVoiceover({ text, voice });
    } catch (genError) {
      await refundGeneration(supabase, user.id).catch((err) =>
        captureError("voiceover: refund_generation failed", err, { userId: user.id })
      );
      throw genError;
    }

    return new NextResponse(audio as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": 'attachment; filename="voiceover.mp3"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    captureError("Generate voiceover error", error);
    return NextResponse.json({ error: "Failed to generate voiceover" }, { status: 500 });
  }
}
