import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { captureError } from "@/lib/logger";
import { getPublisher, ensureFreshToken } from "@/lib/platforms/registry";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Syncs engagement metrics (likes, shares, comments, impressions) from
 * platform APIs into the posts table. Runs on a cron schedule.
 * Secured via CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Fetch recently published posts with platform IDs (last 14 days)
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, platform, platform_post_id, connected_account_id, published_at")
    .eq("status", "published")
    .not("platform_post_id", "is", null)
    .not("connected_account_id", "is", null)
    .gte("published_at", cutoff)
    .order("published_at", { ascending: false })
    .limit(100);

  if (error) {
    captureError("Cron: failed to fetch posts for metrics sync", error);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }

  if (!posts || posts.length === 0) {
    return NextResponse.json({ synced: 0 });
  }

  let synced = 0;
  let skipped = 0;

  for (const post of posts) {
    try {
      const { data: account } = await supabase
        .from("connected_accounts")
        .select("*")
        .eq("id", post.connected_account_id)
        .single();

      if (!account) {
        skipped++;
        continue;
      }

      const publisher = getPublisher(account.platform);
      if (!publisher?.fetchMetrics) {
        skipped++;
        continue;
      }

      const { account: fresh } = await ensureFreshToken(account);
      const metrics = await publisher.fetchMetrics(fresh, post.platform_post_id!);
      if (!metrics) {
        skipped++;
        continue;
      }

      await supabase
        .from("posts")
        .update({
          likes: metrics.likes,
          shares: metrics.shares,
          comments: metrics.comments,
          impressions: metrics.impressions,
        })
        .eq("id", post.id);
      synced++;
    } catch (err) {
      captureError("Cron: metric sync failed", err, { postId: post.id });
      skipped++;
    }
  }

  return NextResponse.json({ processed: posts.length, synced, skipped });
}
