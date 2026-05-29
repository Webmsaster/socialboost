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
    check (status in ('draft', 'pending_review', 'approved', 'scheduled', 'published', 'failed')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  scheduled_for timestamptz,
  published_at timestamptz,
  platform_post_id text,
  connected_account_id uuid,
  error_message text,
  media_url text,
  likes integer not null default 0,
  shares integer not null default 0,
  comments integer not null default 0,
  impressions integer not null default 0,
  content_score integer not null default 0,
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

create policy "Users can insert own connected accounts"
  on public.connected_accounts for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own connected accounts"
  on public.connected_accounts for delete
  using (auth.uid() = user_id);

create policy "Service role full access on connected_accounts"
  on public.connected_accounts for all
  using (auth.role() = 'service_role');

-- The OAuth callback upserts with onConflict (user_id, platform); that requires a
-- matching unique constraint, or the upsert errors (42P10) and connect silently
-- fails. Idempotent add (dedupe any legacy duplicates first).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'connected_accounts_user_platform_unique'
  ) then
    delete from public.connected_accounts a
      using public.connected_accounts b
      where a.ctid < b.ctid and a.user_id = b.user_id and a.platform = b.platform;
    alter table public.connected_accounts
      add constraint connected_accounts_user_platform_unique unique (user_id, platform);
  end if;
end $$;

-- Add foreign key from posts to connected_accounts
alter table public.posts
  add constraint fk_posts_connected_account
  foreign key (connected_account_id) references public.connected_accounts(id)
  on delete set null;

-- Idempotent: add media_url column for existing deployments
alter table public.posts add column if not exists media_url text;

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
  -- Let privileged writes through, freeze the sensitive columns for everyone
  -- else. Two privileged paths:
  --   1. app.bypass_field_guard = 'on' — set by our SECURITY DEFINER RPCs
  --      (increment_generation_count etc.). We use a custom GUC rather than
  --      set_config('role', ...) because PostgreSQL 16+ forbids setting `role`
  --      inside a SECURITY DEFINER function ("cannot set parameter role ...").
  --   2. role = 'service_role' — the server admin client (e.g. the Stripe
  --      webhook) writing directly. current_setting(..., true) uses missing_ok
  --      so a normal client UPDATE (both GUCs unset) never aborts.
  -- NOTE: migration-video-quota.sql redefines this with the video-quota columns
  -- added — that is the canonical final version. Keep this list in sync.
  if current_setting('app.bypass_field_guard', true) is distinct from 'on'
     and current_setting('role', true) is distinct from 'service_role' then
    new.subscription_status := old.subscription_status;
    new.generation_count := old.generation_count;
    new.generation_reset_at := old.generation_reset_at;
    new.stripe_customer_id := old.stripe_customer_id;
    new.bonus_generations := old.bonus_generations;
    new.referral_code := old.referral_code;
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
  -- A non-service-role caller may only touch its OWN row. Without this, any
  -- authenticated user could call this RPC directly with another user's id to
  -- burn their quota — direct RPC calls bypass the route-level rate limiter.
  -- (v1/generate calls this via the service-role admin client, so it is exempt.)
  if current_setting('role', true) is distinct from 'service_role'
     and p_user_id is distinct from auth.uid() then
    raise exception 'increment_generation_count: caller may only update its own row';
  end if;

  -- Bypass protect_profile_fields for this privileged write (see trigger note).
  -- Custom GUC, not set_config('role',...): PG16+ forbids setting `role` in SECDEF.
  perform set_config('app.bypass_field_guard', 'on', true);

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

-- Lock down: not callable by anon/PUBLIC. authenticated (generate/repurpose via
-- the user client) + service_role (v1/generate via the admin client) only.
revoke all on function public.increment_generation_count(uuid, integer) from public;
revoke all on function public.increment_generation_count(uuid, integer) from anon;
grant execute on function public.increment_generation_count(uuid, integer) to authenticated, service_role;

-- ============================================
-- 8. Brand Voice & Model Preference columns
-- ============================================
alter table public.profiles
  add column if not exists brand_voice text,
  add column if not exists preferred_model text default 'gpt-4o-mini';

-- ============================================
-- 9. Referral system
-- ============================================

-- Add referral columns to profiles
alter table public.profiles add column if not exists referral_code text unique;
alter table public.profiles add column if not exists bonus_generations integer not null default 0;

-- Auto-generate referral code for new profiles
create or replace function public.generate_referral_code()
returns trigger as $$
begin
  if new.referral_code is null then
    new.referral_code := substr(md5(new.id::text || now()::text), 1, 8);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists generate_referral_code_trigger on public.profiles;
create trigger generate_referral_code_trigger
  before insert on public.profiles
  for each row execute function public.generate_referral_code();

-- Backfill existing profiles without referral codes
update public.profiles
set referral_code = substr(md5(id::text || created_at::text), 1, 8)
where referral_code is null;

-- Referrals tracking table
create table if not exists public.referrals (
  id uuid default gen_random_uuid() primary key,
  referrer_id uuid references public.profiles(id) on delete cascade not null,
  referred_id uuid references public.profiles(id) on delete cascade not null,
  bonus_granted boolean not null default false,
  created_at timestamptz not null default now(),
  unique(referrer_id, referred_id)
);

alter table public.referrals enable row level security;

create policy "Users can read own referrals"
  on public.referrals for select
  using (auth.uid() = referrer_id);

