-- ============================================================
-- Reserve-before-spend quota RPCs (TOCTOU fix)
--
-- Why: the generate/video/render routes used to READ generation_count,
-- COMPARE it to the limit, run the expensive OpenAI/render call, and only
-- THEN call increment_generation_count. Two concurrent requests that both
-- pass the rate limiter also both pass the read-and-compare, so both spend
-- and the user ends the month over quota (over-spending our OpenAI bill).
--
-- The fix: reserve the slot ATOMICALLY *before* the expensive call. The
-- reserve RPC does a conditional UPDATE (`... WHERE generation_count <
-- p_limit`) and reports whether a row was actually updated (FOUND). Under
-- concurrency PostgreSQL serializes the row-level UPDATEs, so only as many
-- requests as there is remaining quota succeed; the rest get false and the
-- route returns 429 without touching OpenAI. On an OpenAI/render FAILURE
-- the route calls the matching refund RPC to give the reserved slot back.
--
-- These mirror increment_generation_count / increment_video_generation_count
-- exactly: same lazy calendar-month reset, same own-row guard, and the same
-- app.bypass_field_guard custom GUC (NOT set_config('role',...), which
-- PostgreSQL 16+ forbids inside a SECURITY DEFINER function — see
-- migration-video-quota.sql).
--
-- Apply order: after migration-video-quota.sql. Idempotent.
-- ============================================================

-- ------------------------------------------------------------
-- reserve_generation: atomically claim one text-generation slot.
-- Returns true if a slot was reserved (count incremented), false if the
-- user is already at/over the limit. Mirrors increment_generation_count.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_generation(
  p_user_id uuid,
  p_limit integer
)
RETURNS boolean AS $$
BEGIN
  -- A non-service-role caller may only touch its own row (stops quota
  -- griefing). Mirrors increment_generation_count.
  IF current_setting('role', true) IS DISTINCT FROM 'service_role'
     AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'reserve_generation: caller may only update its own row';
  END IF;

  -- Allow this privileged update past protect_profile_fields. Custom GUC,
  -- not set_config('role',...): PG16+ forbids setting `role` in a
  -- SECURITY DEFINER function. Mirrors increment_generation_count.
  PERFORM set_config('app.bypass_field_guard', 'on', true);

  -- Lazy reset on calendar-month rollover (same check as the increment RPC).
  UPDATE public.profiles
  SET generation_count = 0,
      generation_reset_at = now()
  WHERE id = p_user_id
    AND (
      EXTRACT(month FROM generation_reset_at) != EXTRACT(month FROM now())
      OR EXTRACT(year FROM generation_reset_at) != EXTRACT(year FROM now())
    );

  -- Atomic reserve: only increments if still under the limit. The row-level
  -- lock serializes concurrent callers, so the cap is never exceeded.
  UPDATE public.profiles
  SET generation_count = generation_count + 1
  WHERE id = p_user_id AND generation_count < p_limit;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.reserve_generation(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_generation(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.reserve_generation(uuid, integer) TO authenticated, service_role;

-- ------------------------------------------------------------
-- refund_generation: give back one previously-reserved text slot when the
-- expensive call failed. Floors at 0 so a stray refund can't go negative.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refund_generation(
  p_user_id uuid
)
RETURNS void AS $$
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role'
     AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'refund_generation: caller may only update its own row';
  END IF;

  PERFORM set_config('app.bypass_field_guard', 'on', true);

  -- Floor at 0: a refund must never push the counter negative (e.g. after a
  -- month-rollover reset between reserve and refund).
  UPDATE public.profiles
  SET generation_count = GREATEST(generation_count - 1, 0)
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.refund_generation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_generation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.refund_generation(uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- reserve_video_generation: atomically claim one video slot.
-- Mirrors increment_video_generation_count (separate counter + reset).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_video_generation(
  p_user_id uuid,
  p_limit integer
)
RETURNS boolean AS $$
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role'
     AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'reserve_video_generation: caller may only update its own row';
  END IF;

  PERFORM set_config('app.bypass_field_guard', 'on', true);

  UPDATE public.profiles
  SET video_generation_count = 0,
      video_generation_reset_at = now()
  WHERE id = p_user_id
    AND (
      EXTRACT(month FROM video_generation_reset_at) != EXTRACT(month FROM now())
      OR EXTRACT(year FROM video_generation_reset_at) != EXTRACT(year FROM now())
    );

  UPDATE public.profiles
  SET video_generation_count = video_generation_count + 1
  WHERE id = p_user_id AND video_generation_count < p_limit;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.reserve_video_generation(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_video_generation(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.reserve_video_generation(uuid, integer) TO authenticated, service_role;

-- ------------------------------------------------------------
-- refund_video_generation: give back one reserved video slot on failure.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refund_video_generation(
  p_user_id uuid
)
RETURNS void AS $$
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role'
     AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'refund_video_generation: caller may only update its own row';
  END IF;

  PERFORM set_config('app.bypass_field_guard', 'on', true);

  UPDATE public.profiles
  SET video_generation_count = GREATEST(video_generation_count - 1, 0)
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.refund_video_generation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_video_generation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.refund_video_generation(uuid) TO authenticated, service_role;
