import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, StatusBar, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import ProgressBar from "@/components/onboarding/ProgressBar";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  useAnimatedReaction,
  withTiming,
  withDelay,
  Easing,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import { getOnboardingProfile } from "@/lib/onboarding-storage";
import {
  calculateGutScore,
  calculateSubScores,
  getScoreProfile,
  type ScoreProfile,
} from "@/lib/gut-score";
import { ScoreBucketColors, Spacing, Colors, ONBOARDING_TOTAL_STEPS } from "@/constants/theme";

const GAUGE_SIZE = 160;
const GAUGE_STROKE = 10;
const GAUGE_R = (GAUGE_SIZE - GAUGE_STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * GAUGE_R;

const COUNT_UP_DURATION = 1400;
const MIDDLE_FADE_DELAY = 1400;
const MIDDLE_FADE_DURATION = 400;
const BAR_START_DELAY = 1900;
const BAR_OFFSET = 150;
const BAR_DURATION = 600;
const CTA_FADE_DELAY = 2800;
const CTA_FADE_DURATION = 400;

const GUT_SCORE_STEP = 8;

const BREAKDOWN_ITEMS: { key: "skin" | "bloating" | "digestion" | "energy"; label: string; emoji: string }[] = [
  { key: "skin", label: "Skin", emoji: "✨" },
  { key: "bloating", label: "Bloating", emoji: "💨" },
  { key: "digestion", label: "Digestion", emoji: "🌱" },
  { key: "energy", label: "Energy", emoji: "⚡" },
];

function useGutScoreData() {
  const [gutScore, setGutScore] = useState(50);
  const [subScores, setSubScores] = useState({ skin: 50, bloating: 50, digestion: 50, energy: 50 });
  const [profile, setProfile] = useState<ScoreProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getOnboardingProfile().then((p) => {
      if (cancelled) return;
      const score = calculateGutScore(p);
      const subs = calculateSubScores(score);
      const prof = getScoreProfile(score);
      setGutScore(score);
      setSubScores(subs);
      setProfile(prof);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { gutScore, subScores, profile, ready };
}

export default function GutScoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { gutScore, subScores, profile, ready } = useGutScoreData();
  const accent = profile ? ScoreBucketColors[profile.bucket] : ScoreBucketColors.imbalanced;

  const scoreDisplay = useSharedValue(0);
  const ringProgress = useSharedValue(0);
  const middleOpacity = useSharedValue(0);
  const bar1 = useSharedValue(0);
  const bar2 = useSharedValue(0);
  const bar3 = useSharedValue(0);
  const bar4 = useSharedValue(0);
  const ctaOpacity = useSharedValue(0);

  useEffect(() => {
    if (!ready || !profile) return;

    scoreDisplay.value = withTiming(gutScore, {
      duration: COUNT_UP_DURATION,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
    ringProgress.value = withTiming(gutScore / 100, {
      duration: COUNT_UP_DURATION,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });

    middleOpacity.value = withDelay(
      MIDDLE_FADE_DELAY,
      withTiming(1, { duration: MIDDLE_FADE_DURATION, easing: Easing.out(Easing.ease) })
    );

    bar1.value = withDelay(
      BAR_START_DELAY,
      withTiming(1, { duration: BAR_DURATION, easing: Easing.out(Easing.ease) })
    );
    bar2.value = withDelay(
      BAR_START_DELAY + BAR_OFFSET,
      withTiming(1, { duration: BAR_DURATION, easing: Easing.out(Easing.ease) })
    );
    bar3.value = withDelay(
      BAR_START_DELAY + BAR_OFFSET * 2,
      withTiming(1, { duration: BAR_DURATION, easing: Easing.out(Easing.ease) })
    );
    bar4.value = withDelay(
      BAR_START_DELAY + BAR_OFFSET * 3,
      withTiming(1, { duration: BAR_DURATION, easing: Easing.out(Easing.ease) })
    );

    ctaOpacity.value = withDelay(
      CTA_FADE_DELAY,
      withTiming(1, { duration: CTA_FADE_DURATION, easing: Easing.out(Easing.ease) })
    );
  }, [ready, profile, gutScore]);

  const middleZoneStyle = useAnimatedStyle(() => ({
    opacity: middleOpacity.value,
  }));

  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
  }));

  if (!ready || !profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Calculating your score…</Text>
        </View>
      </View>
    );
  }

  const accentHex = ScoreBucketColors[profile.bucket];

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header: back + progress */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color="#2E2E2E" />
        </TouchableOpacity>
        <View style={styles.progressWrapper}>
          <ProgressBar
            current={GUT_SCORE_STEP}
            total={ONBOARDING_TOTAL_STEPS}
            fillColor={Colors.primary}
          />
        </View>
      </View>

      {/* Top zone ~40% */}
      <View style={styles.topZone}>
        <Text style={styles.zoneLabel}>YOUR GUT HEALTH SCORE.</Text>

        <View style={[styles.gaugeWrap, { shadowColor: accentHex }]}>
          <Svg width={GAUGE_SIZE} height={GAUGE_SIZE} style={{ transform: [{ rotate: "-90deg" }] }}>
            <Circle
              cx={GAUGE_SIZE / 2}
              cy={GAUGE_SIZE / 2}
              r={GAUGE_R}
              stroke={accentHex}
              strokeWidth={GAUGE_STROKE}
              fill="none"
              opacity={0.15}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={0}
            />
            <ProgressRing progress={ringProgress} color={accentHex} />
          </Svg>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <ScoreCountUp value={scoreDisplay} />
          </View>
        </View>
      </View>

      {/* Middle zone ~45% (pill, headline, body, breakdown) */}
      <Animated.View style={[styles.middleZone, middleZoneStyle]}>
        <View style={[styles.pill, styles.pillInMiddle, { borderColor: accentHex, backgroundColor: `${accentHex}18` }]}>
          <Text style={[styles.pillText, { color: accentHex }]}>{profile.pillLabel.toUpperCase()}</Text>
        </View>
        <Text style={styles.headline}>{profile.headline}</Text>
        <Text style={styles.body}>{profile.body}</Text>
        <View style={styles.breakdown}>
          {BREAKDOWN_ITEMS.map((item, i) => {
            const score = subScores[item.key];
            const pct = score / 100;
            return (
              <View key={item.key} style={styles.breakdownRow}>
                <Text style={styles.breakdownEmoji}>{item.emoji}</Text>
                <Text style={styles.breakdownLabel}>{item.label}</Text>
                <View style={styles.barTrack}>
                  <BarFill progress={[bar1, bar2, bar3, bar4][i]} color={accentHex} percent={score} />
                </View>
                <Text style={[styles.breakdownValue, { color: accentHex }]}>{score}</Text>
              </View>
            );
          })}
        </View>
      </Animated.View>

      {/* Bottom zone ~15% */}
      <Animated.View style={[styles.bottomZone, ctaStyle]}>
        <TouchableOpacity
          style={[styles.ctaButton, { backgroundColor: accentHex }]}
          onPress={() => router.push("/improve-gut")}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaLabelWhite}>{profile.ctaLabel}</Text>
        </TouchableOpacity>
        <Text style={styles.caption}>{profile.caption}</Text>
      </Animated.View>
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function ProgressRing({ progress, color }: { progress: Animated.SharedValue<number>; color: string }) {
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));
  return (
    <AnimatedCircle
      cx={GAUGE_SIZE / 2}
      cy={GAUGE_SIZE / 2}
      r={GAUGE_R}
      stroke={color}
      strokeWidth={GAUGE_STROKE}
      fill="none"
      strokeLinecap="round"
      strokeDasharray={CIRCUMFERENCE}
      animatedProps={animatedProps}
    />
  );
}

