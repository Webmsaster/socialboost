import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { captureError } from "@/lib/logger";
import { getPublisher, ensureFreshToken } from "@/lib/platforms/registry";
import { decryptToken, encryptToken } from "@/lib/token-crypto";
import type { ConnectedAccount } from "@/lib/platforms";

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

  // Batch-load connected accounts for all posts in one query.
  const accountIds = Array.from(
    new Set(posts.map((p) => p.connected_account_id).filter(Boolean))
  ) as string[];
  const accountMap = new Map<string, ConnectedAccount>();
  if (accountIds.length > 0) {
    const { data: accounts } = await supabase
      .from("connected_accounts")
      .select("*")
      .in("id", accountIds);
    for (const a of (accounts || []) as ConnectedAccount[]) {
      // Tokens are encrypted at rest — decrypt before handing them to the
      // refresher / fetchMetrics, or the platform API gets a `gcm1:` ciphertext
      // Bearer, 401s, and every metric sync silently fails.
      // decryptToken THROWS on malformed ciphertext; isolate it per-account so
      // one corrupt token skips just that account (its posts fall through to the
      // `if (!account) { skipped++ }` branch below) instead of aborting the
      // whole batch-load and every metric sync in this run.
      try {
        a.access_token = decryptToken(a.access_token) ?? a.access_token;
        a.refresh_token = decryptToken(a.refresh_token);
        accountMap.set(a.id, a);
      } catch (err) {
        captureError("Cron: token decrypt failed", err, { accountId: a.id, platform: a.platform });
      }
    }
  }

  for (const post of posts) {
    try {
      const account = post.connected_account_id
        ? accountMap.get(post.connected_account_id)
        : undefined;

      if (!account) {
        skipped++;
        continue;
      }

      const publisher = getPublisher(account.platform);
      if (!publisher?.fetchMetrics) {
        skipped++;
        continue;
      }

      const { account: fresh, refreshed } = await ensureFreshToken(account);
      if (refreshed) {
        // Persist the refreshed token re-encrypted (this route never persisted
        // refreshes before, so it could not self-heal an expiring token).
        await supabase
          .from("connected_accounts")
          .update({
            access_token: encryptToken(fresh.access_token),
            refresh_token: encryptToken(fresh.refresh_token),
            token_expires_at: fresh.token_expires_at,
          })
          .eq("id", fresh.id);
      }
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
