import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

export interface UserStats {
  todayScans: number;
  currentStreak: number;
  weeklyAvgGutScore: number | null;
  totalScans: number;
  longestStreak: number;
}

/**
 * Hook to fetch user statistics (streaks, scan counts, averages).
 */
export function useUserStats() {
  const [stats, setStats] = useState<UserStats>({
    todayScans: 0,
    currentStreak: 0,
    weeklyAvgGutScore: null,
    totalScans: 0,
    longestStreak: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchUserStats() {
      try {
        setIsLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) {
            setIsLoading(false);
          }
          return;
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

        if (!cancelled) {
          setStats({
            todayScans: todayCount || 0,
            currentStreak: profile?.current_streak || 0,
            weeklyAvgGutScore: weeklyAvg,
            totalScans: profile?.total_scans || totalCount || 0,
            longestStreak: profile?.longest_streak || 0,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to fetch user stats"));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchUserStats();

    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  const refetch = () => setRefreshTrigger((c) => c + 1);

  return { stats, isLoading, error, refetch };
}
