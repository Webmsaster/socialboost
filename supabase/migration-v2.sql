-- SocialBoost v2 Migration
-- Run in Supabase SQL Editor after the initial schema.sql + storage-migration.sql

-- ============================================
-- 1. Profile extensions for new features
-- ============================================

-- Brand Voice Training
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS brand_voice text;

-- AI Model preference (gpt-4o-mini or gpt-4o)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_model text NOT NULL DEFAULT 'gpt-4o-mini'
  CHECK (preferred_model IN ('gpt-4o-mini', 'gpt-4o'));

-- Referral program
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bonus_generations integer NOT NULL DEFAULT 0;

-- Protect new fields from client-side manipulation. Privileged writes pass when
-- app.bypass_field_guard='on' (set by the SECURITY DEFINER RPCs — PG16+ forbids
-- setting `role` inside SECDEF) or role='service_role' (admin client).
-- migration-video-quota.sql extends this list with the video-quota columns
-- (canonical final version).
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger AS $$
BEGIN
  IF current_setting('app.bypass_field_guard', true) IS DISTINCT FROM 'on'
     AND current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
    new.subscription_status := old.subscription_status;
    new.generation_count := old.generation_count;
    new.generation_reset_at := old.generation_reset_at;
    new.stripe_customer_id := old.stripe_customer_id;
    new.bonus_generations := old.bonus_generations;
    new.referral_code := old.referral_code;
    new.created_at := old.created_at;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. Referrals table
-- ============================================
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  referred_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  bonus_granted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referrer_id, referred_id)
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id);

CREATE POLICY "Service role full access on referrals"
  ON public.referrals FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 3. Organizations (Team/Agency Plan)
-- ============================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  stripe_customer_id text UNIQUE,
  subscription_status text NOT NULL DEFAULT 'inactive'
    CHECK (subscription_status IN ('inactive', 'active', 'canceled', 'past_due')),
  max_members integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.org_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member')),
  invited_email text,
  accepted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- NOTE: these org_members/organizations SELECT policies were self-referential
-- (org_members subqueried from inside an org_members policy) → 42P17 infinite
-- recursion that broke the entire Teams feature. They are no longer defined
-- here. The canonical, non-recursive policy set lives in schema.sql +
-- migration-teams-rls-fix.sql (via the SECURITY DEFINER helper public.is_org_member).
-- Do NOT re-add a recursive org_members policy.

CREATE POLICY "Service role full access on organizations"
  ON public.organizations FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on org_members"
  ON public.org_members FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 4. Post metrics for performance tracking
-- ============================================
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS likes integer NOT NULL DEFAULT 0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS shares integer NOT NULL DEFAULT 0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS comments integer NOT NULL DEFAULT 0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS impressions integer NOT NULL DEFAULT 0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS metrics_updated_at timestamptz;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS content_score integer;

-- ============================================
-- 5. Indexes for new tables
-- ============================================
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_published_metrics ON public.posts(status, metrics_updated_at) WHERE status = 'published';

-- ============================================
-- 6. Generate referral code on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, referral_code)
  VALUES (new.id, new.email, replace(gen_random_uuid()::text, '-', ''));
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Fallback without referral code
  INSERT INTO profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql;
