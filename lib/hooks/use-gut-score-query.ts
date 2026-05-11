import { calculateGutScore, calculateSubScores } from "@/lib/gut-score";
import { shouldRetryQuery } from "@/lib/network-errors";
import { getOnboardingProfile } from "@/lib/onboarding-storage";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";

export type GutScoreSource = "scans" | "scans_yesterday" | "scans_previous" | "onboarding" | "none";

const LAST_GUT_SCORE_CACHE_KEY = "gutsy_last_gut_score_v1";

type CachedGutScore = {
  gutScore: number;
  subScores: { skin: number; bloating: number; digestion: number; energy: number };
  scoreSource: GutScoreSource;
  savedAt: number;
};

async function readCachedGutScore(): Promise<CachedGutScore | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_GUT_SCORE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedGutScore;
    if (
      typeof parsed?.gutScore !== "number" ||
      !parsed.subScores ||
      typeof parsed.subScores.skin !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeCachedGutScore(data: Omit<CachedGutScore, "savedAt">): Promise<void> {
  try {
    await AsyncStorage.setItem(
      LAST_GUT_SCORE_CACHE_KEY,
      JSON.stringify({ ...data, savedAt: Date.now() }),
    );
  } catch {
    // Best-effort cache write; ignore failures.
  }
}

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

async function fetchGutScore(selectedDate?: Date | null): Promise<GutScoreData> {
  const date = selectedDate ?? (() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate(), 0, 0, 0, 0);
  })();

  // Helper: check whether selected day is "today" (so we persist the display value only for today's view).
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const isSelectedToday = date.getTime() === todayStart.getTime();
  const persistIfToday = (data: GutScoreData) => {
    if (isSelectedToday) {
      void writeCachedGutScore(data);
    }
    return data;
  };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // Not authenticated - use onboarding profile
    const profile = await getOnboardingProfile();
    const score = calculateGutScore(profile);
    const subs = calculateSubScores(score);
    return persistIfToday({
      gutScore: score,
      subScores: subs,
      scoreSource: "onboarding",
    });
  }

  const fetchLoggedScansForDate = async (targetDate: Date) => {
    const { start, end } = getDayRange(targetDate);
    const { data, error } = await supabase
      .from("meal_scans")
      .select("gut_score, bloat_score, skin_score, energy_score, digestion_score, analysis")
      .eq("user_id", user.id)
      .eq("logged_as_eaten", true)
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  };

  const buildScorePayload = (rows: Array<{
    gut_score?: number | null;
    bloat_score?: number | null;
    skin_score?: number | null;
    energy_score?: number | null;
    digestion_score?: number | null;
    analysis?: unknown;
  }>) => {
    const validScores = rows
      .map((s) => {
        if (typeof s.gut_score === "number") return s.gut_score;
        const fromAnalysis = (s.analysis as { gut_score?: number } | null)?.gut_score;
        if (typeof fromAnalysis === "number") return fromAnalysis;
        if (typeof s.bloat_score === "number") return s.bloat_score;
        return null;
      })
      .filter((s): s is number => s !== null && s !== undefined);

    if (validScores.length === 0) return null;

    const avgScore = Math.round(
      validScores.reduce((sum, score) => sum + score, 0) / validScores.length
    );

    const bloatVals = rows
      .map((s) => s.bloat_score)
      .filter((n): n is number => typeof n === "number");
    const skinVals = rows
      .map((s) => s.skin_score)
      .filter((n): n is number => typeof n === "number");
    const digestionVals = rows
      .map((s) => s.digestion_score)
      .filter((n): n is number => typeof n === "number");
    const energyVals = rows
      .map((s) => s.energy_score)
      .filter((n): n is number => typeof n === "number");

    const avg = (a: number[]) =>
      a.length ? a.reduce((s, n) => s + n, 0) / a.length : null;
    const clamp100 = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
    const bloatAvg = bloatVals.length ? avg(bloatVals)! : null;
    const bloatingDisplay =
      bloatAvg == null ? 50 : bloatAvg <= 10 ? clamp100(bloatAvg * 10) : clamp100(bloatAvg);

    return {
      gutScore: avgScore,
      subScores: {
        bloating: bloatingDisplay,
        skin: skinVals.length ? clamp100(avg(skinVals)! * 10) : 50,
        digestion: digestionVals.length ? clamp100(avg(digestionVals)! * 10) : 50,
        energy: energyVals.length ? clamp100(avg(energyVals)! * 10) : 50,
      },
    };
  };

  const recentScans = await fetchLoggedScansForDate(date);

  if (recentScans && recentScans.length > 0) {
    const payload = buildScorePayload(recentScans);
    if (payload) {
      return persistIfToday({
        gutScore: payload.gutScore,
        subScores: payload.subScores,
        scoreSource: "scans",
      });
    }
  }

  // No logged meals on selected day: backfill from most recent previous logged day.
  for (let dayOffset = 1; dayOffset <= 60; dayOffset++) {
    const candidateDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayOffset, 0, 0, 0, 0);
    const previousScans = await fetchLoggedScansForDate(candidateDate);
    if (!previousScans.length) continue;
    const payload = buildScorePayload(previousScans);
    if (!payload) continue;
    return persistIfToday({
      gutScore: payload.gutScore,
      subScores: payload.subScores,
      scoreSource: dayOffset === 1 ? "scans_yesterday" : "scans_previous",
    });
  }

  // Fallback to onboarding profile (no scans for today or yesterday)
  const profile = await getOnboardingProfile();
  const score = calculateGutScore(profile);
  const subs = calculateSubScores(score);
  return persistIfToday({
    gutScore: score,
    subScores: subs,
    scoreSource: "onboarding",
  });
}

