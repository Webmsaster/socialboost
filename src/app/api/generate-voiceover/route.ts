import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/logger";
import { generateVoiceover, type TTSVoice } from "@/lib/openai-tts";
import { isProSubscription } from "@/lib/subscription";

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
      .select("subscription_status")
      .eq("id", user.id)
      .single();

    if (!profile || !isProSubscription(profile.subscription_status)) {
      return NextResponse.json(
        { error: "Voiceover generation is a Pro feature." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const text = typeof body.text === "string" ? body.text : "";
    const voice: TTSVoice = VALID_VOICES.includes(body.voice) ? body.voice : "nova";

    if (!text.trim()) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }
    if (text.length > 4000) {
      return NextResponse.json({ error: "Text too long (max 4000 chars)" }, { status: 400 });
    }

    const audio = await generateVoiceover({ text, voice });

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
