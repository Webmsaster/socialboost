import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/logger";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get published posts with metrics, sorted by engagement score. Scope to the
    // caller explicitly (don't rely on RLS alone): /api/metrics does the same, and
    // without it a future RLS change (e.g. the public-share feature) could leak
    // other users' top-performing content into this user's analytics. It also lets
    // the query use a per-user index instead of scanning the whole table.
    const { data: posts, error } = await supabase
      .from("posts")
      .select("id, platform, topic, content, tone, hashtags, likes, shares, comments, impressions, content_score, created_at")
      .eq("user_id", user.id)
      .eq("status", "published")
      .order("content_score", { ascending: false })
      .limit(20);

    if (error) {
      captureError("Insights fetch error", error);
      return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({ insights: null, message: "Not enough data" });
    }

    // Compute insights locally (no OpenAI needed — deterministic analysis)
    const topPosts = posts.slice(0, 5);
    const allPosts = posts;

    // Best platform
    const platformEngagement: Record<string, { total: number; count: number }> = {};
    for (const p of allPosts) {
      const score = (p.likes || 0) + (p.shares || 0) * 2 + (p.comments || 0) * 3;
      if (!platformEngagement[p.platform]) platformEngagement[p.platform] = { total: 0, count: 0 };
      platformEngagement[p.platform].total += score;
      platformEngagement[p.platform].count += 1;
    }

    const platformRanking = Object.entries(platformEngagement)
      .map(([platform, data]) => ({ platform, avgScore: data.count > 0 ? Math.round(data.total / data.count) : 0 }))
      .sort((a, b) => b.avgScore - a.avgScore);

    // Best tone
    const toneEngagement: Record<string, { total: number; count: number }> = {};
    for (const p of allPosts) {
      const score = (p.likes || 0) + (p.shares || 0) * 2 + (p.comments || 0) * 3;
      if (!toneEngagement[p.tone]) toneEngagement[p.tone] = { total: 0, count: 0 };
      toneEngagement[p.tone].total += score;
      toneEngagement[p.tone].count += 1;
    }

    const toneRanking = Object.entries(toneEngagement)
      .map(([tone, data]) => ({ tone, avgScore: data.count > 0 ? Math.round(data.total / data.count) : 0 }))
      .sort((a, b) => b.avgScore - a.avgScore);

    // Best posting day
    const dayEngagement: Record<string, { total: number; count: number }> = {};
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    for (const p of allPosts) {
      const dayName = dayNames[new Date(p.created_at).getDay()];
      const score = (p.likes || 0) + (p.shares || 0) * 2 + (p.comments || 0) * 3;
      if (!dayEngagement[dayName]) dayEngagement[dayName] = { total: 0, count: 0 };
      dayEngagement[dayName].total += score;
      dayEngagement[dayName].count += 1;
    }

    const dayRanking = Object.entries(dayEngagement)
      .map(([day, data]) => ({ day, avgScore: data.count > 0 ? Math.round(data.total / data.count) : 0 }))
      .sort((a, b) => b.avgScore - a.avgScore);

    // Top hashtags
    const hashtagEngagement: Record<string, { total: number; count: number }> = {};
    for (const p of allPosts) {
      const score = (p.likes || 0) + (p.shares || 0) * 2 + (p.comments || 0) * 3;
      for (const tag of (p.hashtags || [])) {
        if (!hashtagEngagement[tag]) hashtagEngagement[tag] = { total: 0, count: 0 };
        hashtagEngagement[tag].total += score;
        hashtagEngagement[tag].count += 1;
      }
    }

    const topHashtags = Object.entries(hashtagEngagement)
      .map(([tag, data]) => ({ tag, avgScore: data.count > 0 ? Math.round(data.total / data.count) : 0, count: data.count }))
      .filter((h) => h.count >= 2)
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 10);

    // Content length analysis
    const lengthBuckets: Record<string, { total: number; count: number }> = {
      short: { total: 0, count: 0 },
      medium: { total: 0, count: 0 },
      long: { total: 0, count: 0 },
    };

    for (const p of allPosts) {
      const len = (p.content || "").length;
      const score = (p.likes || 0) + (p.shares || 0) * 2 + (p.comments || 0) * 3;
      const bucket = len < 150 ? "short" : len < 500 ? "medium" : "long";
      lengthBuckets[bucket].total += score;
      lengthBuckets[bucket].count += 1;
    }

    const lengthAnalysis = Object.entries(lengthBuckets)
      .map(([label, data]) => ({ label, avgScore: data.count > 0 ? Math.round(data.total / data.count) : 0, count: data.count }))
      .filter((l) => l.count > 0);

    return NextResponse.json(
      {
        insights: {
          topPosts: topPosts.map((p) => ({
            id: p.id,
            platform: p.platform,
            topic: p.topic,
            content: p.content?.slice(0, 200),
            tone: p.tone,
            likes: p.likes || 0,
            shares: p.shares || 0,
            comments: p.comments || 0,
            impressions: p.impressions || 0,
            contentScore: p.content_score || 0,
          })),
          platformRanking,
          toneRanking,
          dayRanking: dayRanking.slice(0, 3),
          topHashtags,
          lengthAnalysis,
          totalAnalyzed: allPosts.length,
        },
      },
      {
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    captureError("Insights error", error);
    return NextResponse.json({ error: "Failed to generate insights" }, { status: 500 });
  }
}
