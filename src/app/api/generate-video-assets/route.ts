import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateImage } from "@/lib/openai";
import { generateVoiceover } from "@/lib/openai-tts";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/logger";
import { isProSubscription } from "@/lib/subscription";
import { persistImage } from "@/lib/storage";

interface SceneInput {
  sceneNumber: number;
  visual: string;
  narration: string;
  textOverlay?: string;
}

const MAX_SCENES = 6;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { success } = await rateLimit(user.id, "/api/generate-video-assets");
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status, generation_count")
      .eq("id", user.id)
      .single();

    if (!profile || !isProSubscription(profile.subscription_status)) {
      return NextResponse.json(
        { error: "Video assets are a Pro feature." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const hook: string = typeof body.hook === "string" ? body.hook : "";
    const cta: string = typeof body.cta === "string" ? body.cta : "";
    const scenesRaw: SceneInput[] = Array.isArray(body.scenes) ? body.scenes : [];
    const scenes = scenesRaw.slice(0, MAX_SCENES);

    if (scenes.length === 0) {
      return NextResponse.json({ error: "Missing scenes" }, { status: 400 });
    }

    // Budget check: each scene = 1 image + a share of the narration TTS.
    // Count 1 generation per scene image; voiceover counts as 1 additional generation.
    const estimatedCost = scenes.length + 1;
    const limit = 100;
    if (profile.generation_count + estimatedCost >= limit) {
      return NextResponse.json(
        { error: `Not enough monthly quota. Need ${estimatedCost}, have ${limit - profile.generation_count} left.` },
        { status: 403 }
      );
    }

    // 1. Generate one image per scene (in parallel, best-effort).
    const imagePromises = scenes.map(async (scene) => {
      try {
        const prompt = `Cinematic social media ad frame. ${scene.visual}. High contrast, vibrant, professional.`;
        const temporary = await generateImage(prompt);
        const persisted = await persistImage(temporary, user.id).catch(() => temporary);
        return { sceneNumber: scene.sceneNumber, url: persisted, error: null as string | null };
      } catch (err) {
        return {
          sceneNumber: scene.sceneNumber,
          url: null as string | null,
          error: err instanceof Error ? err.message : "Image failed",
        };
      }
    });

    // 2. Generate the combined voiceover from hook + narrations + cta.
    const narrationText = [hook, ...scenes.map((s) => s.narration), cta]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 4000);

    const voiceoverPromise = (async () => {
      try {
        const audio = await generateVoiceover({ text: narrationText });
        // Return as base64 data URL so the client can download without a second round-trip.
        const base64 = Buffer.from(audio).toString("base64");
        return { dataUrl: `data:audio/mpeg;base64,${base64}`, error: null as string | null };
      } catch (err) {
        return {
          dataUrl: null as string | null,
          error: err instanceof Error ? err.message : "Voiceover failed",
        };
      }
    })();

    const [images, voiceover] = await Promise.all([
      Promise.all(imagePromises),
      voiceoverPromise,
    ]);

    // Count successful generations and bump the quota for each.
    const successfulImages = images.filter((i) => i.url).length;
    const voiceoverOk = voiceover.dataUrl ? 1 : 0;
    const successful = successfulImages + voiceoverOk;

    if (successful > 0) {
      for (let i = 0; i < successful; i++) {
        await supabase.rpc("increment_generation_count", {
          p_user_id: user.id,
          p_limit: limit,
        });
      }
    }

    return NextResponse.json({
      images,
      voiceover,
      narration: narrationText,
    });
  } catch (error) {
    captureError("Generate video assets error", error);
    return NextResponse.json({ error: "Failed to generate video assets" }, { status: 500 });
  }
}
