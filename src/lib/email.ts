import { Resend } from "resend";

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
      console.error("[Email] Send failed:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[Email] Send error:", error);
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
