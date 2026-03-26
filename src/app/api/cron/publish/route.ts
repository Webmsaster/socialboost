import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { captureError } from "@/lib/logger";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Cron-ready endpoint: processes posts that are scheduled and past due.
 * Call via Vercel Cron or external scheduler every 5 minutes.
 * Secured via CRON_SECRET header.
 *
 * Without OAuth platform connections, posts are marked as "published"
 * so they appear correctly in the calendar/history. When OAuth is added,
 * this endpoint will actually push content to the platforms.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Reset generation counts for users whose reset date has passed
  const { error: resetError } = await supabase
    .from("profiles")
    .update({ generation_count: 0, generation_reset_at: new Date().toISOString() })
    .lt("generation_reset_at", new Date().toISOString());

  if (resetError) {
    captureError("Cron: failed to reset generation counts", resetError);
  }

  // Find all posts scheduled for a time in the past that are still "scheduled"
  const { data: posts, error: fetchError } = await supabase
    .from("posts")
    .select("id, user_id, platform, content, connected_account_id")
    .eq("status", "scheduled")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(50);

  if (fetchError) {
    captureError("Cron: failed to fetch scheduled posts", fetchError);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }

  if (!posts || posts.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let published = 0;
  let failed = 0;

  for (const post of posts) {
    // When OAuth is implemented, publish to the platform here.
    // For now, mark as published since there's no platform connection.
    if (post.connected_account_id) {
      // TODO: Publish to platform via OAuth token
      // For now, mark as failed with explanation
      const { error } = await supabase
        .from("posts")
        .update({
          status: "failed",
          error_message: "Platform publishing not yet implemented",
        })
        .eq("id", post.id);

      if (error) {
        captureError("Cron: failed to update post status", error, { postId: post.id });
      }
      failed++;
    } else {
      // No connected account — mark as published (user handles manual posting)
      const { error } = await supabase
        .from("posts")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
        })
        .eq("id", post.id);

      if (error) {
        captureError("Cron: failed to mark post as published", error, { postId: post.id });
        failed++;
      } else {
        published++;
      }
    }
  }

  return NextResponse.json({ processed: posts.length, published, failed });
}
