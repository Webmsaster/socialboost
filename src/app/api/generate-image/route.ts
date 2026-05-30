import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateImage, type ImageSize } from "@/lib/openai";

// Map social platform to the gpt-image-1 size that actually fits its feed.
// gpt-image-1 only supports these three sizes — we pick the closest match.
// Defaults to square if nothing is specified (works passably everywhere).
const PLATFORM_IMAGE_SIZE: Record<string, ImageSize> = {
  linkedin: "1024x1024", // LinkedIn feed renders square cleanest
  facebook: "1536x1024", // FB feed prefers landscape
  twitter: "1536x1024", // X cards are landscape (16:9)
  instagram: "1024x1536", // IG Reels / portrait posts dominate
  pinterest: "1024x1536", // Pinterest is portrait-first
};
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/logger";
import { trackEvent } from "@/lib/analytics";
import { isProSubscription, textQuotaFor } from "@/lib/subscription";
import { reserveGeneration, refundGeneration } from "@/lib/quota";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success: withinLimit } = await rateLimit(user.id, "/api/generate-image");
    if (!withinLimit) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { prompt, platform } = body as { prompt: string; platform?: string };
    const size: ImageSize =
      (platform && PLATFORM_IMAGE_SIZE[platform]) || "1024x1024";

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: "Missing required field: prompt" },
        { status: 400 }
      );
    }
    if (typeof prompt !== "string" || prompt.length > 1000) {
      return NextResponse.json(
        { error: "Prompt too long (max 1000 chars)" },
        { status: 400 }
      );
    }

    // Check generation limit
    const { data: profile } = await supabase
      .from("profiles")
      .select("generation_count, subscription_status, brand_voice, preferred_model, bonus_generations")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (!isProSubscription(profile.subscription_status)) {
      return NextResponse.json(
        { error: "Image generation requires a Pro subscription." },
        { status: 403 }
      );
    }

    // Image generation draws from the shared monthly text-generation quota.
    // Referral bonus_generations extend the allowance, mirroring /api/generate.
    const limit = textQuotaFor(profile.subscription_status) + (profile.bonus_generations ?? 0);

    // Reserve BEFORE the expensive OpenAI call to close the TOCTOU gap: the RPC
    // atomically increments only if still under the limit, so concurrent
    // requests can't both pass a stale read and over-spend. false = at/over
    // limit → 429, without calling OpenAI.
    const reserved = await reserveGeneration(supabase, user.id, limit);
    if (!reserved) {
      return NextResponse.json(
        { error: `Monthly limit reached (${limit}). Upgrade to Pro for more.` },
        { status: 429 }
      );
    }

    let url: string;
    try {
      const temporaryUrl = await generateImage(prompt, size);

      // Persist to Supabase Storage so URL doesn't expire
      const { persistImage } = await import("@/lib/storage");
      url = await persistImage(temporaryUrl, user.id);

      trackEvent({
        event: "generate_image",
        userId: user.id,
        properties: { persisted: url !== temporaryUrl, size, platform: platform ?? null },
      });
    } catch (genError) {
      // Refund the reserved slot so a failed generation doesn't burn quota.
      await refundGeneration(supabase, user.id).catch((err) =>
        captureError("Failed to refund generation count", err, { userId: user.id })
      );
      throw genError;
    }

    return NextResponse.json({ url });
  } catch (error) {
    captureError("Generate image error", error);
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}
