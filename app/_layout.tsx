import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Colors } from "@/constants/theme";
import { initAuthSessionRecovery } from "@/lib/auth-session";
import { isInvalidRefreshTokenError } from "@/lib/auth-errors";
import { isNetworkRequestFailure, shouldRetryQuery } from "@/lib/network-errors";
import { persistQueryCache, restoreQueryCache } from "@/lib/query-persister";
import { configureRevenueCat } from "@/lib/revenuecat";
import { initSentry, Sentry } from "@/lib/sentry";
import {
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef } from "react";
import { LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// ── Suppress "Network request failed" from ever showing a red LogBox ──
LogBox.ignoreLogs(["Network request failed"]);

initSentry();

// ── Catch unhandled promise rejections caused by network errors ──
const originalHandler = (globalThis as any).ErrorUtils?.getGlobalHandler?.();
if ((globalThis as any).ErrorUtils) {
  (globalThis as any).ErrorUtils.setGlobalHandler(
    (error: any, isFatal?: boolean) => {
      if (isInvalidRefreshTokenError(error)) {
        return;
      }
      if (!isFatal && isNetworkRequestFailure(error)) {
        // Silently swallow non-fatal network errors
        return;
      }
      Sentry.captureException(error);
      originalHandler?.(error, isFatal);
    },
  );
}

// ── Also intercept console.error so network errors never escalate ──
const _origConsoleError = console.error;
console.error = (...args: any[]) => {
  if (
    args.length > 0 &&
    (isInvalidRefreshTokenError(args[0]) ||
      isNetworkRequestFailure(args[0]) ||
      (typeof args[0] === "string" &&
        /network request failed/i.test(args[0])))
  ) {
    // Downgrade to warn so it doesn't trigger LogBox
    console.warn("[auth/network]", ...args);
    return;
  }
  _origConsoleError(...args);
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes — data stays "fresh" this long
      gcTime: 1000 * 60 * 30, // 30 minutes — keep in memory longer
      retry: shouldRetryQuery,
      refetchOnWindowFocus: false,
      refetchOnMount: "always", // silently refetch in background on mount
    },
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  // Restore cached query data on cold start for instant UI
  const restored = useRef(false);
  useEffect(() => {
    if (!restored.current) {
      restored.current = true;
      restoreQueryCache(queryClient);
    }
  }, []);

  // Initialize RevenueCat early so paywall + entitlement checks are ready.
  useEffect(() => {
    void configureRevenueCat();
  }, []);

  // Clear ghost sessions when refresh tokens are invalid server-side.
  useEffect(() => {
    return initAuthSessionRecovery();
  }, []);

  // Persist cache periodically when queries update
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        persistQueryCache(queryClient);
      }, 2000); // debounce 2s
    });
    return () => {
      unsubscribe();
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, []);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }} />
    );
  }

  return (
    <ErrorBoundary onError={(error) => Sentry.captureException(error)}>
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="paywall" options={{ gestureEnabled: false }} />
          <Stack.Screen name="scan-result" />
          <Stack.Screen name="create-account" />
          <Stack.Screen name="try-free" options={{ gestureEnabled: false }} />
          <Stack.Screen name="reminder-promise" options={{ gestureEnabled: false }} />
          <Stack.Screen name="trial-timeline" options={{ gestureEnabled: false }} />
          <Stack.Screen name="gut-score" />
          <Stack.Screen name="improve-gut" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="profile/edit-profile" />
          <Stack.Screen name="profile/notifications" />
          <Stack.Screen name="profile/privacy" />
          <Stack.Screen name="profile/terms-of-use" />
        </Stack>
      </GestureHandlerRootView>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
