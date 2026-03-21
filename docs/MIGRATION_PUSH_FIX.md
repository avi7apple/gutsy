# Fix: Supabase db push — migration version mismatch

**Root cause:** Supabase CLI expects migration filenames in **14-digit timestamp** format: `YYYYMMDDHHmmss_name.sql`. Files with 8-digit timestamps (e.g. `20260210_meal_scans.sql`) are **skipped**. The CLI then sees remote versions but zero valid local files → “Remote migration versions not found in local migrations directory.”

**Fix applied in this repo:** All migrations were renamed to 14-digit timestamps (e.g. `20260210000000_meal_scans.sql`). You must **sync the remote** migration history to these new version strings, then push.

---

## One-time fix

### 1. Update remote version strings in the Dashboard

1. Open **Supabase Dashboard** → your project → **SQL Editor**.
2. Run the full contents of **`supabase/fix_remote_migration_versions.sql`** (it updates both old 8-digit and full-name versions to the new 14-digit names).
3. Click **Run**.

### 2. Push

```bash
npx supabase db push
```

You should see no new migrations to apply (or a clean push). Future `db push` will work.

---

## Optional: add the `alternatives` column

If the table doesn’t have it yet, run in SQL Editor:

```sql
ALTER TABLE public.meal_scans
  ADD COLUMN IF NOT EXISTS alternatives jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.meal_scans.alternatives IS 'Cached instant-alternative products (product + scores + whyBetter) for this scan.';
```
