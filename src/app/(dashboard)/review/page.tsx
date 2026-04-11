"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { TableSkeleton } from "@/components/loading-skeleton";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";

interface ReviewPost {
  id: string;
  platform: string;
  topic: string;
  content: string;
  hashtags: string[];
  tone: string;
  status: string;
  created_at: string;
  user_id: string;
  profiles?: { full_name: string | null; email: string } | null;
}

export default function ReviewPage() {
  const [posts, setPosts] = useState<ReviewPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [canReview, setCanReview] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    loadReviews();
  }, []);

  async function loadReviews() {
    setLoading(true);
    try {
      const res = await fetch("/api/review");
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
        setCanReview(data.canReview || false);
      }
    } catch {
      toast.error("Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(postId: string, action: "approve" | "reject") {
    setProcessingId(postId);
    try {
      const res = await fetch("/api/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, action, note: reviewNote }),
      });
      if (res.ok) {
        toast.success(action === "approve" ? t("review.approved") : t("review.rejected"));
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setReviewingId(null);
        setReviewNote("");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed");
      }
    } catch {
      toast.error("Failed to process review");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t("review.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("review.description")}</p>
      </div>

      {loading ? (
        <TableSkeleton rows={3} />
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{t("review.empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{post.platform}</Badge>
                    <Badge variant="outline" className="capitalize">{post.tone}</Badge>
                    <Badge variant="default">Pending Review</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {post.profiles?.full_name || post.profiles?.email || "Unknown"}
                    {" · "}
                    {new Date(post.created_at).toLocaleDateString()}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-1">{post.topic}</p>
                  <div className="rounded-lg bg-muted p-4 text-sm whitespace-pre-wrap">
                    {post.content}
                    {post.hashtags?.length > 0 && (
                      <>
                        <br /><br />
                        <span className="text-primary">
                          {post.hashtags.map((h) => `#${h}`).join(" ")}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {canReview && (
                  <>
                    {reviewingId === post.id ? (
                      <div className="space-y-3">
                        <Textarea
                          placeholder={t("review.notePlaceholder")}
                          value={reviewNote}
                          onChange={(e) => setReviewNote(e.target.value)}
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleAction(post.id, "approve")}
                            disabled={processingId === post.id}
                          >
                            {t("review.approve")}
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => handleAction(post.id, "reject")}
                            disabled={processingId === post.id}
                          >
                            {t("review.reject")}
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => { setReviewingId(null); setReviewNote(""); }}
                          >
                            {t("review.cancel")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReviewingId(post.id)}
                      >
                        {t("review.startReview")}
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
