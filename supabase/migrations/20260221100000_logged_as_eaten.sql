-- Add logged_as_eaten flag so users can mark a scan as "eaten" after viewing.
-- Scans are saved automatically; this flag is set when user taps "Log as eaten".

alter table public.meal_scans
  add column if not exists logged_as_eaten boolean not null default false;
