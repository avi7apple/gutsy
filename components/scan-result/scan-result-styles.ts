import { ScanResultColors } from "@/constants/theme";
import { StyleSheet } from "react-native";

export const SECTION_GAP = 20;
export const H_PAD = 14;
export const CARD_RADIUS = 16;
export const CARD_PAD = 16;

export const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: ScanResultColors.card,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: ScanResultColors.border,
    padding: CARD_PAD,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: ScanResultColors.textMuted,
    marginBottom: 12,
  },
});
