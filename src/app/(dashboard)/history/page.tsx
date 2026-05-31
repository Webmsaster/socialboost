"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  is_favorite: boolean;
  created_at: string;
  published_at?: string | null;
}

type FilterStatus = "all" | "draft" | "pending_review" | "approved" | "scheduled" | "published";

const POSTS_PER_PAGE = 10;

const URL_ALL = "__all__";

function isUrl(topic: string): boolean {
  return /^https?:\/\//i.test(topic);
}

function shortUrl(u: string): string {
  try {
    const parsed = new URL(u);
    const tail = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.host}${tail}`.replace(/\/$/, "");
  } catch {
    return u;
  }
}

export default function HistoryPage() {
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [websiteFilter, setWebsiteFilter] = useState<string>(URL_ALL);
  // Platform + date-range filters. "all" means no constraint; we store the
  // platform as a single value (not multi) because the existing tab UI is
  // already a single-select pattern and a multi-select would over-complicate.
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  // Captured once on mount via useState's lazy initializer — keeps the render
  // path pure (React's purity lint rule rejects bare Date.now() inline).
  const [nowMs] = useState<number>(() => Date.now());
  const { t } = useLanguage();
  const router = useRouter();
  const supabase = createClient();

  const { data: fetchedPosts, isLoading: loading, error: fetchError, mutate } = useSWR(
    ["history:posts", filter],
    async () => {
      let query = supabase
        .from("posts")
        .select("id, platform, topic, content, hashtags, tone, status, is_favorite, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter !== "all") {
        query = query.eq("status", filter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Post[];
    },
  );

  useEffect(() => {
    if (fetchError) {
      toast.error(fetchError instanceof Error ? fetchError.message : "Failed to load posts");
    }
  }, [fetchError]);

  const posts = useMemo(() => fetchedPosts ?? [], [fetchedPosts]);

  const updatePosts = (updater: (prev: Post[]) => Post[]) => {
    mutate((prev) => updater(prev ?? []), { revalidate: false });
  };

  const websiteOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of posts) {
      if (isUrl(p.topic)) {
        counts.set(p.topic, (counts.get(p.topic) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([url, count]) => ({ url, count }))
      .sort((a, b) => b.count - a.count);
  }, [posts]);

  const filteredPosts = useMemo(() => {
    let result = posts;
    if (showFavoritesOnly) {
      result = result.filter((p) => p.is_favorite);
    }
    if (websiteFilter !== URL_ALL) {
      result = result.filter((p) => p.topic === websiteFilter);
    }
    if (platformFilter !== "all") {
      result = result.filter((p) => p.platform === platformFilter);
    }
    if (dateRangeFilter !== "all") {
      const days =
        dateRangeFilter === "7d"
          ? 7
          : dateRangeFilter === "30d"
          ? 30
          : dateRangeFilter === "90d"
          ? 90
          : null;
      if (days !== null) {
        const cutoff = nowMs - days * 24 * 60 * 60 * 1000;
        result = result.filter((p) => new Date(p.created_at).getTime() >= cutoff);
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.topic.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          p.platform.toLowerCase().includes(q),
      );
    }
    return result;
  }, [posts, search, showFavoritesOnly, websiteFilter, platformFilter, dateRangeFilter, nowMs]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / POSTS_PER_PAGE));
  // Clamp the page instead of resetting via an effect — pure derivation avoids cascading renders.
  const effectivePage = Math.min(page, totalPages);
  const paginatedPosts = filteredPosts.slice(
    (effectivePage - 1) * POSTS_PER_PAGE,
    effectivePage * POSTS_PER_PAGE,
  );

  async function handleDelete(id: string) {
    const deleted = posts.find((p) => p.id === id);
    if (!deleted) return;

    // Optimistic removal
    updatePosts((prev) => prev.filter((p) => p.id !== id));

    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
      updatePosts((prev) => [deleted, ...prev]);
      return;
    }

    toast.success("Post deleted", {
      action: {
        label: "Undo",
        onClick: async () => {
          // Re-insert with the same id. RLS will enforce ownership.
          const { error: restoreError } = await supabase.from("posts").insert({
            id: deleted.id,
            platform: deleted.platform,
            topic: deleted.topic,
            content: deleted.content,
            hashtags: deleted.hashtags,
            tone: deleted.tone,
            status: deleted.status,
            is_favorite: deleted.is_favorite,
            created_at: deleted.created_at,
          });
          if (restoreError) {
            toast.error("Could not restore post");
            return;
          }
          updatePosts((prev) => [deleted, ...prev]);
          toast.success("Post restored");
        },
      },
      duration: 8000,
    });
  }

  async function handleCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) {
        toast.error("CSV must have a header row and at least one data row");
        return;
      }
      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      const rows = lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = values[i] || ""; });
        return row;
      });
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Imported ${data.imported} posts${data.skipped ? `, ${data.skipped} skipped` : ""}`);
        window.location.reload();
      } else {
        toast.error(data.error || "Import failed");
      }
    } catch {
      toast.error("Failed to parse CSV");
    }
    e.target.value = "";
  }

  async function handleToggleFavorite(id: string, current: boolean) {
    const { error } = await supabase.from("posts").update({ is_favorite: !current }).eq("id", id);
    if (error) {
      toast.error("Failed to update");
    } else {
      updatePosts((prev) => prev.map((p) => p.id === id ? { ...p, is_favorite: !current } : p));
    }
  }

  async function handleSubmitForReview(id: string) {
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: id }),
      });
      if (res.ok) {
        updatePosts((prev) => prev.map((p) => p.id === id ? { ...p, status: "pending_review" } : p));
        toast.success("Submitted for review");
      } else {
        toast.error("Failed to submit for review");
      }
    } catch {
      toast.error("Failed to submit for review");
    }
  }

  // Used for the manual-publish workflow. The cron sends a copy-paste-ready
  // reminder when a scheduled post hits its time without a connected account;
  // once the user actually posts on the platform, they come back here and
  // confirm it so the post moves out of "scheduled" into "published".
  async function handleMarkAsPublished(id: string) {
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("posts")
      .update({ status: "published", published_at: nowIso })
      .eq("id", id);
    if (error) {
      toast.error("Failed to update post");
      return;
    }
    updatePosts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: "published", published_at: nowIso } : p,
      ),
    );
    toast.success("Marked as published");
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
    updatePosts((prev) => [data as Post, ...prev]);
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

  const filters: FilterStatus[] = ["all", "draft", "pending_review", "approved", "scheduled", "published"];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("history.title")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => document.getElementById("csv-import")?.click()}>
            Import CSV
          </Button>
          <input
            id="csv-import"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCSVImport}
          />
          {posts.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={exportAsCSV}>
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportAsText}>
                Export TXT
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={showFavoritesOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          >
            {showFavoritesOnly ? "★" : "☆"} Favorites
          </Button>
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">Platform:</span>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="pinterest">Pinterest</SelectItem>
              <SelectItem value="twitter">Twitter / X</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">Date:</span>
          <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(platformFilter !== "all" || dateRangeFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPlatformFilter("all");
              setDateRangeFilter("all");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {websiteOptions.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">Website:</span>
          <Select value={websiteFilter} onValueChange={setWebsiteFilter}>
            <SelectTrigger className="max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={URL_ALL}>
                All websites ({posts.length})
              </SelectItem>
              {websiteOptions.map((opt) => (
                <SelectItem key={opt.url} value={opt.url}>
                  {shortUrl(opt.url)} ({opt.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {websiteFilter !== URL_ALL && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWebsiteFilter(URL_ALL)}
            >
              Clear
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={6} />
      ) : filteredPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground">
            {search ? "No posts matching your search." : t("history.empty")}
          </p>
          {!search && (
            <Button className="mt-4" onClick={() => router.push("/create")}>
              Create your first post
            </Button>
          )}
        </div>
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
                {isUrl(post.topic) ? (
                  <a
                    href={post.topic}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-sm font-medium text-primary hover:underline break-all"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {shortUrl(post.topic)}
                  </a>
                ) : (
                  <p className="text-sm font-medium">{post.topic}</p>
                )}
                <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                  {post.content}
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleFavorite(post.id, post.is_favorite)}
                    className={post.is_favorite ? "text-yellow-500" : ""}
                  >
                    {post.is_favorite ? "★" : "☆"}
                  </Button>
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
                  {post.status === "draft" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSubmitForReview(post.id)}
                    >
                      Submit for Review
                    </Button>
                  )}
                  {post.status === "scheduled" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkAsPublished(post.id)}
                    >
                      Mark as published
                    </Button>
                  )}
                  {post.status === "published" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        const url = `${window.location.origin}/p/${post.id}`;
                        await navigator.clipboard.writeText(url);
                        toast.success("Share link copied");
                      }}
                    >
                      Share link
                    </Button>
                  )}
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
                  disabled={effectivePage <= 1}
                  onClick={() => setPage(effectivePage - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  {effectivePage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={effectivePage >= totalPages}
                  onClick={() => setPage(effectivePage + 1)}
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
