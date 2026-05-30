import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { repurposePost, type Platform } from "@/lib/openai";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/logger";
import { trackEvent } from "@/lib/analytics";
import { isProSubscription, textQuotaFor } from "@/lib/subscription";
import { reserveGeneration, refundGeneration } from "@/lib/quota";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { success } = await rateLimit(user.id, "/api/repurpose");
    if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const { content, sourcePlatform, targetPlatforms, language } = await request.json() as {
      content: string;
      sourcePlatform: Platform;
      targetPlatforms: Platform[];
      language: string;
    };

    if (!content || !targetPlatforms?.length) {
      return NextResponse.json({ error: "Missing content or targetPlatforms" }, { status: 400 });
    }
    if (typeof content !== "string" || content.length > 5000) {
      return NextResponse.json({ error: "Content too long (max 5000 chars)" }, { status: 400 });
    }
    if (!Array.isArray(targetPlatforms) || targetPlatforms.length > 5) {
      return NextResponse.json({ error: "Too many target platforms (max 5)" }, { status: 400 });
    }

    // Check limits
    const { data: profile } = await supabase
      .from("profiles")
      .select("generation_count, subscription_status, brand_voice, preferred_model, bonus_generations")
      .eq("id", user.id).single();

    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    // Referral rewards (bonus_generations) extend the monthly allowance on top
    // of the base plan limit. Single source of truth in subscription.ts; never
    // hardcode 10/100 here.
    const limit = textQuotaFor(profile.subscription_status) + (profile.bonus_generations ?? 0);

    // Reserve BEFORE the expensive OpenAI call to close the TOCTOU gap: the RPC
    // atomically increments only if still under the limit, so concurrent
    // requests can't both pass a stale read and over-spend. false = at/over
    // limit → 429, without calling OpenAI.
    const reserved = await reserveGeneration(supabase, user.id, limit);
    if (!reserved) {
      return NextResponse.json({ error: `Monthly limit reached (${limit})` }, { status: 429 });
    }

    const model = isProSubscription(profile.subscription_status)
      ? (profile.preferred_model || "gpt-4o-mini")
      : "gpt-4o-mini";

    const results: Record<string, { content: string; hashtags: string[] }> = {};

    try {
      for (const targetPlatform of targetPlatforms) {
        if (targetPlatform === sourcePlatform) continue;
        const result = await repurposePost({
          original: content,
          sourcePlatform,
          targetPlatform,
          language: language || "English",
          brandVoice: profile.brand_voice || undefined,
          model,
        });
        results[targetPlatform] = result;
      }
    } catch (genError) {
      // Refund the reserved slot so a failed repurpose doesn't burn quota.
      await refundGeneration(supabase, user.id).catch((err) =>
        captureError("Failed to refund generation count", err, { userId: user.id })
      );
      throw genError;
    }

    trackEvent({ event: "repurpose_content", userId: user.id, properties: { sourcePlatform, targetCount: targetPlatforms.length } });

    return NextResponse.json({ results });
  } catch (error) {
    captureError("Repurpose content error", error);
    return NextResponse.json({ error: "Failed to repurpose content" }, { status: 500 });
  }
}
