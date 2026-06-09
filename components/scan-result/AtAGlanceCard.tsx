import { ScanResultColors } from "@/constants/theme";
import {
  additivesDot,
  allergenDot,
  dotColorValue,
  novaDot,
  packagingDot,
  realFoodDot,
  seedOilsDot,
  sugarAliasDot,
} from "@/lib/scan-result/risk-colors";
import type { AtAGlance } from "@/types/product-scan";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
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

const ADDITIVES_ROW_KEY = "__additives__";
const MAX_VISIBLE_ADDITIVES = 8;

interface RowDef {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  dot: "red" | "amber" | "green";
  expandable?: boolean;
}

function buildRows(at: AtAGlance): RowDef[] {
  return [
    {
      key: ADDITIVES_ROW_KEY,
      icon: "flask-outline",
      label: "Chemical additives",
      value: String(at.additivesCount),
      dot: additivesDot(at.additivesCount),
      expandable: at.additivesCount > 0,
    },
    {
      key: "seedOils",
      icon: "water-outline",
      label: "Seed oils",
      value: at.seedOils ? `Yes (${at.seedOils})` : "No",
      dot: seedOilsDot(!!at.seedOils),
    },
    {
      key: "processing",
      icon: "eye-outline",
      label: "Processing level",
      value: at.processingLevel,
      dot: novaDot(at.processingLevel),
    },
    {
      key: "sugar",
      icon: "ice-cream-outline",
      label: "Sugar aliases",
      value: `${at.sugarAliasCount} found`,
      dot: sugarAliasDot(at.sugarAliasCount),
    },
    {
      key: "allergens",
      icon: "leaf-outline",
      label: "Allergens",
      value: at.allergens.length ? at.allergens.join(", ") : "None",
      dot: allergenDot(at.allergens),
    },
    {
      key: "packaging",
      icon: "cube-outline",
      label: "Packaging",
      value: at.packaging,
      dot: packagingDot(at.packaging),
    },
    {
      key: "realFood",
      icon: "nutrition-outline",
      label: "Real food ratio",
      value: `${at.realFoodRatio}%`,
      dot: realFoodDot(at.realFoodRatio),
    },
  ];
}

interface AtAGlanceCardProps {
  atAGlance: AtAGlance;
}

export function AtAGlanceCard({ atAGlance }: AtAGlanceCardProps) {
  const rows = buildRows(atAGlance);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const visibleAdditives = atAGlance.additives ?? [];
  const displayAdditives = visibleAdditives.slice(0, MAX_VISIBLE_ADDITIVES);
  const hiddenCount = Math.max(0, visibleAdditives.length - MAX_VISIBLE_ADDITIVES);

  const toggleRow = (key: string, expandable?: boolean) => {
    if (!expandable) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  return (
    <View style={cardStyles.card}>
      <Text style={cardStyles.sectionLabel}>At a glance</Text>
      {rows.map((row, index) => {
        const isExpanded = expandedKey === row.key;
        const isAdditives = row.key === ADDITIVES_ROW_KEY;

        return (
          <View key={row.key}>
            <Pressable
              style={[styles.row, index === rows.length - 1 && !isExpanded && styles.rowLast]}
              onPress={() => toggleRow(row.key, row.expandable)}
              disabled={!row.expandable}
            >
              <View style={styles.iconCol}>
                <Ionicons name={row.icon} size={15} color={ScanResultColors.textMuted} />
              </View>
              <Text style={styles.label}>{row.label}</Text>
              <Text style={styles.value} numberOfLines={2}>
                {row.value}
              </Text>
              <View style={[styles.dot, { backgroundColor: dotColorValue(row.dot) }]} />
              {row.expandable ? (
                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={13}
                  color={ScanResultColors.chevron}
                  style={styles.chevron}
                />
              ) : (
                <View style={styles.chevronSpacer} />
              )}
            </Pressable>

            {isAdditives && isExpanded ? (
              <View style={styles.additiveList}>
                {displayAdditives.map((additive) => (
                  <View key={additive.name} style={styles.additiveRow}>
                    <Text style={styles.additiveName}>{additive.name}</Text>
                    <View style={styles.categoryPill}>
                      <Text style={styles.categoryText}>{additive.category}</Text>
                    </View>
                  </View>
                ))}
                {hiddenCount > 0 ? (
                  <Text style={styles.moreText}>+{hiddenCount} more</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}

      {atAGlance.topFlags?.length > 0 ? (
        <Text style={styles.topFlags} numberOfLines={2}>
          Main concerns: {atAGlance.topFlags.join(", ")}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: ScanResultColors.divider,
  },
  rowLast: { borderBottomWidth: 0 },
  iconCol: { width: 20, marginRight: 8 },
  label: {
    flex: 1,
    fontSize: 13,
    color: ScanResultColors.textPrimary,
  },
  value: {
    fontSize: 13,
    color: ScanResultColors.textSecondary,
    marginRight: 8,
    maxWidth: "38%",
    textAlign: "right",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  chevron: { width: 16 },
  chevronSpacer: { width: 16 },
  additiveList: {
    paddingLeft: 28,
    paddingRight: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: ScanResultColors.divider,
    gap: 6,
  },
  additiveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  additiveName: {
    flex: 1,
    fontSize: 12,
    color: ScanResultColors.textBody,
  },
  categoryPill: {
    backgroundColor: ScanResultColors.neutralBg,
    borderWidth: 1,
    borderColor: ScanResultColors.border,
    borderRadius: 20,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: "500",
    color: ScanResultColors.textSecondary,
  },
  moreText: {
    fontSize: 11,
    color: ScanResultColors.textMuted,
    fontStyle: "italic",
  },
  topFlags: {
    fontSize: 12,
    color: ScanResultColors.textMuted,
    lineHeight: 18,
    marginTop: 10,
  },
});
