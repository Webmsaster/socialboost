import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  achievements,
  getUnlockedAchievements,
  getLockedAchievements,
  type UserStats,
} from "@/lib/achievements";
import { captureError } from "@/lib/logger";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Gather stats with count queries + a narrow streak window (last 60 days).
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const [totalRes, publishedRes, platformsRes, streakRes, seriesRes, membersRes, favRes] = await Promise.all([
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "published"),
      supabase.from("posts").select("platform").eq("user_id", user.id).limit(1000),
      supabase
        .from("posts")
        .select("created_at")
        .eq("user_id", user.id)
        .eq("status", "published")
        .gte("created_at", sixtyDaysAgo)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("content_series").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("org_members").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_favorite", true),
    ]);

    const totalPosts = totalRes.count || 0;
    const publishedPosts = publishedRes.count || 0;
    const platforms = new Set((platformsRes.data || []).map((p) => p.platform)).size;

    // Calculate streak from the last 60 days of published posts.
    const publishDates = [...new Set(
      (streakRes.data || []).map((p) => new Date(p.created_at).toDateString())
    )].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    let streak = 0;
    const today = new Date();
    for (let i = 0; i < publishDates.length; i++) {
      const expected = new Date(today);
      expected.setDate(today.getDate() - i);
      if (publishDates[i] === expected.toDateString()) {
        streak++;
      } else break;
    }

    const stats: UserStats = {
      totalPosts,
      publishedPosts,
      platforms,
      streak,
      seriesCount: seriesRes.count || 0,
      teamMembers: membersRes.count || 0,
      favoriteCount: favRes.count || 0,
    };

    const unlocked = getUnlockedAchievements(stats).map((a) => a.id);
    const locked = getLockedAchievements(stats).map((a) => a.id);

    return NextResponse.json({
      stats,
      unlocked,
      locked,
      total: achievements.length,
    });
  } catch (error) {
    captureError("Achievements error", error);
    return NextResponse.json({ error: "Failed to load achievements" }, { status: 500 });
  }
}
