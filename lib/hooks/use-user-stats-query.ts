import { shouldRetryQuery } from "@/lib/network-errors";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

export interface UserStats {
  todayScans: number;
  currentStreak: number;
  weeklyAvgGutScore: number | null;
  totalScans: number;
  longestStreak: number;
}

async function fetchUserStats(): Promise<UserStats> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      todayScans: 0,
      currentStreak: 0,
      weeklyAvgGutScore: null,
      totalScans: 0,
      longestStreak: 0,
    };
  }

  // Get today's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get 7 days ago for weekly average
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Fetch today's scans count
  const { count: todayCount, error: todayError } = await supabase
    .from("meal_scans")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", today.toISOString())
    .lt("created_at", tomorrow.toISOString());

  if (todayError) throw todayError;

  // Fetch total scans count
  const { count: totalCount, error: totalError } = await supabase
    .from("meal_scans")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (totalError) throw totalError;

  // Fetch weekly scans for average
  const { data: weeklyScans, error: weeklyError } = await supabase
    .from("meal_scans")
    .select("bloat_score")
    .eq("user_id", user.id)
    .gte("created_at", sevenDaysAgo.toISOString());

  if (weeklyError) throw weeklyError;

  // Calculate weekly average
  let weeklyAvg: number | null = null;
  if (weeklyScans && weeklyScans.length > 0) {
    const validScores = weeklyScans
      .map((s) => s.bloat_score)
      .filter((s): s is number => s !== null && s !== undefined);
    
    if (validScores.length > 0) {
      weeklyAvg = Math.round(
        validScores.reduce((sum, score) => sum + score, 0) / validScores.length
      );
    }
  }

  // Fetch user profile for streak info
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("current_streak, longest_streak, total_scans, scan_stats")
    .eq("id", user.id)
    .single();

  if (profileError && profileError.code !== "PGRST116") {
    // PGRST116 is "not found" which is okay
    console.warn("Profile fetch error:", profileError);
  }

  return {
    todayScans: todayCount || 0,
    currentStreak: profile?.current_streak || 0,
    weeklyAvgGutScore: weeklyAvg,
    totalScans: profile?.total_scans || totalCount || 0,
    longestStreak: profile?.longest_streak || 0,
  };
}

/**
 * Hook to fetch user statistics (streaks, scan counts, averages) using React Query.
 * Provides instant loading with cached data and background refetching.
 */
export function useUserStats() {
  return useQuery({
    queryKey: ["userStats"],
    queryFn: fetchUserStats,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 30,
    retry: shouldRetryQuery,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    refetchOnReconnect: true,
    initialData: {
      todayScans: 0,
      currentStreak: 0,
      weeklyAvgGutScore: null,
      totalScans: 0,
      longestStreak: 0,
    },
    refetchInterval: 1000 * 60,
  });
}
