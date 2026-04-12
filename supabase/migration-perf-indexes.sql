-- Performance indexes for feature tables added after schema.sql
-- Idempotent — safe to run multiple times.
-- Apply on the live Supabase DB via SQL editor.

-- Webhooks: every list query filters by user_id
CREATE INDEX IF NOT EXISTS idx_user_webhooks_user ON public.user_webhooks(user_id);

-- API keys: list by user, lookup by hash on every API request
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash);

-- Audit log: ordered-by-time list per user
CREATE INDEX IF NOT EXISTS idx_audit_log_user_created ON public.audit_log(user_id, created_at DESC);

-- Templates: list by user
CREATE INDEX IF NOT EXISTS idx_templates_user ON public.templates(user_id);

-- Posts: favorites filter is common on history page; partial index is cheap
CREATE INDEX IF NOT EXISTS idx_posts_user_favorites
  ON public.posts(user_id)
  WHERE is_favorite = true;

-- Posts: the cron/publish query scans scheduled posts past due — partial index keeps it tiny
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_pending
  ON public.posts(scheduled_for)
  WHERE status = 'scheduled';

-- Posts: review workflow query filters by status=pending_review + user_id
CREATE INDEX IF NOT EXISTS idx_posts_pending_review
  ON public.posts(user_id)
  WHERE status = 'pending_review';
