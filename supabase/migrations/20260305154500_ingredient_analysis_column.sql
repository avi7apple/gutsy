-- Store ingredient analysis separately so reopen flows can load it directly without recomputing.
alter table public.meal_scans
  add column if not exists ingredient_analysis jsonb default null;

comment on column public.meal_scans.ingredient_analysis is 'Cached ingredient analysis payload (items/redCount/yellowCount/greenCount) for this scan.';
