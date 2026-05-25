-- ============================================================
-- Scheduled-publish reminder tracking
--
-- The cron/publish job pushes scheduled posts to connected platform
-- accounts when available. For users who never wire up OAuth (the
-- majority — auto-publishing needs platform-specific app review,
-- Meta especially), the same scheduled_for timestamp now triggers
-- a "time to post manually" email instead.
--
-- We need to track whether that reminder has been sent so the daily
-- cron doesn't keep re-sending it on every run.
--
-- Apply order: after schema.sql. Idempotent.
-- ============================================================

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- Index supports the cron's lookup pattern: find scheduled posts whose
-- scheduled_for has passed, the user has no connected account, and we
-- haven't already pinged them. created_at order is the natural tie-breaker.
CREATE INDEX IF NOT EXISTS idx_posts_pending_reminder
  ON public.posts(scheduled_for)
  WHERE status = 'scheduled' AND reminder_sent_at IS NULL;
