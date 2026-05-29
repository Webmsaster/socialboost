-- ============================================================
-- Teams RLS fix: kill the org_members infinite recursion (42P17)
--
-- The org_members SELECT/ALL policies (from schema.sql + migration-v2.sql) each
-- subqueried org_members from INSIDE an org_members policy. PostgreSQL rejects
-- this as 42P17 "infinite recursion detected in policy", so every authenticated
-- read/write of org_members errored and the entire Teams feature was dead
-- (errors swallowed → UI silently showed "no team", org-create orphaned the
-- owner membership row). Empirically reproduced as the `authenticated` role.
--
-- Fix: a SECURITY DEFINER helper that reads org_members WITHOUT re-triggering
-- RLS, plus a single non-recursive SELECT policy. Membership WRITES now go
-- through the server (service-role) after app-layer authorization — there is
-- intentionally NO end-user INSERT/UPDATE/DELETE policy, so a user cannot
-- self-escalate to owner/admin by calling the REST API directly (closes the
-- missing-WITH-CHECK escalation gap too).
--
-- Idempotent. Apply after schema.sql + migration-v2.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_org_member(p_org uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = p_org AND user_id = auth.uid() AND accepted = true
  );
$$;
REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated, service_role;

-- Drop every legacy (recursive / duplicate) org_members policy by name.
DROP POLICY IF EXISTS "Org members can read members" ON public.org_members;
DROP POLICY IF EXISTS "Admins can manage members" ON public.org_members;
DROP POLICY IF EXISTS "Org members can read membership" ON public.org_members;
DROP POLICY IF EXISTS "Members can read own org roster" ON public.org_members;
CREATE POLICY "Members can read own org roster"
  ON public.org_members FOR SELECT
  USING (user_id = auth.uid() OR public.is_org_member(org_id));
DROP POLICY IF EXISTS "Service role full access on org_members" ON public.org_members;
CREATE POLICY "Service role full access on org_members"
  ON public.org_members FOR ALL
  USING (auth.role() = 'service_role');

-- organizations: collapse the two duplicate member-read policies into one
-- non-recursive policy (membership check via the helper).
DROP POLICY IF EXISTS "Org members can read org" ON public.organizations;
DROP POLICY IF EXISTS "Org members can read own org" ON public.organizations;
CREATE POLICY "Org members can read org"
  ON public.organizations FOR SELECT
  USING (owner_id = auth.uid() OR public.is_org_member(id));

-- One membership row per (org, user); idempotent.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_members_org_user_unique') THEN
    DELETE FROM public.org_members a USING public.org_members b
      WHERE a.ctid < b.ctid AND a.org_id = b.org_id AND a.user_id = b.user_id AND a.user_id IS NOT NULL;
    ALTER TABLE public.org_members
      ADD CONSTRAINT org_members_org_user_unique UNIQUE (org_id, user_id);
  END IF;
END $$;
