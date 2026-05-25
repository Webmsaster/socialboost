/**
 * Server-side analytics event tracking.
 *
 * Writes events to:
 *   1. console.log (visible in Vercel Logs / Log Drains — old behavior)
 *   2. public.analytics_events table in Supabase (queryable, see
 *      supabase/migration-analytics-events.sql)
 *
 * Fire-and-forget — never throws, never blocks the caller. If Supabase
 * is unreachable we still get the console fallback.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Primitive = string | number | boolean | null;

interface AnalyticsEvent {
  event: string;
  userId?: string;
  properties?: Record<string, Primitive>;
}

let _admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient | null {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    _admin = createClient(url, key, { auth: { persistSession: false } });
  }
  return _admin;
}

export function trackEvent({ event, userId, properties }: AnalyticsEvent) {
  // 1. Structured log (kept for backwards compat — log drains still work).
  console.log(
    JSON.stringify({
      _analytics: true,
      event,
      userId: userId ?? "anonymous",
      timestamp: new Date().toISOString(),
      ...properties,
    }),
  );

  // 2. Async insert into analytics_events. Intentionally not awaited —
  // tracking failures must never affect the parent request. The whole call
  // is wrapped because Supabase mocks in tests may not implement .insert(),
  // and that should never crash a real request flow either.
  const admin = getAdmin();
  if (!admin) return;
  try {
    const result = admin.from("analytics_events").insert({
      user_id: userId ?? null,
      event,
      properties: properties ?? {},
    });
    if (result && typeof (result as { then?: unknown }).then === "function") {
      (result as Promise<{ error: { message: string } | null }>)
        .then(({ error }) => {
          if (error) console.error("analytics insert failed:", error.message);
        })
        .catch(() => {});
    }
  } catch {
    // Swallow — analytics must never block the parent request.
  }
}
