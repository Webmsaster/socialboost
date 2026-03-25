"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n";

interface ScheduledPost {
  id: string;
  platform: string;
  topic: string;
  content: string;
  scheduled_for: string;
  status: string;
}

export default function CalendarPage() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const { t } = useLanguage();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("posts")
        .select("*")
        .eq("status", "scheduled")
        .order("scheduled_for", { ascending: true });
      if (data) setPosts(data);
    }
    load();
  }, [supabase]);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">{t("calendar.title")}</h1>

      {posts.length === 0 ? (
        <p className="text-muted-foreground">{t("calendar.empty")}</p>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{post.platform}</Badge>
                    <span className="text-sm">{post.topic}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {t("calendar.scheduledFor")}{" "}
                    {new Date(post.scheduled_for).toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                  {post.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
