import { calculateGutScore, calculateSubScores } from "@/lib/gut-score";
import { shouldRetryQuery } from "@/lib/network-errors";
import { getOnboardingProfile } from "@/lib/onboarding-storage";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

export type GutScoreSource = "scans" | "scans_yesterday" | "onboarding";

export interface GutScoreData {
  gutScore: number;
  subScores: {
    skin: number;
    bloating: number;
    digestion: number;
    energy: number;
  };
  scoreSource: GutScoreSource;
}

/** Build start-of-day and start-of-next-day in local time for a given date. */
function getDayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/** Build day range for the day before the given date. */
function getYesterdayRange(date: Date): { start: Date; end: Date } {
  const yesterday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1, 0, 0, 0, 0);
  return getDayRange(yesterday);
}

async function fetchGutScore(selectedDate?: Date | null): Promise<GutScoreData> {
  const date = selectedDate ?? (() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate(), 0, 0, 0, 0);
  })();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // Not authenticated - use onboarding profile
    const profile = await getOnboardingProfile();
    const score = calculateGutScore(profile);
    const subs = calculateSubScores(score);
    return {
      gutScore: score,
      subScores: subs,
      scoreSource: "onboarding",
    };
  }

  const { start, end } = getDayRange(date);

  const { data: recentScans, error: scanError } = await supabase
    .from("meal_scans")
    .select("gut_score, bloat_score, skin_score, energy_score, digestion_score, analysis")
    .eq("user_id", user.id)
    .eq("logged_as_eaten", true)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())
    .order("created_at", { ascending: false });

  if (scanError) throw scanError;

  if (recentScans && recentScans.length > 0) {
    // Per-scan gut score: gut_score column, then analysis.gut_score, then bloat_score
    const validScores = recentScans
      .map((s) => {
        if (typeof s.gut_score === "number") return s.gut_score;
        const fromAnalysis = (s.analysis as { gut_score?: number } | null)?.gut_score;
        if (typeof fromAnalysis === "number") return fromAnalysis;
        if (typeof s.bloat_score === "number") return s.bloat_score;
        return null;
      })
      .filter((s): s is number => s !== null && s !== undefined);

    if (validScores.length > 0) {
      const avgScore = Math.round(
        validScores.reduce((sum, score) => sum + score, 0) / validScores.length
      );

      // Sub-scores from actual scan averages (no randomness). 0–10 scale -> *10 for 0–100.
      const bloatVals = recentScans
        .map((s) => s.bloat_score)
        .filter((n): n is number => typeof n === "number");
      const skinVals = recentScans
        .map((s) => s.skin_score)
        .filter((n): n is number => typeof n === "number");
      const digestionVals = recentScans
        .map((s) => s.digestion_score)
        .filter((n): n is number => typeof n === "number");
      const energyVals = recentScans
        .map((s) => s.energy_score)
        .filter((n): n is number => typeof n === "number");

      const avg = (a: number[]) =>
        a.length ? a.reduce((s, n) => s + n, 0) / a.length : null;
      const clamp100 = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
      // bloat_score can be 0-10 (client/photo) or 0-100 (edge); normalize to 0-100 for display
      const bloatAvg = bloatVals.length ? avg(bloatVals)! : null;
      const bloatingDisplay =
        bloatAvg == null ? 50 : bloatAvg <= 10 ? clamp100(bloatAvg * 10) : clamp100(bloatAvg);

      const subs = {
        bloating: bloatingDisplay,
        skin: skinVals.length ? clamp100(avg(skinVals)! * 10) : 50,
        digestion: digestionVals.length ? clamp100(avg(digestionVals)! * 10) : 50,
        energy: energyVals.length ? clamp100(avg(energyVals)! * 10) : 50,
      };

      return {
        gutScore: avgScore,
        subScores: subs,
        scoreSource: "scans",
      };
    }
  }

  // No logged-as-eaten scans for selected day: try yesterday
  const { start: yesterdayStart, end: yesterdayEnd } = getYesterdayRange(date);
  const { data: yesterdayScans, error: yesterdayError } = await supabase
    .from("meal_scans")
    .select("gut_score, bloat_score, skin_score, energy_score, digestion_score, analysis")
    .eq("user_id", user.id)
    .eq("logged_as_eaten", true)
    .gte("created_at", yesterdayStart.toISOString())
    .lt("created_at", yesterdayEnd.toISOString())
    .order("created_at", { ascending: false });

  if (!yesterdayError && yesterdayScans && yesterdayScans.length > 0) {
    const validScores = yesterdayScans
      .map((s) => {
        if (typeof s.gut_score === "number") return s.gut_score;
        const fromAnalysis = (s.analysis as { gut_score?: number } | null)?.gut_score;
        if (typeof fromAnalysis === "number") return fromAnalysis;
        if (typeof s.bloat_score === "number") return s.bloat_score;
        return null;
      })
      .filter((s): s is number => s !== null && s !== undefined);

    if (validScores.length > 0) {
      const avgScore = Math.round(
        validScores.reduce((sum, score) => sum + score, 0) / validScores.length
      );
      const bloatVals = yesterdayScans
        .map((s) => s.bloat_score)
        .filter((n): n is number => typeof n === "number");
      const skinVals = yesterdayScans
        .map((s) => s.skin_score)
        .filter((n): n is number => typeof n === "number");
      const digestionVals = yesterdayScans
        .map((s) => s.digestion_score)
        .filter((n): n is number => typeof n === "number");
      const energyVals = yesterdayScans
        .map((s) => s.energy_score)
        .filter((n): n is number => typeof n === "number");
      const avg = (a: number[]) =>
        a.length ? a.reduce((s, n) => s + n, 0) / a.length : null;
      const clamp100 = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
      const bloatAvg = bloatVals.length ? avg(bloatVals)! : null;
      const bloatingDisplay =
        bloatAvg == null ? 50 : bloatAvg <= 10 ? clamp100(bloatAvg * 10) : clamp100(bloatAvg);
      const subs = {
        bloating: bloatingDisplay,
        skin: skinVals.length ? clamp100(avg(skinVals)! * 10) : 50,
        digestion: digestionVals.length ? clamp100(avg(digestionVals)! * 10) : 50,
        energy: energyVals.length ? clamp100(avg(energyVals)! * 10) : 50,
      };
      return {
        gutScore: avgScore,
        subScores: subs,
        scoreSource: "scans_yesterday",
      };
    }
  }

  // Fallback to onboarding profile (no logged-as-eaten scans for this day or yesterday)
  const profile = await getOnboardingProfile();
  const score = calculateGutScore(profile);
  const subs = calculateSubScores(score);
  return {
    gutScore: score,
    subScores: subs,
    scoreSource: "onboarding",
  };
}

/**
 * Hook to get gut score and sub-scores for a given day (or today) using React Query.
 * Provides instant loading with cached data and background refetching.
 */
export function useGutScore(selectedDate?: Date | null) {
  const date = selectedDate ?? (() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate(), 0, 0, 0, 0);
  })();
  const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

  return useQuery({
    queryKey: ["gutScore", dateKey],
    queryFn: () => fetchGutScore(selectedDate),
    staleTime: 1000 * 30, // 30 seconds - real-time updates
    gcTime: 1000 * 60 * 5, // 5 minutes
    retry: shouldRetryQuery,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
    initialData: {
      gutScore: 50,
      subScores: { skin: 50, bloating: 50, digestion: 50, energy: 50 },
      scoreSource: "onboarding",
    },
    // Enable background refetching for real-time updates
    refetchInterval: 1000 * 60, // Refetch every minute
  });
}
