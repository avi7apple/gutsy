-- Migration: create meal_scans table and basic RLS
create table if not exists public.meal_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  image_url text,
  image_storage_path text,
  scan_type text not null check (scan_type in ('photo','barcode','manual')),
  food_name text not null,
  identified_foods text[] default '{}'::text[],
  ai_confidence numeric,
  barcode text,
  bloat_score integer,
  skin_score integer,
  energy_score integer,
  digestion_score integer,
  analysis jsonb default '{}'::jsonb,
  nutrition jsonb default '{}'::jsonb,
  user_rating integer,
  actual_bloating integer,
  actual_energy_crash integer,
  actual_skin_reaction integer,
  user_notes text,
  meal_time text,
  is_favorite boolean default false,
  tags text[] default '{}'::text[],
  created_at timestamptz not null default now()
);

alter table public.meal_scans enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'meal_scans' and policyname = 'Users can manage their own meal_scans'
  ) then
    create policy "Users can manage their own meal_scans"
      on public.meal_scans for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
