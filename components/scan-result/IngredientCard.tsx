import { ScanResultColors } from "@/constants/theme";
import { getIngredientLevelStyles } from "@/lib/scan-result/risk-colors";
import type { ProductIngredient } from "@/types/product-scan";
import { Ionicons } from "@expo/vector-icons";
import React, { useRef } from "react";
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

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface IngredientCardProps {
  ingredient: ProductIngredient;
  expanded: boolean;
  onToggle: () => void;
}

function riskMeterSegments(level: string): number {
  if (level === "hi") return 3;
  if (level === "med") return 2;
  if (level === "ben") return 2;
  if (level === "lo") return 1;
  return 1;
}

function riskMeterColor(level: string, filled: boolean): string {
  if (!filled) return ScanResultColors.divider;
  if (level === "hi") return ScanResultColors.riskRed;
  if (level === "med") return ScanResultColors.riskAmber;
  if (level === "lo") return ScanResultColors.riskGreen;
  if (level === "ben") return ScanResultColors.riskGreen;
  return ScanResultColors.chevron;
}

export function IngredientCard({ ingredient, expanded, onToggle }: IngredientCardProps) {
  const styles_level = getIngredientLevelStyles(ingredient.level);
  const rotateAnim = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const filled = riskMeterSegments(ingredient.level);

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

  const handlePress = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle();
  };

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={handlePress}>
        <View style={[styles.dot, { backgroundColor: styles_level.dot }]} />
        <View style={styles.nameCol}>
          <Text style={styles.name}>{ingredient.name}</Text>
          <Text style={styles.role}>{ingredient.role}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: styles_level.badgeBg }]}>
          <Text style={[styles.badgeText, { color: styles_level.badgeText }]}>
            {ingredient.badge || styles_level.badgeLabel}
          </Text>
        </View>
        <Animated.View style={{ transform: [{ rotate: chevronRotate }], marginLeft: 4 }}>
          <Ionicons name="chevron-down" size={13} color={ScanResultColors.chevron} />
        </Animated.View>
      </Pressable>

      {expanded ? (
        <View style={styles.detail}>
          <DetailBlock label="What it is" text={ingredient.whatItIs} />
          <DetailBlock label="Gut impact" text={ingredient.gutImpact} />
          {ingredient.positives.length > 0 ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Positives</Text>
              {ingredient.positives.map((p) => (
                <View key={p} style={styles.bulletRow}>
                  <Ionicons name="checkmark-circle" size={12} color={ScanResultColors.riskGreen} />
                  <Text style={styles.bulletText}>{p}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {ingredient.concerns.length > 0 ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Concerns</Text>
              {ingredient.concerns.map((c) => (
                <View key={c} style={styles.bulletRow}>
                  <Ionicons name="warning" size={12} color={ScanResultColors.riskRed} />
                  <Text style={styles.bulletText}>{c}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.block}>
            <Text style={styles.blockLabel}>Risk level</Text>
            <View style={styles.meter}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.meterSeg,
                    { backgroundColor: riskMeterColor(ingredient.level, i < filled) },
                  ]}
                />
              ))}
            </View>
            <Text style={styles.bodyText}>{ingredient.riskContext}</Text>
          </View>
          {ingredient.regulatoryStatus.length > 0 ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Regulatory status</Text>
              <View style={styles.pillRow}>
                {ingredient.regulatoryStatus.map((r) => (
                  <View key={`${r.body}-${r.status}`} style={styles.regPill}>
                    <Text style={styles.regText}>
                      {r.flag} {r.body}: {r.status}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function DetailBlock({ label, text }: { label: string; text: string }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockLabel}>{label}</Text>
      <Text style={styles.bodyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: ScanResultColors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ScanResultColors.border,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: 13,
    paddingVertical: 13,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  nameCol: { flex: 1 },
  name: { fontSize: 13, fontWeight: "600", color: ScanResultColors.textPrimary },
  role: { fontSize: 11, color: ScanResultColors.textMuted, marginTop: 2 },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 20,
    marginRight: 4,
  },
  badgeText: { fontSize: 10, fontWeight: "600" },
  detail: {
    borderTopWidth: 1,
    borderTopColor: ScanResultColors.divider,
    padding: 14,
  },
  block: { marginTop: 12 },
  blockLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: ScanResultColors.textMuted,
    marginBottom: 6,
  },
  bodyText: { fontSize: 12, color: ScanResultColors.textBody, lineHeight: 19.2 },
  bulletRow: { flexDirection: "row", gap: 3, marginTop: 4, alignItems: "flex-start" },
  bulletText: { flex: 1, fontSize: 12, color: ScanResultColors.textBody, lineHeight: 18 },
  meter: { flexDirection: "row", gap: 4, marginBottom: 8 },
  meterSeg: { flex: 1, height: 5, borderRadius: 3 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  regPill: {
    backgroundColor: ScanResultColors.neutralBg,
    borderWidth: 1,
    borderColor: ScanResultColors.border,
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  regText: { fontSize: 11, color: ScanResultColors.textSecondary },
});
