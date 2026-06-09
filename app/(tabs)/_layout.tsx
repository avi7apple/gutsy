import { LiquidGlassTabBar } from "@/components/LiquidGlassTabBar";
import { Colors, Fonts } from "@/constants/theme";
import { rf } from "@/lib/hooks/use-responsive";
import { evaluateSubscriptionAccess, touchLastActive } from "@/lib/subscription-access";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

// Don't hit RevenueCat on every single background→foreground; users tab
// between apps constantly. Once every ~10 minutes is plenty to catch
// expirations/cancellations without false-positive demotes from transient
// network/cache issues.
const SUBSCRIPTION_RECHECK_MIN_INTERVAL_MS = 10 * 60 * 1000;

export default function TabsLayout() {
  const router = useRouter();
  const lastAppState = useRef<AppStateStatus>(AppState.currentState);
  const lastRevalidatedAtRef = useRef<number>(0);

  useEffect(() => {
    // Stamp last_active_at on cold start too — AppState only fires on
    // foreground/background transitions, not initial mount.
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) void touchLastActive(user.id);
    })();

    const subscription = AppState.addEventListener("change", (nextState) => {
      const prevState = lastAppState.current;
      lastAppState.current = nextState;

      const cameToForeground =
        (prevState === "background" || prevState === "inactive") &&
        nextState === "active";
      if (!cameToForeground) return;

      void revalidateSubscription();
    });

    return () => subscription.remove();

    async function revalidateSubscription() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Cheap analytics ping on every foreground (separate from the
        // throttled RC re-check below).
        void touchLastActive(user.id);

        const now = Date.now();
        const sinceLast = now - lastRevalidatedAtRef.current;
        if (sinceLast < SUBSCRIPTION_RECHECK_MIN_INTERVAL_MS) {
          return;
        }
        lastRevalidatedAtRef.current = now;

        const access = await evaluateSubscriptionAccess(user.id);
        if (!access.hasPaidAccess) {
          router.replace("/paywall" as any);
        }
      } catch (err) {
        console.warn("Foreground subscription re-check failed:", err);
      }
    }
  }, [router]);

  return (
    <Tabs
      tabBar={(props) => <LiquidGlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: Fonts.tabBarLabel,
          fontSize: rf(12),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="gut-helper"
        options={{
          title: "Gut Helper",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarStyle: { display: "none" },
          sceneStyle: { backgroundColor: "#000000" },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="camera" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
