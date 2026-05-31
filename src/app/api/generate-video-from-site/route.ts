import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateVideoScript,
  generateImage,
  type Platform,
  type Tone,
} from "@/lib/openai";
import { generateVoiceover } from "@/lib/openai-tts";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/logger";
import { trackEvent } from "@/lib/analytics";
import { isProSubscription, videoQuotaFor, TEXT_QUOTA_PRO } from "@/lib/subscription";
import {
  reserveGeneration,
  refundGeneration,
  reserveVideoGeneration,
  refundVideoGeneration,
} from "@/lib/quota";
import { persistImage } from "@/lib/storage";
import {
  scrapeWebsite,
  buildPromptBlockFromContext,
} from "@/lib/website-scraper";

const PRO_LIMIT = TEXT_QUOTA_PRO;
const MAX_SCENES_FOR_ASSETS = 6;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success: withinLimit } = await rateLimit(
      user.id,
      "/api/generate-video-from-site"
    );
    if (!withinLimit) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const websiteUrl: string = typeof body.websiteUrl === "string" ? body.websiteUrl.trim() : "";
    const tone: Tone = body.tone as Tone;
    const language: string = typeof body.language === "string" ? body.language : "English";
    const platform: Platform = body.platform as Platform;
    const topicHint: string = typeof body.topicHint === "string" ? body.topicHint : "";

    if (!websiteUrl || !tone || !platform) {
      return NextResponse.json(
        { error: "Missing required fields: websiteUrl, tone, platform" },
        { status: 400 }
      );
    }

    try {
      const parsed = new URL(websiteUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return NextResponse.json(
          { error: "Website URL must be http or https" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json({ error: "Invalid website URL" }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("generation_count, video_generation_count, subscription_status, brand_voice, preferred_model")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    if (!isProSubscription(profile.subscription_status)) {
      return NextResponse.json(
        { error: "Video generation from website is a Pro feature." },
        { status: 403 }
      );
    }

    // Separate video-quota cap. This route does the same expensive work
    // as /api/generate-video-assets (images per scene + TTS) so it shares
    // the cap. Reserve the video slot up front (TOCTOU-safe); refunded later
    // if no images succeed.
    const videoLimit = videoQuotaFor(profile.subscription_status);
    const videoReserved = await reserveVideoGeneration(supabase, user.id, videoLimit);
    if (!videoReserved) {
      return NextResponse.json(
        {
          error: `Monthly video limit reached (${videoLimit}/month on Pro). Resets next billing cycle.`,
        },
        { status: 429 },
      );
    }

    // Reserve 1 text generation for the script before generating it. If we
    // can't, refund the video slot and bail.
    const scriptReserved = await reserveGeneration(supabase, user.id, PRO_LIMIT);
    if (!scriptReserved) {
      await refundVideoGeneration(supabase, user.id).catch((err) =>
        captureError("video-from-site: refund_video (no script quota) failed", err, {
          userId: user.id,
        })
      );
      return NextResponse.json(
        { error: "Not enough monthly quota." },
        { status: 429 }
      );
    }

    const ctx = await scrapeWebsite(websiteUrl);
    if (!ctx) {
      // Scrape failed before we spent on OpenAI — refund both reservations.
      await refundGeneration(supabase, user.id).catch(() => {});
      await refundVideoGeneration(supabase, user.id).catch(() => {});
      return NextResponse.json(
        { error: "Could not fetch website content. Check the URL or try another site." },
        { status: 400 }
      );
    }

    const topic = [
      ctx.title ? `Promote: ${ctx.title}` : "Promote this website",
      buildPromptBlockFromContext(ctx),
      topicHint ? `Additional focus: ${topicHint}` : "",
      "End with a soft call to action pointing viewers to the website.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const model = profile.preferred_model || "gpt-4o-mini";

    let script;
    try {
      script = await generateVideoScript({
        topic,
        tone,
        language,
        platform,
        brandVoice: profile.brand_voice || undefined,
        model,
      });
    } catch (genError) {
      // Script generation failed — refund both reservations.
      await refundGeneration(supabase, user.id).catch(() => {});
      await refundVideoGeneration(supabase, user.id).catch(() => {});
      throw genError;
    }

    const scenes = script.scenes.slice(0, MAX_SCENES_FOR_ASSETS);
    const assetCost = scenes.length + 1; // images + voiceover

    let images: Array<{ sceneNumber: number; url: string | null; error: string | null }> = [];
    let voiceover: { dataUrl: string | null; error: string | null } = {
      dataUrl: null,
      error: null,
    };

    // Reserve the asset-build text slots up front (TOCTOU-safe). If we can't
    // reserve the full asset cost, skip assets and refund what we took — the
    // script (already reserved+generated) is still returned.
    let assetReserved = 0;
    for (let i = 0; i < assetCost; i++) {
      const ok = await reserveGeneration(supabase, user.id, PRO_LIMIT);
      if (!ok) break;
      assetReserved++;
    }
    const canBuildAssets = assetReserved >= assetCost;
    if (!canBuildAssets) {
      for (let i = 0; i < assetReserved; i++) {
        await refundGeneration(supabase, user.id).catch(() => {});
      }
    }

    if (canBuildAssets) {
      const imagePromises = scenes.map(async (scene) => {
        try {
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

      const narrationText = [
        script.hook,
        ...scenes.map((s) => s.narration),
        script.cta,
      ]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 4000);

      const voiceoverPromise = (async () => {
        try {
          const audio = await generateVoiceover({ text: narrationText });
          const base64 = Buffer.from(audio).toString("base64");
          return { dataUrl: `data:audio/mpeg;base64,${base64}`, error: null as string | null };
        } catch (err) {
          return {
            dataUrl: null as string | null,
            error: err instanceof Error ? err.message : "Voiceover failed",
          };
        }
      })();

      const [imgs, vo] = await Promise.all([
        Promise.all(imagePromises),
        voiceoverPromise,
      ]);
      images = imgs;
      voiceover = vo;

      // We reserved `assetCost` text slots. Refund the slots for any image/
      // voiceover that actually failed so users pay only for successes.
      const successfulImages = images.filter((i) => i.url).length;
      const successful = successfulImages + (voiceover.dataUrl ? 1 : 0);
      const assetToRefund = assetCost - successful;
      for (let i = 0; i < assetToRefund; i++) {
        await refundGeneration(supabase, user.id).catch((err) =>
          captureError("Failed to refund generation count (video-from-site)", err, {
            userId: user.id,
          })
        );
      }

      // The dedicated video slot was reserved up front; refund it if no image
      // succeeded (no usable video).
      if (successfulImages === 0) {
        await refundVideoGeneration(supabase, user.id).catch((err) =>
          captureError("Failed to refund video generation count", err, {
            userId: user.id,
          })
        );
      }
    } else {
      // Assets skipped entirely → there is no video, refund the reserved slot.
      await refundVideoGeneration(supabase, user.id).catch((err) =>
        captureError("Failed to refund video generation count (assets skipped)", err, {
          userId: user.id,
        })
      );
    }

    trackEvent({
      event: "generate_video_from_site",
      userId: user.id,
      properties: { platform, tone, hasAssets: canBuildAssets },
    });

    return NextResponse.json({
      website: ctx,
      script,
      images,
      voiceover,
      assetsSkipped: !canBuildAssets
        ? `Not enough quota for full assets (need ${assetCost}).`
        : null,
    });
  } catch (error) {
    captureError("Generate video from site error", error);
    return NextResponse.json(
      { error: "Failed to generate video from site" },
      { status: 500 }
    );
  }
}
