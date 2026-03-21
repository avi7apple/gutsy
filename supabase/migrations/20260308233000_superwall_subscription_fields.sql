-- Add subscription fields for Superwall hard-paywall flow
alter table public.user_profiles
  add column if not exists subscription_tier text not null default 'free',
  add column if not exists subscription_status text not null default 'inactive',
  add column if not exists has_seen_paywall boolean not null default false,
  add column if not exists is_trial_active boolean not null default false,
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists superwall_subscription_id text;

alter table public.user_profiles
  drop constraint if exists user_profiles_subscription_tier_check;

alter table public.user_profiles
  add constraint user_profiles_subscription_tier_check
  check (subscription_tier in ('free', 'premium'));

alter table public.user_profiles
  drop constraint if exists user_profiles_subscription_status_check;

alter table public.user_profiles
  add constraint user_profiles_subscription_status_check
  check (subscription_status in ('inactive', 'trialing', 'active', 'cancelled'));
