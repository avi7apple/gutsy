import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface ScanStats {
  totalScans: number;
  averageScore: number;
  mostScannedFood: string;
  lastUpdated: string | null;
}

/**
 * Hook to fetch user's comprehensive scan statistics
 */
export function useScanStats() {
  const [scanStats, setScanStats] = useState<ScanStats>({
    totalScans: 0,
    averageScore: 0,
    mostScannedFood: "",
    lastUpdated: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchScanStats() {
      try {
        setIsLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) {
            setScanStats({ totalScans: 0, averageScore: 0, mostScannedFood: "", lastUpdated: null });
            setIsLoading(false);
          }
          return;
        }

        const { data, error: fetchError } = await supabase
          .from("user_profiles")
          .select("total_scans, scan_stats")
          .eq("id", user.id)
          .single();

        if (fetchError) throw fetchError;

        const stats = data?.scan_stats as any || {};
        
        if (!cancelled) {
          setScanStats({
            totalScans: data?.total_scans ?? 0,
            averageScore: stats?.average_score ?? 0,
            mostScannedFood: stats?.most_scanned_food ?? "",
            lastUpdated: stats?.last_updated ?? null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to fetch scan stats"));
          setScanStats({ totalScans: 0, averageScore: 0, mostScannedFood: "", lastUpdated: null });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchScanStats();

    // Set up real-time subscription for scan stats updates
    let channel: any = null;
    
    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel('scan-stats-changes')
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
              const stats = (payload.new as any).scan_stats as any || {};
              setScanStats({
                totalScans: (payload.new as any).total_scans ?? 0,
                averageScore: stats?.average_score ?? 0,
                mostScannedFood: stats?.most_scanned_food ?? "",
                lastUpdated: stats?.last_updated ?? null,
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
      .select("total_scans, scan_stats")
      .eq("id", user.id)
      .single();

    if (!error && data) {
      const stats = data.scan_stats as any || {};
      setScanStats({
        totalScans: data.total_scans ?? 0,
        averageScore: stats?.average_score ?? 0,
        mostScannedFood: stats?.most_scanned_food ?? "",
        lastUpdated: stats?.last_updated ?? null,
      });
    }
  };

  return { scanStats, isLoading, error, refetch };
}
