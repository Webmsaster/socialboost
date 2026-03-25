"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n";

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
  const { t } = useLanguage();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [postsRes, profileRes] = await Promise.all([
        supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(5),
        supabase.from("profiles").select("generation_count, subscription_status").eq("id", user.id).single(),
      ]);

      if (postsRes.data) setPosts(postsRes.data);
      if (profileRes.data) setProfile(profileRes.data);
    }
    load();
  }, [supabase]);

  const limit = profile?.subscription_status === "active" ? 100 : 10;

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
