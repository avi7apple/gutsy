-- Add profile settings columns for notifications and privacy
alter table public.user_profiles
add column if not exists notification_settings jsonb not null default '{}'::jsonb,
add column if not exists privacy_settings jsonb not null default '{}'::jsonb;

-- Backfill defaults for existing users with missing keys
update public.user_profiles
set notification_settings = jsonb_build_object(
  'dailyScanReminders', coalesce((notification_settings ->> 'dailyScanReminders')::boolean, true),
  'achievementAlerts', coalesce((notification_settings ->> 'achievementAlerts')::boolean, true),
  'weeklyProgressReports', coalesce((notification_settings ->> 'weeklyProgressReports')::boolean, true),
  'gutHealthTips', coalesce((notification_settings ->> 'gutHealthTips')::boolean, false)
),
privacy_settings = jsonb_build_object(
  'analyticsTracking', coalesce((privacy_settings ->> 'analyticsTracking')::boolean, true),
  'researchDataSharing', coalesce((privacy_settings ->> 'researchDataSharing')::boolean, false),
  'personalizedRecommendations', coalesce((privacy_settings ->> 'personalizedRecommendations')::boolean, true)
);
