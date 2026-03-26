"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/lib/i18n";
import { Onboarding } from "@/components/onboarding";
import { toast } from "sonner";

interface Post {
  id: string;
  platform: string;
  topic: string;
  content: string;
  status: string;
  created_at: string;
}

interface Profile {
  generation_count: number;
  subscription_status: string;
}

export default function DashboardPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();
  const supabase = createClient();

  const [allPosts, setAllPosts] = useState<Pick<Post, "platform" | "status" | "created_at">[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [postsRes, allPostsRes, profileRes] = await Promise.all([
          supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(5),
          supabase.from("posts").select("platform, status, created_at"),
          supabase.from("profiles").select("generation_count, subscription_status").eq("id", user.id).single(),
        ]);

        if (postsRes.error) throw postsRes.error;
        if (profileRes.error) throw profileRes.error;

        if (postsRes.data) setPosts(postsRes.data);
        if (allPostsRes.data) setAllPosts(allPostsRes.data);
        if (profileRes.data) setProfile(profileRes.data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load dashboard";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [supabase]);

  const limit = profile?.subscription_status === "active" ? 100 : 10;

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-destructive font-medium">{error}</p>
            <Button onClick={() => window.location.reload()}>Try again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="mt-2 h-2 w-full rounded-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
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

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Posts</p>
            <p className="text-3xl font-bold">{allPosts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Drafts</p>
            <p className="text-3xl font-bold">{allPosts.filter((p) => p.status === "draft").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Scheduled</p>
            <p className="text-3xl font-bold">{allPosts.filter((p) => p.status === "scheduled").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Platforms</p>
            <p className="text-3xl font-bold">{new Set(allPosts.map((p) => p.platform)).size}</p>
          </CardContent>
        </Card>
      </div>

      {profile && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("dashboard.usage")}</span>
              <span className="text-sm font-medium">
                {profile.generation_count} {t("dashboard.of")} {limit} {t("dashboard.generations")}
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${Math.min((profile.generation_count / limit) * 100, 100)}%` }}
              />
            </div>
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
