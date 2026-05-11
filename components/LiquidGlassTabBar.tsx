import { Colors, Fonts, Spacing } from "@/constants/theme";
import { rf } from "@/lib/hooks/use-responsive";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import React from "react";
import {
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TAB_BAR_HEIGHT = 72;
const ICON_SIZE = 24;
const SCAN_ICON_SIZE = 22;
const SCAN_BUTTON_SIZE = 48;
const MIN_TAB_TOUCH = 44;

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: "home",
  "gut-helper": "chatbubbles",
  scan: "scan",
  history: "list",
  profile: "person",
};

const TAB_LABELS: Record<string, string> = {
  index: "Home",
  "gut-helper": "Gut Helper",
  scan: "Scan",
  history: "History",
  profile: "Profile",
};

const INACTIVE_ICON = Colors.textMuted;
const INACTIVE_LABEL = Colors.textSecondary;

export function LiquidGlassTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const isScanFocused = state.routes[state.index]?.name === "scan";

  if (isScanFocused) {
    return null;
  }

  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: bottomPadding,
        },
      ]}
    >
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const isScan = route.name === "scan";
          const iconName = TAB_ICONS[route.name] ?? "ellipse";
          const { options } = descriptors[route.key];
          const label =
            (options.tabBarLabel as string) ??
            TAB_LABELS[route.name] ??
            route.name;

          const params =
            route.name === "scan"
              ? { ...route.params, previousTab: state.routes[state.index].name }
              : route.params;

          const iconColor = isScan
            ? "#FFFFFF"
            : isFocused
              ? Colors.primary
              : INACTIVE_ICON;
          const labelColor = isFocused ? Colors.primary : INACTIVE_LABEL;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={label}
              onPress={() => navigation.navigate(route.name, params)}
              style={({ pressed }) => [
                styles.tab,
                isScan && styles.tabScan,
                pressed && styles.tabPressed,
              ]}
            >
              {isScan ? (
                <View style={styles.scanButton}>
                  <Ionicons
                    name={iconName}
                    size={SCAN_ICON_SIZE}
                    color={iconColor}
                  />
                </View>
              ) : (
                <>
                  <Ionicons
                    name={iconName}
                    size={ICON_SIZE}
                    color={iconColor}
                    style={styles.icon}
                  />
                  <Text
                    style={[
                      styles.label,
                      { color: labelColor },
                      isFocused && styles.labelActive,
                    ]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.backgroundWhite,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
    zIndex: 100,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: Spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: MIN_TAB_TOUCH,
    gap: 2,
    paddingVertical: Spacing.sm,
  },
  tabScan: {
    flex: 0,
    minWidth: 72,
  },
  tabPressed: {
    opacity: 0.7,
  },
  icon: {
    marginBottom: 2,
  },
  label: {
    fontFamily: Fonts.tabBarLabel,
    fontSize: rf(11),
    letterSpacing: 0.2,
  },
  labelActive: {
    fontFamily: Fonts.tabBarLabel,
  },
  scanButton: {
    width: SCAN_BUTTON_SIZE,
    height: SCAN_BUTTON_SIZE,
    borderRadius: SCAN_BUTTON_SIZE / 2,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: Colors.primaryDark,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
});
