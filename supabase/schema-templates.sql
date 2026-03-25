-- SocialBoost — Templates table migration
-- Run this in your Supabase SQL Editor to add the templates feature.

-- ============================================
-- Templates table (reusable post templates)
-- ============================================
create table if not exists public.templates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  platform text not null check (platform in ('linkedin', 'facebook', 'instagram', 'pinterest', 'twitter')),
  tone text not null default 'professional' check (tone in ('professional', 'casual', 'inspirational', 'humorous', 'educational')),
  topic text not null default '',
  language text not null default 'English',
  created_at timestamptz not null default now()
);

alter table public.templates enable row level security;

create policy "Users can read own templates" on public.templates for select using (auth.uid() = user_id);
create policy "Users can insert own templates" on public.templates for insert with check (auth.uid() = user_id);
create policy "Users can delete own templates" on public.templates for delete using (auth.uid() = user_id);
create policy "Service role full access on templates" on public.templates for all using (auth.role() = 'service_role');

create index if not exists idx_templates_user on public.templates(user_id);
