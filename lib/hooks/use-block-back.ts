import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { BackHandler } from "react-native";

/**
 * Blocks the Android hardware back button while the screen is focused.
 * iOS swipe-back should be disabled separately via Stack.Screen
 * `options={{ gestureEnabled: false }}` in the root layout.
 */
export function useBlockBack(): void {
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => true,
      );
      return () => subscription.remove();
    }, []),
  );
}
