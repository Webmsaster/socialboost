"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton, Skeleton } from "@/components/loading-skeleton";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";

interface Post {
  platform: string;
  status: string;
  tone: string;
  created_at: string;
}

interface PlatformStat {
  platform: string;
  count: number;
  percentage: number;
}

interface WeeklyStat {
  week: string;
  count: number;
}

interface InsightData {
  topPosts: Array<{
    id: string;
    platform: string;
    topic: string;
    content: string;
    tone: string;
    likes: number;
    shares: number;
    comments: number;
    impressions: number;
    contentScore: number;
  }>;
  platformRanking: Array<{ platform: string; avgScore: number }>;
  toneRanking: Array<{ tone: string; avgScore: number }>;
  dayRanking: Array<{ day: string; avgScore: number }>;
  topHashtags: Array<{ tag: string; avgScore: number; count: number }>;
  lengthAnalysis: Array<{ label: string; avgScore: number; count: number }>;
  totalAnalyzed: number;
}

interface MetricsSummary {
  totalPosts: number;
  totalLikes: number;
  totalShares: number;
  totalComments: number;
  totalImpressions: number;
  avgScore: number;
}

interface MetricsData {
  summary: MetricsSummary;
  byPlatform: Record<string, number>;
  recentPosts: Array<{
    id: string;
    platform: string;
    content: string;
    published_at: string;
    likes: number;
    shares: number;
    comments: number;
    impressions: number;
    content_score: number;
  }>;
}

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: "bg-blue-600",
  facebook: "bg-blue-500",
  instagram: "bg-pink-500",
  pinterest: "bg-red-500",
  twitter: "bg-sky-500",
};

