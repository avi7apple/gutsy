import React from "react";
import { View, StyleSheet } from "react-native";
import { Colors, BorderRadius } from "@/constants/theme";

interface ProgressBarProps {
  current: number;
  total: number;
  fillColor?: string;
}

export default function ProgressBar({
  current,
  total,
  fillColor = Colors.primary,
}: ProgressBarProps) {
  const progress = Math.min(current / total, 1);

  return (
    <View style={styles.track}>
      <View
        style={[
          styles.fill,
          { width: `${progress * 100}%`, backgroundColor: fillColor },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: BorderRadius.full,
  },
});
