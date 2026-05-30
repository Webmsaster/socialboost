-- ============================================================
-- API keys + outbound webhooks
--
-- Why: src/lib/api-keys.ts, src/app/api/keys/route.ts,
-- src/lib/webhook-dispatcher.ts and src/app/api/webhooks/manage/route.ts all
-- read/write these tables, and /api/v1/generate authentication depends on
-- api_keys — but NO committed migration ever created them (they were applied
-- ad-hoc on live). A fresh DB build was missing them (public API + webhooks
-- silently broken) and PENDING-APPLY-ON-LIVE.sql even creates indexes on them.
-- This is the canonical definition. Idempotent. Apply after schema.sql.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name         text NOT NULL DEFAULT 'Default',
  key_hash     text NOT NULL UNIQUE,
  key_prefix   text NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Owner manages their own keys via the user-scoped client (keys/route.ts).
-- validateApiKey reads via the service-role admin client (bypasses RLS).
DROP POLICY IF EXISTS "Users manage own api keys" ON public.api_keys;
CREATE POLICY "Users manage own api keys" ON public.api_keys
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role full access on api_keys" ON public.api_keys;
CREATE POLICY "Service role full access on api_keys" ON public.api_keys
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys(user_id);

CREATE TABLE IF NOT EXISTS public.user_webhooks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  url        text NOT NULL,
  events     text[] NOT NULL DEFAULT '{}',
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Per-endpoint signing secret. Outbound deliveries are HMAC-SHA256-signed with
-- this value (X-SocialBoost-Signature: sha256=...). The create route generates
-- and returns it once; this default backfills any pre-existing rows so signing
-- never breaks for webhooks created before this column existed.
ALTER TABLE public.user_webhooks
  ADD COLUMN IF NOT EXISTS secret text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex');

ALTER TABLE public.user_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own webhooks" ON public.user_webhooks;
CREATE POLICY "Users manage own webhooks" ON public.user_webhooks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role full access on user_webhooks" ON public.user_webhooks;
CREATE POLICY "Service role full access on user_webhooks" ON public.user_webhooks
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_user_webhooks_user ON public.user_webhooks(user_id);
