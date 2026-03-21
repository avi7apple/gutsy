import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface ScanForDay {
  id: string;
  food_name: string;
  product_name?: string | null;
  image_url: string | null;
  bloat_score: number | null;
  gut_score?: number | null;
  created_at: string;
  scan_type: "photo" | "barcode" | "manual";
}

function getDayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/**
 * Hook to fetch meal scans for a single day (by created_at in local time).
 * Returns all scans created on that day; no logged_as_eaten filter.
 */
export function useScansForDay(date: Date) {
  const [scans, setScans] = useState<ScanForDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

  useEffect(() => {
    let cancelled = false;

    async function fetchScans() {
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

        const { start, end } = getDayRange(date);

        const { data, error: fetchError } = await supabase
          .from("meal_scans")
          .select("id, food_name, product_name, image_url, bloat_score, gut_score, created_at, scan_type, analysis")
          .eq("user_id", user.id)
          .gte("created_at", start.toISOString())
          .lt("created_at", end.toISOString())
          .order("created_at", { ascending: false })
          .limit(5);

        if (fetchError) throw fetchError;

        const scansWithGutScore = (data || []).map((scan) => {
          const gutScore =
            scan.gut_score ??
            (scan.analysis && typeof scan.analysis === "object"
              ? (scan.analysis as { gut_score?: number }).gut_score ?? scan.bloat_score ?? null
              : scan.bloat_score ?? null);
          return {
            ...scan,
            gut_score: gutScore,
          } as ScanForDay;
        });

        if (!cancelled) {
          setScans(scansWithGutScore);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to fetch scans for day"));
          setScans([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchScans();

    return () => {
      cancelled = true;
    };
  }, [dateKey, refreshTrigger]);

  const refetch = useCallback(() => setRefreshTrigger((c) => c + 1), []);

  return { scans, isLoading, error, refetch };
}
