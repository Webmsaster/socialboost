import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/logger";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get published posts with metrics
    const { data: posts } = await supabase
      .from("posts")
      .select("id, platform, content, published_at, likes, shares, comments, impressions, content_score")
      .eq("user_id", user.id)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(50);

    const totalPosts = posts?.length || 0;
    const totalLikes = posts?.reduce((sum, p) => sum + (p.likes || 0), 0) || 0;
    const totalShares = posts?.reduce((sum, p) => sum + (p.shares || 0), 0) || 0;
    const totalComments = posts?.reduce((sum, p) => sum + (p.comments || 0), 0) || 0;
    const totalImpressions = posts?.reduce((sum, p) => sum + (p.impressions || 0), 0) || 0;
    const avgScore = totalPosts > 0
      ? Math.round((posts?.reduce((sum, p) => sum + (p.content_score || 0), 0) || 0) / totalPosts)
      : 0;

    // Platform breakdown
    const byPlatform: Record<string, number> = {};
    posts?.forEach((p) => { byPlatform[p.platform] = (byPlatform[p.platform] || 0) + 1; });

    return NextResponse.json(
      {
        summary: { totalPosts, totalLikes, totalShares, totalComments, totalImpressions, avgScore },
        byPlatform,
        recentPosts: posts?.slice(0, 10) || [],
      },
      {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    captureError("Metrics fetch error", error);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}
