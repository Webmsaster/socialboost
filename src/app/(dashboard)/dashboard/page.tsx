"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { useLanguage } from "@/lib/i18n";
import { Onboarding } from "@/components/onboarding";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { achievements } from "@/lib/achievements";
import { toast } from "sonner";

interface Post {
  id: string;
  platform: string;
  topic: string;
  status: string;
}

interface Profile {
  generation_count: number;
  video_generation_count: number;
  subscription_status: string;
}

export default function DashboardPage() {
  const { t } = useLanguage();
  const supabase = createClient();

  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  const { data, error, isLoading } = useSWR("dashboard:init", async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const [postsRes, allPostsRes, profileRes] = await Promise.all([
      supabase
        .from("posts")
        .select("id, platform, topic, status")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("posts")
        .select("platform, status, created_at, scheduled_for")
        .gte("created_at", ninetyDaysAgo)
        .limit(500),
      supabase.from("profiles").select("generation_count, video_generation_count, subscription_status").eq("id", user.id).single(),
    ]);

    if (postsRes.error) throw postsRes.error;
    if (profileRes.error) throw profileRes.error;

    return {
      posts: (postsRes.data || []) as Post[],
      allPosts: (allPostsRes.data || []) as Array<{
        platform: string;
        status: string;
        created_at: string;
        scheduled_for?: string;
      }>,
      profile: profileRes.data as Profile | null,
    };
  });

  const { data: achievementsData } = useSWR("dashboard:achievements", async () => {
    const r = await fetch("/api/achievements");
    if (!r.ok) return null;
    return r.json() as Promise<{ unlocked: string[] }>;
  });

  useEffect(() => {
    if (error) {
      const msg = error instanceof Error ? error.message : "Failed to load dashboard";
      toast.error(msg);
    }
  }, [error]);

  const showOnboarding =
    !onboardingDismissed &&
    data?.profile?.generation_count === 0 &&
    typeof window !== "undefined" &&
    !localStorage.getItem("onboarding_done");

  const posts = data?.posts || [];
  const allPosts = data?.allPosts || [];
  const profile = data?.profile || null;
  const unlockedBadges = achievementsData?.unlocked || [];
  const loading = isLoading;
  const errorMessage = error ? (error instanceof Error ? error.message : "Failed to load dashboard") : null;

  const limit = profile?.subscription_status === "active" ? 100 : 10;

  if (errorMessage) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-destructive font-medium">{errorMessage}</p>
            <Button onClick={() => window.location.reload()}>{t("dashboard.tryAgain")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      {showOnboarding && (
        <OnboardingWizard
          onComplete={() => {
            setOnboardingDismissed(true);
            localStorage.setItem("onboarding_done", "1");
          }}
        />
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("dashboard.title")}</h1>
          <p className="text-muted-foreground">{t("dashboard.welcome")}</p>
        </div>
        <Button asChild>
          <Link href="/create">{t("dashboard.quickAction")}</Link>
        </Button>
      </div>

      {/* Onboarding for new users */}
      {allPosts.length === 0 && <Onboarding />}

      {/* Quick Actions */}
      {allPosts.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Button variant="outline" asChild className="justify-start gap-2 h-auto py-3">
            <Link href="/repurpose">
              <span className="text-left">
                <span className="block text-sm font-medium">{t("dashboard.quickRepurpose")}</span>
                <span className="block text-xs text-muted-foreground">{t("dashboard.quickRepurposeDesc")}</span>
              </span>
            </Link>
          </Button>
          <Button variant="outline" asChild className="justify-start gap-2 h-auto py-3">
            <Link href="/series">
              <span className="text-left">
                <span className="block text-sm font-medium">{t("dashboard.quickSeries")}</span>
                <span className="block text-xs text-muted-foreground">{t("dashboard.quickSeriesDesc")}</span>
              </span>
            </Link>
          </Button>
          <Button variant="outline" asChild className="justify-start gap-2 h-auto py-3">
            <Link href="/bulk">
              <span className="text-left">
                <span className="block text-sm font-medium">{t("dashboard.quickBulk")}</span>
                <span className="block text-xs text-muted-foreground">{t("dashboard.quickBulkDesc")}</span>
              </span>
            </Link>
          </Button>
          <Button variant="outline" asChild className="justify-start gap-2 h-auto py-3">
            <Link href="/analytics">
              <span className="text-left">
                <span className="block text-sm font-medium">{t("dashboard.quickAnalytics")}</span>
                <span className="block text-xs text-muted-foreground">{t("dashboard.quickAnalyticsDesc")}</span>
              </span>
            </Link>
          </Button>
        </div>
      )}

      {/* Achievements */}
      {unlockedBadges.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("dashboard.achievements")} ({unlockedBadges.length}/{achievements.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {achievements.map((a) => {
                const unlocked = unlockedBadges.includes(a.id);
                return (
                  <div
                    key={a.id}
                    title={unlocked ? `${a.title}: ${a.description}` : a.description}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                      unlocked ? "bg-primary/5 border-primary/20" : "opacity-30"
                    }`}
                  >
                    <span>{a.icon}</span>
                    <span className="font-medium">{a.title}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("dashboard.totalPosts")}</p>
            <p className="text-3xl font-bold">{allPosts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("dashboard.drafts")}</p>
            <p className="text-3xl font-bold">{allPosts.filter((p) => p.status === "draft").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("dashboard.scheduled")}</p>
            <p className="text-3xl font-bold">{allPosts.filter((p) => p.status === "scheduled").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("dashboard.platforms")}</p>
            <p className="text-3xl font-bold">{new Set(allPosts.map((p) => p.platform)).size}</p>
          </CardContent>
        </Card>
      </div>

      {/* Streak & Next Post Widgets */}
      {allPosts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t("dashboard.streak")}</p>
              <p className="text-3xl font-bold">
                {(() => {
                  const published = allPosts
                    .filter((p) => p.status === "published")
                    .map((p) => new Date(p.created_at).toDateString());
                  const uniqueDays = [...new Set(published)].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
                  let streak = 0;
                  const today = new Date();
                  for (let i = 0; i < uniqueDays.length; i++) {
                    const expected = new Date(today);
                    expected.setDate(today.getDate() - i);
                    if (uniqueDays[i] === expected.toDateString()) {
                      streak++;
                    } else break;
                  }
                  return streak;
                })()}
                <span className="text-lg font-normal text-muted-foreground"> {t("dashboard.days")}</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{t("dashboard.nextPost")}</p>
              {(() => {
                const next = allPosts
                  .filter((p) => p.status === "scheduled" && p.scheduled_for)
                  .sort((a, b) => new Date(a.scheduled_for!).getTime() - new Date(b.scheduled_for!).getTime())[0];
                if (!next) return <p className="text-sm text-muted-foreground mt-1">{t("dashboard.noScheduled")}</p>;
                const date = new Date(next.scheduled_for!);
                return (
                  <div className="mt-1">
                    <p className="text-lg font-bold">{next.platform}</p>
                    <p className="text-sm text-muted-foreground">
                      {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {profile && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("dashboard.usage")}</span>
                <span className="text-sm font-medium">
                  {limit - profile.generation_count} {t("dashboard.remaining")} ({profile.generation_count}/{limit})
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min((profile.generation_count / limit) * 100, 100)}%` }}
                />
              </div>
            </div>
            {profile.subscription_status === "active" && (
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Video renders</span>
                  <span className="text-sm font-medium">
                    {Math.max(0, 5 - (profile.video_generation_count ?? 0))} of 5 left this month
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-amber-500 transition-all"
                    style={{ width: `${Math.min(((profile.video_generation_count ?? 0) / 5) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.recentPosts")}</CardTitle>
        </CardHeader>
        <CardContent>
          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dashboard.noPosts")}</p>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <div key={post.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="secondary">{post.platform}</Badge>
                    <span className="text-sm truncate">{post.topic}</span>
                  </div>
                  <Badge variant={post.status === "published" ? "default" : "outline"}>
                    {post.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
