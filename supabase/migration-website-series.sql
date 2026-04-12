-- Website-aware content series: attach a target URL, cache scraped context.
-- Apply on the live Supabase DB via SQL editor. Idempotent.

ALTER TABLE public.content_series
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS website_context jsonb,
  ADD COLUMN IF NOT EXISTS website_scraped_at timestamptz;
