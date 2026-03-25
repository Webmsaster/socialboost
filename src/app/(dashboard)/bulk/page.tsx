"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const PLATFORMS = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "pinterest", label: "Pinterest" },
  { id: "twitter", label: "Twitter/X" },
] as const;

type PlatformId = (typeof PLATFORMS)[number]["id"];

const TONES = [
  { id: "professional", label: "Professional" },
  { id: "casual", label: "Casual" },
  { id: "inspirational", label: "Inspirational" },
  { id: "humorous", label: "Humorous" },
  { id: "educational", label: "Educational" },
] as const;

const LANGUAGES = [
  { value: "English", label: "English" },
  { value: "German", label: "Deutsch" },
  { value: "French", label: "Français" },
  { value: "Spanish", label: "Español" },
] as const;

const VARIATION_OPTIONS = [1, 2, 3] as const;

interface GeneratedPost {
  id: string;
  platform: PlatformId;
  content: string;
  hashtags: string[];
  saved: boolean;
  error?: string;
}

interface GenerationJob {
  platform: PlatformId;
  variationIndex: number;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function BulkPage() {
  const [topic, setTopic] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<PlatformId>>(
    new Set()
  );
  const [tone, setTone] = useState("professional");
  const [language, setLanguage] = useState("English");
  const [variations, setVariations] = useState(1);
  const [results, setResults] = useState<GeneratedPost[]>([]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [savingAll, setSavingAll] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(
    new Set()
  );

  const supabase = createClient();

  const totalPosts = selectedPlatforms.size * variations;

  const togglePlatform = useCallback((platformId: PlatformId) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platformId)) {
        next.delete(platformId);
      } else {
        next.add(platformId);
      }
      return next;
    });
  }, []);

  async function callGenerate(
    platform: PlatformId
  ): Promise<{ content: string; hashtags: string[] }> {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, topic, tone, language }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Generation failed");
    }

    return res.json();
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();

    if (!topic.trim()) {
      toast.error("Please enter a topic");
      return;
    }

    if (selectedPlatforms.size === 0) {
      toast.error("Please select at least one platform");
      return;
    }

    // Build job queue
    const jobs: GenerationJob[] = [];
    for (const platform of selectedPlatforms) {
      for (let v = 0; v < variations; v++) {
        jobs.push({ platform, variationIndex: v });
      }
    }

    setGenerating(true);
    setProgress({ current: 0, total: jobs.length });
    setResults([]);

    const generated: GeneratedPost[] = [];
    let errorCount = 0;

    // Generate sequentially to respect rate limits
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      setProgress({ current: i + 1, total: jobs.length });

      try {
        const result = await callGenerate(job.platform);
        generated.push({
          id: generateId(),
          platform: job.platform,
          content: result.content,
          hashtags: result.hashtags,
          saved: false,
        });
      } catch (err) {
        errorCount++;
        generated.push({
          id: generateId(),
          platform: job.platform,
          content: "",
          hashtags: [],
          saved: false,
          error: err instanceof Error ? err.message : "Generation failed",
        });
      }

      // Update results progressively so cards appear as they complete
      setResults([...generated]);
    }

    setGenerating(false);

    const successCount = generated.filter((p) => !p.error).length;
    if (errorCount > 0) {
      toast.warning(
        `Generated ${successCount} of ${jobs.length} posts. ${errorCount} failed.`
      );
    } else {
      toast.success(`Successfully generated ${successCount} posts!`);
    }
  }

  async function handleSaveOne(post: GeneratedPost) {
    if (post.saved || post.error) return;

    setSavingIds((prev) => new Set(prev).add(post.id));

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        return;
      }

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        platform: post.platform,
        topic,
        tone,
        content: post.content,
        hashtags: post.hashtags,
        status: "draft",
      });

      if (error) {
        toast.error("Failed to save post");
        return;
      }

      setResults((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, saved: true } : p))
      );
      toast.success("Post saved as draft");
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });
    }
  }

  async function handleSaveAll() {
    const unsaved = results.filter((p) => !p.saved && !p.error);
    if (unsaved.length === 0) {
      toast.info("No unsaved posts to save");
      return;
    }

    setSavingAll(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        return;
      }

      const rows = unsaved.map((post) => ({
        user_id: user.id,
        platform: post.platform,
        topic,
        tone,
        content: post.content,
        hashtags: post.hashtags,
        status: "draft" as const,
      }));

      const { error } = await supabase.from("posts").insert(rows);

      if (error) {
        toast.error("Failed to save posts");
        return;
      }

      const savedIds = new Set(unsaved.map((p) => p.id));
      setResults((prev) =>
        prev.map((p) => (savedIds.has(p.id) ? { ...p, saved: true } : p))
      );
      toast.success(`${unsaved.length} posts saved as drafts`);
    } finally {
      setSavingAll(false);
    }
  }

  async function handleRegenerate(post: GeneratedPost) {
    setRegeneratingIds((prev) => new Set(prev).add(post.id));

    try {
      const result = await callGenerate(post.platform);
      setResults((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                content: result.content,
                hashtags: result.hashtags,
                saved: false,
                error: undefined,
              }
            : p
        )
      );
      toast.success("Post regenerated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Regeneration failed"
      );
    } finally {
      setRegeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });
    }
  }

  async function handleCopy(post: GeneratedPost) {
    const fullText =
      post.hashtags.length > 0
        ? `${post.content}\n\n${post.hashtags.map((h) => `#${h}`).join(" ")}`
        : post.content;
    await navigator.clipboard.writeText(fullText);
    toast.success("Copied to clipboard");
  }

  // Group results by platform for display
  const groupedResults = PLATFORMS.reduce<
    Record<PlatformId, GeneratedPost[]>
  >(
    (acc, p) => {
      const posts = results.filter((r) => r.platform === p.id);
      if (posts.length > 0) {
        acc[p.id] = posts;
      }
      return acc;
    },
    {} as Record<PlatformId, GeneratedPost[]>
  );

  const platformLabel = (id: PlatformId): string =>
    PLATFORMS.find((p) => p.id === id)?.label ?? id;

  const hasUnsaved = results.some((p) => !p.saved && !p.error);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Bulk Generation</h1>
        <p className="text-muted-foreground mt-1">
          Generate posts for multiple platforms at once
        </p>
      </div>

      <form onSubmit={handleGenerate} className="space-y-6">
        {/* Topic */}
        <div className="space-y-2">
          <Label>Topic / Theme</Label>
          <Textarea
            placeholder="Describe the main topic or theme for your posts..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={4}
            required
            disabled={generating}
          />
        </div>

        {/* Platform toggles */}
        <div className="space-y-2">
          <Label>Platforms</Label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => {
              const isSelected = selectedPlatforms.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={generating}
                  onClick={() => togglePlatform(p.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-accent"
                  } disabled:opacity-50`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          {selectedPlatforms.size === 0 && (
            <p className="text-sm text-muted-foreground">
              Select at least one platform
            </p>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Tone */}
          <div className="space-y-2">
            <Label>Tone</Label>
            <Select
              value={tone}
              onValueChange={setTone}
              disabled={generating}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Language */}
          <div className="space-y-2">
            <Label>Language</Label>
            <Select
              value={language}
              onValueChange={setLanguage}
              disabled={generating}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Variations */}
          <div className="space-y-2">
            <Label>Variations per platform</Label>
            <Select
              value={String(variations)}
              onValueChange={(v) => setVariations(Number(v))}
              disabled={generating}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VARIATION_OPTIONS.map((v) => (
                  <SelectItem key={v} value={String(v)}>
                    {v} {v === 1 ? "variation" : "variations"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Estimated count and generate button */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {selectedPlatforms.size > 0 && (
              <p className="text-sm text-muted-foreground">
                Will generate{" "}
                <span className="font-semibold text-foreground">
                  {totalPosts}
                </span>{" "}
                {totalPosts === 1 ? "post" : "posts"} ({selectedPlatforms.size}{" "}
                {selectedPlatforms.size === 1 ? "platform" : "platforms"} ×{" "}
                {variations} {variations === 1 ? "variation" : "variations"})
              </p>
            )}
          </div>
          <Button
            type="submit"
            disabled={
              generating || selectedPlatforms.size === 0 || !topic.trim()
            }
            className="w-full sm:w-auto"
          >
            {generating ? "Generating..." : "Generate All"}
          </Button>
        </div>
      </form>

      {/* Progress bar */}
      {generating && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Generating {progress.current} of {progress.total}...
            </span>
            <span className="font-medium">
              {Math.round((progress.current / progress.total) * 100)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300 ease-in-out"
              style={{
                width: `${(progress.current / progress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Generated Posts ({results.filter((r) => !r.error).length})
            </h2>
            {hasUnsaved && (
              <Button
                onClick={handleSaveAll}
                disabled={savingAll || generating}
              >
                {savingAll ? "Saving..." : "Save All as Drafts"}
              </Button>
            )}
          </div>

          {Object.entries(groupedResults).map(([platformId, posts]) => (
            <div key={platformId} className="space-y-3">
              <h3 className="flex items-center gap-2 text-lg font-medium">
                <Badge variant="secondary">
                  {platformLabel(platformId as PlatformId)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {posts.filter((p) => !p.error).length}{" "}
                  {posts.filter((p) => !p.error).length === 1
                    ? "post"
                    : "posts"}
                </span>
              </h3>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => (
                  <Card
                    key={post.id}
                    className={
                      post.error
                        ? "border-destructive/50"
                        : post.saved
                          ? "border-green-500/50"
                          : ""
                    }
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between text-sm">
                        <Badge
                          variant={post.error ? "destructive" : "secondary"}
                        >
                          {platformLabel(post.platform)}
                        </Badge>
                        {post.saved && (
                          <Badge
                            variant="outline"
                            className="border-green-500 text-green-600"
                          >
                            Saved
                          </Badge>
                        )}
                        {post.error && (
                          <Badge variant="destructive">Error</Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {post.error ? (
                        <p className="text-sm text-destructive">
                          {post.error}
                        </p>
                      ) : (
                        <>
                          <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
                            {post.content}
                            {post.hashtags.length > 0 && (
                              <>
                                <br />
                                <br />
                                <span className="text-primary">
                                  {post.hashtags
                                    .map((h) => `#${h}`)
                                    .join(" ")}
                                </span>
                              </>
                            )}
                          </div>
                        </>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {!post.error && !post.saved && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSaveOne(post)}
                            disabled={savingIds.has(post.id) || savingAll}
                          >
                            {savingIds.has(post.id) ? "Saving..." : "Save"}
                          </Button>
                        )}
                        {!post.error && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopy(post)}
                          >
                            Copy
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRegenerate(post)}
                          disabled={regeneratingIds.has(post.id) || generating}
                        >
                          {regeneratingIds.has(post.id)
                            ? "Regenerating..."
                            : "Regenerate"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
