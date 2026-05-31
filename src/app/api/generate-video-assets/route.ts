import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateImage } from "@/lib/openai";
import { generateVoiceover } from "@/lib/openai-tts";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/logger";
import { isProSubscription, videoQuotaFor, TEXT_QUOTA_PRO } from "@/lib/subscription";
import {
  reserveGeneration,
  refundGeneration,
  reserveVideoGeneration,
  refundVideoGeneration,
} from "@/lib/quota";
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

    const videoLimit = videoQuotaFor(profile.subscription_status);
    const limit = TEXT_QUOTA_PRO + (profile.bonus_generations ?? 0);

    const body = await request.json();
    const hook: string = typeof body.hook === "string" ? body.hook : "";
    const cta: string = typeof body.cta === "string" ? body.cta : "";
    const scenesRaw: SceneInput[] = Array.isArray(body.scenes) ? body.scenes : [];
    const scenes = scenesRaw.slice(0, MAX_SCENES);

    if (scenes.length === 0) {
      return NextResponse.json({ error: "Missing scenes" }, { status: 400 });
    }

    // Reserve BEFORE the expensive work (TOCTOU-safe), separately for the
    // video cap and the text cap. Each scene = 1 image generation + the
    // narration counts as 1 voiceover generation. We reserve the video slot
    // first (it's the scarcer, ~$0.30 resource); if either reservation can't
    // be fully satisfied we refund whatever we took and return 429 without
    // calling OpenAI. Unused/failed reservations are refunded after the work.
    const estimatedCost = scenes.length + 1; // images + voiceover

    // Video-specific quota: this is the expensive route (gpt-image-1 ×N + TTS
    // = ~$0.30) so it has its own cap. See src/lib/subscription.ts.
    const videoReserved = await reserveVideoGeneration(supabase, user.id, videoLimit);
    if (!videoReserved) {
      return NextResponse.json(
        {
          error: `Monthly video limit reached (${videoLimit}/month on Pro). Resets next billing cycle.`,
        },
        { status: 429 },
      );
    }

    // Reserve the text generations one-by-one so we know exactly how many we
    // got; if we can't reserve the full estimated cost, refund and bail.
    let textReserved = 0;
    for (let i = 0; i < estimatedCost; i++) {
      const ok = await reserveGeneration(supabase, user.id, limit);
      if (!ok) break;
      textReserved++;
    }
    if (textReserved < estimatedCost) {
      for (let i = 0; i < textReserved; i++) {
        await refundGeneration(supabase, user.id).catch((err) =>
          captureError("video assets: refund_generation (insufficient quota) failed", err, {
            userId: user.id,
          })
        );
      }
      await refundVideoGeneration(supabase, user.id).catch((err) =>
        captureError("video assets: refund_video_generation (insufficient quota) failed", err, {
          userId: user.id,
        })
      );
      return NextResponse.json(
        { error: `Not enough monthly quota. Need ${estimatedCost}.` },
        { status: 429 }
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

    // We reserved `estimatedCost` text slots (scenes + 1 voiceover) up front.
    // Refund the slots for any image/voiceover that actually failed so users
    // are only charged for successful generations.
    const successfulImages = images.filter((i) => i.url).length;
    const voiceoverOk = voiceover.dataUrl ? 1 : 0;
    const successful = successfulImages + voiceoverOk;
    const textToRefund = estimatedCost - successful;
    for (let i = 0; i < textToRefund; i++) {
      await refundGeneration(supabase, user.id).catch((err) =>
        captureError("Failed to refund generation count (video assets)", err, {
          userId: user.id,
        })
      );
    }

    // One asset-bundle = 1 video for quota purposes. We reserved the video slot
    // up front; if no image succeeded there's no usable video, so refund it.
    if (successfulImages === 0) {
      await refundVideoGeneration(supabase, user.id).catch((err) =>
        captureError("Failed to refund video generation count", err, {
          userId: user.id,
        })
      );
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
