-- ============================================================
-- Per-user video generation quota
--
-- Why: a video (gpt-image-1 per scene + TTS) costs ~$0.30 each at our
-- model prices, while a text post costs <$0.001. Sharing the
-- generation_count bucket means a Pro user can burn ~$30 of OpenAI in
-- one month while paying us $9 — negative margin territory. This adds a
-- separate counter so we can cap videos independently (default: 5/month
-- on Pro, 0 on Free), without affecting the text-post quota.
--
-- The reset semantics mirror increment_generation_count: monthly,
-- lazy-on-first-call via the same calendar-month check inside the RPC below.
-- NOTE: the Stripe webhook does NOT reset this counter — the lazy
-- calendar-month check in the RPC is the only reset path.
--
-- Apply order: after schema.sql (and after migration-v2.sql). Idempotent.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS video_generation_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS video_generation_reset_at timestamptz NOT NULL DEFAULT now();

-- Atomic increment + monthly reset, parallel to increment_generation_count.
-- Returns the new count and whether the increment succeeded (false = over limit).
CREATE OR REPLACE FUNCTION public.increment_video_generation_count(
  p_user_id uuid,
  p_limit integer
)
RETURNS TABLE(new_count integer, was_incremented boolean) AS $$
BEGIN
  -- A non-service-role caller may only touch its own row (see
  -- increment_generation_count for the rationale — stops quota griefing).
  IF current_setting('role', true) IS DISTINCT FROM 'service_role'
     AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'increment_video_generation_count: caller may only update its own row';
  END IF;

  -- Signal protect_profile_fields (which freezes video_generation_count against
  -- client writes) to allow this privileged update. Custom GUC, not
  -- set_config('role',...): PostgreSQL 16+ forbids setting `role` inside a
  -- SECURITY DEFINER function. Without this the trigger would revert the
  -- increment and the cap would never advance. Mirrors increment_generation_count.
  PERFORM set_config('app.bypass_field_guard', 'on', true);

  -- Reset on calendar-month rollover.
  UPDATE public.profiles
  SET video_generation_count = 0,
      video_generation_reset_at = now()
  WHERE id = p_user_id
    AND (
      EXTRACT(month FROM video_generation_reset_at) != EXTRACT(month FROM now())
      OR EXTRACT(year FROM video_generation_reset_at) != EXTRACT(year FROM now())
    );

  RETURN QUERY
  UPDATE public.profiles
  SET video_generation_count = video_generation_count + 1
  WHERE id = p_user_id AND video_generation_count < p_limit
  RETURNING video_generation_count AS new_count, true AS was_incremented;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT video_generation_count AS new_count, false AS was_incremented
    FROM public.profiles WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.increment_video_generation_count(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_video_generation_count(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.increment_video_generation_count(uuid, integer) TO authenticated, service_role;

-- ------------------------------------------------------------
-- Canonical protect_profile_fields: freeze the video-quota columns too.
-- This is the FINAL definition and supersedes schema.sql + migration-v2.sql
-- (apply this migration after both). The settings page writes brand_voice /
-- preferred_model / notification_preferences to profiles directly from the
-- RLS-scoped client, so without freezing these columns a user could run
-- `update profiles set video_generation_count = 0` from the browser and mint
-- unlimited ~$0.30 videos — the exact abuse this quota was built to prevent.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger AS $$
BEGIN
  IF current_setting('app.bypass_field_guard', true) IS DISTINCT FROM 'on'
     AND current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
    new.subscription_status        := old.subscription_status;
    new.generation_count           := old.generation_count;
    new.generation_reset_at        := old.generation_reset_at;
    new.video_generation_count     := old.video_generation_count;
    new.video_generation_reset_at  := old.video_generation_reset_at;
    new.stripe_customer_id         := old.stripe_customer_id;
    new.bonus_generations          := old.bonus_generations;
    new.referral_code              := old.referral_code;
    new.created_at                 := old.created_at;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql;
