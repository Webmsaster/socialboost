import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { captureError } from "@/lib/logger";
import { sendPostPublishedEmail, sendPublishFailedEmail } from "@/lib/email";

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
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
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
    if (post.connected_account_id) {
      // Look up connected account for OAuth publishing
      const { data: account } = await supabase
        .from("connected_accounts")
        .select("*")
        .eq("id", post.connected_account_id)
        .single();

      if (!account) {
        await supabase
          .from("posts")
          .update({ status: "failed", error_message: "Connected account not found" })
          .eq("id", post.id);
        failed++;

        const { data: profile } = await supabase.from("profiles").select("email").eq("id", post.user_id).single();
        if (profile?.email) {
          sendPublishFailedEmail(profile.email, post.platform, "Connected account not found");
        }
        continue;
      }

      const { getPublisher } = await import("@/lib/platforms/registry");
      const publisher = getPublisher(account.platform);

      if (!publisher) {
        await supabase
          .from("posts")
          .update({ status: "failed", error_message: `Publishing to ${account.platform} is not yet supported` })
          .eq("id", post.id);
        failed++;

        const { data: profile } = await supabase.from("profiles").select("email").eq("id", post.user_id).single();
        if (profile?.email) {
          sendPublishFailedEmail(profile.email, post.platform, `Publishing to ${account.platform} is not yet supported`);
        }
        continue;
      }

      const result = await publisher.publish(account, post.content);

      if (result.success) {
        await supabase
          .from("posts")
          .update({
            status: "published",
            published_at: new Date().toISOString(),
            platform_post_id: result.platformPostId || null,
          })
          .eq("id", post.id);
        published++;

        const { data: profile } = await supabase.from("profiles").select("email").eq("id", post.user_id).single();
        if (profile?.email) {
          sendPostPublishedEmail(profile.email, post.content, post.platform);
        }
      } else {
        captureError("Cron: platform publish failed", new Error(result.error || "Unknown error"), { postId: post.id, platform: account.platform });
        await supabase
          .from("posts")
          .update({ status: "failed", error_message: result.error || "Publishing failed" })
          .eq("id", post.id);
        failed++;

        const { data: profile } = await supabase.from("profiles").select("email").eq("id", post.user_id).single();
        if (profile?.email) {
          sendPublishFailedEmail(profile.email, post.platform, result.error || "Publishing failed");
        }
      }
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

        // Send notification email
        const { data: profile } = await supabase.from("profiles").select("email").eq("id", post.user_id).single();
        if (profile?.email) {
          sendPostPublishedEmail(profile.email, post.content, post.platform);
        }
      }
    }
  }

  return NextResponse.json({ processed: posts.length, published, failed });
}
