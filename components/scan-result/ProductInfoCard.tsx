import { ScanResultColors } from "@/constants/theme";
import { getHealthGradeStyles } from "@/lib/scan-result/risk-colors";
import type { ProductInsight } from "@/types/product-scan";
import type { ScanAnalysis } from "@/types/scan";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { GutsyScoreRing } from "./GutsyScoreRing";
import { ImpactDetailSheet } from "./ImpactDetailSheet";
import { ImpactRow, type ImpactAreaId, type ImpactChip } from "./ImpactRow";
import { cardStyles } from "./scan-result-styles";

interface ProductInfoCardProps {
  insight: ProductInsight;
  bloatScore: number;
  skinScore: number;
  digestionScore: number;
  energyScore: number;
  impactDetails?: ScanAnalysis["impactDetails"];
}

export function ProductInfoCard({
  insight,
  bloatScore,
  skinScore,
  digestionScore,
  energyScore,
  impactDetails,
}: ProductInfoCardProps) {
  const gradeStyles = getHealthGradeStyles(insight.healthGrade);
  const [selectedImpact, setSelectedImpact] = useState<ImpactAreaId | null>(null);

  const showParent =
    insight.parentCompany &&
    insight.parentCompany.toLowerCase() !== insight.brandName.toLowerCase();

  const impactChips: ImpactChip[] = useMemo(
    () => [
      { id: "bloat", label: "Bloating", score: Math.round(bloatScore), icon: "water-outline" },
      { id: "skin", label: "Skin", score: Math.round(skinScore), icon: "sparkles-outline" },
      { id: "dig", label: "Digestion", score: Math.round(digestionScore), icon: "leaf-outline" },
      { id: "energy", label: "Energy", score: Math.round(energyScore), icon: "flash-outline" },
    ],
    [bloatScore, skinScore, digestionScore, energyScore],
  );

  const selectedChip = impactChips.find((c) => c.id === selectedImpact) ?? null;

  return (
    <View style={cardStyles.card}>
      <View style={styles.topRow}>
        <View style={styles.imageWrap}>
          {insight.productImageUrl ? (
            <Image source={{ uri: insight.productImageUrl }} style={styles.image} />
          ) : (
            <Ionicons name="nutrition-outline" size={32} color={ScanResultColors.riskGreen} />
          )}
        </View>
        <View style={styles.meta}>
          <Text style={styles.productName} numberOfLines={3}>
            {insight.productName}
          </Text>
          <Text style={styles.brand}>{insight.brandName}</Text>
          {showParent ? (
            <Text style={styles.parent}>Owned by {insight.parentCompany}</Text>
          ) : null}
          <View style={[styles.gradePill, { backgroundColor: gradeStyles.bg }]}>
            <Ionicons name="warning-outline" size={11} color={gradeStyles.text} />
            <Text style={[styles.gradeText, { color: gradeStyles.text }]}>{insight.healthGrade}</Text>
          </View>
        </View>
        <GutsyScoreRing score={insight.gutsyScore} />
      </View>

      <View style={styles.divider} />
      <Text style={styles.gutReaction}>{insight.gutReaction}</Text>

      <ImpactRow chips={impactChips} onSelect={setSelectedImpact} />

      {insight.hasActiveRecall ? (
        <Pressable
          style={[styles.recallRow, styles.recallDanger]}
          onPress={() => insight.recallUrl && Linking.openURL(insight.recallUrl)}
        >
          <Ionicons name="alert-circle" size={16} color={ScanResultColors.riskRed} />
          <Text style={styles.recallDangerText}>Active recall on record — tap to learn more</Text>
        </Pressable>
      ) : (
        <View style={[styles.recallRow, styles.recallSafe]}>
          <Ionicons name="shield-checkmark" size={16} color={ScanResultColors.riskGreenDark} />
          <Text style={styles.recallSafeText}>No active recalls or lawsuits</Text>
        </View>
      )}

      <ImpactDetailSheet
        visible={selectedImpact != null}
        chip={selectedChip}
        impactDetails={impactDetails}
        onClose={() => setSelectedImpact(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  imageWrap: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: ScanResultColors.imageBg,
    borderWidth: 1,
    borderColor: ScanResultColors.imageBorder,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: { width: 80, height: 80 },
  meta: { flex: 1, minWidth: 0 },
  productName: {
    fontSize: 15,
    fontWeight: "600",
    color: ScanResultColors.textPrimary,
    lineHeight: 19.5,
  },
  brand: { fontSize: 12, color: ScanResultColors.textSecondary, marginTop: 2 },
  parent: {
    fontSize: 11,
    fontStyle: "italic",
    color: ScanResultColors.textItalic,
    marginTop: 2,
  },
  gradePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  gradeText: { fontSize: 11, fontWeight: "600" },
  divider: {
    height: 1,
    backgroundColor: ScanResultColors.divider,
    marginTop: 12,
  },
  gutReaction: {
    fontSize: 12,
    fontStyle: "italic",
    color: ScanResultColors.textSecondary,
    lineHeight: 19.2,
    marginTop: 0,
  },
  recallRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    minHeight: 44,
  },
  recallSafe: { backgroundColor: ScanResultColors.riskGreenBg },
  recallDanger: { backgroundColor: ScanResultColors.riskRedBg },
  recallSafeText: { fontSize: 12, fontWeight: "700", color: ScanResultColors.riskGreenText, flex: 1 },
  recallDangerText: { fontSize: 12, fontWeight: "700", color: ScanResultColors.riskRedText, flex: 1 },
});
