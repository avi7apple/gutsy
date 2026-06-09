import { ScanResultColors } from "@/constants/theme";
import { getScoreRiskColor } from "@/lib/scan-result/risk-colors";
import type { ScanAnalysis } from "@/types/scan";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ImpactAreaId, ImpactChip } from "./ImpactRow";

const FALLBACK_DESCRIPTION: Record<ImpactAreaId, string> = {
  skin: "Several ingredients in this product can drive inflammation, oil production, or blood-sugar spikes — all triggers for reactive skin.",
  bloat: "This product contains ingredients that commonly ferment in the gut, pull in water, or disrupt the mucus layer — a common recipe for gas and bloating.",
  dig: "Some ingredients can disrupt microbiome balance, irritate the gut lining, or slow digestion.",
  energy: "This product may spike blood sugar, promote post-meal crashes, or disrupt steady energy and focus.",
};

type ImpactDetailsKey = "skin" | "bloating" | "digestion" | "energy";

function areaToDetailsKey(id: ImpactAreaId): ImpactDetailsKey {
  if (id === "bloat") return "bloating";
  if (id === "dig") return "digestion";
  return id;
}

interface ImpactDetailSheetProps {
  visible: boolean;
  chip: ImpactChip | null;
  impactDetails?: ScanAnalysis["impactDetails"];
  onClose: () => void;
}

export function ImpactDetailSheet({
  visible,
  chip,
  impactDetails,
  onClose,
}: ImpactDetailSheetProps) {
  const insets = useSafeAreaInsets();

  if (!chip) return null;

  const detailsKey = areaToDetailsKey(chip.id);
  const details = impactDetails?.[detailsKey];
  const title = details?.learnMore?.title ?? `${chip.label} impact`;
  const body =
    details?.learnMore?.content ??
    details?.description ??
    FALLBACK_DESCRIPTION[chip.id];
  const scoreColor = getScoreRiskColor(chip.score * 10);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name={chip.icon} size={20} color={ScanResultColors.textSecondary} />
              <Text style={styles.title}>{title}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={ScanResultColors.textMuted} />
            </Pressable>
          </View>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreValue, { color: scoreColor }]}>{chip.score}</Text>
            <Text style={styles.scoreOutOf}>/10</Text>
            <Text style={styles.scoreLabel}>{chip.label}</Text>
          </View>
          <Text style={styles.body}>{body}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: ScanResultColors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    maxHeight: "70%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: ScanResultColors.border,
    alignSelf: "center",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: ScanResultColors.textPrimary,
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginBottom: 12,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: "700",
  },
  scoreOutOf: {
    fontSize: 14,
    color: ScanResultColors.textMuted,
    marginRight: 8,
  },
  scoreLabel: {
    fontSize: 14,
    color: ScanResultColors.textSecondary,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: ScanResultColors.textBody,
  },
});
