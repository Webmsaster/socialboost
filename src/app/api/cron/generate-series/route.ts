import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generatePost, type Platform, type Tone } from "@/lib/openai";
import { captureError } from "@/lib/logger";
import {
  scrapeWebsite,
  buildPromptBlockFromContext,
  type WebsiteContext,
} from "@/lib/website-scraper";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Cron endpoint: generates posts for active content series that are due.
 * Checks each series' frequency, day_of_week, and last_generated_at to decide
 * whether to generate a new post. Generated posts are saved as "scheduled" drafts.
 *
 * Secured via CRON_SECRET header. Run daily via Vercel Cron.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const now = new Date();
  const todayDayOfWeek = now.getDay();
  // Fetch all active series
  const { data: seriesList, error: fetchError } = await supabase
    .from("content_series")
    .select("*, profiles(brand_voice, preferred_model, subscription_status, generation_count)")
    .eq("is_active", true);

  if (fetchError) {
    captureError("Series cron: failed to fetch series", fetchError);
    return NextResponse.json({ error: "Failed to fetch series" }, { status: 500 });
  }

  if (!seriesList || seriesList.length === 0) {
    return NextResponse.json({ processed: 0, generated: 0 });
  }

  let generated = 0;
  let skipped = 0;

  for (const series of seriesList) {
    try {
      // Check if this series is due today
      if (!isDue(series, now, todayDayOfWeek)) {
        skipped++;
        continue;
      }

      // Check generation limits for the user
      const profile = series.profiles as {
        brand_voice: string | null;
        preferred_model: string | null;
        subscription_status: string;
        generation_count: number;
      } | null;

      if (!profile) {
        skipped++;
        continue;
      }

      const limit = profile.subscription_status === "active" ? 100 : 10;
      if (profile.generation_count >= limit) {
        skipped++;
        continue;
      }

      // If the series targets a website, refresh scraped context once per day.
      let websiteContext: WebsiteContext | null =
        (series.website_context as WebsiteContext | null) ?? null;
      if (series.website_url) {
        const lastScraped = series.website_scraped_at ? new Date(series.website_scraped_at) : null;
        const stale = !lastScraped || now.getTime() - lastScraped.getTime() > 24 * 60 * 60 * 1000;
        if (stale) {
          const fresh = await scrapeWebsite(series.website_url);
          if (fresh) {
            websiteContext = fresh;
            await supabase
              .from("content_series")
              .update({
                website_context: fresh,
                website_scraped_at: now.toISOString(),
              })
              .eq("id", series.id);
          }
        }
      }

      const topic = websiteContext
        ? `${series.topic_template}\n\n${buildPromptBlockFromContext(websiteContext)}\n\nWrite a post that naturally ties the topic above to this website and ends with a soft call to action pointing readers there.`
        : series.topic_template;

      // Generate the post
      const result = await generatePost({
        platform: series.platform as Platform,
        topic,
        tone: (series.tone || "professional") as Tone,
        language: "English",
        brandVoice: profile.brand_voice || undefined,
        model: profile.subscription_status === "active"
          ? (profile.preferred_model || "gpt-4o-mini")
          : "gpt-4o-mini",
      });

      // Calculate scheduled_for time
      const scheduledFor = new Date(now);
      if (series.preferred_time) {
        const [hours, minutes] = series.preferred_time.split(":").map(Number);
        scheduledFor.setHours(hours, minutes, 0, 0);
      } else {
        scheduledFor.setHours(9, 0, 0, 0);
      }
      // If preferred time already passed today, keep today's date
      // The publish cron will pick it up next run

      // Save as scheduled post
      const { error: insertError } = await supabase
        .from("posts")
        .insert({
          user_id: series.user_id,
          platform: series.platform,
          topic: `[${series.name}] ${series.topic_template}`.slice(0, 200),
          content: result.content,
          hashtags: result.hashtags,
          tone: series.tone || "professional",
          status: "scheduled",
          scheduled_for: scheduledFor.toISOString(),
          content_score: result.content_score ? result.content_score * 10 : 0,
        });

      if (insertError) {
        captureError("Series cron: failed to insert post", insertError, { seriesId: series.id });
        continue;
      }

      // Update last_generated_at and increment generation count
      await supabase
        .from("content_series")
        .update({ last_generated_at: now.toISOString() })
        .eq("id", series.id);

      await supabase.rpc("increment_generation_count", {
        p_user_id: series.user_id,
        p_limit: limit,
      });

      generated++;
    } catch (err) {
      captureError("Series cron: generation error", err, { seriesId: series.id });
    }
  }

  return NextResponse.json({
    processed: seriesList.length,
    generated,
    skipped,
  });
}

/**
 * Determines if a series is due for generation based on frequency and last generation.
 */
function isDue(
  series: { frequency: string; day_of_week: number | null; last_generated_at: string | null },
  now: Date,
  todayDayOfWeek: number
): boolean {
  // Check day_of_week match (if specified)
  if (series.day_of_week !== null && series.day_of_week !== todayDayOfWeek) {
    // For daily frequency, ignore day_of_week
    if (series.frequency !== "daily") return false;
  }

  // If never generated, it's due
  if (!series.last_generated_at) return true;

  const lastGenerated = new Date(series.last_generated_at);
  const diffMs = now.getTime() - lastGenerated.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  switch (series.frequency) {
    case "daily":
      return diffDays >= 0.9; // ~22 hours to account for cron drift
    case "weekly":
      return diffDays >= 6.5;
    case "biweekly":
      return diffDays >= 13;
    case "monthly":
      return diffDays >= 28;
    default:
      return false;
  }
}
