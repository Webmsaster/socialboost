import { captureError } from "@/lib/logger";

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

  const payload: WebhookPayload = {
    event,
    data,
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(webhookUrl, {
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
