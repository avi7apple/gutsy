import ProgressBar from "@/components/onboarding/ProgressBar";
import { Colors, ONBOARDING_TOTAL_STEPS, ScoreBucketColors, Spacing } from "@/constants/theme";
import {
  calculateGutScore,
  calculateSubScores,
  getScoreProfile,
  type ScoreProfile,
} from "@/lib/gut-score";
import { rf, rs, useBreakpoint } from "@/lib/hooks/use-responsive";
import { getOnboardingProfile } from "@/lib/onboarding-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

const GAUGE_SIZE_BASE = 160;
const GAUGE_STROKE_BASE = 10;

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
  const breakpoint = useBreakpoint();
  const isSmallScreen = breakpoint === "small";
  const isCompactScreen = breakpoint === "small" || breakpoint === "medium";
  const accent = profile ? ScoreBucketColors[profile.bucket] : ScoreBucketColors.imbalanced;

  const gaugeSize = isSmallScreen ? rs(GAUGE_SIZE_BASE * 0.88) : rs(GAUGE_SIZE_BASE);
  const gaugeStroke = isSmallScreen ? rs(GAUGE_STROKE_BASE * 0.8) : rs(GAUGE_STROKE_BASE);
  const gaugeRadius = (gaugeSize - gaugeStroke) / 2;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;

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
      <View style={[styles.header, isCompactScreen && styles.headerCompact, isSmallScreen && styles.headerTight]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, isSmallScreen && styles.backButtonTight]}
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
      <View style={[styles.topZone, isCompactScreen && styles.topZoneCompact]}>
        <Text style={[styles.zoneLabel, isSmallScreen && styles.zoneLabelTight]}>YOUR GUT HEALTH SCORE</Text>

        <View style={[styles.gaugeWrap, isSmallScreen && styles.gaugeWrapTight, { shadowColor: accentHex, width: gaugeSize, height: gaugeSize }]}>
          <Svg width={gaugeSize} height={gaugeSize} style={{ transform: [{ rotate: "-90deg" }] }}>
            <Circle
              cx={gaugeSize / 2}
              cy={gaugeSize / 2}
              r={gaugeRadius}
              stroke={accentHex}
              strokeWidth={gaugeStroke}
              fill="none"
              opacity={0.15}
              strokeDasharray={gaugeCircumference}
              strokeDashoffset={0}
            />
            <ProgressRing progress={ringProgress} color={accentHex} radius={gaugeRadius} stroke={gaugeStroke} circumference={gaugeCircumference} />
          </Svg>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <ScoreCountUp value={scoreDisplay} compact={isSmallScreen} />
          </View>
        </View>
      </View>

      {/* Middle zone ~45% (pill, headline, body, breakdown) */}
      <Animated.View
        style={[
          styles.middleZone,
          isCompactScreen && styles.middleZoneCompact,
          isSmallScreen && styles.middleZoneTight,
          middleZoneStyle,
        ]}
      >
        <View style={[styles.pill, styles.pillInMiddle, isSmallScreen && styles.pillTight, { borderColor: accentHex, backgroundColor: `${accentHex}18` }]}>
          <Text style={[styles.pillText, isSmallScreen && styles.pillTextTight, { color: accentHex }]}>{profile.pillLabel.toUpperCase()}</Text>
        </View>
        <Text style={[styles.headline, isCompactScreen && styles.headlineCompact, isSmallScreen && styles.headlineTight]}>
          {profile.headline}
        </Text>
        <Text style={[styles.body, isSmallScreen && styles.bodyTight]}>{profile.body}</Text>
        <View style={[styles.breakdown, isSmallScreen && styles.breakdownTight]}>
          {BREAKDOWN_ITEMS.map((item, i) => {
            const score = subScores[item.key];
            return (
              <View key={item.key} style={[styles.breakdownRow, isSmallScreen && styles.breakdownRowTight]}>
                <Text style={[styles.breakdownEmoji, isSmallScreen && styles.breakdownEmojiTight]}>{item.emoji}</Text>
                <Text style={[styles.breakdownLabel, isSmallScreen && styles.breakdownLabelTight]}>{item.label}</Text>
                <View style={[styles.barTrack, isSmallScreen && styles.barTrackTight]}>
                  <BarFill progress={[bar1, bar2, bar3, bar4][i]} color={accentHex} percent={score} />
                </View>
                <Text style={[styles.breakdownValue, isSmallScreen && styles.breakdownValueTight, { color: accentHex }]}>{score}</Text>
              </View>
            );
          })}
        </View>
      </Animated.View>

      {/* Bottom zone ~15% */}
      <Animated.View style={[styles.bottomZone, isCompactScreen && styles.bottomZoneCompact, ctaStyle]}>
        <TouchableOpacity
          style={[styles.ctaButton, isSmallScreen && styles.ctaButtonTight, { backgroundColor: accentHex }]}
          onPress={() => router.push("/improve-gut")}
          activeOpacity={0.85}
        >
          <Text style={[styles.ctaLabelWhite, isSmallScreen && styles.ctaLabelTight]}>{profile.ctaLabel}</Text>
        </TouchableOpacity>
        <Text style={[styles.caption, isSmallScreen && styles.captionTight]}>{profile.caption}</Text>
      </Animated.View>
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function ProgressRing({
  progress,
  color,
  radius,
  stroke,
  circumference,
}: {
  progress: SharedValue<number>;
  color: string;
  radius: number;
  stroke: number;
  circumference: number;
}) {
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));
  return (
    <AnimatedCircle
      cx={radius + stroke / 2}
      cy={radius + stroke / 2}
      r={radius}
      stroke={color}
      strokeWidth={stroke}
      fill="none"
      strokeLinecap="round"
      strokeDasharray={circumference}
      animatedProps={animatedProps}
    />
  );
}