create policy "Service role full access on referrals"
  on public.referrals for all
  using (auth.role() = 'service_role');

create index if not exists idx_referrals_referrer on public.referrals(referrer_id);
create index if not exists idx_referrals_referred on public.referrals(referred_id);

-- Function to grant referral bonus to both users
create or replace function public.grant_referral_bonus(
  p_referrer_id uuid,
  p_referred_id uuid,
  p_bonus integer
)
returns void as $$
begin
  -- Bypass protect_profile_fields for this privileged write (see trigger note).
  -- Custom GUC, not set_config('role',...): PG16+ forbids setting `role` in SECDEF.
  perform set_config('app.bypass_field_guard', 'on', true);

  update public.profiles
  set bonus_generations = bonus_generations + p_bonus
  where id = p_referrer_id;

  update public.profiles
  set bonus_generations = bonus_generations + p_bonus
  where id = p_referred_id;
end;
$$ language plpgsql security definer;

-- CRITICAL lockdown: only the server (service_role) may grant bonuses. This RPC
-- was world-executable (anon + authenticated + PUBLIC), so any user could call
-- grant_referral_bonus(my_id, my_id, 999999) and mint unlimited generations.
-- /api/referral/claim invokes it via the service-role admin client.
revoke all on function public.grant_referral_bonus(uuid, uuid, integer) from public;
revoke all on function public.grant_referral_bonus(uuid, uuid, integer) from anon;
revoke all on function public.grant_referral_bonus(uuid, uuid, integer) from authenticated;
grant execute on function public.grant_referral_bonus(uuid, uuid, integer) to service_role;

-- ============================================
-- 12. Content Series (recurring post templates)
-- ============================================
create table if not exists public.content_series (
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
  post_type text not null default 'text'
    check (post_type in ('text', 'video')),
  created_at timestamptz not null default now()
);

alter table public.content_series enable row level security;

create policy "Users can read own series"
  on public.content_series for select using (auth.uid() = user_id);
create policy "Users can insert own series"
  on public.content_series for insert with check (auth.uid() = user_id);
create policy "Users can update own series"
  on public.content_series for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own series"
  on public.content_series for delete using (auth.uid() = user_id);
create policy "Service role full access on content_series"
  on public.content_series for all
  using (auth.role() = 'service_role');

create index if not exists idx_content_series_user on public.content_series(user_id);

-- ============================================
-- 13. Organizations & Team Members
-- ============================================
create table if not exists public.organizations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  subscription_status text not null default 'inactive',
  max_members integer not null default 5,
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- org_members is created BEFORE the organizations SELECT policy below (which
-- references org_members) so a clean standalone schema.sql apply doesn't error
-- on a forward reference. organizations still precedes org_members (FK target).
create table if not exists public.org_members (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  invited_email text,
  accepted boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.org_members enable row level security;

create policy "Org members can read org"
  on public.organizations for select
  using (id in (select org_id from public.org_members where user_id = auth.uid()));
create policy "Owner can update org"
  on public.organizations for update using (owner_id = auth.uid());
create policy "Users can create orgs"
  on public.organizations for insert with check (auth.uid() = owner_id);
create policy "Service role full access on organizations"
  on public.organizations for all
  using (auth.role() = 'service_role');

-- Non-recursive membership check. The original org_members policies each
-- subqueried org_members from INSIDE an org_members policy → PostgreSQL rejects
-- that as 42P17 "infinite recursion detected in policy", so every authenticated
-- read/write of org_members errored and the whole Teams feature was dead. A
-- SECURITY DEFINER helper reads the table WITHOUT re-triggering RLS.
create or replace function public.is_org_member(p_org uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org and user_id = auth.uid() and accepted = true
  );
$$;
revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.is_org_member(uuid) from anon;
grant execute on function public.is_org_member(uuid) to authenticated, service_role;

-- End users may READ their own membership rows + the roster of orgs they belong
-- to. They may NOT write org_members directly: every membership mutation
-- (create-owner, invite, accept, remove) goes through the server via the
-- service-role client after app-layer authorization, so a user cannot
-- self-escalate to owner/admin by hitting the REST API directly.
create policy "Members can read own org roster"
  on public.org_members for select
  using (user_id = auth.uid() or public.is_org_member(org_id));
create policy "Service role full access on org_members"
  on public.org_members for all
  using (auth.role() = 'service_role');

create index if not exists idx_org_members_org on public.org_members(org_id);
create index if not exists idx_org_members_user on public.org_members(user_id);

-- One membership row per (org, user). schema.sql's CREATE TABLE IF NOT EXISTS
-- means migration-v2's UNIQUE never lands on an existing DB, so add it here
-- idempotently (NULL user_id = pending invite, allowed to repeat).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'org_members_org_user_unique') then
    delete from public.org_members a using public.org_members b
      where a.ctid < b.ctid and a.org_id = b.org_id and a.user_id = b.user_id and a.user_id is not null;
    alter table public.org_members
      add constraint org_members_org_user_unique unique (org_id, user_id);
  end if;
end $$;

-- ============================================
-- 14. Notification Preferences
-- ============================================
alter table public.profiles
  add column if not exists notification_preferences jsonb default '{}'::jsonb;

-- ============================================
-- 15. Stripe webhook idempotency
-- ============================================
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
create policy "Service role full access on stripe_events"
  on public.stripe_events for all
  using (auth.role() = 'service_role');
