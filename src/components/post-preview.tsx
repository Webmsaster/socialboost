"use client";

import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";

interface PostPreviewProps {
  platform: string;
  content: string;
  hashtags: string[];
  imageUrl?: string | null;
}

function LinkedInPreview({ content, hashtags }: PostPreviewProps) {
  return (
    <div className="rounded-lg border bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
            U
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Your Name</p>
            <p className="text-xs text-muted-foreground">Your Headline | 1h</p>
          </div>
        </div>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
        {hashtags.length > 0 && (
          <p className="mt-2 text-sm text-blue-600">
            {hashtags.map((h) => `#${h}`).join(" ")}
          </p>
        )}
      </div>
      <div className="border-t px-4 py-2 flex gap-6 text-xs text-muted-foreground">
        <span>Like</span>
        <span>Comment</span>
        <span>Repost</span>
        <span>Send</span>
      </div>
    </div>
  );
}

function TwitterPreview({ content, hashtags }: PostPreviewProps) {
  return (
    <div className="rounded-xl border bg-white dark:bg-zinc-900 p-4">
      <div className="flex gap-3">
        <div className="h-10 w-10 rounded-full bg-sky-500 flex items-center justify-center text-white font-bold shrink-0">
          U
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="text-sm font-bold">Your Name</span>
            <span className="text-sm text-muted-foreground">@yourhandle · 1h</span>
          </div>
          <p className="text-sm whitespace-pre-wrap mt-1">{content}</p>
          {hashtags.length > 0 && (
            <p className="mt-1 text-sm text-sky-500">
              {hashtags.map((h) => `#${h}`).join(" ")}
            </p>
          )}
          <div className="mt-3 flex gap-8 text-xs text-muted-foreground">
            <span>Reply</span>
            <span>Repost</span>
            <span>Like</span>
            <span>Share</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function InstagramPreview({ content, hashtags, imageUrl }: PostPreviewProps) {
  return (
    <div className="rounded-lg border bg-white dark:bg-zinc-900 overflow-hidden max-w-sm">
      <div className="flex items-center gap-2 p-3">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-500 to-yellow-500 flex items-center justify-center text-white text-xs font-bold">
          U
        </div>
        <span className="text-sm font-semibold">yourhandle</span>
      </div>
      {imageUrl ? (
        <Image src={imageUrl} alt="Post visual" width={400} height={400} className="w-full aspect-square object-cover" unoptimized />
      ) : (
        <div className="w-full aspect-square bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900/20 dark:to-purple-900/20 flex items-center justify-center">
          <span className="text-xs text-muted-foreground">Image placeholder</span>
        </div>
      )}
      <div className="p-3">
        <div className="flex gap-4 mb-2 text-xs text-muted-foreground">
          <span>Like</span>
          <span>Comment</span>
          <span>Share</span>
        </div>
        <p className="text-sm">
          <span className="font-semibold mr-1">yourhandle</span>
          {content.length > 125 ? content.slice(0, 125) + "..." : content}
        </p>
        {hashtags.length > 0 && (
          <p className="mt-1 text-sm text-blue-500">
            {hashtags.map((h) => `#${h}`).join(" ")}
          </p>
        )}
      </div>
    </div>
  );
}

function FacebookPreview({ content, hashtags }: PostPreviewProps) {
  return (
    <div className="rounded-lg border bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
            U
          </div>
          <div>
            <p className="text-sm font-semibold">Your Name</p>
            <p className="text-xs text-muted-foreground">1h · Public</p>
          </div>
        </div>
        <p className="text-sm whitespace-pre-wrap">{content}</p>
        {hashtags.length > 0 && (
          <p className="mt-2 text-sm text-blue-600">
            {hashtags.map((h) => `#${h}`).join(" ")}
          </p>
        )}
      </div>
      <div className="border-t px-4 py-2 flex justify-around text-xs text-muted-foreground">
        <span>Like</span>
        <span>Comment</span>
        <span>Share</span>
      </div>
    </div>
  );
}

function PinterestPreview({ content, hashtags, imageUrl }: PostPreviewProps) {
  return (
    <div className="rounded-2xl border bg-white dark:bg-zinc-900 overflow-hidden max-w-xs">
      {imageUrl ? (
        <Image src={imageUrl} alt="Pin visual" width={320} height={480} className="w-full aspect-[2/3] object-cover" unoptimized />
      ) : (
        <div className="w-full aspect-[2/3] bg-gradient-to-b from-red-100 to-orange-100 dark:from-red-900/20 dark:to-orange-900/20 flex items-center justify-center">
          <span className="text-xs text-muted-foreground">Pin image</span>
        </div>
      )}
      <div className="p-3">
        <p className="text-sm font-semibold line-clamp-2">{content.slice(0, 100)}</p>
        {hashtags.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {hashtags.map((h) => `#${h}`).join(" ")}
          </p>
        )}
      </div>
    </div>
  );
}

export function PostPreview({ platform, content, hashtags, imageUrl }: PostPreviewProps) {
  if (!content) return null;

  const props = { platform, content, hashtags, imageUrl };

  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm font-medium text-muted-foreground mb-3">
          Preview — {platform.charAt(0).toUpperCase() + platform.slice(1)}
        </p>
        {platform === "linkedin" && <LinkedInPreview {...props} />}
        {platform === "twitter" && <TwitterPreview {...props} />}
        {platform === "instagram" && <InstagramPreview {...props} />}
        {platform === "facebook" && <FacebookPreview {...props} />}
        {platform === "pinterest" && <PinterestPreview {...props} />}
      </CardContent>
    </Card>
  );
}
