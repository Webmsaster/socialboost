CREATE TABLE IF NOT EXISTS public.content_series (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  platform text not null
    check (platform in ('linkedin', 'facebook', 'instagram', 'pinterest', 'twitter')),
  tone text not null default 'professional'
    check (tone in ('professional', 'casual', 'inspirational', 'humorous', 'educational')),
  topic_template text not null,
  frequency text not null default 'weekly'
    check (frequency in ('daily', 'weekly', 'biweekly', 'monthly')),
  day_of_week integer check (day_of_week between 0 and 6),
  preferred_time text default '09:00',
  is_active boolean not null default true,
  last_generated_at timestamptz,
  created_at timestamptz not null default now()
);

ALTER TABLE public.content_series ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='content_series' AND policyname='Users can read own series') THEN
    CREATE POLICY "Users can read own series" ON public.content_series FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='content_series' AND policyname='Users can insert own series') THEN
    CREATE POLICY "Users can insert own series" ON public.content_series FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='content_series' AND policyname='Users can update own series') THEN
    CREATE POLICY "Users can update own series" ON public.content_series FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='content_series' AND policyname='Users can delete own series') THEN
    CREATE POLICY "Users can delete own series" ON public.content_series FOR DELETE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='content_series' AND policyname='Service role full access on content_series') THEN
    CREATE POLICY "Service role full access on content_series" ON public.content_series FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_content_series_user ON public.content_series(user_id);

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS media_url text;
-- reviewed_by is audit metadata: SET NULL on reviewer deletion (not RESTRICT,
-- which would block deleting any user who reviewed someone else's post).
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS review_note text;

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_status_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_status_check CHECK (status IN ('draft', 'pending_review', 'approved', 'scheduled', 'published', 'failed'));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{}'::jsonb;
