import { ScanResultColors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

interface ScanResultCTAsProps {
  onShare: () => void;
  onScanAgain: () => void;
  onSave: () => void;
  saving?: boolean;
  saved?: boolean;
  sharing?: boolean;
}

export function ScanResultCTAs({
  onShare,
  onScanAgain,
  onSave,
  saving,
  saved,
  sharing,
}: ScanResultCTAsProps) {
  return (
    <View style={styles.wrap}>
      <Pressable style={[styles.btn, styles.shareBtn]} onPress={onShare} disabled={sharing}>
        {sharing ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <>
            <Ionicons name="share-social-outline" size={18} color="#FFF" />
            <Text style={styles.shareText}>Share my health report</Text>
          </>
        )}
      </Pressable>
      <Pressable style={[styles.btn, styles.scanBtn]} onPress={onScanAgain}>
        <Ionicons name="scan-outline" size={18} color="#FFF" />
        <Text style={styles.scanText}>Scan another product</Text>
      </Pressable>
      <Pressable
        style={[styles.btn, styles.saveBtn, saved && styles.saveBtnDone]}
        onPress={onSave}
        disabled={saving || saved}
      >
        {saving ? (
          <ActivityIndicator color={ScanResultColors.primary} size="small" />
        ) : (
          <>
            <Ionicons
              name={saved ? "bookmark" : "bookmark-outline"}
              size={18}
              color={ScanResultColors.primary}
            />
            <Text style={styles.saveText}>{saved ? "Saved to my foods" : "Save to my foods"}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    borderRadius: 14,
    minHeight: 44,
  },
  shareBtn: { backgroundColor: ScanResultColors.accent },
  shareText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  scanBtn: { backgroundColor: ScanResultColors.primary },
  scanText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  saveBtn: {
    backgroundColor: ScanResultColors.card,
    borderWidth: 1.5,
    borderColor: ScanResultColors.primary,
  },
  saveBtnDone: { opacity: 0.7 },
  saveText: { fontSize: 14, fontWeight: "600", color: ScanResultColors.primary },
});
