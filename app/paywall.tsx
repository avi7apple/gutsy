import { Colors, Fonts, Spacing } from "@/constants/theme";
import { markPaywallSeen, startTrialAccess } from "@/lib/subscription-access";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const DEFAULT_PLACEMENT = "trial_timeline";
const SUPERWALL_UNAVAILABLE_MESSAGE =
  "Paywall requires a development build. Run `npx expo run:ios` or `npx expo run:android`.";

type RegisterPlacementArgs = {
  placement: string;
  feature: () => Promise<void>;
};

type RuntimeHooks = {
  useUser: () => { identify: (userId: string) => Promise<void> };
  usePlacement: (handlers: {
    onError: (message: string) => void;
    onDismiss: () => void;
  }) => {
    registerPlacement: (args: RegisterPlacementArgs) => Promise<void>;
  };
  available: boolean;
};

const runtimeHooks: RuntimeHooks = {
  useUser: () => ({
    identify: async () => {},
  }),
  usePlacement: () => ({
    registerPlacement: async () => {
      throw new Error(SUPERWALL_UNAVAILABLE_MESSAGE);
    },
  }),
  available: false,
};

try {
  const superwall = require("expo-superwall") as Partial<RuntimeHooks>;
  if (superwall.useUser && superwall.usePlacement) {
    runtimeHooks.useUser = superwall.useUser;
    runtimeHooks.usePlacement = superwall.usePlacement;
    runtimeHooks.available = true;
  }
} catch {
  runtimeHooks.available = false;
}

export default function PaywallScreen() {
  const router = useRouter();
  const triggeredRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const { identify } = runtimeHooks.useUser();
  const { registerPlacement } = runtimeHooks.usePlacement({
    onError: (message: string) => {
      setError(message);
      triggeredRef.current = false;
    },
    onDismiss: () => {
      triggeredRef.current = false;
    },
  });

  const triggerPaywall = useCallback(async () => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    setError(null);

    if (!runtimeHooks.available) {
      setError(SUPERWALL_UNAVAILABLE_MESSAGE);
      triggeredRef.current = false;
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/create-account");
        return;
      }

      await identify(user.id);
      await markPaywallSeen(user.id);

      await registerPlacement({
        placement:
          process.env.EXPO_PUBLIC_SUPERWALL_MAIN_PLACEMENT ?? DEFAULT_PLACEMENT,
        feature: async () => {
          await startTrialAccess(user.id);
          router.replace("/(tabs)");
        },
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to open paywall right now.",
      );
      triggeredRef.current = false;
    }
  }, [identify, registerPlacement, router]);

  useEffect(() => {
    if (!runtimeHooks.available) {
      setError(SUPERWALL_UNAVAILABLE_MESSAGE);
      return;
    }
    void triggerPaywall();
  }, [triggerPaywall]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.title}>Loading your plan options...</Text>
        <Text style={styles.body}>
          You need an active plan to access Gutsy after onboarding.
        </Text>

        {error ? (
          <>
            <Text style={styles.error}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                void triggerPaywall();
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    marginTop: Spacing.xl,
    fontFamily: Fonts.cardTitle,
    fontSize: 22,
    color: Colors.text,
    textAlign: "center",
  },
  body: {
    marginTop: Spacing.md,
    fontFamily: Fonts.body,
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  error: {
    marginTop: Spacing.xl,
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.error,
    textAlign: "center",
  },
  retryButton: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: 12,
  },
  retryButtonText: {
    color: "#fff",
    fontFamily: Fonts.cardTitle,
    fontSize: 15,
  },
});
