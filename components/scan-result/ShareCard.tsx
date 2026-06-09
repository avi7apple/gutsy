import { ScanResultColors } from "@/constants/theme";
import type { AtAGlance, ProductInsight } from "@/types/product-scan";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { GutsyScoreRing } from "./GutsyScoreRing";

interface ShareCardProps {
  insight: ProductInsight;
}

function topGlanceLines(at: AtAGlance): string[] {
  const lines: string[] = [];
  lines.push(`Additives: ${at.additivesCount}`);
  lines.push(`Seed oils: ${at.seedOils ? "Yes" : "No"}`);
  lines.push(`Processing: ${at.processingLevel.split(" ")[0]}`);
  return lines.slice(0, 3);
}

export const SHARE_CARD_WIDTH = 320;

export function ShareCard({ insight }: ShareCardProps) {
  const glance = topGlanceLines(insight.atAGlance);

  return (
    <View style={styles.card}>
      <Text style={styles.brand}>Gutsy</Text>
      <Text style={styles.productName} numberOfLines={2}>
        {insight.productName}
      </Text>
      <View style={styles.ringRow}>
        <GutsyScoreRing score={insight.gutsyScore} size={72} />
      </View>
      <View style={styles.glance}>
        {glance.map((line) => (
          <Text key={line} style={styles.glanceLine}>
            • {line}
          </Text>
        ))}
        <Text style={styles.glanceLine}>• Real food ratio: {insight.atAGlance.realFoodRatio}%</Text>
      </View>
      <Text style={styles.watermark}>gutsy.app</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    backgroundColor: ScanResultColors.background,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: ScanResultColors.border,
  },
  brand: {
    fontSize: 14,
    fontWeight: "700",
    color: ScanResultColors.primary,
    marginBottom: 8,
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    color: ScanResultColors.textPrimary,
    marginBottom: 12,
  },
  ringRow: { alignItems: "center", marginBottom: 12 },
  glance: { gap: 4, marginBottom: 16 },
  glanceLine: { fontSize: 12, color: ScanResultColors.textSecondary },
  watermark: {
    fontSize: 10,
    color: ScanResultColors.textMuted,
    textAlign: "center",
  },
});
