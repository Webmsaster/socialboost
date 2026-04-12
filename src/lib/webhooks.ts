import { captureError } from "@/lib/logger";
import { parseSafeUrl } from "@/lib/ssrf";

interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Fires a webhook to the user's configured webhook URL.
 * Fire-and-forget — does not block the caller.
 */
export async function fireWebhook(
  webhookUrl: string | null | undefined,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  if (!webhookUrl) return;

  const safe = parseSafeUrl(webhookUrl);
  if (!safe) {
    captureError("Webhook URL rejected (invalid or private host)", null, { webhookUrl, event });
    return;
  }

  const payload: WebhookPayload = {
    event,
    data,
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(safe.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "SocialBoost-Webhook/1.0" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      captureError("Webhook delivery failed", new Error(`${res.status}`), { webhookUrl, event });
    }
  } catch (error) {
    captureError("Webhook delivery error", error, { webhookUrl, event });
  }
}