/**
 * Synchronous initial data accessor: returns the most recently cached gut score
 * from AsyncStorage if available. Used to avoid the hardcoded "50" flash on
 * first mount after app start.
 *
 * React Query's `initialData` must be synchronous, so we prime an in-memory
 * cache once at module load via `primeInitialGutScoreCache()`.
 */
let inMemoryInitialGutScore: GutScoreData | null = null;
let initialCachePrimed = false;
let initialCachePrimingPromise: Promise<void> | null = null;

async function primeInitialGutScoreCache(): Promise<void> {
  if (initialCachePrimed) return;
  if (initialCachePrimingPromise) return initialCachePrimingPromise;
  initialCachePrimingPromise = (async () => {
    try {
      const cached = await readCachedGutScore();
      if (cached) {
        inMemoryInitialGutScore = {
          gutScore: cached.gutScore,
          subScores: cached.subScores,
          scoreSource: cached.scoreSource,
        };
      } else {
        // No cache yet — compute an onboarding-based initial so we don't flash 50.
        try {
          const profile = await getOnboardingProfile();
          const score = calculateGutScore(profile);
          const subs = calculateSubScores(score);
          inMemoryInitialGutScore = {
            gutScore: score,
            subScores: subs,
            scoreSource: "onboarding",
          };
        } catch {
          inMemoryInitialGutScore = null;
        }
      }
    } finally {
      initialCachePrimed = true;
    }
  })();
  return initialCachePrimingPromise;
}

// Kick off priming at module load (non-blocking). The first useGutScore call
// will synchronously read whatever has been primed so far.
void primeInitialGutScoreCache();

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

  // Ensure the priming has kicked off (idempotent).
  void primeInitialGutScoreCache();

  return useQuery({
    queryKey: ["gutScore", dateKey],
    queryFn: () => fetchGutScore(selectedDate),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 15,
    retry: shouldRetryQuery,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: true,
    // Use the primed initial (cached real score or onboarding fallback) instead of
    // a hardcoded 50. If priming hasn't completed on the very first mount, the
    // query will simply show isLoading until the real value arrives.
    initialData: inMemoryInitialGutScore ?? undefined,
    refetchInterval: 1000 * 60 * 3,
  });
}
