-- ============================================================
-- audit_log table
--
-- Why this exists as its own migration:
-- The application has been writing to public.audit_log (see
-- src/lib/audit-log.ts) since the audit/webhook/email-drip work in
-- 2026-03/04, but no CREATE TABLE statement was ever checked in.
-- migration-perf-indexes.sql and PENDING-APPLY-ON-LIVE.sql both
-- reference the table via CREATE INDEX, which silently fails if the
-- table is missing. On a fresh Supabase project the table needs to
-- exist before those indexes can be applied.
--
-- Apply order: run this AFTER schema.sql but BEFORE the perf-indexes
-- and PENDING-APPLY-ON-LIVE migrations.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  action      text NOT NULL,
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Owners can read their own audit trail. Inserts happen via service-role
-- (see src/lib/audit-log.ts → getAdmin()), so no INSERT policy is needed
-- for end users.
DROP POLICY IF EXISTS audit_log_owner_read ON public.audit_log;
CREATE POLICY audit_log_owner_read ON public.audit_log
  FOR SELECT USING (user_id = auth.uid());

-- Common access pattern: "show me my last N audit events".
CREATE INDEX IF NOT EXISTS idx_audit_log_user_created
  ON public.audit_log(user_id, created_at DESC);
