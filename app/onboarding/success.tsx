import OnboardingButton from "@/components/onboarding/OnboardingButton";
import ProgressBar from "@/components/onboarding/ProgressBar";
import {
  Colors,
  Fonts,
  ONBOARDING_TOTAL_STEPS,
  OnboardingButtonBar,
  Shadows,
  Spacing,
} from "@/constants/theme";
import { rf, rs, useBreakpoint } from "@/lib/hooks/use-responsive";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import React, { useEffect } from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const BAR_1X_HEIGHT = 28;
const BAR_4X_HEIGHT = BAR_1X_HEIGHT * 4;
const CHART_MAX_HEIGHT = BAR_4X_HEIGHT;
const BAR_WIDTH = 72;

const CURRENT_STEP = 14;

const HEADLINE_DURATION = 500;
const CARD_DELAY = 120;
const CARD_DURATION = 450;
const BAR_START_DELAY = 350;
const BAR_GUTSY_DELAY = 180;
const SUBTEXT_DELAY = 750;
const BOTTOM_DELAY = 950;

export default function SuccessScreen() {
  const router = useRouter();
  const breakpoint = useBreakpoint();
  const isSmallScreen = breakpoint === "small";
  const isCompactScreen = breakpoint === "small" || breakpoint === "medium";

  const guessingBarHeight = BAR_1X_HEIGHT;
  const gutsyBarHeight = BAR_4X_HEIGHT;

  const headlineOpacity = useSharedValue(0);
  const headlineTranslateY = useSharedValue(20);

  const cardOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.94);

  const guessingHeight = useSharedValue(0);
  const gutsyHeight = useSharedValue(0);
  const barOpacity = useSharedValue(0);

  const subtextOpacity = useSharedValue(0);
  const subtextTranslateY = useSharedValue(12);

  const bottomOpacity = useSharedValue(0);

  useEffect(() => {
    headlineOpacity.value = withTiming(1, {
      duration: HEADLINE_DURATION,
      easing: Easing.out(Easing.cubic),
    });
    headlineTranslateY.value = withSpring(0, {
      damping: 18,
      stiffness: 120,
    });

    cardOpacity.value = withDelay(
      CARD_DELAY,
      withTiming(1, {
        duration: CARD_DURATION,
        easing: Easing.out(Easing.cubic),
      })
    );
    cardScale.value = withDelay(
      CARD_DELAY,
      withSpring(1, {
        damping: 16,
        stiffness: 140,
      })
    );

    barOpacity.value = withDelay(
      BAR_START_DELAY,
      withTiming(1, { duration: 200 })
    );
    guessingHeight.value = withDelay(
      BAR_START_DELAY,
      withSpring(guessingBarHeight, {
        damping: 18,
        stiffness: 100,
        overshootClamping: true,
      })
    );
    gutsyHeight.value = withDelay(
      BAR_START_DELAY + BAR_GUTSY_DELAY,
      withSpring(gutsyBarHeight, {
        damping: 18,
        stiffness: 100,
        overshootClamping: true,
      })
    );

    subtextOpacity.value = withDelay(
      SUBTEXT_DELAY,
      withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.cubic),
      })
    );
    subtextTranslateY.value = withDelay(
      SUBTEXT_DELAY,
      withSpring(0, { damping: 18, stiffness: 120 })
    );

    bottomOpacity.value = withDelay(
      BOTTOM_DELAY,
      withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.cubic),
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const headlineStyle = useAnimatedStyle(() => ({
    opacity: headlineOpacity.value,
    transform: [{ translateY: headlineTranslateY.value }],
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const guessingBarStyle = useAnimatedStyle(() => ({
    height: guessingHeight.value,
    opacity: barOpacity.value,
  }));

  const gutsyBarStyle = useAnimatedStyle(() => ({
    height: gutsyHeight.value,
    opacity: barOpacity.value,
  }));

  const subtextStyle = useAnimatedStyle(() => ({
    opacity: subtextOpacity.value,
    transform: [{ translateY: subtextTranslateY.value }],
  }));

  const bottomStyle = useAnimatedStyle(() => ({
    opacity: bottomOpacity.value,
  }));

  const handleBack = () => {
    router.back();
  };

  const handleContinue = () => {
    router.push("/onboarding/gender" as Href);
  };

  const chartMaxWidth = isSmallScreen ? rs(280) : rs(320);
  const barWidth = isSmallScreen ? rs(60) : rs(BAR_WIDTH);
  const labelRowMinHeight = isSmallScreen ? rs(36) : 44;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        <View
          style={[styles.header, isCompactScreen ? styles.headerCompact : undefined, isSmallScreen ? styles.headerTight : undefined]}
        >
          <TouchableOpacity
            onPress={handleBack}
            style={[styles.backButton, isSmallScreen ? styles.backButtonTight : undefined]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color="#2E2E2E" />
          </TouchableOpacity>
          <View style={styles.progressWrapper}>
            <ProgressBar
              current={CURRENT_STEP}
              total={ONBOARDING_TOTAL_STEPS}
              fillColor={Colors.primary}
            />
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            isCompactScreen ? styles.scrollContentCompact : undefined,
            isSmallScreen ? styles.scrollContentTight : undefined,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={headlineStyle}>
            <Text
              style={[styles.headline, isCompactScreen ? styles.headlineCompact : undefined, isSmallScreen ? styles.headlineTight : undefined]}
            >
              Fix your gut 4x faster when you know what's actually in your food.
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.chartCard,
              isCompactScreen ? styles.chartCardCompact : undefined,
              isSmallScreen ? styles.chartCardTight : undefined,
              { maxWidth: chartMaxWidth },
              cardStyle,
            ]}
          >
            <View style={[styles.barRow, { gap: isSmallScreen ? Spacing.lg : Spacing.xxl }]}>
              <View style={styles.barColumn}>
                <View style={[styles.labelRow, { minHeight: labelRowMinHeight }]}>
                  <Text style={[styles.chartLabelText, isSmallScreen ? styles.chartLabelTextTight : undefined]} numberOfLines={2}>
                    Guessing what to eat
                  </Text>
                </View>
                <View style={[styles.barContainer, { height: CHART_MAX_HEIGHT, width: barWidth }]}>
                  <Animated.View
                    style={[
                      styles.barFill,
                      styles.barGuessing,
                      guessingBarStyle,
                    ]}
                  >
                    <Text style={styles.barLabelDark}>1x</Text>
                  </Animated.View>
                </View>
              </View>
              <View style={styles.barColumn}>
                <View style={[styles.labelRow, { minHeight: labelRowMinHeight }]}>
                  <Text style={[styles.chartLabelText, isSmallScreen ? styles.chartLabelTextTight : undefined]}>With Gutsy</Text>
                </View>
                <View style={[styles.barContainer, { height: CHART_MAX_HEIGHT, width: barWidth }]}>
                  <Animated.View
                    style={[styles.barFill, styles.barGutsy, gutsyBarStyle]}
                  >
                    <Text style={styles.barLabelLight}>4x</Text>
                  </Animated.View>
                </View>
              </View>
            </View>
          </Animated.View>

          <Animated.View style={subtextStyle}>
            <Text style={[styles.subtext, isSmallScreen ? styles.subtextTight : undefined]}>
              Scan any product. See exactly how it affects your gut and what to
              choose instead.
            </Text>
          </Animated.View>
        </ScrollView>

        <Animated.View
          style={[styles.bottomSection, isCompactScreen ? styles.bottomSectionCompact : undefined, isSmallScreen ? styles.bottomSectionTight : undefined, bottomStyle]}
        >
          <View style={[styles.buttonContainer, isSmallScreen ? styles.buttonContainerTight : undefined]}>
            <OnboardingButton
              title="Continue"
              onPress={handleContinue}
              style={styles.continueButton}
            />
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF8F3",
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: rs(Spacing.lg),
    paddingTop: rs(Spacing.md),
    paddingBottom: rs(Spacing.xl),
    gap: rs(Spacing.lg),
  },
  headerCompact: {
    paddingHorizontal: rs(Spacing.md),
  },
  headerTight: {
    paddingHorizontal: rs(Spacing.md),
    paddingTop: rs(Spacing.sm),
    paddingBottom: rs(Spacing.lg),
    gap: rs(Spacing.md),
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: rs(Spacing.xxl),
    paddingTop: rs(Spacing.xxxl),
    paddingBottom: rs(Spacing.xl),
    flexGrow: 1,
    alignItems: "center",
  },
  scrollContentCompact: {
    paddingHorizontal: rs(Spacing.xl),
  },
  scrollContentTight: {
    paddingHorizontal: rs(Spacing.lg),
    paddingTop: rs(Spacing.xxxl * 1.6),
    paddingBottom: rs(Spacing.xxxl),
  },
  headline: {
    fontFamily: Fonts.cardTitle,
    fontSize: rf(22),
    color: "#2E2E2E",
    lineHeight: rf(30),
    marginBottom: rs(Spacing.xxxl),
    textAlign: "center",
    maxWidth: rs(320),
  },
  headlineCompact: {
    fontSize: rf(20),
    lineHeight: rf(28),
  },
  headlineTight: {
    fontSize: rf(18),
    lineHeight: rf(26),
    marginBottom: rs(Spacing.xxxl - Spacing.sm),
  },
  chartCard: {
    width: "100%",
    maxWidth: rs(320),
    backgroundColor: "#FFFFFF",
    borderRadius: rs(16),
    paddingVertical: rs(Spacing.xxl),
    paddingHorizontal: rs(Spacing.xl),
    marginBottom: rs(Spacing.xxxl),
    borderWidth: 1,
    borderColor: "#E5E7EB",
    ...Shadows.md,
    alignItems: "center",
  },
  chartCardCompact: {
    paddingVertical: rs(Spacing.xl),
  },
  chartCardTight: {
    paddingVertical: rs(Spacing.lg),
    paddingHorizontal: rs(Spacing.lg),
  },
  barRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: Spacing.xxl,
    width: "100%",
    maxWidth: 240,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    maxWidth: 100,
  },
  labelRow: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    marginBottom: Spacing.lg,
  },
  chartLabelText: {
    fontFamily: Fonts.body,
    fontSize: rf(14),
    color: "#2E2E2E",
    textAlign: "center",
    lineHeight: rf(20),
  },
  chartLabelTextTight: {
    fontSize: rf(12.5),
    lineHeight: rf(18),
  },
  barContainer: {
    height: CHART_MAX_HEIGHT,
    width: BAR_WIDTH,
    justifyContent: "flex-end",
    alignItems: "center",
    overflow: "hidden",
  },
  barFill: {
    width: "100%",
    borderRadius: rs(8),
    minHeight: rs(28),
    paddingVertical: rs(6),
    justifyContent: "center",
    alignItems: "center",
  },
  barGuessing: {
    backgroundColor: "#D1D5DB",
  },
  barGutsy: {
    backgroundColor: Colors.primary,
  },
  barLabelDark: {
    fontFamily: Fonts.cardTitle,
    fontSize: rf(16),
    color: "#374151",
  },
  barLabelLight: {
    fontFamily: Fonts.cardTitle,
    fontSize: rf(16),
    color: "#FFFFFF",
  },
  subtext: {
    fontFamily: Fonts.body,
    fontSize: rf(16),
    color: "#2E2E2E",
    lineHeight: rf(24),
    textAlign: "center",
    maxWidth: rs(320),
  },
  subtextTight: {
    fontSize: rf(14),
    lineHeight: rf(20),
    maxWidth: rs(280),
  },
  bottomSection: {
    paddingHorizontal: rs(OnboardingButtonBar.paddingHorizontal),
    paddingBottom: rs(Spacing.xxl),
  },
  bottomSectionCompact: {
    paddingHorizontal: rs(OnboardingButtonBar.paddingHorizontal - Spacing.sm),
  },
  bottomSectionTight: {
    paddingHorizontal: rs(OnboardingButtonBar.paddingHorizontal - Spacing.md),
  },
  buttonContainer: {
    paddingTop: Spacing.sm,
  },
  buttonContainerTight: {
    paddingTop: Spacing.xs,
  },
  continueButton: {
    backgroundColor: Colors.primary,
    ...Shadows.md,
  },
});
