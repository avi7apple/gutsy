import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";
import { isNetworkRequestFailure } from "./network-errors";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Wraps the global fetch so that network-transport errors (no connectivity,
 * DNS failures, timeouts, etc.) are turned into a synthetic 408 JSON response
 * instead of throwing.  This prevents Supabase auth-js internal requests
 * from surfacing unhandled "Network request failed" errors that trigger the
 * React-Native LogBox.
 */
let didWarnNetworkFetch = false;
const networkSafeFetch: typeof globalThis.fetch = async (input, init) => {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (isNetworkRequestFailure(error)) {
      if (!didWarnNetworkFetch) {
        didWarnNetworkFetch = true;
        console.warn(
          "[supabase] Network request failed – returning synthetic 408 so auth-js handles it gracefully.",
        );
      }
      return new Response(
        JSON.stringify({
          error: "request_timeout",
          error_description: "Network request failed",
          message: "Network request failed",
        }),
        {
          status: 408,
          statusText: "Request Timeout",
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    throw error;
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: networkSafeFetch,
  },
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Create a .env file from .env.example and restart Expo with `npx expo start -c`."
  );
}

/**
 * Safe wrapper around getUser() that:
 *  1. Always returns { data: { user }, error } – never null `data`.
 *  2. Catches all network / auth errors so callers can safely destructure.
 *  3. Times out after 5 s so a stalled request can never hang the app.
 */
const _origGetUser = supabase.auth.getUser.bind(supabase.auth);
supabase.auth.getUser = (async (jwt?: string) => {
  try {
    const result = await Promise.race([
      _origGetUser(jwt),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("getUser timeout")), 5000),
      ),
    ]);
    return {
      data: { user: result?.data?.user ?? null },
      error: result?.error ?? null,
    };
  } catch {
    const { data } = await supabase.auth.getSession();
    return { data: { user: data.session?.user ?? null }, error: null };
  }
}) as typeof supabase.auth.getUser;
