import { ScanResultColors } from "@/constants/theme";
import type { ProductAlternative } from "@/types/product-scan";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { cardStyles } from "./scan-result-styles";

interface BetterAlternativesCardProps {
  alternatives: ProductAlternative[];
  loading?: boolean;
  onSelectAlternative: (alt: ProductAlternative) => void;
  onScanToCompare: () => void;
}

export function BetterAlternativesCard({
  alternatives,
  loading,
  onSelectAlternative,
  onScanToCompare,
}: BetterAlternativesCardProps) {
  return (
    <View style={cardStyles.card}>
      <Text style={cardStyles.sectionLabel}>Better alternatives</Text>
      {loading ? (
        <Text style={styles.loading}>Finding alternatives…</Text>
      ) : alternatives.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            Look for products in this category with a Gutsy score above 70
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {alternatives.map((alt) => (
            <Pressable
              key={`${alt.productName}-${alt.brandName}`}
              style={styles.altCard}
              onPress={() => onSelectAlternative(alt)}
            >
              <View style={styles.altImage}>
                {alt.imageUrl ? (
                  <Image source={{ uri: alt.imageUrl }} style={styles.altImg} />
                ) : (
                  <Ionicons name="nutrition-outline" size={22} color={ScanResultColors.riskGreen} />
                )}
              </View>
              <View style={styles.altMeta}>
                <Text style={styles.altName} numberOfLines={2}>
                  {alt.productName}
                </Text>
                <Text style={styles.altReason} numberOfLines={2}>
                  {alt.reason}
                </Text>
              </View>
              <View style={styles.scoreCircle}>
                <Text style={styles.scoreNum}>{Math.round(alt.gutsyScore)}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
      <Pressable style={styles.compareBtn} onPress={onScanToCompare}>
        <Ionicons name="scan-outline" size={18} color={ScanResultColors.primary} />
        <Text style={styles.compareText}>Scan to compare</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  loading: { fontSize: 12, color: ScanResultColors.textMuted, marginBottom: 10 },
  emptyCard: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: ScanResultColors.dashedAccent,
    backgroundColor: ScanResultColors.neutralBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  emptyText: { fontSize: 12, color: ScanResultColors.textSecondary, textAlign: "center" },
  altCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ScanResultColors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ScanResultColors.border,
    padding: 12,
    gap: 10,
    minHeight: 44,
  },
  altImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: ScanResultColors.imageBg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  altImg: { width: 44, height: 44 },
  altMeta: { flex: 1, minWidth: 0 },
  altName: { fontSize: 13, fontWeight: "600", color: ScanResultColors.textPrimary },
  altReason: { fontSize: 11, color: ScanResultColors.textSecondary, marginTop: 2 },
  scoreCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ScanResultColors.riskGreenBg,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreNum: {
    fontSize: 13,
    fontWeight: "700",
    color: ScanResultColors.riskGreenText,
  },
  compareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: ScanResultColors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    minHeight: 44,
    backgroundColor: ScanResultColors.card,
  },
  compareText: { fontSize: 13, fontWeight: "600", color: ScanResultColors.primary },
});
