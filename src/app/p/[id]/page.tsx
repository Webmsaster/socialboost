import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function loadPost(id: string) {
  // Only published posts are publicly viewable. No topic, no user data exposed.
  const supabase = getAdmin();
  const { data } = await supabase
    .from("posts")
    .select("id, platform, content, hashtags, created_at, status")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await loadPost(id);
  if (!post) return { title: "Post not found — SocialBoost" };

  const snippet = (post.content as string).slice(0, 140);
  return {
    title: `${post.platform} post — SocialBoost`,
    description: snippet,
    openGraph: {
      title: `Shared ${post.platform} post`,
      description: snippet,
      type: "article",
    },
    robots: { index: false, follow: false },
  };
}

export default async function PublicPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await loadPost(id);
  if (!post) notFound();

  const hashtags = (post.hashtags as string[] | null) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold">
            SocialBoost
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try for free
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-6">
          <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {post.platform}
          </span>
        </div>

        <article className="rounded-2xl border bg-card p-8 shadow-sm">
          <p className="whitespace-pre-wrap text-base leading-relaxed">
            {post.content}
          </p>
          {hashtags.length > 0 && (
            <p className="mt-6 text-sm text-primary">
              {hashtags.map((h) => `#${h}`).join(" ")}
            </p>
          )}
        </article>

        <div className="mt-10 rounded-xl border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Built with SocialBoost — AI-powered social media content in seconds.
          </p>
          <Link
            href="/signup"
            className="mt-3 inline-block rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create your own
          </Link>
        </div>
      </main>
    </div>
  );
}
