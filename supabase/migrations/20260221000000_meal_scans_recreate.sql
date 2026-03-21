-- Recreate meal_scans with product_name, gut_score, and full schema per plan.
-- Run after dropping the old table, or use this migration to drop and create.

drop table if exists public.meal_scans;

create table public.meal_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Scan inputs / identifiers
  scan_type text not null check (scan_type in ('photo', 'barcode', 'manual')),
  food_name text not null,
  product_name text,
  identified_foods text[] default '{}'::text[],
  barcode text,

  -- Media
  image_url text,
  image_storage_path text,

  -- Scores (bloat/skin/energy/digestion 0-10; gut_score 0-100 for display and list views)
  gut_score integer,
  bloat_score integer,
  skin_score integer,
  energy_score integer,
  digestion_score integer,

  -- Rich content (manufacturer, ingredients, full ScanAnalysis stored inside analysis)
  analysis jsonb default '{}'::jsonb,
  nutrition jsonb default '{}'::jsonb,
  ai_confidence numeric,

  -- Optional feedback / UX (not set by scan flow)
  user_rating integer,
  actual_bloating integer,
  actual_energy_crash integer,
  actual_skin_reaction integer,
  user_notes text,
  meal_time text,
  is_favorite boolean default false,
  tags text[] default '{}'::text[],

  -- Set when user taps "Log as eaten" (scan is saved automatically on result)
  logged_as_eaten boolean not null default false,

  created_at timestamptz not null default now()
);

alter table public.meal_scans enable row level security;

create policy "Users can manage their own meal_scans"
  on public.meal_scans
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
