-- Newsletter subscribers table
-- Idempotent migration — safe to re-run.

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create index if not exists idx_newsletter_email on public.newsletter_subscribers(email);

-- Enable RLS: only service role can read/write (no public access)
alter table public.newsletter_subscribers enable row level security;

-- No policies — only service role bypass applies. This is intentional;
-- the API route uses the service role key to write, and there's no
-- public read access.
