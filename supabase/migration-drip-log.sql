-- ============================================================
-- Drip-email send log — idempotency for the onboarding drip
--
-- Why: src/app/api/cron/email-drip/route.ts had NO per-user send tracking.
-- It relied on a fixed calendar-day signup-anniversary window being hit by
-- exactly one cron run. Any second run on the same UTC day (a manual retrigger
-- or a Vercel cron retry) re-selected the same users and re-sent every stage —
-- users received "Welcome" (and every later email) multiple times. And a single
-- missed day meant a cohort permanently skipped that stage with no catch-up.
--
-- This table records (user_id, stage) once a stage is sent. The composite PK
-- makes the claim atomic: the cron INSERTs the row first; a duplicate-key
-- conflict means "already sent / being sent" → skip. Combined with a wider age
-- window in the cron, a missed day now self-heals on the next successful run.
--
-- Apply order: any time after schema.sql. Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.drip_emails (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  stage   text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, stage)
);

ALTER TABLE public.drip_emails ENABLE ROW LEVEL SECURITY;

-- Only the server (service-role) reads/writes this, and service-role bypasses
-- RLS, so no end-user policy is defined (RLS-enabled + no policy = no client
-- access). The policy below is a no-op safeguard documenting intent.
DROP POLICY IF EXISTS "Service role full access on drip_emails" ON public.drip_emails;
CREATE POLICY "Service role full access on drip_emails"
  ON public.drip_emails FOR ALL
  USING (auth.role() = 'service_role');
