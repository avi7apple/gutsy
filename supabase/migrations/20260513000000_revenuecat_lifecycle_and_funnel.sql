-- RevenueCat lifecycle + funnel analytics
--
-- Goals of this migration:
--   1. Replace the legacy `superwall_subscription_id` column with a properly
--      named `revenuecat_app_user_id` column so RevenueCat webhooks can be
--      mapped back to Supabase rows in the future.
--   2. Add subscription lifecycle fields that mirror what RevenueCat actually
--      reports on an entitlement (`store`, `product_id`, `will_renew`,
--      `current_period_ends_at`, `original_purchase_date`, etc.) so the
--      Supabase row reflects reality rather than only a "trialing/active"
--      bucket.
--   3. Add funnel + engagement tracking columns that the app can populate
--      cheaply (paywall view count, last paywall seen, last_active_at,
--      onboarding timestamps, etc.) so cohort/retention dashboards can be
--      built from `user_profiles` without grepping logs.
--   4. Add a separate `revenuecat_events` audit table that an RC webhook can
--      append to (kept out of `user_profiles` because it's append-only).

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Rename the legacy Superwall column. Tolerant if it was already renamed
--    or never existed.
-- ────────────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'superwall_subscription_id'
  ) then
    alter table public.user_profiles
      rename column superwall_subscription_id to revenuecat_app_user_id;
  end if;
end $$;

alter table public.user_profiles
  add column if not exists revenuecat_app_user_id text;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Subscription lifecycle columns mirroring RevenueCat's entitlement info.
-- ────────────────────────────────────────────────────────────────────────────
alter table public.user_profiles
  add column if not exists current_period_ends_at timestamptz,
  add column if not exists original_purchase_date timestamptz,
  add column if not exists will_renew              boolean,
  add column if not exists cancelled_at            timestamptz,
  add column if not exists store                   text,
  add column if not exists product_id              text,
  add column if not exists currency                text,
  add column if not exists price_paid              numeric;

alter table public.user_profiles
  drop constraint if exists user_profiles_store_check;

alter table public.user_profiles
  add constraint user_profiles_store_check
  check (
    store is null
    or store in (
      'APP_STORE',
      'MAC_APP_STORE',
      'PLAY_STORE',
      'STRIPE',
      'PROMOTIONAL',
      'AMAZON',
      'RC_BILLING',
      'EXTERNAL',
      'UNKNOWN_STORE'
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Funnel + engagement analytics columns.
--    Cheap to populate from existing entry points; expensive to add later
--    once you've shipped, so we add them up-front.
-- ────────────────────────────────────────────────────────────────────────────
alter table public.user_profiles
  add column if not exists paywall_view_count       integer not null default 0,
  add column if not exists last_paywall_seen_at     timestamptz,
  add column if not exists trial_started_count      integer not null default 0,
  add column if not exists onboarding_started_at    timestamptz,
  add column if not exists onboarding_completed_at  timestamptz,
  add column if not exists last_active_at           timestamptz,
  add column if not exists country                  text,
  add column if not exists referral_source          text;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Append-only audit log for RevenueCat webhook events.
--    Populated by a (future) `supabase/functions/revenuecat-webhook` edge
--    function that uses the service role key. Schema mirrors RC's webhook
--    payload but keeps the raw envelope for forensic debugging.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.revenuecat_events (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users (id) on delete cascade,
  rc_app_user_id    text,
  event_type        text not null,
  event_timestamp   timestamptz not null,
  product_id        text,
  period_type       text,
  store             text,
  price             numeric,
  currency          text,
  environment       text,
  expiration_at     timestamptz,
  raw_event         jsonb not null,
  created_at        timestamptz not null default now()
);

create index if not exists revenuecat_events_user_id_idx
  on public.revenuecat_events (user_id);

create index if not exists revenuecat_events_event_timestamp_idx
  on public.revenuecat_events (event_timestamp desc);

alter table public.revenuecat_events enable row level security;

-- Users may read their own audit rows (useful for support / debugging the
-- profile screen). Inserts come only from the service role via the webhook
-- edge function — no client-side write policy.
drop policy if exists "Users can read their own RC events" on public.revenuecat_events;
create policy "Users can read their own RC events"
  on public.revenuecat_events for select
  using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Helpful indexes on the new lifecycle columns for filtering dashboards.
-- ────────────────────────────────────────────────────────────────────────────
create index if not exists user_profiles_subscription_status_idx
  on public.user_profiles (subscription_status);

create index if not exists user_profiles_current_period_ends_at_idx
  on public.user_profiles (current_period_ends_at);

create index if not exists user_profiles_last_active_at_idx
  on public.user_profiles (last_active_at);
