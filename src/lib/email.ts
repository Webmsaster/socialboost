import { Resend } from "resend";
import { captureError } from "./logger";

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM_EMAIL = process.env.EMAIL_FROM || "SocialBoost <noreply@socialboost.app>";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    // No RESEND_API_KEY configured — skip silently in dev
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    if (error) {
      captureError("Resend send failed", error, { to, subject });
      return false;
    }
    return true;
  } catch (error) {
    captureError("Resend send threw", error, { to, subject });
    return false;
  }
}

export async function sendPostPublishedEmail(
  to: string,
  postContent: string,
  platform: string
): Promise<boolean> {
  const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
  return sendEmail({
    to,
    subject: `Your ${platformName} post was published!`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #7c3aed, #6d28d9); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">SocialBoost</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="margin-top: 0;">Your post is live on ${platformName}!</h2>
          <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 3px solid #7c3aed;">
            <p style="margin: 0; color: #374151; font-size: 14px; white-space: pre-wrap;">${postContent.slice(0, 300)}${postContent.length > 300 ? "..." : ""}</p>
          </div>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://socialboost.app"}/history"
             style="display: inline-block; background: #7c3aed; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">
            View in History
          </a>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
            You received this email because a scheduled post was published from your SocialBoost account.
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendLimitReachedEmail(
  to: string,
  currentPlan: string,
  limit: number
): Promise<boolean> {
  const isPro = currentPlan === "active";
  return sendEmail({
    to,
    subject: "You've reached your monthly generation limit",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #7c3aed, #6d28d9); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">SocialBoost</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="margin-top: 0;">Monthly limit reached</h2>
          <p style="color: #374151;">
            You've used all <strong>${limit}</strong> generations this month on your <strong>${isPro ? "Pro" : "Free"}</strong> plan.
            Your limit will reset at the beginning of next month.
          </p>
          ${
            !isPro
              ? `<div style="background: #f5f3ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
                  <p style="margin: 0 0 12px 0; font-weight: 600; color: #5b21b6;">Upgrade to Pro for 100 generations/month</p>
                  <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://socialboost.app"}/settings"
                     style="display: inline-block; background: #7c3aed; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">
                    Upgrade to Pro — $9/mo
                  </a>
                </div>`
              : ""
          }
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
            You received this email because your SocialBoost generation limit was reached.
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendReviewApprovedEmail(
  to: string,
  postTopic: string,
  reviewerName: string,
  note?: string
): Promise<boolean> {
  return sendEmail({
    to,
    subject: "Your post was approved!",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #7c3aed, #6d28d9); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">SocialBoost</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="margin-top: 0; color: #16a34a;">Post Approved</h2>
          <p style="color: #374151;">
            <strong>${reviewerName}</strong> approved your post: <em>${postTopic}</em>
          </p>
          ${note ? `<div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 3px solid #16a34a;">
            <p style="margin: 0; color: #166534; font-size: 14px;">${note}</p>
          </div>` : ""}
          <p style="color: #374151; font-size: 14px;">
            Your post is now ready to be scheduled and published.
          </p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://socialboost.app"}/history"
             style="display: inline-block; background: #7c3aed; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">
            View Post
          </a>
        </div>
      </div>
    `,
  });
}

export async function sendReviewRejectedEmail(
  to: string,
  postTopic: string,
  reviewerName: string,
  note?: string
): Promise<boolean> {
  return sendEmail({
    to,
    subject: "Your post needs changes",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #7c3aed, #6d28d9); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">SocialBoost</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="margin-top: 0; color: #d97706;">Changes Requested</h2>
          <p style="color: #374151;">
            <strong>${reviewerName}</strong> sent back your post: <em>${postTopic}</em>
          </p>
          ${note ? `<div style="background: #fffbeb; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 3px solid #d97706;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">${note}</p>
          </div>` : ""}
          <p style="color: #374151; font-size: 14px;">
            Your post has been moved back to drafts. Edit it and resubmit when ready.
          </p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://socialboost.app"}/history"
             style="display: inline-block; background: #7c3aed; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">
            Edit Post
          </a>
        </div>
      </div>
    `,
  });
}

export async function sendWelcomeEmail(to: string, name?: string): Promise<boolean> {
  const greeting = name ? `Hi ${name}` : "Welcome";
  return sendEmail({
    to,
    subject: "Welcome to SocialBoost!",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #7c3aed, #6d28d9); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">SocialBoost</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="margin-top: 0;">${greeting}!</h2>
          <p style="color: #374151;">You just joined SocialBoost — the easiest way to create social media content with AI.</p>
          <p style="color: #374151;">Here's how to get the most out of your first week:</p>
          <ol style="color: #374151; padding-left: 20px;">
            <li style="margin-bottom: 8px;"><strong>Create your first post</strong> — Pick a platform, topic, and tone. Takes 30 seconds.</li>
            <li style="margin-bottom: 8px;"><strong>Try Bulk Generation</strong> — Generate a full week of content in one click.</li>
            <li style="margin-bottom: 8px;"><strong>Set up a Content Series</strong> — Automate recurring posts like "Monday Motivation."</li>
          </ol>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://socialboost.app"}/create"
             style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; margin-top: 8px;">
            Create Your First Post
          </a>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
            You're on the Free plan (10 posts/month). Upgrade to Pro for 100 posts, AI images, video scripts, and more.
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendDay3ReminderEmail(to: string): Promise<boolean> {
  return sendEmail({
    to,
    subject: "Have you tried these SocialBoost features?",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #7c3aed, #6d28d9); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">SocialBoost</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="margin-top: 0;">3 features you might have missed</h2>
          <div style="margin: 16px 0;">
            <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 12px;">
              <p style="margin: 0; font-weight: 600;">Content Repurposing</p>
              <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">Turn one post into 5 platform-ready versions with one click.</p>
            </div>
            <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 12px;">
              <p style="margin: 0; font-weight: 600;">AI Content Score</p>
              <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">Get instant feedback on your post quality before publishing.</p>
            </div>
            <div style="background: #f9fafb; padding: 16px; border-radius: 8px;">
              <p style="margin: 0; font-weight: 600;">Auto-Scheduling</p>
              <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">Let AI pick the best times for your posts across all platforms.</p>
            </div>
          </div>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://socialboost.app"}/dashboard"
             style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px;">
            Explore Features
          </a>
        </div>
      </div>
    `,
  });
}

export async function sendDay7UpgradeEmail(to: string, generationsUsed: number): Promise<boolean> {
  return sendEmail({
    to,
    subject: "Your first week with SocialBoost",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #7c3aed, #6d28d9); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">SocialBoost</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="margin-top: 0;">Your first week recap</h2>
          <p style="color: #374151;">You've created <strong>${generationsUsed}</strong> posts this week. ${generationsUsed >= 5 ? "You're on a roll!" : "Time to ramp up?"}</p>
          <div style="background: #f5f3ff; padding: 20px; border-radius: 8px; margin: 16px 0; text-align: center;">
            <p style="margin: 0 0 8px; font-weight: 600; color: #5b21b6;">Ready for more?</p>
            <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px;">Upgrade to Pro for 100 generations/month, AI images, video scripts, content series, and more.</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://socialboost.app"}/settings"
               style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px;">
              Upgrade to Pro — $9/mo
            </a>
          </div>
        </div>
      </div>
    `,
  });
}

/**
 * Day 5: Push the Pro Auto-Train-Brand-Voice feature.
 * The feature is invisible unless we explicitly point users at it — and it's
 * the single biggest quality lever they have, so this email is the most
 * cost-effective nudge in the drip.
 */
export async function sendBrandVoiceNudgeEmail(
  to: string,
  postsSoFar: number,
): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://socialboost.app";
  const recap = postsSoFar > 0
    ? `You've generated <strong>${postsSoFar}</strong> posts so far. Want them to sound less like ChatGPT and more like you?`
    : `Most users tell us their first AI posts sound generic. There's a fix.`;
  return sendEmail({
    to,
    subject: "Make SocialBoost write in your voice — 30 seconds",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #7c3aed, #6d28d9); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">SocialBoost</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="margin-top: 0;">Your posts can sound like you — not like ChatGPT</h2>
          <p style="color: #374151;">${recap}</p>
          <p style="color: #374151;">Auto-Train Brand Voice (Pro feature) reads your existing posts, learns your tone, vocabulary, hook style, and CTA patterns, then injects that into every future post. No more "Unlocking the power of…" openings.</p>
          <div style="background: #f5f3ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0; color: #5b21b6; font-weight: 600;">How it works</p>
            <ol style="color: #374151; margin: 8px 0 0; padding-left: 18px; font-size: 14px;">
              <li>Open Settings → Auto-train brand voice</li>
              <li>Pick "Use my last posts" or paste 5-10 examples</li>
              <li>Click Analyze — you get a voice profile in ~5 seconds</li>
              <li>Apply it. Every future post sounds like you wrote it.</li>
            </ol>
          </div>
          <a href="${appUrl}/settings#brand-voice"
             style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px;">
            Train my voice now
          </a>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
            This feature is part of Pro. Not yet on Pro? <a href="${appUrl}/settings" style="color: #7c3aed;">Upgrade for $9/mo</a>.
          </p>
        </div>
      </div>
    `,
  });
}

/**
 * Day 10: Highlight the video pipeline. Pro-only, drives upgrades.
 * Sent only to users still on the Free plan after the brand-voice nudge —
 * the email-drip route handles the targeting.
 */
export async function sendVideoFeatureEmail(to: string): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://socialboost.app";
  return sendEmail({
    to,
    subject: "Did you know SocialBoost makes videos too?",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #7c3aed, #6d28d9); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">SocialBoost</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="margin-top: 0;">Reels / TikTok / Shorts — done in one click</h2>
          <p style="color: #374151;">Most people use SocialBoost for text posts and never discover the video pipeline. It produces ready-to-post 1080×1920 MP4s in under a minute.</p>
          <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <ol style="color: #374151; margin: 0; padding-left: 18px; font-size: 14px; line-height: 1.6;">
              <li>Open Create → Video Script tab, type your topic.</li>
              <li>Click <strong>Generate Full Video Assets</strong> — AI writes the script, generates one portrait image per scene, and creates a voiceover.</li>
              <li>Click <strong>Render Full Video</strong> — get a finished MP4 with Ken-Burns motion, text overlays, and embedded voiceover.</li>
              <li>Download. Post to Reels / TikTok / Shorts / LinkedIn.</li>
            </ol>
          </div>
          <a href="${appUrl}/create?tab=video-script"
             style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px;">
            Try video generation
          </a>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
            Full video render is a Pro feature. Scripts and image previews are available on every plan.
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendWeeklyDigestEmail(
  to: string,
  stats: { postsCreated: number; postsPublished: number; topPlatform: string; streak: number }
): Promise<boolean> {
  return sendEmail({
    to,
    subject: `Your weekly SocialBoost recap: ${stats.postsCreated} posts created`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #7c3aed, #6d28d9); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">SocialBoost</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="margin-top: 0;">Your Week in Numbers</h2>
          <div style="display: flex; gap: 12px; margin: 16px 0;">
            <div style="flex: 1; background: #f9fafb; padding: 16px; border-radius: 8px; text-align: center;">
              <p style="margin: 0; font-size: 28px; font-weight: bold; color: #7c3aed;">${stats.postsCreated}</p>
              <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">Posts Created</p>
            </div>
            <div style="flex: 1; background: #f9fafb; padding: 16px; border-radius: 8px; text-align: center;">
              <p style="margin: 0; font-size: 28px; font-weight: bold; color: #7c3aed;">${stats.postsPublished}</p>
              <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">Published</p>
            </div>
            <div style="flex: 1; background: #f9fafb; padding: 16px; border-radius: 8px; text-align: center;">
              <p style="margin: 0; font-size: 28px; font-weight: bold; color: #7c3aed;">${stats.streak}</p>
              <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">Day Streak</p>
            </div>
          </div>
          ${stats.topPlatform ? `<p style="color: #374151; font-size: 14px;">Your top platform this week: <strong>${stats.topPlatform}</strong></p>` : ""}
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://socialboost.app"}/analytics"
             style="display: inline-block; background: #7c3aed; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; margin-top: 8px;">
            View Full Analytics
          </a>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
            You can disable weekly digests in Settings > Notifications.
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendPublishFailedEmail(
  to: string,
  platform: string,
  errorMessage: string
): Promise<boolean> {
  const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
  return sendEmail({
    to,
    subject: `Failed to publish your ${platformName} post`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #7c3aed, #6d28d9); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">SocialBoost</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="margin-top: 0; color: #dc2626;">Publishing failed</h2>
          <p style="color: #374151;">
            We couldn't publish your scheduled post to <strong>${platformName}</strong>.
          </p>
          <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 3px solid #dc2626;">
            <p style="margin: 0; color: #991b1b; font-size: 14px;">${errorMessage}</p>
          </div>
          <p style="color: #374151; font-size: 14px;">
            Your post has been saved as a draft. You can try reconnecting your account or publishing manually.
          </p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://socialboost.app"}/history"
             style="display: inline-block; background: #7c3aed; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">
            View Post
          </a>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
            You received this email because a scheduled post failed to publish from your SocialBoost account.
          </p>
        </div>
      </div>
    `,
  });
}
