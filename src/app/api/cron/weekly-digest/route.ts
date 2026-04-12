import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWeeklyDigestEmail } from "@/lib/email";
import { captureError } from "@/lib/logger";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Weekly digest cron — sends a summary email to active users.
 * Run every Monday at 9 AM via Vercel Cron.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getAdmin();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Get all active users with their notification preferences
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, notification_preferences")
    .not("email", "like", "%@socialboost-test.com");

  if (profileError || !profiles) {
    captureError("Weekly digest: failed to fetch profiles", profileError);
    return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;

  // Batch-fetch all posts from the last 7 days across all users in a single
  // query, then group by user_id. Avoids N+1 (one query per profile).
  const eligibleUserIds = profiles
    .filter((p) => {
      const prefs = p.notification_preferences as Record<string, boolean> | null;
      return prefs?.digest !== false;
    })
    .map((p) => p.id);

  const postsByUser = new Map<
    string,
    Array<{ platform: string; status: string; created_at: string }>
  >();
  if (eligibleUserIds.length > 0) {
    const { data: allPosts } = await supabase
      .from("posts")
      .select("user_id, platform, status, created_at")
      .in("user_id", eligibleUserIds)
      .gte("created_at", sevenDaysAgo);
    for (const p of allPosts || []) {
      const bucket = postsByUser.get(p.user_id) || [];
      bucket.push({ platform: p.platform, status: p.status, created_at: p.created_at });
      postsByUser.set(p.user_id, bucket);
    }
  }

  for (const profile of profiles) {
    try {
      // Check if user opted out of digest emails
      const prefs = profile.notification_preferences as Record<string, boolean> | null;
      if (prefs?.digest === false) {
        skipped++;
        continue;
      }

      const posts = postsByUser.get(profile.id);

      if (!posts || posts.length === 0) {
        skipped++;
        continue;
      }

      const postsCreated = posts.length;
      const postsPublished = posts.filter((p) => p.status === "published").length;

      // Find top platform
      const platformCounts: Record<string, number> = {};
      for (const p of posts) {
        platformCounts[p.platform] = (platformCounts[p.platform] || 0) + 1;
      }
      const topPlatform = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

      // Calculate streak (simplified — check consecutive days with posts)
      const uniqueDays = [...new Set(posts.map((p) => new Date(p.created_at).toDateString()))];
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const check = new Date(today);
        check.setDate(today.getDate() - i);
        if (uniqueDays.includes(check.toDateString())) {
          streak++;
        } else if (i > 0) break;
      }

      const ok = await sendWeeklyDigestEmail(profile.email, {
        postsCreated,
        postsPublished,
        topPlatform,
        streak,
      });

      if (ok) sent++;
      else skipped++;
    } catch (err) {
      captureError("Weekly digest: send error", err, { userId: profile.id });
    }
  }

  return NextResponse.json({ sent, skipped, total: profiles.length });
}
