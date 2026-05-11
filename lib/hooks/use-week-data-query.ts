import { shouldRetryQuery } from "@/lib/network-errors";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

/** Single letter day labels Mon–Sun */
const WEEK_DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

export type DayStatus = "good" | "warning" | "bad" | "none";

export interface WeekDayItem {
  day: string;
  date: string;
  status: DayStatus;
  score: number | null;
  dateObj: Date;
  isToday: boolean;
}

export interface WeekDataResult {
  weekData: WeekDayItem[];
  todayIndex: number;
  trackedCount: number;
  totalDays: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/** Start of Monday 00:00 local for the week containing d. */
function getWeekStart(d: Date): Date {
  const day = d.getDay(); // 0 Sun, 1 Mon, ..., 6 Sat
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

/** End of Sunday 23:59:59.999 local for that week. */
function getWeekEnd(start: Date): Date {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function scoreToStatus(score: number): DayStatus {
  if (score >= 76) return "good";
  if (score >= 51) return "warning";
  return "bad";
}

/**
 * Fetches meal_scans for the current week (Mon–Sun), grouped by day.
 * Counts all scans (not just logged_as_eaten) for better user experience.
 * Returns weekData with status/score per day.
 */
function getDefaultWeek(now: Date): WeekDayItem[] {
  const weekStart = getWeekStart(now);
  return WEEK_DAY_LETTERS.map((day, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    return {
      day,
      date: String(d.getDate()),
      status: "none" as DayStatus,
      score: null,
      dateObj: d,
      isToday,
    };
  });
}

async function fetchWeekData(): Promise<Omit<WeekDataResult, 'totalDays'>> {
  const { data: { user } } = await supabase.auth.getUser();
  const now = new Date();
  const weekStart = getWeekStart(now);
  const weekEnd = getWeekEnd(weekStart);

  const defaultWeek: WeekDayItem[] = WEEK_DAY_LETTERS.map((day, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    return {
      day,
      date: String(d.getDate()),
      status: "none" as DayStatus,
      score: null,
      dateObj: d,
      isToday,
    };
  });

  if (!user) {
    const idx = defaultWeek.findIndex((x) => x.isToday);
    return {
      weekData: defaultWeek,
      todayIndex: idx >= 0 ? idx : 0,
      trackedCount: 0,
      isLoading: false,
      error: null,
      refetch: () => {},
    };
  }

  const { data: scans, error: scanError } = await supabase
    .from("meal_scans")
    .select("gut_score, bloat_score, analysis, created_at")
    .eq("user_id", user.id)
    .eq("logged_as_eaten", true)
    .gte("created_at", weekStart.toISOString())
    .lte("created_at", weekEnd.toISOString());

  if (scanError) throw scanError;

  const byDay: Record<string, number[]> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    byDay[key] = [];
  }

  (scans ?? []).forEach((s) => {
    const created = new Date(s.created_at);
    const key = `${created.getFullYear()}-${created.getMonth()}-${created.getDate()}`;
    if (!byDay[key]) byDay[key] = [];
    const score =
      typeof s.gut_score === "number"
        ? s.gut_score
        : (s.analysis as { gut_score?: number } | null)?.gut_score ?? s.bloat_score;
    if (typeof score === "number") byDay[key].push(score);
  });

  const result: WeekDayItem[] = defaultWeek.map((item) => {
    const key = `${item.dateObj.getFullYear()}-${item.dateObj.getMonth()}-${item.dateObj.getDate()}`;
    const scores = byDay[key] ?? [];
    if (scores.length === 0) {
      return { ...item, status: "none" as DayStatus, score: null };
    }
    const avg = Math.round(
      scores.reduce((a, b) => a + b, 0) / scores.length
    );
    return {
      ...item,
      status: scoreToStatus(avg),
      score: avg,
    };
  });

  const tracked = result.filter((r) => r.status !== "none").length;
  const todayIdx = result.findIndex((r) => r.isToday);

  return {
    weekData: result,
    todayIndex: todayIdx >= 0 ? todayIdx : 0,
    trackedCount: tracked,
    isLoading: false,
    error: null,
    refetch: () => {},
  };
}

/**
 * Hook to fetch week data using React Query.
 * Provides instant loading with cached data and background refetching.
 */
export function useWeekData(): WeekDataResult {
  const now = new Date();
  const defaultWeek = getDefaultWeek(now);
  const defaultTodayIndex = defaultWeek.findIndex((x) => x.isToday);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["weekData"],
    queryFn: fetchWeekData,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    retry: shouldRetryQuery,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
    initialData: {
      weekData: defaultWeek,
      todayIndex: defaultTodayIndex >= 0 ? defaultTodayIndex : 0,
      trackedCount: 0,
      isLoading: false,
      error: null,
      refetch: () => {},
    },
    refetchInterval: 1000 * 60 * 5,
  });

  // Ensure dateObj is properly reconstructed as Date objects after cache retrieval
  const weekData = (data?.weekData ?? defaultWeek).map(item => ({
    ...item,
    dateObj: new Date(item.dateObj),
  }));

  return {
    weekData,
    todayIndex: data?.todayIndex ?? defaultTodayIndex,
    trackedCount: data?.trackedCount ?? 0,
    totalDays: 7,
    isLoading,
    error: error instanceof Error ? error : null,
    refetch,
  };
}
