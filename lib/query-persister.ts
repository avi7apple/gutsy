import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueryClient } from "@tanstack/react-query";

const CACHE_KEY = "GUTSY_QUERY_CACHE";
const CACHE_VERSION = 1;

interface PersistedCache {
  version: number;
  timestamp: number;
  data: Record<string, { data: unknown; dataUpdatedAt: number }>;
}

/**
 * Persist React Query cache to AsyncStorage for instant cold starts.
 * Only caches specific query keys that benefit from persistence.
 */
const PERSISTABLE_KEYS = [
  "userProfile",
  "userData",
  "gutScore",
  "weekData",
  "userStats",
  "recentScans",
  "allScans",
];

function shouldPersist(queryKey: readonly unknown[]): boolean {
  const key = typeof queryKey[0] === "string" ? queryKey[0] : "";
  return PERSISTABLE_KEYS.includes(key);
}

/** Save current query cache to AsyncStorage (debounced externally). */
export async function persistQueryCache(queryClient: QueryClient): Promise<void> {
  try {
    const queryCache = queryClient.getQueryCache();
    const queries = queryCache.getAll();
    const data: PersistedCache["data"] = {};

    for (const query of queries) {
      if (
        shouldPersist(query.queryKey) &&
        query.state.status === "success" &&
        query.state.data !== undefined
      ) {
        const keyStr = JSON.stringify(query.queryKey);
        data[keyStr] = {
          data: query.state.data,
          dataUpdatedAt: query.state.dataUpdatedAt,
        };
      }
    }

    const cache: PersistedCache = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      data,
    };

    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    // Silently fail — cache persistence is best-effort
    console.warn("Failed to persist query cache:", e);
  }
}

/** Restore cached query data into the QueryClient on app start. */
export async function restoreQueryCache(queryClient: QueryClient): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return;

    const cache: PersistedCache = JSON.parse(raw);
    if (cache.version !== CACHE_VERSION) {
      await AsyncStorage.removeItem(CACHE_KEY);
      return;
    }

    // Don't restore cache older than 30 minutes
    const MAX_AGE = 1000 * 60 * 30;
    if (Date.now() - cache.timestamp > MAX_AGE) {
      await AsyncStorage.removeItem(CACHE_KEY);
      return;
    }

    for (const [keyStr, entry] of Object.entries(cache.data)) {
      try {
        const queryKey = JSON.parse(keyStr);
        queryClient.setQueryData(queryKey, entry.data, {
          updatedAt: entry.dataUpdatedAt,
        });
      } catch {
        // Skip individual entries that fail to parse
      }
    }
  } catch (e) {
    console.warn("Failed to restore query cache:", e);
  }
}
