import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { captureError } from "@/lib/logger";
import { requireCronAuth } from "@/lib/cron-auth";
import {
  runSeriesOnce,
  type ProfileRow,
  type SeriesRow,
} from "@/lib/series-runner";

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
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const supabase = getSupabaseAdmin();
  const now = new Date();
  const todayDayOfWeek = now.getDay();

  const { data: seriesList, error: fetchError } = await supabase
    .from("content_series")
    .select("*, profiles(brand_voice, preferred_model, subscription_status, generation_count, bonus_generations)")
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

  for (const row of seriesList) {
    try {
      const series = row as SeriesRow & {
        frequency: string;
        day_of_week: number | null;
        last_generated_at: string | null;
        profiles: ProfileRow | null;
      };

      if (!isDue(series, todayDayOfWeek)) {
        skipped++;
        continue;
      }

      const profile = series.profiles;
      if (!profile) {
        skipped++;
        continue;
      }

      const result = await runSeriesOnce(supabase, series, profile, now);
      if (result.ok) {
        generated++;
      } else {
        skipped++;
      }
    } catch (err) {
      captureError("Series cron: generation error", err, { seriesId: row.id });
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
  series: {
    frequency: string;
    day_of_week: number | null;
    last_generated_at: string | null;
  },
  todayDayOfWeek: number
): boolean {
  if (series.day_of_week !== null && series.day_of_week !== todayDayOfWeek) {
    if (series.frequency !== "daily") return false;
  }

  if (!series.last_generated_at) return true;

  const lastGenerated = new Date(series.last_generated_at);
  const diffMs = Date.now() - lastGenerated.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  switch (series.frequency) {
    case "daily":
      return diffDays >= 0.9;
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
