import { useCallback, useState } from "react";
import { Alert } from "react-native";
import type { Router } from "expo-router";

import { restorePurchasesForCurrentUser } from "@/lib/subscription-access";

export function useRestorePurchases(router: Router) {
  const [restoring, setRestoring] = useState(false);

  const handleRestore = useCallback(async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const result = await restorePurchasesForCurrentUser();
      if (result === "restored") {
        router.replace("/(tabs)");
        return;
      }

      if (result === "no-user") {
        Alert.alert(
          "Sign in to restore",
          "Create or sign into your Gutsy account to restore an existing subscription.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Sign In",
              onPress: () => router.replace("/create-account"),
            },
          ],
        );
        return;
      }

      Alert.alert(
        "No purchases found",
        "We couldn't find an active subscription on this Apple/Google account.",
      );
    } catch (error) {
      Alert.alert(
        "Restore failed",
        error instanceof Error ? error.message : "Please try again in a moment.",
      );
    } finally {
      setRestoring(false);
    }
  }, [restoring, router]);

  return { restoring, handleRestore };
}
