import { ScanResultColors } from "@/constants/theme";
import { getScoreRiskColor } from "@/lib/scan-result/risk-colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type ImpactAreaId = "bloat" | "skin" | "dig" | "energy";

export interface ImpactChip {
  id: ImpactAreaId;
  label: string;
  score: number;
  icon: keyof typeof Ionicons.glyphMap;
}

interface ImpactRowProps {
  chips: ImpactChip[];
  onSelect: (id: ImpactAreaId) => void;
}

export function ImpactRow({ chips, onSelect }: ImpactRowProps) {
  return (
    <View style={styles.row}>
      {chips.map((chip) => {
        const color = getScoreRiskColor(chip.score * 10);
        return (
          <Pressable
            key={chip.id}
            style={styles.chip}
            onPress={() => onSelect(chip.id)}
            accessibilityRole="button"
            accessibilityLabel={`${chip.label}, score ${chip.score} out of 10`}
          >
            <Ionicons name={chip.icon} size={14} color={ScanResultColors.textMuted} />
            <Text style={[styles.score, { color }]}>{chip.score}</Text>
            <Text style={styles.label} numberOfLines={1}>
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
  },
  chip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ScanResultColors.border,
    backgroundColor: ScanResultColors.card,
    minHeight: 44,
  },
  score: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  label: {
    fontSize: 10,
    color: ScanResultColors.textSecondary,
    marginTop: 1,
    textAlign: "center",
  },
});