function ScoreCountUp({ value }: { value: Animated.SharedValue<number> }) {
  const [display, setDisplay] = useState(0);
  useAnimatedReaction(
    () => Math.round(value.value),
    (v) => runOnJS(setDisplay)(v),
    [value]
  );
  return (
    <View style={styles.scoreCenter}>
      <Text style={styles.scoreNumber}>{display}</Text>
      <Text style={styles.scoreOutOf}>/100</Text>
    </View>
  );
}

function BarFill({
  progress,
  color,
  percent,
}: {
  progress: Animated.SharedValue<number>;
  color: string;
  percent: number;
}) {
  const style = useAnimatedStyle(() => ({
    width: `${interpolate(progress.value, [0, 1], [0, percent])}%`,
  }));
  return <Animated.View style={[styles.barFill, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF8F3",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  progressWrapper: {
    flex: 1,
  },
  topZone: {
    flex: 0.4,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: Spacing.xxl,
    paddingHorizontal: Spacing.xxl,
  },
  zoneLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2.5,
    color: Colors.textSecondary,
    opacity: 0.9,
    marginBottom: Spacing.lg,
  },
  gaugeWrap: {
    width: GAUGE_SIZE,
    height: GAUGE_SIZE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  pill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 9999,
    borderWidth: 1.5,
  },
  pillInMiddle: {
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  middleZone: {
    flex: 0.45,
    paddingHorizontal: Spacing.xxl,
    paddingTop: 0,
    paddingBottom: Spacing.lg,
    marginTop: -(Spacing.massive + Spacing.xxxl),
  },
  headline: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text,
    lineHeight: 28,
    marginBottom: Spacing.md,
  },
  body: {
    fontSize: 15,
    fontWeight: "400",
    color: Colors.text,
    opacity: 0.75,
    lineHeight: 22,
    marginBottom: Spacing.xxl,
  },
  breakdown: {
    gap: Spacing.lg,
    marginBottom: Spacing.massive,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  breakdownEmoji: {
    fontSize: 18,
    width: 24,
    textAlign: "center",
  },
  breakdownLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    width: 72,
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
    minWidth: 0,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: "700",
    width: 28,
    textAlign: "right",
  },
  bottomZone: {
    flex: 0.15,
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.xl,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  ctaButton: {
    width: "100%",
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  ctaLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  ctaLabelWhite: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  caption: {
    fontSize: 12,
    color: Colors.textSecondary,
    opacity: 0.85,
  },
  scoreCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: "700",
    color: Colors.text,
  },
  scoreOutOf: {
    fontSize: 16,
    fontWeight: "500",
    color: Colors.textSecondary,
    opacity: 0.7,
    marginTop: -4,
  },
});
