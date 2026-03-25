"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";

interface Post {
  id: string;
  platform: string;
  topic: string;
  content: string;
  hashtags: string[];
  tone: string;
  status: string;
  created_at: string;
}

type FilterStatus = "all" | "draft" | "scheduled" | "published";

export default function HistoryPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const { t } = useLanguage();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      let query = supabase.from("posts").select("*").order("created_at", { ascending: false });
      if (filter !== "all") {
        query = query.eq("status", filter);
      }
      const { data } = await query;
      if (data) setPosts(data);
    }
    load();
  }, [supabase, filter]);

  async function handleDelete(id: string) {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
    } else {
      setPosts((prev) => prev.filter((p) => p.id !== id));
    }
  }

  const filters: FilterStatus[] = ["all", "draft", "scheduled", "published"];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">{t("history.title")}</h1>

      <div className="flex gap-2">
        {filters.map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {t(`history.filter.${f === "all" ? "all" : f + "s"}`)}
          </Button>
        ))}
      </div>

      {posts.length === 0 ? (
        <p className="text-muted-foreground">{t("history.empty")}</p>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{post.platform}</Badge>
                    <Badge variant="outline">{post.tone}</Badge>
                    <Badge variant={post.status === "published" ? "default" : "outline"}>
                      {post.status}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(post.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm font-medium">{post.topic}</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                  {post.content}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(post.content);
                      toast.success("Copied!");
                    }}
                  >
                    Copy
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(post.id)}>
                    {t("history.delete")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