function ScoreCountUp({ value, compact }: { value: SharedValue<number>; compact?: boolean }) {
  const [display, setDisplay] = useState(0);
  useAnimatedReaction(
    () => Math.round(value.value),
    (v) => runOnJS(setDisplay)(v),
    [value]
  );
  return (
    <View style={styles.scoreCenter}>
      <Text style={[styles.scoreNumber, compact && styles.scoreNumberTight]}>{display}</Text>
      <Text style={[styles.scoreOutOf, compact && styles.scoreOutOfTight]}>/100</Text>
    </View>
  );
}

function BarFill({
  progress,
  color,
  percent,
}: {
  progress: SharedValue<number>;
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
    fontSize: rf(16),
    color: Colors.textSecondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: rs(Spacing.lg),
    paddingTop: rs(Spacing.md),
    paddingBottom: rs(Spacing.xxl),
    gap: rs(Spacing.lg),
  },
  headerCompact: {
    paddingBottom: rs(Spacing.xl),
    gap: rs(Spacing.md),
  },
  headerTight: {
    paddingHorizontal: rs(Spacing.md),
    paddingBottom: rs(Spacing.lg),
  },
  backButton: {
    width: rs(44),
    height: rs(44),
    borderRadius: rs(22),
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonTight: {
    width: rs(38),
    height: rs(38),
    borderRadius: rs(19),
  },
  progressWrapper: {
    flex: 1,
  },
  topZone: {
    flex: 0.4,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: rs(Spacing.xxl),
    paddingHorizontal: rs(Spacing.xxl),
  },
  topZoneCompact: {
    paddingTop: rs(Spacing.xl),
  },
  zoneLabel: {
    fontSize: rf(11),
    fontWeight: "700",
    letterSpacing: 2.5,
    color: Colors.textSecondary,
    opacity: 0.9,
    marginBottom: rs(Spacing.lg),
  },
  zoneLabelTight: {
    fontSize: rf(9),
    letterSpacing: 1.8,
    marginBottom: rs(Spacing.xl),
  },
  gaugeWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  gaugeWrapTight: {
    marginBottom: rs(Spacing.xs * 0.2),
  },
  pill: {
    paddingHorizontal: rs(Spacing.lg),
    paddingVertical: rs(Spacing.sm),
    borderRadius: 9999,
    borderWidth: 1.5,
  },
  pillInMiddle: {
    alignSelf: "center",
    marginBottom: rs(Spacing.md),
  },
  pillTight: {
    paddingHorizontal: rs(Spacing.md),
    paddingVertical: rs(Spacing.xs),
    marginTop: rs(Spacing.xs),
    marginBottom: rs(Spacing.md),
  },
  pillText: {
    fontSize: rf(11),
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  pillTextTight: {
    fontSize: rf(10),
    letterSpacing: 1,
  },
  middleZone: {
    flex: 0.45,
    paddingHorizontal: rs(Spacing.xxl),
    paddingTop: 0,
    paddingBottom: rs(Spacing.lg),
    marginTop: -(rs(Spacing.massive) + rs(Spacing.xxxl)),
  },
  middleZoneCompact: {
    paddingHorizontal: rs(Spacing.xl),
    marginTop: -rs(Spacing.massive),
  },
  middleZoneTight: {
    paddingHorizontal: rs(Spacing.lg),
    marginTop: -(rs(Spacing.xxxl) * 2.5),
  },
  headline: {
    fontSize: rf(22),
    fontWeight: "700",
    color: Colors.text,
    lineHeight: rf(28),
    marginBottom: rs(Spacing.md),
  },
  headlineCompact: {
    fontSize: rf(20),
    lineHeight: rf(26),
  },
  headlineTight: {
    fontSize: rf(16),
    lineHeight: rf(22),
  },
  body: {
    fontSize: rf(15),
    fontWeight: "400",
    color: Colors.text,
    opacity: 0.75,
    lineHeight: rf(22),
    marginBottom: rs(Spacing.xxl),
  },
  bodyTight: {
    fontSize: rf(12),
    lineHeight: rf(17),
    marginBottom: rs(Spacing.xxl),
  },
  breakdown: {
    gap: rs(Spacing.lg),
    marginBottom: rs(Spacing.massive),
  },
  breakdownTight: {
    gap: rs(Spacing.md),
    paddingVertical: rs(Spacing.sm),
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: rs(Spacing.sm),
  },
  breakdownRowTight: {
    gap: rs(Spacing.xs),
    paddingVertical: rs(Spacing.xs),
    paddingHorizontal: rs(Spacing.sm),
    alignItems: "center",
  },
  breakdownEmoji: {
    fontSize: rf(18),
    width: rs(24),
    textAlign: "center",
  },
  breakdownEmojiTight: {
    fontSize: rf(16),
    width: rs(20),
  },
  breakdownLabel: {
    fontSize: rf(14),
    fontWeight: "600",
    color: Colors.text,
    flexShrink: 1,
  },
  breakdownLabelTight: {
    fontSize: rf(11.5),
    paddingLeft: rs(Spacing.sm),
    paddingRight: rs(Spacing.xs),
  },
  barTrack: {
    flex: 1,
    height: rs(8),
    borderRadius: rs(4),
    backgroundColor: "rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  barTrackTight: {
    height: rs(8),
    marginTop: rs(Spacing.xs),
    width: "100%",
  },
  barFill: {
    height: "100%",
    borderRadius: rs(4),
    minWidth: 0,
  },
  breakdownValue: {
    fontSize: rf(14),
    fontWeight: "700",
    width: rs(40),
    textAlign: "right",
  },
  breakdownValueTight: {
    width: rs(32),
    fontSize: rf(12),
  },
  bottomZone: {
    flex: 0.15,
    paddingHorizontal: rs(Spacing.xxl),
    paddingBottom: rs(Spacing.xl),
    justifyContent: "flex-end",
    alignItems: "center",
  },
  bottomZoneCompact: {
    paddingHorizontal: rs(Spacing.xl),
  },
  ctaButton: {
    width: "100%",
    height: rs(56),
    borderRadius: rs(14),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: rs(Spacing.sm),
  },
  ctaButtonTight: {
    height: rs(52),
    borderRadius: rs(12),
  },
  ctaLabel: {
    fontSize: rf(17),
    fontWeight: "600",
    color: "#1a1a1a",
  },
  ctaLabelWhite: {
    fontSize: rf(17),
    fontWeight: "600",
    color: "#FFFFFF",
  },
  ctaLabelTight: {
    fontSize: rf(14),
  },
  caption: {
    fontSize: rf(12),
    color: Colors.textSecondary,
    opacity: 0.85,
  },
  captionTight: {
    fontSize: rf(10),
  },
  scoreCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreNumber: {
    fontSize: rf(48),
    fontWeight: "700",
    color: Colors.text,
  },
  scoreNumberTight: {
    fontSize: rf(34),
  },
  scoreOutOf: {
    fontSize: rf(16),
    fontWeight: "500",
    color: Colors.textSecondary,
    opacity: 0.7,
    marginTop: rs(-4),
  },
  scoreOutOfTight: {
    fontSize: rf(13),
  },
});
