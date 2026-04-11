"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/loading-skeleton";
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

const POSTS_PER_PAGE = 10;

export default function HistoryPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();
  const router = useRouter();
  const supabase = createClient();

  const filteredPosts = useMemo(() => {
    if (!search.trim()) return posts;
    const q = search.toLowerCase();
    return posts.filter(
      (p) =>
        p.topic.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.platform.toLowerCase().includes(q)
    );
  }, [posts, search]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / POSTS_PER_PAGE));
  const paginatedPosts = filteredPosts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);

  // Reset page when filter or search changes
  useEffect(() => { setPage(1); }, [filter, search]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        let query = supabase.from("posts").select("*").order("created_at", { ascending: false });
        if (filter !== "all") {
          query = query.eq("status", filter);
        }
        const { data, error } = await query;
        if (error) throw error;
        if (data) setPosts(data);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load posts");
      } finally {
        setLoading(false);
      }
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

  async function handleDuplicate(post: Post) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      return;
    }
    const { data, error } = await supabase
      .from("posts")
      .insert({
        user_id: user.id,
        platform: post.platform,
        topic: post.topic,
        content: post.content,
        hashtags: post.hashtags,
        tone: post.tone,
        status: "draft",
      })
      .select()
      .single();
    if (error || !data) {
      toast.error("Failed to duplicate");
      return;
    }
    setPosts((prev) => [data as Post, ...prev]);
    toast.success("Duplicated as draft");
  }

  function exportAsCSV() {
    if (posts.length === 0) return;
    const headers = ["Platform", "Topic", "Tone", "Status", "Content", "Hashtags", "Created"];
    const rows = posts.map((p) => [
      p.platform,
      `"${p.topic.replace(/"/g, '""')}"`,
      p.tone,
      p.status,
      `"${p.content.replace(/"/g, '""')}"`,
      `"${(p.hashtags ?? []).join(", ")}"`,
      new Date(p.created_at).toLocaleDateString(),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `socialboost-posts-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Posts exported as CSV");
  }

  function exportAsText() {
    if (posts.length === 0) return;
    const text = posts
      .map(
        (p) =>
          `[${p.platform.toUpperCase()}] ${p.topic}\nTone: ${p.tone} | Status: ${p.status}\n\n${p.content}${
            p.hashtags?.length ? "\n\n" + p.hashtags.map((h) => `#${h}`).join(" ") : ""
          }\n${"—".repeat(40)}`
      )
      .join("\n\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `socialboost-posts-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Posts exported as text");
  }

  const filters: FilterStatus[] = ["all", "draft", "scheduled", "published"];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("history.title")}</h1>
        {posts.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportAsCSV}>
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportAsText}>
              Export TXT
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex gap-2">
          {filters.map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {t(`history.filter.${f === "draft" ? "drafts" : f}`)}
            </Button>
          ))}
        </div>
        <Input
          placeholder="Search posts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:ml-auto sm:max-w-xs"
        />
      </div>

      {loading ? (
        <TableSkeleton rows={6} />
      ) : filteredPosts.length === 0 ? (
        <p className="text-muted-foreground">
          {search ? "No posts matching your search." : t("history.empty")}
        </p>
      ) : (
        <div className="space-y-4">
          {paginatedPosts.map((post) => (
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDuplicate(post)}
                  >
                    Duplicate
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/repurpose?postId=${post.id}`)}
                  >
                    Repurpose
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(post.id)}>
                    {t("history.delete")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                {filteredPosts.length} post{filteredPosts.length !== 1 ? "s" : ""} total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
