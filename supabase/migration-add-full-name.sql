-- Add full_name column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;

-- Update the protect_profile_fields function to allow full_name updates
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger AS $$
BEGIN
  IF current_setting('role') != 'service_role' THEN
    new.subscription_status := old.subscription_status;
    new.generation_count := old.generation_count;
    new.generation_reset_at := old.generation_reset_at;
    new.stripe_customer_id := old.stripe_customer_id;
    new.created_at := old.created_at;
    -- full_name is NOT protected, users can update it
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql;
