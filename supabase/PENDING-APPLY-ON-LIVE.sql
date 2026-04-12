-- =============================================================
-- PENDING MIGRATIONS — apply in Supabase SQL Editor in one paste.
-- Safe: all statements use IF NOT EXISTS and are idempotent.
-- Generated 2026-04-12 as a session handoff bundle.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Performance indexes for feature tables
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_webhooks_user ON public.user_webhooks(user_id);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_created ON public.audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_templates_user ON public.templates(user_id);

CREATE INDEX IF NOT EXISTS idx_posts_user_favorites
  ON public.posts(user_id)
  WHERE is_favorite = true;

CREATE INDEX IF NOT EXISTS idx_posts_scheduled_pending
  ON public.posts(scheduled_for)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_posts_pending_review
  ON public.posts(user_id)
  WHERE status = 'pending_review';

-- -------------------------------------------------------------
-- 2. Website-aware content series (for autonomous posting with
--    scraped website context + CTA back to the site)
-- -------------------------------------------------------------
ALTER TABLE public.content_series
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS website_context jsonb,
  ADD COLUMN IF NOT EXISTS website_scraped_at timestamptz;

-- -------------------------------------------------------------
-- 3. Stripe webhook idempotency (dedupe retried events)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Service role full access on stripe_events"
    ON public.stripe_events FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -------------------------------------------------------------
-- Done. Verify with:
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'content_series'
--     AND column_name IN ('website_url', 'website_context', 'website_scraped_at');
--   SELECT 1 FROM information_schema.tables WHERE table_name = 'stripe_events';
-- -------------------------------------------------------------
