/**
 * Server-side analytics event tracking.
 * Logs structured events visible in Vercel Logs / Log Drains.
 * Can be extended to write to Supabase or external analytics later.
 */

interface AnalyticsEvent {
  event: string;
  userId?: string;
  properties?: Record<string, string | number | boolean>;
}

export function trackEvent({ event, userId, properties }: AnalyticsEvent) {
  console.log(
    JSON.stringify({
      _analytics: true,
      event,
      userId: userId ?? "anonymous",
      timestamp: new Date().toISOString(),
      ...properties,
    })
  );
}
