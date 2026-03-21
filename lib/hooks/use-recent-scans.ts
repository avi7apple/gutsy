import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface RecentScan {
  id: string;
  food_name: string;
  product_name?: string | null;
  image_url: string | null;
  bloat_score: number | null;
  gut_score?: number | null;
  created_at: string;
  scan_type: "photo" | "barcode" | "manual";
}

/**
 * Hook to fetch recent meal scans for the current user.
 */
export function useRecentScans(limit: number = 5) {
  const [scans, setScans] = useState<RecentScan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchRecentScans() {
      try {
        setIsLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) {
            setScans([]);
            setIsLoading(false);
          }
          return;
        }

        const { data, error: fetchError } = await supabase
          .from("meal_scans")
          .select("id, food_name, product_name, image_url, bloat_score, gut_score, created_at, scan_type, analysis")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (fetchError) throw fetchError;

        const scansWithGutScore = (data || []).map((scan) => {
          const gutScore =
            scan.gut_score ??
            (scan.analysis && typeof scan.analysis === "object"
              ? (scan.analysis as any).gut_score ?? scan.bloat_score ?? null
              : scan.bloat_score ?? null);
          return {
            ...scan,
            gut_score: gutScore,
          } as RecentScan;
        });

        if (!cancelled) {
          setScans(scansWithGutScore);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to fetch recent scans"));
          setScans([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchRecentScans();

    return () => {
      cancelled = true;
    };
  }, [limit, refreshTrigger]);

  const refetch = () => setRefreshTrigger((c) => c + 1);

  return { scans, isLoading, error, refetch };
}
