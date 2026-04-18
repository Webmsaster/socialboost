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
import { isProSubscription } from "@/lib/subscription";
import { persistImage } from "@/lib/storage";
import {
  scrapeWebsite,
  buildPromptBlockFromContext,
} from "@/lib/website-scraper";

const PRO_LIMIT = 100;
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
      .select("generation_count, subscription_status, brand_voice, preferred_model")
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

    const remaining = PRO_LIMIT - profile.generation_count;
    // Worst-case cost: 1 script + 6 scene images + 1 voiceover = 8 generations.
    if (remaining < 2) {
      return NextResponse.json(
        { error: `Not enough monthly quota (${remaining} left).` },
        { status: 403 }
      );
    }

    const ctx = await scrapeWebsite(websiteUrl);
    if (!ctx) {
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

    const script = await generateVideoScript({
      topic,
      tone,
      language,
      platform,
      brandVoice: profile.brand_voice || undefined,
      model,
    });

    // 1 generation for the script.
    await supabase.rpc("increment_generation_count", {
      p_user_id: user.id,
      p_limit: PRO_LIMIT,
    });

    const scenes = script.scenes.slice(0, MAX_SCENES_FOR_ASSETS);
    const remainingAfterScript = remaining - 1;
    const assetCost = scenes.length + 1; // images + voiceover
    const canBuildAssets = remainingAfterScript >= assetCost;

    let images: Array<{ sceneNumber: number; url: string | null; error: string | null }> = [];
    let voiceover: { dataUrl: string | null; error: string | null } = {
      dataUrl: null,
      error: null,
    };

    if (canBuildAssets) {
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

      const successful =
        images.filter((i) => i.url).length + (voiceover.dataUrl ? 1 : 0);
      if (successful > 0) {
        const results = await Promise.all(
          Array.from({ length: successful }, () =>
            supabase.rpc("increment_generation_count", {
              p_user_id: user.id,
              p_limit: PRO_LIMIT,
            })
          )
        );
        for (const { error: incError } of results) {
          if (incError) {
            captureError("Failed to increment generation count (video-from-site)", incError, {
              userId: user.id,
            });
            break;
          }
        }
      }
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
        ? `Not enough quota for full assets (need ${assetCost}, have ${remainingAfterScript}).`
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
