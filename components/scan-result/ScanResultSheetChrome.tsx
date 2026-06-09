import { ScanResultColors } from "@/constants/theme";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

interface ScanResultSheetChromeProps {
  panHandlers?: any;
  onPress: () => void;
}

export function ScanResultSheetChrome({ panHandlers, onPress }: ScanResultSheetChromeProps) {
  return (
    <Pressable style={styles.handleZone} onPress={onPress} {...(panHandlers as any)}>
      <View style={styles.handle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  handleZone: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
    minHeight: 28,
  },
  handle: {
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: ScanResultColors.border,
  },
});

