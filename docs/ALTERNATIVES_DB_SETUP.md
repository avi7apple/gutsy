# Saving instant alternatives to the database

Instant alternatives are stored **on the same table as the scan**: `meal_scans.alternatives` (JSONB). There is no separate table. Each scan row has its own cached list so when the user reopens a scan from Today or History they see the same alternatives.

## What you need to do

### 1. Ensure the `alternatives` column exists

If you already ran migrations before the alternatives column was added, add it once:

**Option A – Supabase CLI (recommended)**

```bash
supabase db push
```

This applies any unapplied migrations, including `20260224000000_alternatives.sql` which adds the column.

**Option B – SQL Editor (Supabase Dashboard)**

Run:

```sql
alter table public.meal_scans
  add column if not exists alternatives jsonb default '[]'::jsonb;
```

### 2. Confirm the column is there

In Supabase → SQL Editor:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'meal_scans' and column_name = 'alternatives';
```

You should get one row: `alternatives | jsonb`.

### 3. If alternatives still don’t save

- Check the app console for `[meal_scans] Save alternatives error:` and any Supabase error details.
- Ensure the scan is saved first (so `savedScanId` is set) and that alternatives actually load (you see cards, not “We couldn’t find better alternatives”).
- The app retries the save once after 1.5s if the first update fails.
