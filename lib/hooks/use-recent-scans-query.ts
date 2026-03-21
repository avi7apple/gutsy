import { shouldRetryQuery } from "@/lib/network-errors";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

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

async function fetchRecentScans(limit: number = 5): Promise<RecentScan[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return [];
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

  return scansWithGutScore;
}

/**
 * Hook to fetch recent meal scans for the current user using React Query.
 * Provides instant loading with cached data and background refetching.
 */
export function useRecentScans(limit: number = 5) {
  return useQuery({
    queryKey: ["recentScans"],
    queryFn: () => fetchRecentScans(limit),
    staleTime: 1000 * 30, // 30 seconds - real-time updates
    gcTime: 1000 * 60 * 5, // 5 minutes
    retry: shouldRetryQuery,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
    initialData: [],
    refetchInterval: 1000 * 60, // Refetch every minute
  });
}
