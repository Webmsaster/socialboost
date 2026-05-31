import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { captureError } from "@/lib/logger";
import { sendPostPublishedEmail, sendPublishFailedEmail, sendScheduledReminderEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit-log";
import { dispatchWebhooks } from "@/lib/webhook-dispatcher";
import { trackEvent } from "@/lib/analytics";
import { encryptToken, decryptToken } from "@/lib/token-crypto";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Cron-ready endpoint: processes posts that are scheduled and past due.
 * Scheduled daily at 08:00 UTC (vercel.json) on the Hobby tier, which caps
 * crons at 1×/day — so a post can publish up to ~24h after its scheduled time.
 * For near-real-time publishing, point an external scheduler (e.g. cron-job.org)
 * at this route every few minutes with the same CRON_SECRET bearer token.
 * Secured via CRON_SECRET header.
 *
 * For users without an OAuth-connected account on the post's platform we
 * send a "time to post manually" reminder email (copy-paste-friendly body)
 * instead of silently flipping the status. The user posts on their own,
 * then marks the post as published from /history.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // NOTE: monthly quota reset is handled lazily inside the
  // increment_generation_count / increment_video_generation_count RPCs
  // (calendar-month check on the first call of a new month). We must NOT
  // mass-reset here: `generation_reset_at < now()` matches every row on
  // every run, so this would zero every user's quota on each cron tick and
  // effectively grant unlimited free generations.

  // Find all posts scheduled for a time in the past that are still "scheduled"
  const { data: posts, error: fetchError } = await supabase
    .from("posts")
    .select("id, user_id, platform, topic, content, hashtags, media_url, connected_account_id, reminder_sent_at")
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
  let remindersSent = 0;

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
          sendPublishFailedEmail(profile.email, post.platform, "Connected account not found").catch(
            (err) => captureError("Cron: sendPublishFailedEmail failed", err)
          );
        }
        continue;
      }

      // Tokens are encrypted at rest — decrypt before handing them to the
      // token refresher and the platform publisher (which call the live APIs).
      // decryptToken THROWS on malformed ciphertext; isolate it per-row so one
      // corrupt token marks just this post failed instead of aborting the batch.
      try {
        account.access_token = decryptToken(account.access_token);
        account.refresh_token = decryptToken(account.refresh_token);
      } catch (err) {
        captureError("Cron: token decrypt failed", err, { postId: post.id, platform: post.platform });
        await supabase
          .from("posts")
          .update({ status: "failed", error_message: "token_decrypt_failed" })
          .eq("id", post.id);
        failed++;

        const { data: profile } = await supabase.from("profiles").select("email").eq("id", post.user_id).single();
        if (profile?.email) {
          sendPublishFailedEmail(profile.email, post.platform, "token_decrypt_failed").catch(
            (err) => captureError("Cron: sendPublishFailedEmail failed", err)
          );
        }
        continue;
      }

      const { getPublisher, ensureFreshToken } = await import("@/lib/platforms/registry");
      const publisher = getPublisher(account.platform);

      // Refresh expiring tokens before publishing. If the refresh FAILS we must
      // NOT hand the stale/empty token to the publisher — skip publishing,
      // mark the post failed (surfaced via the History "Retry" affordance) and
      // continue to the next post.
      try {
        const { account: freshAccount, refreshed } = await ensureFreshToken(account);
        if (refreshed) {
          if (!freshAccount.access_token) {
            throw new Error("token refresh returned no access token");
          }
          await supabase
            .from("connected_accounts")
            .update({
              access_token: encryptToken(freshAccount.access_token),
              refresh_token: encryptToken(freshAccount.refresh_token),
              token_expires_at: freshAccount.token_expires_at,
            })
            .eq("id", freshAccount.id);
          Object.assign(account, freshAccount);
        }
      } catch (err) {
        captureError("Cron: token refresh failed", err, { postId: post.id, platform: account.platform });
        await supabase
          .from("posts")
          .update({ status: "failed", error_message: "token_refresh_failed" })
          .eq("id", post.id);
        failed++;

        const { data: profile } = await supabase.from("profiles").select("email").eq("id", post.user_id).single();
        if (profile?.email) {
          sendPublishFailedEmail(profile.email, post.platform, "token_refresh_failed").catch(
            (err) => captureError("Cron: sendPublishFailedEmail failed", err)
          );
        }
        continue;
      }

      if (!publisher) {
        await supabase
          .from("posts")
          .update({ status: "failed", error_message: `Publishing to ${account.platform} is not yet supported` })
          .eq("id", post.id);
        failed++;

        const { data: profile } = await supabase.from("profiles").select("email").eq("id", post.user_id).single();
        if (profile?.email) {
          sendPublishFailedEmail(profile.email, post.platform, `Publishing to ${account.platform} is not yet supported`).catch(
            (err) => captureError("Cron: sendPublishFailedEmail failed", err)
          );
        }
        continue;
      }

      const result = await publisher.publish(account, post.content, post.hashtags ?? undefined, {
        mediaUrl: post.media_url ?? undefined,
      });

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

        await logAudit(post.user_id, "post.published", { postId: post.id, platform: post.platform });
        trackEvent({
          event: "post_published",
          userId: post.user_id,
          properties: { platform: post.platform, via: "platform_api" },
        });
        dispatchWebhooks(post.user_id, "post.published", {
          postId: post.id,
          platform: post.platform,
          platformPostId: result.platformPostId || null,
        }).catch(() => { /* handled inside */ });

        const { data: profile } = await supabase.from("profiles").select("email").eq("id", post.user_id).single();
        if (profile?.email) {
          sendPostPublishedEmail(profile.email, post.content, post.platform).catch(
            (err) => captureError("Cron: sendPostPublishedEmail failed", err)
          );
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
          sendPublishFailedEmail(profile.email, post.platform, result.error || "Publishing failed").catch(
            (err) => captureError("Cron: sendPublishFailedEmail failed", err)
          );
        }
      }
    } else {
      // No connected account — send a "time to post manually" reminder
      // instead of auto-marking the post as published (the old behavior was
      // a lie: nothing actually got posted, we just flipped the status).
      // Skip if we've already pinged the user for this post.
      if (post.reminder_sent_at) {
        continue;
      }
      const profileLookup = await supabase
        .from("profiles")
        .select("email")
        .eq("id", post.user_id)
        .single();
      const profile = profileLookup?.data;

      if (profile?.email) {
        const ok = await sendScheduledReminderEmail(profile.email, {
          id: post.id,
          platform: post.platform,
          content: post.content,
          hashtags: post.hashtags ?? [],
          topic: post.topic ?? null,
        }).catch((err) => {
          captureError("Cron: sendScheduledReminderEmail failed", err);
          return false;
        });

        if (ok) {
          await supabase
            .from("posts")
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq("id", post.id);
          remindersSent++;
          trackEvent({
            event: "scheduled_reminder_sent",
            userId: post.user_id,
            properties: { platform: post.platform },
          });
        } else {
          failed++;
        }
      }
    }
  }

  return NextResponse.json({ processed: posts.length, published, failed, remindersSent });
}
