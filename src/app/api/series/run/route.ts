import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/logger";
import { logAudit } from "@/lib/audit-log";
import { runSeriesOnce, type SeriesRow, type ProfileRow } from "@/lib/series-runner";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { success } = await rateLimit(user.id, "/api/series/run");
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const { id } = body as { id?: string };
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Missing series id" }, { status: 400 });
    }

    const { data: series, error: seriesError } = await supabase
      .from("content_series")
      .select("id, user_id, name, platform, tone, topic_template, preferred_time, website_url, website_context, website_scraped_at, post_type")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (seriesError || !series) {
      return NextResponse.json({ error: "Series not found" }, { status: 404 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("brand_voice, preferred_model, subscription_status, generation_count")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const result = await runSeriesOnce(
      supabase,
      series as SeriesRow,
      profile as ProfileRow
    );

    if (!result.ok) {
      const status =
        result.reason === "limit_reached"
          ? 403
          : result.reason === "generation_failed"
            ? 502
            : 500;
      return NextResponse.json(
        { error: result.reason, detail: result.detail },
        { status }
      );
    }

    await logAudit(user.id, "series.run_now", { seriesId: id, postId: result.postId });

    return NextResponse.json({ ok: true, postId: result.postId });
  } catch (error) {
    captureError("Series run error", error);
    return NextResponse.json({ error: "Failed to run series" }, { status: 500 });
  }
}
