import { supabase } from './supabase';

/**
 * Calculate the correct streak for a user based on their scan history
 * Streak counts consecutive days with at least one scan, ending if a day is missed
 */
export async function calculateUserStreak(userId: string): Promise<{
  currentStreak: number;
  longestStreak: number;
  lastScanDate: string | null;
}> {
  try {
    // Get all scan dates for the user, ordered by date
    const { data: scans, error } = await supabase
      .from('meal_scans')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error || !scans || scans.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastScanDate: null,
      };
    }

    // Group scans by date (local timezone)
    const scanDates = new Set<string>();
    scans.forEach(scan => {
      const date = new Date(scan.created_at);
      const dateKey = formatDateKey(date);
      scanDates.add(dateKey);
    });

    // Convert to sorted array
    const sortedDates = Array.from(scanDates).sort();

    // Calculate streaks
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let lastScanDate = scans[scans.length - 1].created_at;

    const now = new Date();
    const today = formatDateKey(now);
    const yesterday = formatDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));

    console.log('[StreakCalculator] Debug:', {
      today,
      yesterday,
      mostRecentDate: formatDateKey(new Date(lastScanDate)),
      sortedDates: sortedDates.slice(-5), // Show last 5 dates
      lastScanDate
    });

    // Check if the most recent scan is today or yesterday
    const mostRecentDate = formatDateKey(new Date(lastScanDate));
    
    // If no scans today or yesterday, current streak is 0 (longest streak still preserved)
    if (mostRecentDate !== today && mostRecentDate !== yesterday) {
      console.log('[StreakCalculator] No recent scans, returning 0 streak');
      const longestStreak = calculateLongestStreak(sortedDates);
      return {
        currentStreak: 0,
        longestStreak,
        lastScanDate,
      };
    }

    // Calculate current streak by going backwards from most recent scan
    tempStreak = 1; // Start with most recent day
    for (let i = sortedDates.length - 2; i >= 0; i--) {
      const currentDate = sortedDates[i];
      const nextDate = sortedDates[i + 1];
      
      // Check if current date is exactly one day before next date
      const dayDiff = daysBetweenDateKeys(currentDate, nextDate);
      
      if (dayDiff === 1) {
        // Consecutive day
        tempStreak++;
      } else {
        // Break in streak
        break;
      }
    }
    
    currentStreak = tempStreak;

    // Calculate longest streak
    longestStreak = calculateLongestStreak(sortedDates);

    return {
      currentStreak,
      longestStreak,
      lastScanDate,
    };
  } catch (error) {
    console.error('[StreakCalculator] Error calculating streak:', error);
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastScanDate: null,
    };
  }
}

/**
 * Update user's streak in the database
 */
export async function updateUserStreak(userId: string): Promise<void> {
  try {
    const { currentStreak, longestStreak, lastScanDate } = await calculateUserStreak(userId);

    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        id: userId,
        current_streak: currentStreak,
        longest_streak: longestStreak,
        last_scan_date: lastScanDate,
      }, {
        onConflict: 'id',
      });

    if (error) {
      console.error('[StreakCalculator] Error updating streak:', error);
    } else {
      console.log(`[StreakCalculator] Updated streak for user: ${currentStreak} days`);
    }
  } catch (error) {
    console.error('[StreakCalculator] Error updating user streak:', error);
  }
}

/**
 * Format date as YYYY-MM-DD for consistent comparison (using local timezone)
 */
function formatDateKey(date: Date): string {
  // Use local timezone to match user's perspective of "today"
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKeyLocal(dateKey: string): Date {
  const [yearStr, monthStr, dayStr] = dateKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!isFinite(year) || !isFinite(month) || !isFinite(day)) {
    return new Date(NaN);
  }
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function daysBetweenDateKeys(fromDateKey: string, toDateKey: string): number {
  const from = parseDateKeyLocal(fromDateKey);
  const to = parseDateKeyLocal(toDateKey);
  if (!isFinite(from.getTime()) || !isFinite(to.getTime())) return Number.POSITIVE_INFINITY;
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function calculateLongestStreak(sortedDates: string[]): number {
  if (sortedDates.length === 0) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    if (daysBetweenDateKeys(sortedDates[i - 1], sortedDates[i]) === 1) {
      current++;
    } else {
      longest = Math.max(longest, current);
      current = 1;
    }
  }
  return Math.max(longest, current);
}

/**
 * Get the start of day in local timezone
 */
function getStartOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}
