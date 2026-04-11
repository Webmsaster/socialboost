import { createClient } from "@supabase/supabase-js";
import { captureError } from "./logger";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Fire all active webhooks for a user and event type.
 * Runs in the background — does not block the calling request.
 */
export async function dispatchWebhooks(
  userId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = getAdmin();
    const { data: webhooks } = await supabase
      .from("user_webhooks")
      .select("id, url")
      .eq("user_id", userId)
      .eq("is_active", true)
      .contains("events", [event]);

    if (!webhooks || webhooks.length === 0) return;

    const body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    for (const webhook of webhooks) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-SocialBoost-Event": event,
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeout);
      } catch (err) {
        captureError("Webhook delivery failed", err, { webhookId: webhook.id, event });
      }
    }
  } catch (err) {
    captureError("Webhook dispatch error", err, { userId, event });
  }
}
