import { shouldRetryQuery } from "@/lib/network-errors";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

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

async function fetchScansForDay(date: Date): Promise<ScanForDay[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return [];
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

  return scansWithGutScore;
}

/**
 * Hook to fetch meal scans for a single day using React Query.
 * Returns all scans created on that day; no logged_as_eaten filter.
 * Provides instant loading with cached data and background refetching.
 */
export function useScansForDay(date: Date) {
  const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

  return useQuery({
    queryKey: ["scansForDay", dateKey],
    queryFn: () => fetchScansForDay(date),
    staleTime: 1000 * 30, // 30 seconds - real-time updates
    gcTime: 1000 * 60 * 5, // 5 minutes
    retry: shouldRetryQuery,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
    initialData: [],
    // Enable background refetching for real-time updates
    refetchInterval: 1000 * 60, // Refetch every minute
  });
}
