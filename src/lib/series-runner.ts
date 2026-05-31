import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generatePost,
  generateVideoScript,
  type Platform,
  type Tone,
} from "./openai";
import {
  scrapeWebsite,
  buildPromptBlockFromContext,
  type WebsiteContext,
} from "./website-scraper";
import { captureError } from "./logger";
import { scoreContent } from "./content-score";
import { isProSubscription, textQuotaFor } from "./subscription";

export type SeriesRow = {
  id: string;
  user_id: string;
  name: string;
  platform: string;
  tone: string | null;
  topic_template: string;
  preferred_time: string | null;
  website_url: string | null;
  website_context: WebsiteContext | null;
  website_scraped_at: string | null;
  post_type?: string | null;
};

export type ProfileRow = {
  brand_voice: string | null;
  preferred_model: string | null;
  subscription_status: string;
  generation_count: number;
  bonus_generations?: number | null;
};

export type SeriesRunResult =
  | { ok: true; postId: string }
  | { ok: false; reason: "limit_reached" | "generation_failed" | "insert_failed"; detail?: string };

/**
 * Generate + persist one post for the given series. Shared between the cron
 * scheduler and the on-demand "Run now" endpoint so the logic stays in sync.
 *
 * Caller is responsible for auth/ownership checks. Supabase client must have
 * permission to write to `posts` and `content_series` for this user.
 */
export async function runSeriesOnce(
  supabase: SupabaseClient,
  series: SeriesRow,
  profile: ProfileRow,
  now: Date = new Date()
): Promise<SeriesRunResult> {
  const limit = textQuotaFor(profile.subscription_status) + (profile.bonus_generations ?? 0);
  if (profile.generation_count >= limit) {
    return { ok: false, reason: "limit_reached" };
  }

  let websiteContext: WebsiteContext | null = series.website_context ?? null;
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

  const model = isProSubscription(profile.subscription_status)
    ? profile.preferred_model || "gpt-4o-mini"
    : "gpt-4o-mini";
  const postType = series.post_type === "video" ? "video" : "text";

  // For text series we generate a single post; for video series we produce a
  // full video script and serialize it into content so the user can review it
  // in History and optionally generate assets on top of it from the Create
  // page later. Asset generation in cron is deliberately out of scope — it
  // would burn 5–7 credits per run.
  let content: string;
  let hashtags: string[] = [];

  try {
    if (postType === "video") {
      const script = await generateVideoScript({
        platform: series.platform as Platform,
        topic,
        tone: (series.tone || "professional") as Tone,
        language: "English",
        brandVoice: profile.brand_voice || undefined,
        model,
      });
      content = formatVideoScript(script);
    } else {
      const result = await generatePost({
        platform: series.platform as Platform,
        topic,
        tone: (series.tone || "professional") as Tone,
        language: "English",
        brandVoice: profile.brand_voice || undefined,
        model,
      });
      content = result.content;
      hashtags = result.hashtags;
    }
  } catch (err) {
    captureError("Series runner: generation failed", err, { seriesId: series.id });
    return {
      ok: false,
      reason: "generation_failed",
      detail: err instanceof Error ? err.message : "unknown",
    };
  }

  const scheduledFor = new Date(now);
  // Guard against a malformed preferred_time (e.g. "", "9", "9am"): an unparsed
  // value yields NaN → Invalid Date → toISOString() throws AFTER the (paid)
  // generation already ran. Fall back to 09:00 on any non-HH:MM value.
  const [ph, pm] = (series.preferred_time ?? "").split(":").map(Number);
  if (Number.isFinite(ph) && Number.isFinite(pm)) {
    scheduledFor.setHours(ph, pm, 0, 0);
  } else {
    scheduledFor.setHours(9, 0, 0, 0);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("posts")
    .insert({
      user_id: series.user_id,
      platform: series.platform,
      topic: `[${series.name}] ${series.topic_template}`.slice(0, 200),
      content,
      hashtags,
      tone: series.tone || "professional",
      status: "scheduled",
      scheduled_for: scheduledFor.toISOString(),
      // Match what the Create UI stores: deterministic 0-100 score from the
      // shared scoreContent() helper, not OpenAI's self-rated 1-10 scaled up.
      content_score: scoreContent({
        content,
        platform: series.platform,
        hashtags,
      }).score,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    captureError("Series runner: insert failed", insertError, { seriesId: series.id });
    return {
      ok: false,
      reason: "insert_failed",
      detail: insertError?.message,
    };
  }

  await supabase
    .from("content_series")
    .update({ last_generated_at: now.toISOString() })
    .eq("id", series.id);

  await supabase.rpc("increment_generation_count", {
    p_user_id: series.user_id,
    p_limit: limit,
  });

  return { ok: true, postId: inserted.id };
}

interface VideoScriptShape {
  hook: string;
  scenes: Array<{
    sceneNumber: number;
    duration: string;
    visual: string;
    narration: string;
    textOverlay: string;
  }>;
  cta: string;
  totalDuration: string;
  musicSuggestion: string;
}

function formatVideoScript(script: VideoScriptShape): string {
  const lines: string[] = [
    `🎬 VIDEO SCRIPT (${script.totalDuration})`,
    "",
    `HOOK: ${script.hook}`,
    "",
  ];
  for (const scene of script.scenes) {
    lines.push(`— Scene ${scene.sceneNumber} (${scene.duration})`);
    lines.push(`  Visual: ${scene.visual}`);
    lines.push(`  Narration: ${scene.narration}`);
    lines.push(`  Overlay: ${scene.textOverlay}`);
    lines.push("");
  }
  lines.push(`CTA: ${script.cta}`);
  lines.push(`Music: ${script.musicSuggestion}`);
  return lines.join("\n");
}
