import { ScanResultColors } from "@/constants/theme";
import { dotColorValue, severityBadgeStyles } from "@/lib/scan-result/risk-colors";
import type { HealthFlag } from "@/types/product-scan";
import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { cardStyles } from "./scan-result-styles";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface HealthFlagsCardProps {
  flags: HealthFlag[];
}

export function HealthFlagsCard({ flags }: HealthFlagsCardProps) {
  const relevant = flags.filter((f) => f.isRelevant);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (relevant.length === 0) return null;

  return (
    <View style={cardStyles.card}>
      <Text style={cardStyles.sectionLabel}>Health flags</Text>
      {relevant.map((flag, index) => (
        <FlagRow
          key={flag.name}
          flag={flag}
          isLast={index === relevant.length - 1}
          expanded={expanded === flag.name}
          onToggle={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setExpanded((p) => (p === flag.name ? null : flag.name));
          }}
        />
      ))}
    </View>
  );
}

function FlagRow({
  flag,
  isLast,
  expanded,
  onToggle,
}: {
  flag: HealthFlag;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: expanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [expanded, rotateAnim]);

  const chevronRotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  const badge = severityBadgeStyles(flag.severity);

  return (
    <View style={[styles.rowWrap, !isLast && styles.rowBorder]}>
      <Pressable style={styles.row} onPress={onToggle}>
        <View style={[styles.dot, { backgroundColor: dotColorValue(flag.dotColor) }]} />
        <Text style={styles.name}>{flag.name}</Text>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeText, { color: badge.text }]}>{flag.severity}</Text>
        </View>
        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <Ionicons name="chevron-down" size={13} color={ScanResultColors.chevron} />
        </Animated.View>
      </Pressable>
      {expanded ? (
        <Text style={styles.detail}>{flag.detail}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rowWrap: {},
  rowBorder: { borderBottomWidth: 1, borderBottomColor: ScanResultColors.divider },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    gap: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: ScanResultColors.textPrimary,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 20,
    marginRight: 4,
  },
  badgeText: { fontSize: 10, fontWeight: "600" },
  detail: {
    fontSize: 12,
    color: ScanResultColors.textSecondary,
    lineHeight: 19.2,
    paddingTop: 2,
    paddingBottom: 10,
    paddingLeft: 18,
  },
});
