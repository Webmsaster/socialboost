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

    // Gather stats
    const [postsRes, seriesRes, membersRes, favRes] = await Promise.all([
      supabase.from("posts").select("platform, status, created_at, is_favorite").eq("user_id", user.id),
      supabase.from("content_series").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("org_members").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_favorite", true),
    ]);

    const posts = postsRes.data || [];
    const totalPosts = posts.length;
    const publishedPosts = posts.filter((p) => p.status === "published").length;
    const platforms = new Set(posts.map((p) => p.platform)).size;

    // Calculate streak
    const publishDates = [...new Set(
      posts.filter((p) => p.status === "published")
        .map((p) => new Date(p.created_at).toDateString())
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
