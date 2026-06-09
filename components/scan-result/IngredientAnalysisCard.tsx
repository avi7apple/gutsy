import { ScanResultColors } from "@/constants/theme";
import { filterAndSortIngredients, type IngredientFilter } from "@/lib/scan-result/ingredient-sort";
import type { ProductIngredient } from "@/types/product-scan";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from "react-native";
import { IngredientCard } from "./IngredientCard";
import { cardStyles } from "./scan-result-styles";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FILTERS: { id: IngredientFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "high", label: "High risk" },
  { id: "warning", label: "Warning" },
  { id: "beneficial", label: "Beneficial" },
];

function countForFilter(items: ProductIngredient[], filterId: IngredientFilter): number {
  if (filterId === "all") return items.length;
  if (filterId === "high") return items.filter((i) => i.level === "hi").length;
  if (filterId === "warning") return items.filter((i) => i.level === "med" || i.level === "lo").length;
  return items.filter((i) => i.level === "ben").length;
}

function defaultFilter(items: ProductIngredient[]): IngredientFilter {
  return items.some((i) => i.level === "hi") ? "high" : "all";
}

function summaryCounts(items: ProductIngredient[]): { total: number; flagged: number; neutral: number } {
  const flagged = items.filter((i) => i.level === "hi" || i.level === "med" || i.level === "lo").length;
  const neutral = items.filter((i) => i.level === "neutral" || i.level === "ben").length;
  return { total: items.length, flagged, neutral };
}

interface IngredientAnalysisCardProps {
  ingredients: ProductIngredient[];
  rawLabelIngredients?: string[];
}

export function IngredientAnalysisCard({
  ingredients,
  rawLabelIngredients,
}: IngredientAnalysisCardProps) {
  const initialFilter = useMemo(() => defaultFilter(ingredients), [ingredients]);
  const [filter, setFilter] = useState<IngredientFilter>(initialFilter);
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const [labelExpanded, setLabelExpanded] = useState(false);

  const filtered = useMemo(
    () => filterAndSortIngredients(ingredients, filter),
    [ingredients, filter],
  );

  const counts = useMemo(() => summaryCounts(ingredients), [ingredients]);
  const hasRawLabel = Array.isArray(rawLabelIngredients) && rawLabelIngredients.length > 0;
  const showAnalysis = ingredients.length > 0;

  if (!showAnalysis && !hasRawLabel) return null;

  return (
    <View style={cardStyles.card}>
      <Text style={cardStyles.sectionLabel}>Ingredient analysis</Text>

      {showAnalysis ? (
        <>
          <Text style={styles.summary}>
            {counts.total} analyzed · {counts.flagged} flagged · {counts.neutral} neutral
          </Text>
          <View style={styles.filterRow}>
            {FILTERS.map((f) => {
              const count = countForFilter(ingredients, f.id);
              const label = count > 0 ? `${f.label} (${count})` : f.label;
              return (
                <Pressable
                  key={f.id}
                  style={[styles.filterBtn, filter === f.id && styles.filterBtnActive]}
                  onPress={() => setFilter(f.id)}
                >
                  <Text style={[styles.filterText, filter === f.id && styles.filterTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.list}>
            {filtered.length === 0 ? (
              <Text style={styles.empty}>No ingredients in this category.</Text>
            ) : (
              filtered.map((ing) => (
                <IngredientCard
                  key={ing.name}
                  ingredient={ing}
                  expanded={expandedName === ing.name}
                  onToggle={() =>
                    setExpandedName((prev) => (prev === ing.name ? null : ing.name))
                  }
                />
              ))
            )}
          </View>
        </>
      ) : null}

      {hasRawLabel ? (
        <View style={[styles.labelSection, showAnalysis && styles.labelSectionWithAnalysis]}>
          <Pressable
            style={styles.labelHeader}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setLabelExpanded((p) => !p);
            }}
          >
            <Text style={styles.labelTitle}>Full ingredients label</Text>
            <Ionicons
              name={labelExpanded ? "chevron-up" : "chevron-down"}
              size={14}
              color={ScanResultColors.chevron}
            />
          </Pressable>
          {labelExpanded ? (
            <Text style={styles.labelBody}>{rawLabelIngredients!.join(", ")}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    fontSize: 12,
    color: ScanResultColors.textMuted,
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  filterBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ScanResultColors.border,
    backgroundColor: ScanResultColors.card,
    minHeight: 44,
    justifyContent: "center",
  },
  filterBtnActive: {
    backgroundColor: ScanResultColors.primary,
    borderColor: ScanResultColors.primary,
  },
  filterText: { fontSize: 12, fontWeight: "500", color: ScanResultColors.textSecondary },
  filterTextActive: { color: "#FFFFFF" },
  list: { gap: 8 },
  empty: { fontSize: 12, color: ScanResultColors.textMuted, textAlign: "center", padding: 12 },
  labelSection: {
    borderTopWidth: 1,
    borderTopColor: ScanResultColors.divider,
    paddingTop: 12,
  },
  labelSectionWithAnalysis: {
    marginTop: 12,
  },
  labelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
  },
  labelTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: ScanResultColors.textPrimary,
  },
  labelBody: {
    fontSize: 12,
    lineHeight: 19,
    color: ScanResultColors.textBody,
    paddingBottom: 4,
  },
});
