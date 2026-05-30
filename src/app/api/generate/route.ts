import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generatePost, type Platform, type Tone } from "@/lib/openai";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/logger";
import { trackEvent } from "@/lib/analytics";
import { sendLimitReachedEmail } from "@/lib/email";
import { isProSubscription, textQuotaFor } from "@/lib/subscription";
import { reserveGeneration, refundGeneration } from "@/lib/quota";
import { scrapeWebsite, buildPromptBlockFromContext } from "@/lib/website-scraper";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResult = await rateLimit(user.id, "/api/generate");
    const rateLimitHeaders = {
      "X-RateLimit-Limit": String(rateLimitResult.limit),
      "X-RateLimit-Remaining": String(rateLimitResult.remaining),
      ...(rateLimitResult.reset ? { "X-RateLimit-Reset": String(rateLimitResult.reset) } : {}),
    };
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429, headers: rateLimitHeaders }
      );
    }

    const body = await request.json();
    const { platform, topic, tone, language, websiteUrl, brandVoiceOverride } = body as {
      platform: Platform;
      topic: string;
      tone: Tone;
      language: string;
      websiteUrl?: string;
      // Used by the Settings → Auto-Train trainer to preview a sample post
      // in a brand voice the user hasn't saved yet. When present, takes
      // priority over the profile's saved brand_voice.
      brandVoiceOverride?: string;
    };

    if (!platform || !topic || !tone) {
      return NextResponse.json(
        { error: "Missing required fields: platform, topic, tone" },
        { status: 400 }
      );
    }
    if (typeof topic !== "string" || topic.length > 2000) {
      return NextResponse.json(
        { error: "Topic too long (max 2000 chars)" },
        { status: 400 }
      );
    }

    let normalizedWebsiteUrl: string | null = null;
    if (typeof websiteUrl === "string" && websiteUrl.trim()) {
      try {
        const parsed = new URL(websiteUrl.trim());
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return NextResponse.json(
            { error: "Website URL must be http or https" },
            { status: 400 }
          );
        }
        normalizedWebsiteUrl = parsed.toString();
      } catch {
        return NextResponse.json({ error: "Invalid website URL" }, { status: 400 });
      }
    }

    // Check generation limit
    const { data: profile } = await supabase
      .from("profiles")
      .select("generation_count, subscription_status, email, brand_voice, preferred_model, bonus_generations")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Referral rewards (bonus_generations) extend the monthly allowance on top
    // of the base plan limit. The UI promises these, so they must be honored.
    const isPro = isProSubscription(profile.subscription_status);
    const limit = textQuotaFor(profile.subscription_status) + (profile.bonus_generations ?? 0);

    // Reserve BEFORE the expensive OpenAI call to close the TOCTOU gap: the RPC
    // atomically increments only if still under the limit, so concurrent
    // requests can't both pass a stale read and over-spend. false = at/over
    // limit → 429, without calling OpenAI.
    const reserved = await reserveGeneration(supabase, user.id, limit);
    if (!reserved) {
      // Notify user (fire-and-forget, don't block response)
      sendLimitReachedEmail(profile.email || user.email!, profile.subscription_status, limit).catch(
        (err) => captureError("Failed to send limit reached email", err)
      );
      return NextResponse.json(
        { error: `Monthly limit reached (${limit}). Upgrade to Pro for more.` },
        { status: 429 }
      );
    }

    const model = isPro
      ? (profile.preferred_model || "gpt-4o-mini")
      : "gpt-4o-mini";

    let effectiveTopic = topic;
    if (normalizedWebsiteUrl) {
      const ctx = await scrapeWebsite(normalizedWebsiteUrl);
      if (ctx) {
        effectiveTopic = `${topic}\n\n${buildPromptBlockFromContext(ctx)}\n\nWrite a post that naturally ties the topic above to this website and ends with a soft call to action pointing readers there.`;
      }
    }

    let result;
    try {
      result = await generatePost({
        platform,
        topic: effectiveTopic,
        tone,
        language: language || "English",
        brandVoice:
          (typeof brandVoiceOverride === "string" && brandVoiceOverride.trim()
            ? brandVoiceOverride.trim().slice(0, 2000)
            : profile.brand_voice) || undefined,
        model,
      });
    } catch (genError) {
      // Refund the reserved slot so a failed generation doesn't burn quota.
      await refundGeneration(supabase, user.id).catch((err) =>
        captureError("Failed to refund generation count", err, { userId: user.id })
      );
      throw genError;
    }

    trackEvent({ event: "generate_post", userId: user.id, properties: { platform, tone, language: language || "English" } });

    return NextResponse.json(result);
  } catch (error) {
    captureError("Generate post error", error);
    return NextResponse.json(
      { error: "Failed to generate post" },
      { status: 500 }
    );
  }
}
