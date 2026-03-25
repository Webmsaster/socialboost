-- SocialBoost — Supabase Database Schema
-- Run this in your Supabase SQL Editor to set up the database.

-- ============================================
-- 1. Profiles table (extends Supabase auth.users)
-- ============================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  stripe_customer_id text unique,
  subscription_status text not null default 'inactive'
    check (subscription_status in ('inactive', 'active', 'canceled', 'past_due')),
  generation_count integer not null default 0,
  generation_reset_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile (restricted)"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Service role full access"
  on public.profiles for all
  using (auth.role() = 'service_role');

-- ============================================
-- 2. Posts table (AI-generated social media content)
-- ============================================
create table if not exists public.posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  platform text not null
    check (platform in ('linkedin', 'facebook', 'instagram', 'pinterest', 'twitter')),
  topic text not null,
  tone text not null default 'professional'
    check (tone in ('professional', 'casual', 'inspirational', 'humorous', 'educational')),
  content text not null,
  hashtags text[] default '{}',
  is_favorite boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'published', 'failed')),
  scheduled_for timestamptz,
  published_at timestamptz,
  platform_post_id text,
  connected_account_id uuid,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;

create policy "Users can read own posts"
  on public.posts for select using (auth.uid() = user_id);

create policy "Users can insert own posts"
  on public.posts for insert with check (auth.uid() = user_id);

create policy "Users can update own posts"
  on public.posts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own posts"
  on public.posts for delete using (auth.uid() = user_id);

create policy "Service role full access on posts"
  on public.posts for all
  using (auth.role() = 'service_role');

-- ============================================
-- 3. Connected Accounts (OAuth tokens, future use)
-- ============================================
create table if not exists public.connected_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  platform text not null
    check (platform in ('linkedin', 'facebook', 'instagram', 'pinterest', 'twitter')),
  platform_user_id text not null,
  platform_username text,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  page_id text,
  created_at timestamptz not null default now()
);

alter table public.connected_accounts enable row level security;

create policy "Users can read own connected accounts"
  on public.connected_accounts for select
  using (auth.uid() = user_id);

create policy "Users can delete own connected accounts"
  on public.connected_accounts for delete
  using (auth.uid() = user_id);

create policy "Service role full access on connected_accounts"
  on public.connected_accounts for all
  using (auth.role() = 'service_role');

-- Add foreign key from posts to connected_accounts
alter table public.posts
  add constraint fk_posts_connected_account
  foreign key (connected_account_id) references public.connected_accounts(id)
  on delete set null;

-- ============================================
-- 4. Indexes
-- ============================================
create index if not exists idx_posts_user_id on public.posts(user_id);
create index if not exists idx_posts_scheduled on public.posts(scheduled_for)
  where status = 'scheduled';
create index if not exists idx_posts_user_created on public.posts(user_id, created_at desc);
create index if not exists idx_connected_accounts_user on public.connected_accounts(user_id);
create index if not exists idx_profiles_stripe on public.profiles(stripe_customer_id)
  where stripe_customer_id is not null;

-- ============================================
-- 5. Auto-create profile on signup
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- 6. Protect sensitive profile fields
-- ============================================
create or replace function public.protect_profile_fields()
returns trigger as $$
begin
  if current_setting('role') != 'service_role' then
    new.subscription_status := old.subscription_status;
    new.generation_count := old.generation_count;
    new.generation_reset_at := old.generation_reset_at;
    new.stripe_customer_id := old.stripe_customer_id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists protect_profile_fields_trigger on public.profiles;
create trigger protect_profile_fields_trigger
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ============================================
-- 7. Atomic generation counter
-- ============================================
create or replace function public.increment_generation_count(
  p_user_id uuid,
  p_limit integer
)
returns table(new_count integer, was_incremented boolean) as $$
begin
  perform set_config('role', 'service_role', true);

  update public.profiles
  set generation_count = 0, generation_reset_at = now()
  where id = p_user_id
    and (
      extract(month from generation_reset_at) != extract(month from now())
      or extract(year from generation_reset_at) != extract(year from now())
    );

  return query
  update public.profiles
  set generation_count = generation_count + 1
  where id = p_user_id and generation_count < p_limit
  returning generation_count as new_count, true as was_incremented;

  if not found then
    return query
    select generation_count as new_count, false as was_incremented
    from public.profiles where id = p_user_id;
  end if;
end;
$$ language plpgsql security definer;
