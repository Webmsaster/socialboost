import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { captureError } from "./logger";
import { parseSafeUrl, safeFetch } from "./ssrf";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** A user-configured outbound webhook endpoint. */
export type UserWebhook = {
  id: string;
  url: string;
  /** Per-endpoint HMAC-SHA256 signing secret (user_webhooks.secret). */
  secret: string;
};

/**
 * Deliver a single signed webhook request.
 *
 * Signs the EXACT rawBody string with the endpoint's secret using HMAC-SHA256
 * and ships it as `X-SocialBoost-Signature: sha256=<hex>`. The same rawBody is
 * used for both signing and the request body so receivers can recompute the
 * HMAC over the raw bytes they receive. SSRF-checks the URL before sending.
 */
export async function dispatchWebhook(
  webhook: UserWebhook,
  rawBody: string,
  event: string,
  timestamp: string
): Promise<void> {
  const safe = parseSafeUrl(webhook.url);
  if (!safe) {
    captureError("Webhook URL rejected at dispatch (invalid or private host)", null, {
      webhookId: webhook.id,
      event,
    });
    return;
  }

  const signature = createHmac("sha256", webhook.secret).update(rawBody).digest("hex");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    // safeFetch re-validates + resolve-and-pins internally (DNS-rebinding-safe);
    // the parseSafeUrl above is just a cheap early reject with webhook context.
    const res = await safeFetch(safe.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SocialBoost-Signature": `sha256=${signature}`,
        "X-SocialBoost-Event": event,
        "X-SocialBoost-Timestamp": timestamp,
      },
      body: rawBody,
      signal: controller.signal,
    });
    if (!res.ok) {
      captureError("Webhook delivery non-2xx", new Error(`HTTP ${res.status}`), {
        webhookId: webhook.id,
        event,
        status: res.status,
      });
    }
  } catch (err) {
    captureError("Webhook delivery failed", err, { webhookId: webhook.id, event });
  } finally {
    clearTimeout(timeout);
  }
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
      .select("id, url, secret")
      .eq("user_id", userId)
      .eq("is_active", true)
      .contains("events", [event]);

    if (!webhooks || webhooks.length === 0) return;

    const timestamp = new Date().toISOString();
    const rawBody = JSON.stringify({
      event,
      timestamp,
      data: payload,
    });

    for (const webhook of webhooks as UserWebhook[]) {
      await dispatchWebhook(webhook, rawBody, event, timestamp);
    }
  } catch (err) {
    captureError("Webhook dispatch error", err, { userId, event });
  }
}
