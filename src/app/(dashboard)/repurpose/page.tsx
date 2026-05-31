"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  created_at: string;
}

const platforms = ["linkedin", "facebook", "instagram", "pinterest", "twitter"] as const;

type RepurposeResult = Record<string, { content: string; hashtags: string[] }>;

export default function RepurposePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [customContent, setCustomContent] = useState("");
  const [sourcePlatform, setSourcePlatform] = useState<string>("linkedin");
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>([]);
  const [tone, setTone] = useState<string>("professional");
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<RepurposeResult | null>(null);
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null);
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("posts")
        .select("id, platform, topic, content, hashtags, tone, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        toast.error("Failed to load posts");
      } else {
        setPosts(data ?? []);
        const postId = searchParams.get("postId");
        if (postId && data) {
          const found = data.find((p: Post) => p.id === postId);
          if (found) handleSelectPost(found);
        }
      }
      setLoading(false);
    }
    load();
  }, [supabase, searchParams]);

  function handleSelectPost(post: Post) {
    setSelectedPost(post);
    setCustomContent(post.content);
    setSourcePlatform(post.platform);
    setTone(post.tone || "professional");
    setTargetPlatforms(platforms.filter((p) => p !== post.platform));
    setResults(null);
  }

  function toggleTargetPlatform(platform: string) {
    setTargetPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  }

  async function handleRepurpose() {
    if (!customContent.trim()) {
      toast.error(t("repurpose.noContent"));
      return;
    }
    if (targetPlatforms.length === 0) {
      toast.error(t("repurpose.noTargets"));
      return;
    }

    setGenerating(true);
    setResults(null);

    try {
      const res = await fetch("/api/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: customContent,
          sourcePlatform,
          targetPlatforms,
          language: "English",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to repurpose");
      }

      const data = await res.json();
      setResults(data.results);
      toast.success(t("repurpose.success"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to repurpose content");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveAsDraft(platform: string, content: string, hashtags: string[]) {
    setSavingPlatform(platform);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        return;
      }
      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        platform,
        topic: selectedPost?.topic || "Repurposed content",
        content,
        hashtags,
        tone,
        status: "draft",
      });
      if (error) throw error;
      toast.success(`${t("repurpose.saved")} (${platform})`);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSavingPlatform(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t("repurpose.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("repurpose.description")}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left: Source selection */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("repurpose.source")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("repurpose.selectExisting")}</Label>
                {loading ? (
                  <TableSkeleton rows={3} />
                ) : posts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("repurpose.noPosts")}</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2 rounded-lg border p-2">
                    {posts.map((post) => (
                      <button
                        key={post.id}
                        onClick={() => handleSelectPost(post)}
                        className={`w-full text-left rounded-lg p-3 transition-colors ${
                          selectedPost?.id === post.id
                            ? "bg-primary/10 border border-primary"
                            : "hover:bg-muted border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs">{post.platform}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(post.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm font-medium truncate">{post.topic}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{post.content}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t("repurpose.orPaste")}</Label>
                <Textarea
                  value={customContent}
                  onChange={(e) => {
                    setCustomContent(e.target.value);
                    if (selectedPost && e.target.value !== selectedPost.content) {
                      setSelectedPost(null);
                    }
                  }}
                  placeholder={t("repurpose.pastePlaceholder")}
                  rows={6}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("repurpose.sourcePlatform")}</Label>
                  <Select value={sourcePlatform} onValueChange={setSourcePlatform}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {platforms.map((p) => (
                        <SelectItem key={p} value={p}>
                          {t(`platform.${p}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("repurpose.targetPlatforms")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {platforms
                  .filter((p) => p !== sourcePlatform)
                  .map((platform) => (
                    <Button
                      key={platform}
                      variant={targetPlatforms.includes(platform) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleTargetPlatform(platform)}
                    >
                      {t(`platform.${platform}`)}
                    </Button>
                  ))}
              </div>
              <Button
                className="w-full mt-4"
                onClick={handleRepurpose}
                disabled={generating || !customContent.trim() || targetPlatforms.length === 0}
              >
                {generating ? t("repurpose.generating") : t("repurpose.generate")}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          {generating && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p className="text-sm text-muted-foreground">{t("repurpose.generating")}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {results && Object.entries(results).map(([platform, result]) => (
            <Card key={platform}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Badge>{platform}</Badge>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm whitespace-pre-wrap">{result.content}</p>
                {result.hashtags?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {result.hashtags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const full = result.content + (result.hashtags?.length
                        ? "\n\n" + result.hashtags.map((h) => `#${h}`).join(" ")
                        : "");
                      navigator.clipboard.writeText(full);
                      toast.success("Copied!");
                    }}
                  >
                    {t("repurpose.copy")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={savingPlatform === platform}
                    onClick={() => handleSaveAsDraft(platform, result.content, result.hashtags)}
                  >
                    {savingPlatform === platform ? "..." : t("repurpose.saveAsDraft")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {!generating && !results && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t("repurpose.emptyState")}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
