import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";
import ProgressBar from "@/components/onboarding/ProgressBar";
import OnboardingButton from "@/components/onboarding/OnboardingButton";
import {
  Spacing,
  Shadows,
  OnboardingButtonBar,
  ONBOARDING_TOTAL_STEPS,
  Colors,
  Fonts,
} from "@/constants/theme";

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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
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
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={headlineStyle}>
            <Text style={styles.headline}>
              Fix your gut 4x faster when you know what's actually in your food.
            </Text>
          </Animated.View>

          <Animated.View style={[styles.chartCard, cardStyle]}>
            <View style={styles.barRow}>
              <View style={styles.barColumn}>
                <View style={styles.labelRow}>
                  <Text style={styles.chartLabelText} numberOfLines={2}>
                    Guessing what to eat
                  </Text>
                </View>
                <View style={styles.barContainer}>
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
                <View style={styles.labelRow}>
                  <Text style={styles.chartLabelText}>With Gutsy</Text>
                </View>
                <View style={styles.barContainer}>
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
            <Text style={styles.subtext}>
              Scan any product. See exactly how it affects your gut and what to
              choose instead.
            </Text>
          </Animated.View>
        </ScrollView>

        <Animated.View style={[styles.bottomSection, bottomStyle]}>
          <View style={styles.buttonContainer}>
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.xl,
    flexGrow: 1,
    alignItems: "center",
  },
  headline: {
    fontFamily: Fonts.cardTitle,
    fontSize: 22,
    color: "#2E2E2E",
    lineHeight: 30,
    marginBottom: Spacing.xxxl,
    textAlign: "center",
    maxWidth: 320,
  },
  chartCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xxxl,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    ...Shadows.md,
    alignItems: "center",
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
    fontSize: 14,
    color: "#2E2E2E",
    textAlign: "center",
    lineHeight: 20,
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
    borderRadius: 8,
    minHeight: 28,
    paddingVertical: 6,
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
    fontSize: 16,
    color: "#374151",
  },
  barLabelLight: {
    fontFamily: Fonts.cardTitle,
    fontSize: 16,
    color: "#FFFFFF",
  },
  subtext: {
    fontFamily: Fonts.body,
    fontSize: 16,
    color: "#2E2E2E",
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 320,
  },
  bottomSection: {
    paddingHorizontal: OnboardingButtonBar.paddingHorizontal,
    paddingBottom: Spacing.xxl,
  },
  buttonContainer: {
    paddingTop: Spacing.sm,
  },
  continueButton: {
    backgroundColor: Colors.primary,
    ...Shadows.md,
  },
});
