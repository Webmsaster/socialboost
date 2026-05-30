"use client";

import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import { useRecentWebsites } from "@/lib/use-recent-websites";
import { scoreContent } from "@/lib/content-score";

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
  // When the post was generated from a URL, we keep it so the card shows
  // which site produced it and the saved row stores it as the topic.
  sourceUrl?: string;
}

interface GenerationJob {
  platform: PlatformId;
  variationIndex: number;
  websiteUrl?: string;
}

type BulkMode = "topic" | "urls";

const URL_GENERIC_TOPIC =
  "Share this website with my audience and drive traffic to it.";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function BulkPage() {
  const [mode, setMode] = useState<BulkMode>("topic");
  const [topic, setTopic] = useState("");
  const [urlsInput, setUrlsInput] = useState("");
  const [sitemapInput, setSitemapInput] = useState("");
  const [loadingSitemap, setLoadingSitemap] = useState(false);
  const recentWebsites = useRecentWebsites();
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

  const STORAGE_KEY = "socialboost_bulk_progress";

  // Restore previous results from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { results: GeneratedPost[]; topic: string };
        if (parsed.results?.length > 0) {
          setResults(parsed.results);
          setTopic(parsed.topic ?? "");
        }
      }
    } catch { /* ignore parse errors */ }
  }, []);

  const parsedUrls = urlsInput
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const totalPosts =
    mode === "urls"
      ? parsedUrls.length * selectedPlatforms.size
      : selectedPlatforms.size * variations;

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
    platform: PlatformId,
    override?: { topic?: string; websiteUrl?: string }
  ): Promise<{ content: string; hashtags: string[] }> {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        topic: override?.topic ?? topic,
        tone,
        language,
        websiteUrl: override?.websiteUrl,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Generation failed");
    }

    return res.json();
  }

  async function handleLoadSitemap() {
    const input = sitemapInput.trim();
    if (!input) {
      toast.error("Enter a site URL first");
      return;
    }
    setLoadingSitemap(true);
    try {
      const res = await fetch("/api/sitemap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: input }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to fetch sitemap");
        return;
      }
      const data = (await res.json()) as {
        urls: string[];
        truncated: boolean;
      };
      const existing = new Set(
        urlsInput
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
      );
      const added: string[] = [];
      for (const u of data.urls) {
        if (!existing.has(u)) {
          existing.add(u);
          added.push(u);
        }
      }
      if (added.length === 0) {
        toast.info("Sitemap loaded — no new URLs to add");
        return;
      }
      setUrlsInput((prev) => {
        const sep = prev && !prev.endsWith("\n") ? "\n" : "";
        return prev + sep + added.join("\n");
      });
      toast.success(
        `${added.length} URL${added.length === 1 ? "" : "s"} added${data.truncated ? " (list was truncated)" : ""}`
      );
    } catch {
      toast.error("Failed to fetch sitemap");
    } finally {
      setLoadingSitemap(false);
    }
  }

  function validateUrls(lines: string[]): { valid: string[]; invalid: string[] } {
    const valid: string[] = [];
    const invalid: string[] = [];
    for (const line of lines) {
      try {
        const parsed = new URL(line);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          valid.push(parsed.toString());
        } else {
          invalid.push(line);
        }
      } catch {
        invalid.push(line);
      }
    }
    return { valid, invalid };
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();

    if (selectedPlatforms.size === 0) {
      toast.error("Please select at least one platform");
      return;
    }

    // Build job queue depending on the mode.
    const jobs: GenerationJob[] = [];

    if (mode === "topic") {
      if (!topic.trim()) {
        toast.error("Please enter a topic");
        return;
      }
      for (const platform of selectedPlatforms) {
        for (let v = 0; v < variations; v++) {
          jobs.push({ platform, variationIndex: v });
        }
      }
    } else {
      const { valid, invalid } = validateUrls(parsedUrls);
      if (invalid.length > 0) {
        toast.error(`Invalid URL: ${invalid[0]}`);
        return;
      }
      if (valid.length === 0) {
        toast.error("Add at least one website URL");
        return;
      }
      for (const websiteUrl of valid) {
        for (const platform of selectedPlatforms) {
          jobs.push({ platform, variationIndex: 0, websiteUrl });
        }
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
        const result = await callGenerate(job.platform, {
          topic: job.websiteUrl ? URL_GENERIC_TOPIC : undefined,
          websiteUrl: job.websiteUrl,
        });
        generated.push({
          id: generateId(),
          platform: job.platform,
          content: result.content,
          hashtags: result.hashtags,
          saved: false,
          sourceUrl: job.websiteUrl,
        });
      } catch (err) {
        errorCount++;
        generated.push({
          id: generateId(),
          platform: job.platform,
          content: "",
          hashtags: [],
          saved: false,
          sourceUrl: job.websiteUrl,
          error: err instanceof Error ? err.message : "Generation failed",
        });
      }

      // Update results progressively so cards appear as they complete
      setResults([...generated]);
      // Persist to localStorage for crash recovery
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ results: generated, topic })); } catch { /* full storage */ }
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
        topic: post.sourceUrl || topic,
        tone,
        content: post.content,
        hashtags: post.hashtags,
        status: "draft",
        // Score with THIS post's platform + hashtags, not a shared value.
        content_score: scoreContent({
          content: post.content,
          platform: post.platform,
          hashtags: post.hashtags,
        }).score,
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
        topic: post.sourceUrl || topic,
        tone,
        content: post.content,
        hashtags: post.hashtags,
        status: "draft" as const,
        // Score each row with its own platform + hashtags.
        content_score: scoreContent({
          content: post.content,
          platform: post.platform,
          hashtags: post.hashtags,
        }).score,
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
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    } finally {
      setSavingAll(false);
    }
  }

  async function handleRegenerate(post: GeneratedPost) {
    setRegeneratingIds((prev) => new Set(prev).add(post.id));

    try {
      const result = await callGenerate(post.platform, {
        topic: post.sourceUrl ? URL_GENERIC_TOPIC : undefined,
        websiteUrl: post.sourceUrl,
      });
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
      {recentWebsites.length > 0 && (
        <datalist id="recent-websites-bulk">
          {recentWebsites.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      )}
      <div>
        <h1 className="text-3xl font-bold">Bulk Generation</h1>
        <p className="text-muted-foreground mt-1">
          Generate posts for multiple platforms at once
        </p>
      </div>

      <form onSubmit={handleGenerate} className="space-y-6">
        {/* Mode switch */}
        <div className="inline-flex rounded-lg border p-1">
          <button
            type="button"
            disabled={generating}
            onClick={() => setMode("topic")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "topic"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            } disabled:opacity-50`}
          >
            Single topic
          </button>
          <button
            type="button"
            disabled={generating}
            onClick={() => setMode("urls")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "urls"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            } disabled:opacity-50`}
          >
            Multiple websites
          </button>
        </div>

        {/* Topic OR URL list */}
        {mode === "topic" ? (
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
        ) : (
          <div className="space-y-4">
            {/* Sitemap loader */}
            <div className="space-y-2 rounded-lg border border-dashed p-3">
              <Label className="text-xs">Load URLs from a sitemap</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="url"
                  placeholder="https://yoursite.com (or https://yoursite.com/sitemap.xml)"
                  value={sitemapInput}
                  onChange={(e) => setSitemapInput(e.target.value)}
                  disabled={generating || loadingSitemap}
                  className="flex-1"
                  list="recent-websites-bulk"
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={generating || loadingSitemap || !sitemapInput.trim()}
                  onClick={handleLoadSitemap}
                >
                  {loadingSitemap ? "Loading..." : "Load sitemap"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                We try /sitemap.xml and /sitemap_index.xml on the given host, then append the found URLs below (max 200, deduplicated against what&apos;s already there).
              </p>
            </div>

            <div className="space-y-2">
              <Label>Website URLs (one per line)</Label>
              <Textarea
                placeholder={"https://example.com\nhttps://another-site.com/landing\nhttps://blog.example.com/post"}
                value={urlsInput}
                onChange={(e) => setUrlsInput(e.target.value)}
                rows={6}
                disabled={generating}
              />
              <p className="text-xs text-muted-foreground">
                We scrape title + description + headings for each URL and weave them into a post tailored to each site.
                {parsedUrls.length > 0 && (
                  <>
                    {" "}
                    <span className="font-medium text-foreground">
                      {parsedUrls.length} URL{parsedUrls.length === 1 ? "" : "s"} detected.
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
        )}

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

        <div className={`grid gap-6 ${mode === "urls" ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
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

          {/* Variations — only meaningful in topic mode; URL mode = one post per URL */}
          {mode === "topic" && (
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
          )}
        </div>

        {/* Estimated count and generate button */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {selectedPlatforms.size > 0 && totalPosts > 0 && (
              <p className="text-sm text-muted-foreground">
                Will generate{" "}
                <span className="font-semibold text-foreground">
                  {totalPosts}
                </span>{" "}
                {totalPosts === 1 ? "post" : "posts"}{" "}
                {mode === "topic" ? (
                  <>
                    ({selectedPlatforms.size}{" "}
                    {selectedPlatforms.size === 1 ? "platform" : "platforms"} ×{" "}
                    {variations} {variations === 1 ? "variation" : "variations"})
                  </>
                ) : (
                  <>
                    ({parsedUrls.length}{" "}
                    {parsedUrls.length === 1 ? "URL" : "URLs"} ×{" "}
                    {selectedPlatforms.size}{" "}
                    {selectedPlatforms.size === 1 ? "platform" : "platforms"})
                  </>
                )}
              </p>
            )}
          </div>
          <Button
            type="submit"
            disabled={
              generating ||
              selectedPlatforms.size === 0 ||
              (mode === "topic" ? !topic.trim() : parsedUrls.length === 0)
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
                      {post.sourceUrl && (
                        <p className="truncate text-xs text-muted-foreground">
                          <span className="font-medium">Source:</span>{" "}
                          <a
                            href={post.sourceUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-primary hover:underline"
                          >
                            {post.sourceUrl}
                          </a>
                        </p>
                      )}
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
