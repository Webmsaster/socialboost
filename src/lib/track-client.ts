/**
 * Fire-and-forget client-side event tracking.
 * Calls POST /api/track which validates the event name and persists to
 * analytics_events via the shared server trackEvent().
 *
 * Failures are swallowed — analytics must never affect UX.
 */

type Primitive = string | number | boolean | null;

export function trackClient(
  event: string,
  properties?: Record<string, Primitive>,
) {
  try {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, properties: properties ?? {} }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // never throw from analytics
  }
}
