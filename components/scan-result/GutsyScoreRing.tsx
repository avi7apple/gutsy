import { ScanResultColors } from "@/constants/theme";
import { getScoreRiskColor } from "@/lib/scan-result/risk-colors";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

const SIZE = 64;
const STROKE = 5;
const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface GutsyScoreRingProps {
  score: number;
  size?: number;
}

export function GutsyScoreRing({ score, size = SIZE }: GutsyScoreRingProps) {
  const color = getScoreRiskColor(score);
  const progress = Math.min(100, Math.max(0, score)) / 100;
  const offset = CIRCUMFERENCE - progress * CIRCUMFERENCE;
  const scale = size / SIZE;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={color}
          strokeOpacity={0.15}
          strokeWidth={STROKE}
          fill="none"
        />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={color}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>
      <View style={[styles.center, scale !== 1 && { transform: [{ scale }] }]}>
        <Text style={[styles.score, { color }]}>{Math.round(score)}</Text>
        <Text style={styles.outOf}>/100</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  score: {
    fontSize: 20,
    fontWeight: "700",
  },
  outOf: {
    fontSize: 9,
    color: ScanResultColors.textMuted,
    marginTop: -2,
  },
});
