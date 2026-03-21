-- Store instant alternatives per scan so we show the same products when viewing a past scan.
alter table public.meal_scans
  add column if not exists alternatives jsonb default '[]'::jsonb;

comment on column public.meal_scans.alternatives is 'Cached instant-alternative products (product + scores + whyBetter) for this scan.';
