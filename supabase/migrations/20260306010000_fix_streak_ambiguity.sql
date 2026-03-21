-- Fix column ambiguity in streak update function

-- Drop the existing trigger and function
drop trigger if exists on_meal_scan_inserted on public.meal_scans;
drop function if exists public.update_user_streaks();

-- Recreate the function with fixed variable names
create or replace function public.update_user_streaks()
returns trigger as $$
declare
    scan_date date;
    last_scan_date_from_db date;
    days_diff integer;
    current_streak_val integer;
    longest_streak_val integer;
    total_scans_val integer;
begin
    -- Get the date of the new scan (in UTC)
    scan_date := date(new.created_at);
    
    -- Get the last scan date for this user
    select coalesce(last_scan_date::date, '1970-01-01'::date) 
    into last_scan_date_from_db
    from public.user_profiles 
    where id = new.user_id;
    
    -- Calculate days difference
    days_diff := scan_date - last_scan_date_from_db;
    
    -- Get current values
    select coalesce(current_streak, 0), coalesce(longest_streak, 0), coalesce(total_scans, 0)
    into current_streak_val, longest_streak_val, total_scans_val
    from public.user_profiles 
    where id = new.user_id;
    
    if days_diff = 1 then
        -- Consecutive day, increment streak
        update public.user_profiles 
        set 
            current_streak = current_streak_val + 1,
            longest_streak = greatest(longest_streak_val, current_streak_val + 1),
            last_scan_date = new.created_at,
            total_scans = total_scans_val + 1
        where id = new.user_id;
    elsif days_diff = 0 then
        -- Same day, just increment total scans
        update public.user_profiles 
        set 
            total_scans = total_scans_val + 1
        where id = new.user_id;
    else
        -- New streak (or first scan)
        update public.user_profiles 
        set 
            current_streak = 1,
            longest_streak = greatest(longest_streak_val, 1),
            last_scan_date = new.created_at,
            total_scans = total_scans_val + 1
        where id = new.user_id;
    end if;
    
    return new;
end;
$$ language plpgsql security definer;

-- Recreate the trigger
create trigger on_meal_scan_inserted
    after insert on public.meal_scans
    for each row execute function public.update_user_streaks();
