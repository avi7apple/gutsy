import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  lastScanDate: string | null;
}

/**
 * Hook to fetch user's streak statistics
 */
export function useStreakStats() {
  const [streakStats, setStreakStats] = useState<StreakStats>({
    currentStreak: 0,
    longestStreak: 0,
    lastScanDate: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStreakStats() {
      try {
        setIsLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) {
            setStreakStats({ currentStreak: 0, longestStreak: 0, lastScanDate: null });
            setIsLoading(false);
          }
          return;
        }

        const { data, error: fetchError } = await supabase
          .from("user_profiles")
          .select("current_streak, longest_streak, last_scan_date")
          .eq("id", user.id)
          .single();

        if (fetchError) throw fetchError;

        if (!cancelled) {
          setStreakStats({
            currentStreak: data?.current_streak ?? 0,
            longestStreak: data?.longest_streak ?? 0,
            lastScanDate: data?.last_scan_date ?? null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to fetch streak stats"));
          setStreakStats({ currentStreak: 0, longestStreak: 0, lastScanDate: null });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchStreakStats();

    // Set up real-time subscription for streak updates
    let channel: any = null;
    
    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel('streak-stats-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_profiles',
            filter: `id=eq.${user.id}`
          },
          (payload) => {
            if (!cancelled && payload.new) {
              setStreakStats({
                currentStreak: (payload.new as any).current_streak ?? 0,
                longestStreak: (payload.new as any).longest_streak ?? 0,
                lastScanDate: (payload.new as any).last_scan_date ?? null,
              });
            }
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const refetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("user_profiles")
      .select("current_streak, longest_streak, last_scan_date")
      .eq("id", user.id)
      .single();

    if (!error && data) {
      setStreakStats({
        currentStreak: data.current_streak ?? 0,
        longestStreak: data.longest_streak ?? 0,
        lastScanDate: data.last_scan_date ?? null,
      });
    }
  };

  return { streakStats, isLoading, error, refetch };
}
