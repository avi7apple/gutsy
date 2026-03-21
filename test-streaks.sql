-- Test script to verify streaks functionality
-- This can be run in the Supabase SQL Editor

-- First, let's check if our new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND column_name IN ('current_streak', 'longest_streak', 'total_scans', 'last_scan_date', 'scan_stats');

-- Test the streak calculation function by inserting a test scan
-- (Make sure to replace 'your-user-id' with an actual user ID)

-- Check current user profiles
SELECT id, current_streak, longest_streak, total_scans, last_scan_date, scan_stats 
FROM user_profiles 
LIMIT 5;

-- Check meal scans for a user
SELECT user_id, food_name, created_at, gut_score, bloat_score 
FROM meal_scans 
ORDER BY created_at DESC 
LIMIT 10;