export default function AnalyticsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const { t } = useLanguage();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      try {
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from("posts")
          .select("platform, status, tone, created_at")
          .gte("created_at", ninetyDaysAgo)
          .order("created_at", { ascending: false })
          .limit(1000);

        if (error) throw error;
        setPosts(data ?? []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load analytics";
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }

    async function loadMetrics() {
      try {
        const res = await fetch("/api/metrics");
        if (res.ok) {
          const data = await res.json();
          setMetrics(data);
        }
      } catch {
        // Metrics are non-critical, fail silently
      } finally {
        setMetricsLoading(false);
      }
    }

    async function loadInsights() {
      try {
        const res = await fetch("/api/insights");
        if (res.ok) {
          const data = await res.json();
          setInsights(data.insights);
        }
      } catch {
        // Insights are non-critical
      } finally {
        setInsightsLoading(false);
      }
    }

    load();
    loadMetrics();
    loadInsights();
  }, [supabase]);

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-9 w-40" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  const total = posts.length;
  const drafts = posts.filter((p) => p.status === "draft").length;
  const scheduled = posts.filter((p) => p.status === "scheduled").length;
  const published = posts.filter((p) => p.status === "published").length;

  // Platform breakdown
  const platformCounts = posts.reduce<Record<string, number>>((acc, p) => {
    acc[p.platform] = (acc[p.platform] || 0) + 1;
    return acc;
  }, {});
  const platformStats: PlatformStat[] = Object.entries(platformCounts)
    .map(([platform, count]) => ({
      platform,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Tone breakdown
  const toneCounts = posts.reduce<Record<string, number>>((acc, p) => {
    acc[p.tone] = (acc[p.tone] || 0) + 1;
    return acc;
  }, {});
  const toneStats = Object.entries(toneCounts)
    .map(([tone, count]) => ({ tone, count }))
    .sort((a, b) => b.count - a.count);

  // Weekly activity (last 8 weeks)
  const weeklyStats: WeeklyStat[] = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - i * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const count = posts.filter((p) => {
      const d = new Date(p.created_at);
      return d >= weekStart && d < weekEnd;
    }).length;

    weeklyStats.push({
      week: weekStart.toLocaleDateString("en", { month: "short", day: "numeric" }),
      count,
    });
  }
  const maxWeekly = Math.max(...weeklyStats.map((w) => w.count), 1);

  // Posts this month
  const thisMonth = posts.filter((p) => {
    const d = new Date(p.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  // Posts last month
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = posts.filter((p) => {
    const d = new Date(p.created_at);
    return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear();
  }).length;

  const monthChange = lastMonth > 0
    ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
    : thisMonth > 0 ? 100 : 0;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">{t("analytics.title")}</h1>

      {/* Overview Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("analytics.totalPosts")}</p>
            <p className="text-3xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("analytics.thisMonth")}</p>
            <p className="text-3xl font-bold">{thisMonth}</p>
            {monthChange !== 0 && (
              <p className={`text-xs mt-1 ${monthChange > 0 ? "text-green-600" : "text-red-500"}`}>
                {monthChange > 0 ? "+" : ""}{monthChange}% {t("analytics.vsLastMonth")}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("analytics.published")}</p>
            <p className="text-3xl font-bold">{published}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("analytics.platforms")}</p>
            <p className="text-3xl font-bold">{platformStats.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Platform Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>{t("analytics.byPlatform")}</CardTitle>
          </CardHeader>
          <CardContent>
            {platformStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("analytics.noData")}</p>
            ) : (
              <div className="space-y-4">
                {platformStats.map((stat) => (
                  <div key={stat.platform} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize font-medium">{stat.platform}</span>
                      <span className="text-muted-foreground">
                        {stat.count} ({stat.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full transition-all ${PLATFORM_COLORS[stat.platform] ?? "bg-primary"}`}
                        style={{ width: `${stat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tone Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>{t("analytics.byTone")}</CardTitle>
          </CardHeader>
          <CardContent>
            {toneStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("analytics.noData")}</p>
            ) : (
              <div className="space-y-3">
                {toneStats.map((stat) => (
                  <div key={stat.tone} className="flex items-center justify-between">
                    <Badge variant="secondary" className="capitalize">
                      {t(`tone.${stat.tone}`)}
                    </Badge>
                    <span className="text-sm font-medium">{stat.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weekly Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("analytics.weeklyActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-40">
              {weeklyStats.map((week) => (
                <div key={week.week} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-medium text-muted-foreground">{week.count}</span>
                  <div
                    className="w-full rounded-t bg-primary transition-all min-h-[4px]"
                    style={{ height: `${(week.count / maxWeekly) * 100}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                    {week.week}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("analytics.byStatus")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold">{drafts}</p>
                <p className="text-sm text-muted-foreground">{t("analytics.drafts")}</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold">{scheduled}</p>
                <p className="text-sm text-muted-foreground">{t("analytics.scheduled")}</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold">{published}</p>
                <p className="text-sm text-muted-foreground">{t("analytics.publishedCount")}</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold">
                  {posts.filter((p) => p.status === "failed").length}
                </p>
                <p className="text-sm text-muted-foreground">{t("analytics.failed")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Post Performance Metrics */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">{t("analytics.performance")}</h2>

        {metricsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-2 h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !metrics || metrics.summary.totalPosts === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t("analytics.noMetrics")}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">{t("analytics.totalLikes")}</p>
                  <p className="text-3xl font-bold">{metrics.summary.totalLikes.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">{t("analytics.totalShares")}</p>
                  <p className="text-3xl font-bold">{metrics.summary.totalShares.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">{t("analytics.totalComments")}</p>
                  <p className="text-3xl font-bold">{metrics.summary.totalComments.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">{t("analytics.totalImpressions")}</p>
                  <p className="text-3xl font-bold">{metrics.summary.totalImpressions.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">{t("analytics.avgScore")}</p>
                  <p className="text-3xl font-bold">{metrics.summary.avgScore}/100</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent published posts with metrics */}
            {metrics.recentPosts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("analytics.published")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {metrics.recentPosts.map((post) => (
                      <div key={post.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="capitalize">{post.platform}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(post.published_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm truncate">{post.content}</p>
                        </div>
                        <div className="flex items-center gap-4 ml-4 text-sm text-muted-foreground shrink-0">
                          <span title="Likes">{post.likes}</span>
                          <span title="Shares">{post.shares}</span>
                          <span title="Comments">{post.comments}</span>
                          <span title="Impressions">{post.impressions.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* AI Performance Insights */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">{t("analytics.insights")}</h2>

        {insightsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : !insights ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t("analytics.noInsights")}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Best Platform */}
              {insights.platformRanking.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("analytics.bestPlatform")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold capitalize">{insights.platformRanking[0].platform}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Avg. engagement score: {insights.platformRanking[0].avgScore}
                    </p>
                    <div className="mt-3 space-y-1">
                      {insights.platformRanking.map((p) => (
                        <div key={p.platform} className="flex items-center justify-between text-xs">
                          <span className="capitalize">{p.platform}</span>
                          <span className="text-muted-foreground">{p.avgScore}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Best Tone */}
              {insights.toneRanking.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("analytics.bestTone")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold capitalize">{insights.toneRanking[0].tone}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Avg. engagement score: {insights.toneRanking[0].avgScore}
                    </p>
                    <div className="mt-3 space-y-1">
                      {insights.toneRanking.map((t_) => (
                        <div key={t_.tone} className="flex items-center justify-between text-xs">
                          <span className="capitalize">{t_.tone}</span>
                          <span className="text-muted-foreground">{t_.avgScore}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Best Day */}
              {insights.dayRanking.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("analytics.bestDay")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{insights.dayRanking[0].day}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Avg. engagement score: {insights.dayRanking[0].avgScore}
                    </p>
                    <div className="mt-3 space-y-1">
                      {insights.dayRanking.map((d) => (
                        <div key={d.day} className="flex items-center justify-between text-xs">
                          <span>{d.day}</span>
                          <span className="text-muted-foreground">{d.avgScore}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Content Length Analysis */}
            {insights.lengthAnalysis.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("analytics.contentLength")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    {insights.lengthAnalysis.map((l) => (
                      <div key={l.label} className="rounded-lg border p-4 text-center">
                        <p className="text-sm font-medium capitalize">{l.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.label === "short" ? "<150 chars" : l.label === "medium" ? "150-500 chars" : "500+ chars"}
                        </p>
                        <p className="text-2xl font-bold mt-2">{l.avgScore}</p>
                        <p className="text-xs text-muted-foreground">avg score ({l.count} posts)</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Top Hashtags */}
            {insights.topHashtags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("analytics.topHashtags")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {insights.topHashtags.map((h) => (
                      <div key={h.tag} className="flex items-center gap-1.5 rounded-full border px-3 py-1.5">
                        <span className="text-sm font-medium">#{h.tag}</span>
                        <span className="text-xs text-muted-foreground">{h.avgScore} avg</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Top Posts */}
            {insights.topPosts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("analytics.topPosts")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {insights.topPosts.map((post, i) => (
                      <div key={post.id} className="flex items-start gap-3 rounded-lg border p-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          #{i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="capitalize text-xs">{post.platform}</Badge>
                            <Badge variant="outline" className="capitalize text-xs">{post.tone}</Badge>
                          </div>
                          <p className="text-sm truncate">{post.content}</p>
                          <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                            <span>{post.likes} likes</span>
                            <span>{post.shares} shares</span>
                            <span>{post.comments} comments</span>
                            <span>{post.impressions.toLocaleString()} views</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
