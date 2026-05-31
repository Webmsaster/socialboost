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
-- lazy-on-first-call via the same calendar-month check. Stripe webhook
-- on subscription renewal also resets it (see src/app/api/stripe/webhook).
--
-- Apply order: after schema.sql. Idempotent.
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
GRANT EXECUTE ON FUNCTION public.increment_video_generation_count(uuid, integer) TO authenticated, service_role;
