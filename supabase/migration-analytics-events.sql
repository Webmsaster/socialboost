-- ============================================================
-- analytics_events table — queryable usage data
--
-- Why: src/lib/analytics.ts currently only console.logs events,
-- which means the only way to answer "how many users tried the
-- Carousel tab last week?" is to grep Vercel logs. This table
-- gives us a real SQL surface for usage analytics, funnels, and
-- feature-adoption decisions ("kill what nobody uses").
--
-- Schema is intentionally minimal: event name + free-form jsonb
-- properties. Don't over-design — we may move to PostHog later.
--
-- Apply order: any time after schema.sql. Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event       text NOT NULL,
  properties  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Writes only happen via service-role from the server (see src/lib/analytics.ts
-- and the /api/track endpoint). End users have no need to read the raw events.
-- Authenticated users may insert their own events via /api/track which validates
-- the user_id matches auth.uid().
DROP POLICY IF EXISTS analytics_events_owner_insert ON public.analytics_events;
CREATE POLICY analytics_events_owner_insert ON public.analytics_events
  FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Common access patterns for the analytics dashboard / ad-hoc queries.
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_created
  ON public.analytics_events(event, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_created
  ON public.analytics_events(user_id, created_at DESC);
