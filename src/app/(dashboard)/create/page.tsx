"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useRecentWebsites } from "@/lib/use-recent-websites";
import { trackClient } from "@/lib/track-client";
import { PostPreview } from "@/components/post-preview";
import {
  PLATFORM_LIMITS,
  platforms,
  tones,
  type PlatformKey,
  type ContentType,
  type PostResult,
  type PostVariant,
  type VideoScriptResult,
  type VideoAdResult,
  type CarouselResult,
} from "./create-types";
import {
  formatPostText,
  formatVideoScriptText,
  formatVideoAdText,
  formatCarouselText,
} from "./create-helpers";

// --- Component ---

export default function CreatePage() {
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Common state
  const [contentType, setContentType] = useState<ContentType>("post");
  const [platform, setPlatform] = useState<string>("linkedin");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<string>("professional");
  const [language, setLanguage] = useState("English");
  const [loading, setLoading] = useState(false);

  // Post-specific
  const [enableImage, setEnableImage] = useState(false);
  const [enableVariants, setEnableVariants] = useState(false);
  const [postResult, setPostResult] = useState<PostResult | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [variants, setVariants] = useState<PostVariant[] | null>(null);

  // Video ad specific
  const [product, setProduct] = useState("");

  // Carousel specific
  const [slideCount, setSlideCount] = useState(5);

  // Video script result
  const [videoScriptResult, setVideoScriptResult] =
    useState<VideoScriptResult | null>(null);

  // Video ad result
  const [videoAdResult, setVideoAdResult] = useState<VideoAdResult | null>(
    null
  );

  // Carousel result
  const [carouselResult, setCarouselResult] = useState<CarouselResult | null>(
    null
  );
  const [currentSlide, setCurrentSlide] = useState(0);

  // Hashtag suggestions
  const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>([]);
  const [loadingHashtags, setLoadingHashtags] = useState(false);
  const [loadingVoiceover, setLoadingVoiceover] = useState(false);
  const [loadingVideoAssets, setLoadingVideoAssets] = useState(false);
  const [videoAssets, setVideoAssets] = useState<{
    images: Array<{ sceneNumber: number; url: string | null; error: string | null }>;
    voiceover: { dataUrl: string | null; error: string | null };
  } | null>(null);
  const [loadingFullVideo, setLoadingFullVideo] = useState(false);
  const [fullVideoUrl, setFullVideoUrl] = useState<string | null>(null);

  // Whether the user has set up a brand voice (manual textarea or auto-trained).
  // If empty, we surface a one-time onboarding banner — most users skip this
  // field and then complain about generic AI output.
  const [hasBrandVoice, setHasBrandVoice] = useState<boolean | null>(null);
  const [brandVoiceBannerDismissed, setBrandVoiceBannerDismissed] = useState(false);

  // Website → full video (video-script tab)
  const [siteUrl, setSiteUrl] = useState("");
  const [loadingSiteVideo, setLoadingSiteVideo] = useState(false);

  // Website URL for website-aware Social Post generation
  const [postWebsiteUrl, setPostWebsiteUrl] = useState("");

  // Reuse URLs the user has already published against — shared for both the
  // post tab and the video-script tab via a single datalist below.
  const recentWebsites = useRecentWebsites();

  // Content score
  const [contentScore, setContentScore] = useState<{ score: number; tips: string[] } | null>(null);
  const [scoringContent, setScoringContent] = useState(false);

  // Copy states
  const [copied, setCopied] = useState(false);
  const [copiedVariant, setCopiedVariant] = useState<string | null>(null);

  // Check whether the user has filled in a brand voice. If not, we'll show a
  // banner suggesting auto-training — the Phase 2 feature is useless if nobody
  // discovers it.
  useEffect(() => {
    setBrandVoiceBannerDismissed(
      localStorage.getItem("brand_voice_banner_dismissed") === "1",
    );
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("brand_voice")
        .eq("id", user.id)
        .single();
      const bv = (data?.brand_voice ?? "").toString().trim();
      setHasBrandVoice(bv.length > 0);
    })();
  }, [supabase]);

  // Auto-save draft to localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      if (topic.trim()) {
        localStorage.setItem("draft_create", JSON.stringify({
          contentType, platform, tone, language, topic, product, slideCount,
          enableVariants, enableImage, savedAt: Date.now()
        }));
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [contentType, platform, tone, language, topic, product, slideCount, enableVariants, enableImage]);

  // Restore draft on mount
  useEffect(() => {
    const saved = localStorage.getItem("draft_create");
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        // Only restore if saved less than 24h ago
        if (Date.now() - draft.savedAt < 86400000) {
          if (draft.topic) setTopic(draft.topic);
          if (draft.platform) setPlatform(draft.platform);
          if (draft.tone) setTone(draft.tone);
          if (draft.language) setLanguage(draft.language);
          if (draft.contentType) setContentType(draft.contentType);
          if (draft.product) setProduct(draft.product);
          if (draft.slideCount) setSlideCount(draft.slideCount);
          toast.info("Draft restored from auto-save");
        }
      } catch {
        // Ignore invalid JSON
      }
    }
  }, []);

  // Template prefill from URL params
  useEffect(() => {
    const templateId = searchParams.get("template");
    if (!templateId) return;

    async function loadTemplate() {
      const { data } = await supabase
        .from("templates")
        .select("platform, tone, topic, language")
        .eq("id", templateId)
        .single();

      if (data) {
        if (data.platform) setPlatform(data.platform);
        if (data.tone) setTone(data.tone);
        if (data.topic) setTopic(data.topic);
        if (data.language) setLanguage(data.language);
      }
    }

    loadTemplate();
  }, [searchParams, supabase]);

  // Clear results when content type changes
  useEffect(() => {
    setPostResult(null);
    setImageUrl(null);
    setVariants(null);
    setVideoScriptResult(null);
    setVideoAdResult(null);
    setCarouselResult(null);
    setCurrentSlide(0);
    setVideoAssets(null);
    setFullVideoUrl(null);
  }, [contentType]);

  // --- Hashtag suggestions ---

  async function fetchHashtags() {
    if (!topic.trim()) {
      toast.error("Enter a topic first");
      return;
    }
    setLoadingHashtags(true);
    try {
      const res = await fetch("/api/hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, platform }),
      });
      if (!res.ok) throw new Error("Failed to fetch hashtags");
      const data = await res.json();
      const merged = [
        ...(data.trending ?? []),
        ...(data.niche ?? []),
        ...(data.broad ?? []),
      ];
      setSuggestedHashtags(merged);
    } catch {
      toast.error("Could not load hashtag suggestions");
    } finally {
      setLoadingHashtags(false);
    }
  }

  // --- Handlers ---

  const clearAllResults = useCallback(() => {
    setPostResult(null);
    setImageUrl(null);
    setVariants(null);
    setVideoScriptResult(null);
    setVideoAdResult(null);
    setCarouselResult(null);
    setCurrentSlide(0);
    setVideoAssets(null);
    setFullVideoUrl(null);
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    clearAllResults();

    try {
      switch (contentType) {
        case "post":
          await handleGeneratePost();
          break;
        case "video-script":
          await handleGenerateVideoScript();
          break;
        case "video-ad":
          await handleGenerateVideoAd();
          break;
        case "carousel":
          await handleGenerateCarousel();
          break;
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleGeneratePost() {
    if (enableVariants) {
      // A/B Variants mode
      const res = await fetch("/api/generate-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          topic,
          tone,
          language,
          count: 3,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Generation failed");
      }
      const data = await res.json();
      setVariants(data.variants);
      localStorage.removeItem("draft_create");
    } else {
      // Single post mode
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          topic,
          tone,
          language,
          websiteUrl: postWebsiteUrl.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Generation failed");
      }
      const data = await res.json();
      setPostResult(data);
      setContentScore(null);
      localStorage.removeItem("draft_create");

      // Auto-score the generated content
      fetchContentScore(data.content, platform, data.hashtags);

      // Generate image if enabled
      if (enableImage) {
        try {
          const imgRes = await fetch("/api/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: topic }),
          });
          if (imgRes.ok) {
            const imgData = await imgRes.json();
            setImageUrl(imgData.url);
          }
        } catch {
          toast.error("Image generation failed, but your post is ready.");
        }
      }
    }
  }

  async function handleGenerateVideoScript() {
    const res = await fetch("/api/generate-video-script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, tone, language, platform }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Generation failed");
    }
    const data = await res.json();
    setVideoScriptResult(data);
    localStorage.removeItem("draft_create");
  }

  async function handleGenerateVideoFromSite() {
    if (!siteUrl.trim()) {
      toast.error("Enter a website URL first");
      return;
    }
    setLoadingSiteVideo(true);
    clearAllResults();
    setVideoAssets(null);
    try {
      const res = await fetch("/api/generate-video-from-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl: siteUrl.trim(),
          tone,
          language,
          platform,
          topicHint: topic.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Generation failed");
        return;
      }
      const data = await res.json();
      setVideoScriptResult(data.script);
      setVideoAssets({ images: data.images, voiceover: data.voiceover });
      if (data.assetsSkipped) {
        toast.warning(data.assetsSkipped);
      } else {
        toast.success("Full video generated for your site");
      }
    } catch {
      toast.error("Failed to generate video from site");
    } finally {
      setLoadingSiteVideo(false);
    }
  }

  async function handleGenerateVideoAd() {
    if (!product.trim()) {
      toast.error("Please enter a product/brand name.");
      return;
    }
    const res = await fetch("/api/generate-video-ad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, tone, language, product }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Generation failed");
    }
    const data = await res.json();
    setVideoAdResult(data);
    localStorage.removeItem("draft_create");
  }

  async function handleGenerateCarousel() {
    const res = await fetch("/api/generate-carousel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, tone, language, platform, slideCount }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Generation failed");
    }
    const data = await res.json();
    setCarouselResult(data);
    setCurrentSlide(0);
    localStorage.removeItem("draft_create");
  }

  // --- Copy Helpers ---

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyVariant(variant: PostVariant) {
    const fullText =
      variant.hashtags.length > 0
        ? `${variant.content}\n\n${variant.hashtags.map((h) => `#${h}`).join(" ")}`
        : variant.content;
    await navigator.clipboard.writeText(fullText);
    setCopiedVariant(variant.variantLabel);
    setTimeout(() => setCopiedVariant(null), 2000);
  }

  // --- Save Helper ---

  async function handleSavePost(content: string, hashtags: string[]) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      platform,
      topic,
      tone,
      content,
      hashtags,
      status: "draft",
      content_score: contentScore?.score ?? 0,
    });

    if (error) {
      toast.error("Failed to save");
    } else {
      toast.success("Post saved as draft!");
      trackClient("post_saved_as_draft", {
        platform,
        tone,
        contentType,
        score: contentScore?.score ?? null,
      });
    }
  }

  // --- Render Helpers ---

  function getGenerateButtonText(): string {
    if (loading) return "Generating...";
    switch (contentType) {
      case "post":
        return enableVariants ? "Generate A/B Variants" : "Generate Post";
      case "video-script":
        return "Generate Video Script";
      case "video-ad":
        return "Generate Storyboard";
      case "carousel":
        return "Generate Carousel";
    }
  }

  async function handleRenderFullVideo() {
    if (!videoAssets || !videoScriptResult) return;
    const usableImages = videoAssets.images.filter((i) => !!i.url);
    if (usableImages.length === 0) {
      toast.error("No scene images available to render");
      return;
    }
    trackClient("render_video_clicked", { sceneCount: usableImages.length });

    setLoadingFullVideo(true);
    setFullVideoUrl(null);
    try {
      const scenes = usableImages.map((img) => {
        const scriptScene = videoScriptResult.scenes.find(
          (s) => s.sceneNumber === img.sceneNumber,
        );
        const durationNum = scriptScene
          ? parseInt(String(scriptScene.duration).match(/\d+/)?.[0] ?? "5", 10)
          : 5;
        return {
          imageUrl: img.url as string,
          duration: durationNum,
          textOverlay: scriptScene?.textOverlay ?? "",
        };
      });

      const res = await fetch("/api/render-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes,
          voiceoverDataUrl: videoAssets.voiceover.dataUrl ?? undefined,
          aspect: "9:16",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to render video");
        return;
      }
      setFullVideoUrl(data.videoUrl);
      toast.success("Full video rendered!");
    } catch {
      toast.error("Failed to render video");
    } finally {
      setLoadingFullVideo(false);
    }
  }

  async function fetchContentScore(content: string, scorePlatform: string, hashtags: string[]) {
    setScoringContent(true);
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, platform: scorePlatform, hashtags }),
      });
      if (res.ok) {
        const data = await res.json();
        setContentScore({ score: data.score, tips: data.tips });
      }
    } catch {
      // Score is non-critical
    } finally {
      setScoringContent(false);
    }
  }

  // --- Result Components ---

  function renderPostResult() {
    if (!postResult) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Generated Post
            <Badge variant="secondary">{platform}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm">
            {postResult.content}
            {postResult.hashtags.length > 0 && (
              <>
                <br />
                <br />
                <span className="text-primary">
                  {postResult.hashtags.map((h) => `#${h}`).join(" ")}
                </span>
              </>
            )}
          </div>

          {imageUrl && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Generated Image</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="AI generated visual"
                className="w-full max-w-md rounded-lg border"
              />
            </div>
          )}

          {/* Content Score */}
          {scoringContent ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Analyzing content...
            </div>
          ) : contentScore && (
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className={`text-2xl font-bold ${
                  contentScore.score >= 80 ? "text-green-600" :
                  contentScore.score >= 60 ? "text-yellow-600" : "text-red-500"
                }`}>
                  {contentScore.score}/100
                </div>
                <div className="flex-1">
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        contentScore.score >= 80 ? "bg-green-500" :
                        contentScore.score >= 60 ? "bg-yellow-500" : "bg-red-500"
                      }`}
                      style={{ width: `${contentScore.score}%` }}
                    />
                  </div>
                </div>
              </div>
              {contentScore.tips.length > 0 && (
                <ul className="text-xs text-muted-foreground space-y-1">
                  {contentScore.tips.map((tip, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="shrink-0">{contentScore.score >= 80 ? "✓" : "→"}</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                copyToClipboard(
                  formatPostText(postResult.content, postResult.hashtags)
                )
              }
            >
              {copied ? "Copied!" : "Copy"}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                handleSavePost(postResult.content, postResult.hashtags)
              }
            >
              Save as Draft
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderVariantsResult() {
    if (!variants) return null;

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          A/B Variants
          <Badge variant="secondary" className="ml-2">
            {variants.length} variants
          </Badge>
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {variants.map((variant) => (
            <Card key={variant.variantLabel} className="relative">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {variant.variantLabel}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {variant.approach}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
                  {variant.content}
                  {variant.hashtags.length > 0 && (
                    <>
                      <br />
                      <br />
                      <span className="text-primary">
                        {variant.hashtags.map((h) => `#${h}`).join(" ")}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyVariant(variant)}
                  >
                    {copiedVariant === variant.variantLabel
                      ? "Copied!"
                      : "Copy"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleSavePost(variant.content, variant.hashtags)
                    }
                  >
                    Select & Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  function renderVideoScriptResult() {
    if (!videoScriptResult) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Video Script
            <Badge variant="secondary">
              {videoScriptResult.totalDuration}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Hook */}
          <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Hook (First 3 seconds)
            </p>
            <p className="mt-1 text-sm font-medium">
              {videoScriptResult.hook}
            </p>
          </div>

          {/* Scenes */}
          <div className="space-y-4">
            <p className="text-sm font-semibold">Scenes</p>
            {videoScriptResult.scenes.map((scene) => (
              <div
                key={scene.sceneNumber}
                className="rounded-lg border bg-card p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="outline">Scene {scene.sceneNumber}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {scene.duration}
                  </span>
                </div>
                <div className="grid gap-2 text-sm">
                  <div>
                    <span className="font-medium text-muted-foreground">
                      Visual:{" "}
                    </span>
                    {scene.visual}
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">
                      Narration:{" "}
                    </span>
                    {scene.narration}
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">
                      Text Overlay:{" "}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {scene.textOverlay}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="rounded-lg border-l-4 border-green-500 bg-green-500/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-green-600">
              Call to Action
            </p>
            <p className="mt-1 text-sm font-medium">{videoScriptResult.cta}</p>
          </div>

          {/* Music */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium">Music Suggestion:</span>
            {videoScriptResult.musicSuggestion}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                copyToClipboard(formatVideoScriptText(videoScriptResult))
              }
            >
              {copied ? "Copied!" : "Copy Script"}
            </Button>
            <Button
              variant="outline"
              disabled={loadingVoiceover}
              onClick={async () => {
                setLoadingVoiceover(true);
                try {
                  const narration = [
                    videoScriptResult.hook,
                    ...videoScriptResult.scenes.map((s) => s.narration),
                    videoScriptResult.cta,
                  ]
                    .filter(Boolean)
                    .join("\n\n")
                    .slice(0, 4000);

                  const res = await fetch("/api/generate-voiceover", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: narration }),
                  });

                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    toast.error(err.error || "Failed to generate voiceover");
                    return;
                  }

                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `voiceover-${Date.now()}.mp3`;
                  link.click();
                  URL.revokeObjectURL(url);
                  toast.success("Voiceover downloaded");
                } catch {
                  toast.error("Failed to generate voiceover");
                } finally {
                  setLoadingVoiceover(false);
                }
              }}
            >
              {loadingVoiceover ? "Generating..." : "Generate Voiceover (Pro)"}
            </Button>
            <Button
              variant="outline"
              disabled={loadingVideoAssets}
              onClick={async () => {
                setLoadingVideoAssets(true);
                setVideoAssets(null);
                try {
                  const res = await fetch("/api/generate-video-assets", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      hook: videoScriptResult.hook,
                      cta: videoScriptResult.cta,
                      scenes: videoScriptResult.scenes.map((s) => ({
                        sceneNumber: s.sceneNumber,
                        visual: s.visual,
                        narration: s.narration,
                        textOverlay: s.textOverlay,
                      })),
                    }),
                  });
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    toast.error(err.error || "Failed to generate assets");
                    return;
                  }
                  const data = await res.json();
                  setVideoAssets({ images: data.images, voiceover: data.voiceover });
                  toast.success("Video assets ready");
                } catch {
                  toast.error("Failed to generate assets");
                } finally {
                  setLoadingVideoAssets(false);
                }
              }}
            >
              {loadingVideoAssets ? "Generating..." : "Generate Full Video Assets (Pro)"}
            </Button>
          </div>

          {videoAssets && (
            <div className="mt-4 space-y-4 rounded-lg border border-dashed p-4">
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm font-semibold">
                  Video assets — import into CapCut, InShot, or any video editor
                </p>
                <Button
                  size="sm"
                  onClick={handleRenderFullVideo}
                  disabled={
                    loadingFullVideo ||
                    !videoAssets.images.some((i) => !!i.url) ||
                    !videoAssets.voiceover.dataUrl
                  }
                >
                  {loadingFullVideo ? "Rendering..." : "Render Full Video (Pro)"}
                </Button>
              </div>

              {fullVideoUrl && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Rendered MP4</p>
                  <video
                    src={fullVideoUrl}
                    controls
                    className="w-full max-h-[480px] rounded-md border bg-black"
                  />
                  <a
                    href={fullVideoUrl}
                    download={`socialboost-video-${Date.now()}.mp4`}
                    className="inline-block text-xs text-primary hover:underline"
                  >
                    Download MP4
                  </a>
                </div>
              )}

              {videoAssets.voiceover.dataUrl && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Voiceover (full narration)</p>
                  <audio controls src={videoAssets.voiceover.dataUrl} className="w-full" />
                  <a
                    href={videoAssets.voiceover.dataUrl}
                    download={`voiceover-${Date.now()}.mp3`}
                    className="inline-block text-xs text-primary hover:underline"
                  >
                    Download MP3
                  </a>
                </div>
              )}

              {videoAssets.images.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Scene images</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {videoAssets.images.map((img) => (
                      <div key={img.sceneNumber} className="space-y-1">
                        <p className="text-xs text-muted-foreground">Scene {img.sceneNumber}</p>
                        {img.url ? (
                          <a href={img.url} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.url}
                              alt={`Scene ${img.sceneNumber}`}
                              className="w-full rounded-md border"
                            />
                          </a>
                        ) : (
                          <p className="text-xs text-destructive">
                            {img.error || "Image failed"}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderVideoAdResult() {
    if (!videoAdResult) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Video Ad Storyboard
            <Badge variant="secondary">{videoAdResult.adFormat}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Concept */}
          <div className="rounded-lg bg-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Creative Concept
            </p>
            <p className="mt-1 text-sm">{videoAdResult.concept}</p>
          </div>

          {/* Frames */}
          <div className="space-y-4">
            <p className="text-sm font-semibold">Frames</p>
            <div className="grid gap-4 md:grid-cols-2">
              {videoAdResult.frames.map((frame) => (
                <div
                  key={frame.frameNumber}
                  className="rounded-lg border bg-card p-4"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <Badge variant="outline">Frame {frame.frameNumber}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {frame.duration}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-muted-foreground">
                        Background:{" "}
                      </span>
                      {frame.background}
                    </div>
                    <div className="text-lg font-bold">{frame.headline}</div>
                    <div className="text-muted-foreground">{frame.subtext}</div>
                    <div className="text-xs italic text-muted-foreground">
                      Animation: {frame.animation}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="rounded-lg border-l-4 border-green-500 bg-green-500/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-green-600">
              Call to Action
            </p>
            <p className="mt-1 text-sm font-medium">{videoAdResult.cta}</p>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div>
              <span className="font-medium">Target Audience:</span>{" "}
              {videoAdResult.targetAudience}
            </div>
            <div>
              <span className="font-medium">Format:</span>{" "}
              {videoAdResult.adFormat}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                copyToClipboard(formatVideoAdText(videoAdResult))
              }
            >
              {copied ? "Copied!" : "Copy Storyboard"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderCarouselResult() {
    if (!carouselResult) return null;

    const slide = carouselResult.slides[currentSlide];
    if (!slide) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {carouselResult.title}
            <Badge variant="secondary">
              {carouselResult.slides.length} slides
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Slide preview */}
          <div className="rounded-lg border bg-gradient-to-br from-muted to-muted/50 p-6">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Slide {slide.slideNumber} of {carouselResult.slides.length}
            </div>
            <h4 className="mb-2 text-xl font-bold">{slide.heading}</h4>
            <p className="mb-4 text-sm">{slide.body}</p>
            <div className="rounded bg-background/50 p-2 text-xs text-muted-foreground">
              <span className="font-medium">Visual suggestion: </span>
              {slide.visualSuggestion}
            </div>
            {slide.speakerNotes && (
              <div className="mt-2 text-xs italic text-muted-foreground">
                Notes: {slide.speakerNotes}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={currentSlide === 0}
              onClick={() => setCurrentSlide((prev) => prev - 1)}
            >
              Previous
            </Button>

            {/* Dots */}
            <div className="flex gap-1.5">
              {carouselResult.slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2.5 w-2.5 rounded-full transition-colors ${
                    idx === currentSlide
                      ? "bg-primary"
                      : "bg-muted-foreground/30"
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={currentSlide === carouselResult.slides.length - 1}
              onClick={() => setCurrentSlide((prev) => prev + 1)}
            >
              Next
            </Button>
          </div>

          {/* Hashtags */}
          {carouselResult.hashtags.length > 0 && (
            <div className="text-sm text-primary">
              {carouselResult.hashtags.map((h) => `#${h}`).join(" ")}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                copyToClipboard(formatCarouselText(carouselResult))
              }
            >
              {copied ? "Copied!" : "Copy All"}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                handleSavePost(
                  formatCarouselText(carouselResult),
                  carouselResult.hashtags
                )
              }
            >
              Save as Draft
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Main Render ---

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Create Content</h1>

      {hasBrandVoice === false && !brandVoiceBannerDismissed && (
        <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium">
              Generic AI output is your default — fix it in 30 seconds
            </p>
            <p className="text-xs text-muted-foreground">
              Your brand voice is empty, so every post sounds like ChatGPT. Train it on
              your existing posts in Settings and every future post sounds like you wrote it.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button asChild size="sm">
              <a href="/settings#brand-voice">Train now</a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                localStorage.setItem("brand_voice_banner_dismissed", "1");
                setBrandVoiceBannerDismissed(true);
              }}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Shared list of previously-used website URLs, attached via list="recent-websites" on every URL input on this page. */}
      {recentWebsites.length > 0 && (
        <datalist id="recent-websites">
          {recentWebsites.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      )}

      {/* Content Type Tabs */}
      <Tabs
        value={contentType}
        onValueChange={(v) => {
          setContentType(v as ContentType);
          trackClient("tab_switched", { to: v });
        }}
      >
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="post">Social Post</TabsTrigger>
          <TabsTrigger value="video-script">Video Script</TabsTrigger>
          <TabsTrigger value="video-ad">Video Ad</TabsTrigger>
          <TabsTrigger value="carousel">Carousel</TabsTrigger>
        </TabsList>

        {/* All tab contents share the same form */}
        <TabsContent value={contentType}>
          <form onSubmit={handleGenerate} className="space-y-6" aria-label="Content generation form">
            {/* Common inputs */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {platforms.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tones.map((tn) => (
                      <SelectItem key={tn} value={tn}>
                        {tn.charAt(0).toUpperCase() + tn.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="English">English</SelectItem>
                  <SelectItem value="German">Deutsch</SelectItem>
                  <SelectItem value="French">Francais</SelectItem>
                  <SelectItem value="Spanish">Espanol</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Topic</Label>
              <Textarea
                placeholder="Describe what you want to create content about... (Ctrl/⌘ + Enter to generate)"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !loading && topic.trim()) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={4}
                required
              />
              {contentType === "post" && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <button
                    type="button"
                    onClick={fetchHashtags}
                    disabled={loadingHashtags || !topic.trim()}
                    className="text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                  >
                    {loadingHashtags ? "Loading..." : "Suggest hashtags"}
                  </button>
                  <span className={postResult ? (
                    postResult.content.length > PLATFORM_LIMITS[platform as PlatformKey]
                      ? "text-destructive font-medium"
                      : "text-muted-foreground"
                  ) : "text-muted-foreground"}>
                    {postResult
                      ? `${postResult.content.length} / ${PLATFORM_LIMITS[platform as PlatformKey].toLocaleString()} chars`
                      : `Limit: ${PLATFORM_LIMITS[platform as PlatformKey].toLocaleString()} chars`}
                  </span>
                </div>
              )}
              {suggestedHashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {suggestedHashtags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`#${tag}`);
                        toast.success(`#${tag} copied`);
                      }}
                      className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Type-specific inputs */}
            {contentType === "video-script" && (
              <div className="space-y-3 rounded-lg border border-dashed p-4">
                <div>
                  <Label>Generate complete video for your website (Pro)</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Paste a URL — we scrape the page, write the script, and generate scene images + voiceover in one step. Uses ~1 + scenes + 1 of your monthly quota.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    type="url"
                    placeholder="https://yoursite.com"
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    className="flex-1"
                    list="recent-websites"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={loadingSiteVideo || !siteUrl.trim()}
                    onClick={handleGenerateVideoFromSite}
                  >
                    {loadingSiteVideo ? "Generating..." : "Generate video for my site"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tip: the Topic field above, if filled, is used as an extra focus hint.
                </p>
              </div>
            )}

            {contentType === "video-ad" && (
              <div className="space-y-2">
                <Label>Product / Brand Name</Label>
                <Input
                  placeholder="e.g. Nike Air Max, Notion, your SaaS product..."
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  required
                />
              </div>
            )}

            {contentType === "carousel" && (
              <div className="space-y-2">
                <Label>Number of Slides ({slideCount})</Label>
                <input
                  type="range"
                  min={3}
                  max={10}
                  value={slideCount}
                  onChange={(e) => setSlideCount(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>3</span>
                  <span>10</span>
                </div>
              </div>
            )}

            {/* Post-specific: website URL */}
            {contentType === "post" && (
              <div className="space-y-2">
                <Label>Website URL (optional)</Label>
                <Input
                  type="url"
                  placeholder="https://yoursite.com"
                  value={postWebsiteUrl}
                  onChange={(e) => setPostWebsiteUrl(e.target.value)}
                  list="recent-websites"
                />
                <p className="text-xs text-muted-foreground">
                  If set, we scrape title, description, and headings and weave them into the post with a soft CTA back to your site.
                </p>
              </div>
            )}

            {/* Post-specific toggles */}
            {contentType === "post" && (
              <div className="flex flex-wrap gap-6">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={enableVariants}
                    onChange={(e) => setEnableVariants(e.target.checked)}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  <span className="text-sm font-medium">
                    Generate A/B Variants
                  </span>
                  <span className="text-xs text-muted-foreground">
                    (3 different versions)
                  </span>
                </label>

                {!enableVariants && (
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={enableImage}
                      onChange={(e) => setEnableImage(e.target.checked)}
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                    <span className="text-sm font-medium">
                      Also generate image
                    </span>
                    <span className="text-xs text-muted-foreground">
                      (DALL-E 3)
                    </span>
                  </label>
                )}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full md:w-auto"
              aria-busy={loading}
            >
              {getGenerateButtonText()}
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      {/* Results */}
      <div aria-live="polite">
      {contentType === "post" && !enableVariants && postResult && (
        <PostPreview
          platform={platform}
          content={postResult.content}
          hashtags={postResult.hashtags}
          imageUrl={imageUrl}
        />
      )}
      {contentType === "post" && !enableVariants && renderPostResult()}
      {contentType === "post" && enableVariants && renderVariantsResult()}
      {contentType === "video-script" && renderVideoScriptResult()}
      {contentType === "video-ad" && renderVideoAdResult()}
      {contentType === "carousel" && renderCarouselResult()}
      </div>
    </div>
  );
}
