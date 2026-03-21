-- Add streaks and scan statistics to user_profiles
alter table public.user_profiles 
add column if not exists current_streak integer default 0,
add column if not exists longest_streak integer default 0,
add column if not exists total_scans integer default 0,
add column if not exists last_scan_date timestamptz,
add column if not exists scan_stats jsonb default '{}'::jsonb;

-- Function to update streaks when a new scan is added
create or replace function public.update_user_streaks()
returns trigger as $$
declare
    scan_date date;
    last_scan_date date;
    days_diff integer;
begin
    -- Get the date of the new scan (in UTC)
    scan_date := date(new.created_at);
    
    -- Get the last scan date for this user
    select coalesce(last_scan_date::date, '1970-01-01'::date) 
    into last_scan_date
    from public.user_profiles 
    where id = new.user_id;
    
    -- Calculate days difference
    days_diff := scan_date - last_scan_date;
    
    if days_diff = 1 then
        -- Consecutive day, increment streak
        update public.user_profiles 
        set 
            current_streak = current_streak + 1,
            longest_streak = greatest(longest_streak, current_streak + 1),
            last_scan_date = new.created_at,
            total_scans = total_scans + 1
        where id = new.user_id;
    elsif days_diff = 0 then
        -- Same day, just increment total scans
        update public.user_profiles 
        set 
            total_scans = total_scans + 1
        where id = new.user_id;
    else
        -- New streak (or first scan)
        update public.user_profiles 
        set 
            current_streak = 1,
            longest_streak = greatest(longest_streak, 1),
            last_scan_date = new.created_at,
            total_scans = total_scans + 1
        where id = new.user_id;
    end if;
    
    return new;
end;
$$ language plpgsql security definer;

-- Function to update scan statistics
create or replace function public.update_scan_stats()
returns trigger as $$
declare
    avg_score numeric;
    most_scanned_food text;
begin
    -- Calculate average score for all user's scans
    select avg(
        case 
            when gut_score is not null then gut_score
            when bloat_score is not null then bloat_score
            else 50
        end
    ) into avg_score
    from public.meal_scans 
    where user_id = new.user_id;
    
    -- Find most scanned food
    select food_name into most_scanned_food
    from (
        select food_name, count(*) as scan_count
        from public.meal_scans 
        where user_id = new.user_id
        group by food_name
        order by scan_count desc
        limit 1
    ) top_food;
    
    -- Update scan statistics
    update public.user_profiles 
    set scan_stats = jsonb_build_object(
        'average_score', round(coalesce(avg_score, 0), 1),
        'most_scanned_food', coalesce(most_scanned_food, ''),
        'last_updated', now()
    )
    where id = new.user_id;
    
    return new;
end;
$$ language plpgsql security definer;

-- Create triggers to automatically update streaks and stats when scans are added
drop trigger if exists on_meal_scan_inserted on public.meal_scans;
create trigger on_meal_scan_inserted
    after insert on public.meal_scans
    for each row execute function public.update_user_streaks();

drop trigger if exists on_meal_scan_stats_update on public.meal_scans;
create trigger on_meal_scan_stats_update
    after insert on public.meal_scans
    for each row execute function public.update_scan_stats();

-- Function to initialize streaks for existing users
create or replace function public.initialize_user_streaks()
returns void as $$
declare
    user_record record;
    first_scan_date date;
    scan_count integer;
begin
    for user_record in 
        select distinct user_id from public.meal_scans
    loop
        -- Get first scan date for this user
        select min(date(created_at)) into first_scan_date
        from public.meal_scans 
        where user_id = user_record.user_id;
        
        -- Get total scan count
        select count(*) into scan_count
        from public.meal_scans 
        where user_id = user_record.user_id;
        
        -- Update user profile with initial data
        update public.user_profiles 
        set 
            current_streak = 1,
            longest_streak = 1,
            total_scans = scan_count,
            last_scan_date = (
                select max(created_at) 
                from public.meal_scans 
                where user_id = user_record.user_id
            )
        where id = user_record.user_id;
    end loop;
    
    -- Update scan stats for all users
    for user_record in 
        select distinct user_id from public.meal_scans
    loop
        perform public.update_scan_stats_for_user(user_record.user_id);
    end loop;
end;
$$ language plpgsql security definer;

-- Helper function to update stats for a specific user
create or replace function public.update_scan_stats_for_user(user_uuid uuid)
returns void as $$
declare
    avg_score numeric;
    most_scanned_food text;
begin
    -- Calculate average score
    select avg(
        case 
            when gut_score is not null then gut_score
            when bloat_score is not null then bloat_score
            else 50
        end
    ) into avg_score
    from public.meal_scans 
    where user_id = user_uuid;
    
    -- Find most scanned food
    select food_name into most_scanned_food
    from (
        select food_name, count(*) as scan_count
        from public.meal_scans 
        where user_id = user_uuid
        group by food_name
        order by scan_count desc
        limit 1
    ) top_food;
    
    -- Update scan statistics
    update public.user_profiles 
    set scan_stats = jsonb_build_object(
        'average_score', round(coalesce(avg_score, 0), 1),
        'most_scanned_food', coalesce(most_scanned_food, ''),
        'last_updated', now()
    )
    where id = user_uuid;
end;
$$ language plpgsql security definer;
