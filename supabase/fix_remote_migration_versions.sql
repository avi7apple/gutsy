-- Run this ONCE in Supabase Dashboard → SQL Editor.
-- The CLI compares remote "version" to the TIMESTAMP part only of local filenames (the 14 digits).
-- So remote must store only the 14-digit number, not the full filename.
-- After this, run: npx supabase db push

-- Set every version to the 14-digit timestamp only (no _name suffix):
UPDATE supabase_migrations.schema_migrations SET version = '20260210000000' WHERE version = '20260210000000_meal_scans';
UPDATE supabase_migrations.schema_migrations SET version = '20260215000000' WHERE version = '20260215000000_user_profiles';
UPDATE supabase_migrations.schema_migrations SET version = '20260221000000' WHERE version = '20260221000000_meal_scans_recreate';
UPDATE supabase_migrations.schema_migrations SET version = '20260221100000' WHERE version = '20260221100000_logged_as_eaten';
UPDATE supabase_migrations.schema_migrations SET version = '20260222000000' WHERE version = '20260222000000_meal_scans_complete';
UPDATE supabase_migrations.schema_migrations SET version = '20260224000000' WHERE version = '20260224000000_alternatives';

-- If you still have old 8-digit or full-name versions, run these too:
UPDATE supabase_migrations.schema_migrations SET version = '20260210000000' WHERE version = '20260210_meal_scans';
UPDATE supabase_migrations.schema_migrations SET version = '20260215000000' WHERE version = '20260215_user_profiles';
UPDATE supabase_migrations.schema_migrations SET version = '20260221000000' WHERE version = '20260221_meal_scans_recreate';
UPDATE supabase_migrations.schema_migrations SET version = '20260221100000' WHERE version = '202602211_logged_as_eaten';
UPDATE supabase_migrations.schema_migrations SET version = '20260222000000' WHERE version = '20260222_meal_scans_complete';
UPDATE supabase_migrations.schema_migrations SET version = '20260224000000' WHERE version = '20260224_alternatives';

UPDATE supabase_migrations.schema_migrations SET version = '20260210000000' WHERE version = '20260210';
UPDATE supabase_migrations.schema_migrations SET version = '20260215000000' WHERE version = '20260215';
UPDATE supabase_migrations.schema_migrations SET version = '20260221000000' WHERE version = '20260221';
UPDATE supabase_migrations.schema_migrations SET version = '20260221100000' WHERE version = '202602211';
UPDATE supabase_migrations.schema_migrations SET version = '20260222000000' WHERE version = '20260222';
UPDATE supabase_migrations.schema_migrations SET version = '20260224000000' WHERE version = '20260224';
