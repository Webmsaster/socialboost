import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateImage } from "@/lib/openai";
import { generateVoiceover } from "@/lib/openai-tts";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/logger";
import { isProSubscription, videoQuotaFor } from "@/lib/subscription";
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
      .select("subscription_status, generation_count, video_generation_count, bonus_generations")
      .eq("id", user.id)
      .single();

    if (!profile || !isProSubscription(profile.subscription_status)) {
      return NextResponse.json(
        { error: "Video assets are a Pro feature." },
        { status: 403 }
      );
    }

    // Video-specific quota guard. This is the expensive route (gpt-image-1
    // ×N + TTS = ~$0.30) so it has its own cap separate from the regular
    // generation_count. See src/lib/subscription.ts for the limits.
    const videoLimit = videoQuotaFor(profile.subscription_status);
    if ((profile.video_generation_count ?? 0) >= videoLimit) {
      return NextResponse.json(
        {
          error: `Monthly video limit reached (${videoLimit}/month on Pro). Resets next billing cycle.`,
        },
        { status: 403 },
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
    const limit = 100 + (profile.bonus_generations ?? 0);
    if (profile.generation_count + estimatedCost > limit) {
      return NextResponse.json(
        { error: `Not enough monthly quota. Need ${estimatedCost}, have ${limit - profile.generation_count} left.` },
        { status: 403 }
      );
    }

    // 1. Generate one image per scene (in parallel, best-effort).
    const imagePromises = scenes.map(async (scene) => {
      try {
        // Describe the visual content only. Words like "frame" or "ad" near the
        // start tend to make gpt-image-1 render those words AS text in the image
        // itself, so the style guidance moves to the end as comma-separated tags.
        // Explicit "single subject" / "no split-screen" kills the model's habit
        // of returning 4-panel grids when it sees "scenes" or "diverse" in input.
        const prompt = `${scene.visual}. Single subject, one continuous shot, no split-screen, no collage, no grid, no text, no watermark. Photorealistic, vertical composition, vibrant lighting, cinematic depth of field.`;
        const temporary = await generateImage(prompt, "1024x1536");
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
      const results = await Promise.all(
        Array.from({ length: successful }, () =>
          supabase.rpc("increment_generation_count", {
            p_user_id: user.id,
            p_limit: limit,
          })
        )
      );
      for (const { error: incError } of results) {
        if (incError) {
          captureError("Failed to increment generation count (video assets)", incError, {
            userId: user.id,
          });
          break;
        }
      }
    }

    // One asset-bundle = 1 video for quota purposes. Counted separately from
    // text generations because video costs ~$0.30 vs text's ~$0.001.
    if (successfulImages > 0) {
      const { error: videoIncErr } = await supabase.rpc(
        "increment_video_generation_count",
        { p_user_id: user.id, p_limit: videoLimit },
      );
      if (videoIncErr) {
        captureError("Failed to increment video generation count", videoIncErr, {
          userId: user.id,
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
