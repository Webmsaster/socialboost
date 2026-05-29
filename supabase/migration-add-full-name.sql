-- Add full_name column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;

-- NOTE: this migration intentionally NO LONGER redefines protect_profile_fields.
-- It used to redefine it with a *shorter* field list (no bonus_generations /
-- referral_code / video_generation_count). Because every definition is a
-- CREATE OR REPLACE, re-applying this file after the later migrations would
-- silently strip that protection — a privilege-escalation hole (a user could
-- self-grant bonus generations or reset their video quota). The single
-- canonical definition now lives in schema.sql (base fields) and is extended
-- with the video-quota columns in migration-video-quota.sql. full_name was
-- never in the protected list, so it stays user-editable regardless.
