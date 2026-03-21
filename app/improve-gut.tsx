import OnboardingButton from "@/components/onboarding/OnboardingButton";
import {
  BorderRadius,
  Colors,
  ONBOARDING_TOTAL_STEPS,
  Shadows,
  Spacing,
} from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import {
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ProgressBar from "@/components/onboarding/ProgressBar";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SCANNER_SIZE = 128;
const BRACKET_LENGTH = 16;
const BRACKET_STROKE = 2;
const PULSE_RING_OFFSET = 10;
const PULSE_DURATION = 2000;
const PULSE_OFFSET_MS = 500;

const STEPS = [
  {
    emoji: "📦",
    label: "Point at any packaged food",
    description: "Barcode or photo. We read both instantly.",
  },
  {
    emoji: "🔬",
    label: "We decode every ingredient",
    description:
      "See what each one does for your gut: the good, the bad, and what to swap.",
  },
  {
    emoji: "📈",
    label: "See your personal impact",
    description:
      "Each scan shows exactly how that product affects your gut profile.",
  },
];

export default function ImproveGutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const headerOpacity = useSharedValue(0);
  const scannerOpacity = useSharedValue(0);
  const scanLineY = useSharedValue(0);
  const pulseOpacity = useSharedValue(0.15);
  const card1Opacity = useSharedValue(0);
  const card1TranslateX = useSharedValue(16);
  const card2Opacity = useSharedValue(0);
  const card2TranslateX = useSharedValue(16);
  const card3Opacity = useSharedValue(0);
  const card3TranslateX = useSharedValue(16);
  const ctaOpacity = useSharedValue(0);

  useEffect(() => {
    headerOpacity.value = withDelay(
      100,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) }),
    );
    scannerOpacity.value = withDelay(
      200,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) }),
    );

    scanLineY.value = withDelay(
      200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );

    pulseOpacity.value = withDelay(
      200 + PULSE_OFFSET_MS,
      withRepeat(
        withSequence(
          withTiming(0.45, {
            duration: PULSE_DURATION / 2,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(0.15, {
            duration: PULSE_DURATION / 2,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        false,
      ),
    );

    card1Opacity.value = withDelay(
      200,
      withTiming(1, {
        duration: 400,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }),
    );
    card1TranslateX.value = withDelay(
      200,
      withTiming(0, {
        duration: 400,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }),
    );
    card2Opacity.value = withDelay(
      500,
      withTiming(1, {
        duration: 400,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }),
    );
    card2TranslateX.value = withDelay(
      500,
      withTiming(0, {
        duration: 400,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }),
    );
    card3Opacity.value = withDelay(
      800,
      withTiming(1, {
        duration: 400,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }),
    );
    card3TranslateX.value = withDelay(
      800,
      withTiming(0, {
        duration: 400,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }),
    );

    ctaOpacity.value = withDelay(
      1000,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) }),
    );
  }, []);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
  }));
  const scannerStyle = useAnimatedStyle(() => ({
    opacity: scannerOpacity.value,
  }));
  const scanLineStyle = useAnimatedStyle(() => {
    const translated = interpolate(scanLineY.value, [0, 1], [0, SCANNER_SIZE]);
    return { transform: [{ translateY: translated }] };
  });
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }));
  const card1Style = useAnimatedStyle(() => ({
    opacity: card1Opacity.value,
    transform: [{ translateX: card1TranslateX.value }],
  }));
  const card2Style = useAnimatedStyle(() => ({
    opacity: card2Opacity.value,
    transform: [{ translateX: card2TranslateX.value }],
  }));
  const card3Style = useAnimatedStyle(() => ({
    opacity: card3Opacity.value,
    transform: [{ translateX: card3TranslateX.value }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({ opacity: ctaOpacity.value }));

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <StatusBar barStyle="dark-content" />

      <View style={styles.blobTopRight} pointerEvents="none" />
      <View style={styles.blobBottomLeft} pointerEvents="none" />

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
            current={9}
            total={ONBOARDING_TOTAL_STEPS}
            fillColor={Colors.primary}
          />
        </View>
      </View>

      <Animated.View style={[styles.headerZone, headerStyle]}>
        <Text style={styles.zoneLabel}>IMPROVE YOUR GUT HEALTH</Text>
        <Text style={styles.headline}>
          Your score is{"\n"}
          <Text style={styles.headlineItalic}>not fixed.</Text>
        </Text>
        <Text style={styles.subtitle}>
          Every food choice either helps or hurts that number. {"You're"}{" "}
          about to see which is which, before you eat.
        </Text>
      </Animated.View>

      <Animated.View style={[styles.scannerZone, scannerStyle]}>
        <View style={styles.scannerOuter}>
          <Animated.View style={[styles.pulseRing, pulseStyle]} />
          <View style={styles.scannerSquare}>
            <View style={styles.cornerBrackets}>
              <View style={[styles.bracket, styles.bracketTopLeft]} />
              <View style={[styles.bracket, styles.bracketTopRight]} />
              <View style={[styles.bracket, styles.bracketBottomLeft]} />
              <View style={[styles.bracket, styles.bracketBottomRight]} />
            </View>
            <Animated.View style={[styles.scanLineWrap, scanLineStyle]}>
              <LinearGradient
                colors={["transparent", Colors.primary, "transparent"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.scanLine}
              />
            </Animated.View>
            <Text style={styles.scannerIcon}>📦</Text>
          </View>
        </View>
      </Animated.View>

      <View style={styles.stepsZone}>
        <Animated.View style={[styles.stepCard, card1Style]}>
          <View style={styles.stepIconWrap}>
            <Text style={styles.stepEmoji}>{STEPS[0].emoji}</Text>
          </View>
          <View style={styles.stepTextWrap}>
            <Text style={styles.stepLabel}>{STEPS[0].label}</Text>
            <Text style={styles.stepDescription}>{STEPS[0].description}</Text>
          </View>
        </Animated.View>
        <Animated.View style={[styles.stepCard, card2Style]}>
          <View style={styles.stepIconWrap}>
            <Text style={styles.stepEmoji}>{STEPS[1].emoji}</Text>
          </View>
          <View style={styles.stepTextWrap}>
            <Text style={styles.stepLabel}>{STEPS[1].label}</Text>
            <Text style={styles.stepDescription}>{STEPS[1].description}</Text>
          </View>
        </Animated.View>
        <Animated.View style={[styles.stepCard, card3Style]}>
          <View style={styles.stepIconWrap}>
            <Text style={styles.stepEmoji}>{STEPS[2].emoji}</Text>
          </View>
          <View style={styles.stepTextWrap}>
            <Text style={styles.stepLabel}>{STEPS[2].label}</Text>
            <Text style={styles.stepDescription}>{STEPS[2].description}</Text>
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[styles.bottomZone, ctaStyle]}>
        <OnboardingButton
          title="Personalize app for me →"
          onPress={() => router.push("/onboarding/goal")}
          style={styles.ctaButton}
        />
        <Text style={styles.caption}>
          Your gut health journey starts right now.
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF8F3",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
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
  blobTopRight: {
    position: "absolute",
    top: -60,
    right: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.primary,
    opacity: 0.06,
  },
  blobBottomLeft: {
    position: "absolute",
    bottom: -50,
    left: -50,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.primary,
    opacity: 0.06,
  },
  headerZone: {
    flex: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.md,
  },
  zoneLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    color: Colors.textSecondary,
    opacity: 0.9,
    marginBottom: Spacing.xs,
  },
  headline: {
    fontSize: 27,
    fontWeight: "600",
    color: Colors.text,
    lineHeight: 34,
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  headlineItalic: {
    fontStyle: "italic",
    color: Colors.primary,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "400",
    color: Colors.text,
    opacity: 0.75,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 300,
  },
  scannerZone: {
    flex: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
  },
  scannerOuter: {
    width: SCANNER_SIZE + PULSE_RING_OFFSET * 2,
    height: SCANNER_SIZE + PULSE_RING_OFFSET * 2,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    width: SCANNER_SIZE + PULSE_RING_OFFSET * 2,
    height: SCANNER_SIZE + PULSE_RING_OFFSET * 2,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  scannerSquare: {
    width: SCANNER_SIZE,
    height: SCANNER_SIZE,
    borderRadius: BorderRadius.md,
    backgroundColor: `${Colors.primary}08`,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cornerBrackets: {
    ...StyleSheet.absoluteFillObject,
  },
  bracket: {
    position: "absolute",
    width: BRACKET_LENGTH,
    height: BRACKET_LENGTH,
    borderColor: Colors.primary,
    borderLeftWidth: BRACKET_STROKE,
    borderTopWidth: BRACKET_STROKE,
  },
  bracketTopLeft: {
    top: Spacing.sm,
    left: Spacing.sm,
  },
  bracketTopRight: {
    top: Spacing.sm,
    right: Spacing.sm,
    borderLeftWidth: 0,
    borderTopWidth: BRACKET_STROKE,
    borderRightWidth: BRACKET_STROKE,
  },
  bracketBottomLeft: {
    bottom: Spacing.sm,
    left: Spacing.sm,
    borderTopWidth: 0,
    borderLeftWidth: BRACKET_STROKE,
    borderBottomWidth: BRACKET_STROKE,
  },
  bracketBottomRight: {
    bottom: Spacing.sm,
    right: Spacing.sm,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: BRACKET_STROKE,
    borderBottomWidth: BRACKET_STROKE,
  },
  scanLineWrap: {
    position: "absolute",
    left: 0,
    top: 0,
    width: SCANNER_SIZE,
    height: SCANNER_SIZE,
    justifyContent: "flex-start",
    alignItems: "center",
  },
  scanLine: {
    width: SCANNER_SIZE - Spacing.lg,
    height: 2,
    borderRadius: 1,
  },
  scannerIcon: {
    fontSize: 36,
  },
  stepsZone: {
    flex: 1,
    minHeight: 0,
    justifyContent: "center",
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  stepCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${Colors.primary}0C`,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: `${Colors.primary}20`,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  stepIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    backgroundColor: `${Colors.primary}18`,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  stepEmoji: {
    fontSize: 18,
  },
  stepTextWrap: {
    flex: 1,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 1,
  },
  stepDescription: {
    fontSize: 12,
    fontWeight: "400",
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  bottomZone: {
    flex: 0,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    alignItems: "center",
  },
  ctaButton: {
    width: "100%",
    marginBottom: Spacing.sm,
    ...Shadows.md,
  },
  caption: {
    fontSize: 11,
    color: Colors.textSecondary,
    opacity: 0.8,
    textAlign: "center",
  },
});
