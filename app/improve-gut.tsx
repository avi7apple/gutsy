import OnboardingButton from "@/components/onboarding/OnboardingButton";
import ProgressBar from "@/components/onboarding/ProgressBar";
import {
  BorderRadius,
  Colors,
  ONBOARDING_TOTAL_STEPS,
  Shadows,
  Spacing,
} from "@/constants/theme";
import { rf, rs, useBreakpoint } from "@/lib/hooks/use-responsive";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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
  const breakpoint = useBreakpoint();
  const isSmallScreen = breakpoint === "small";
  const isCompactScreen = breakpoint === "small" || breakpoint === "medium";

  const scannerSize = isSmallScreen ? rs(SCANNER_SIZE * 0.85) : rs(SCANNER_SIZE);
  const pulseSize = scannerSize + PULSE_RING_OFFSET * 2;
  const scanLineWidth = scannerSize - rs(Spacing.lg);

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
    const translated = interpolate(scanLineY.value, [0, 1], [0, scannerSize]);
    return { transform: [{ translateY: translated }] };
  }, [scannerSize]);
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

      <View
        style={[
          styles.header,
          isCompactScreen ? styles.headerCompact : undefined,
          isSmallScreen ? styles.headerTight : undefined,
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, isSmallScreen ? styles.backButtonTight : undefined]}
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

      <Animated.View
        style={[
          styles.headerZone,
          isCompactScreen ? styles.headerZoneCompact : undefined,
          isSmallScreen ? styles.headerZoneTight : undefined,
          headerStyle,
        ]}
      >
        <Text style={[styles.zoneLabel, isSmallScreen ? styles.zoneLabelTight : undefined]}>IMPROVE YOUR GUT HEALTH</Text>
        <Text
          style={[
            styles.headline,
            isCompactScreen ? styles.headlineCompact : undefined,
            isSmallScreen ? styles.headlineTight : undefined,
          ]}
        >
          Your score is{"\n"}
          <Text style={styles.headlineItalic}>not fixed.</Text>
        </Text>
        <Text
          style={[
            styles.subtitle,
            isCompactScreen ? styles.subtitleCompact : undefined,
            isSmallScreen ? styles.subtitleTight : undefined,
          ]}
        >
          Every food choice either helps or hurts that number. {"You're"}{" "}
          about to see which is which, before you eat.
        </Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.scannerZone,
          isCompactScreen ? styles.scannerZoneCompact : undefined,
          isSmallScreen ? styles.scannerZoneTight : undefined,
          scannerStyle,
        ]}
      >
        <View style={[styles.scannerOuter, { width: pulseSize, height: pulseSize }]}>
          <Animated.View style={[styles.pulseRing, { width: pulseSize, height: pulseSize }, pulseStyle]} />
          <View
            style={[
              styles.scannerSquare,
              { width: scannerSize, height: scannerSize },
              !isSmallScreen ? { borderRadius: scannerSize / 6 } : undefined,
            ]}
          >
            <View style={styles.cornerBrackets}>
              <View style={[styles.bracket, styles.bracketTopLeft]} />
              <View style={[styles.bracket, styles.bracketTopRight]} />
              <View style={[styles.bracket, styles.bracketBottomLeft]} />
              <View style={[styles.bracket, styles.bracketBottomRight]} />
            </View>
            <Animated.View style={[styles.scanLineWrap, { width: scannerSize, height: scannerSize }, scanLineStyle]}>
              <LinearGradient
                colors={["transparent", Colors.primary, "transparent"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[styles.scanLine, { width: scanLineWidth }]}
              />
            </Animated.View>
            <Text style={[styles.scannerIcon, isSmallScreen ? styles.scannerIconTight : undefined]}>📦</Text>
          </View>
        </View>
      </Animated.View>

      <View
        style={[
          styles.stepsZone,
          isCompactScreen ? styles.stepsZoneCompact : undefined,
          isSmallScreen ? styles.stepsZoneTight : undefined,
        ]}
      >
        <Animated.View
          style={[
            styles.stepCard,
            isCompactScreen ? styles.stepCardCompact : undefined,
            isSmallScreen ? styles.stepCardTight : undefined,
            card1Style,
          ]}
        >
          <View style={[styles.stepIconWrap, isSmallScreen ? styles.stepIconWrapTight : undefined]}>
            <Text style={[styles.stepEmoji, isSmallScreen ? styles.stepEmojiTight : undefined]}>{STEPS[0].emoji}</Text>
          </View>
          <View style={styles.stepTextWrap}>
            <Text
              style={[
                styles.stepLabel,
                isCompactScreen ? styles.stepLabelCompact : undefined,
                isSmallScreen ? styles.stepLabelTight : undefined,
              ]}
            >
              {STEPS[0].label}
            </Text>
            <Text
              style={[
                styles.stepDescription,
                isCompactScreen ? styles.stepDescriptionCompact : undefined,
                isSmallScreen ? styles.stepDescriptionTight : undefined,
              ]}
            >
              {STEPS[0].description}
            </Text>
          </View>
        </Animated.View>
        <Animated.View
          style={[
            styles.stepCard,
            isCompactScreen ? styles.stepCardCompact : undefined,
            isSmallScreen ? styles.stepCardTight : undefined,
            card2Style,
          ]}
        >
          <View style={[styles.stepIconWrap, isSmallScreen ? styles.stepIconWrapTight : undefined]}>
            <Text style={[styles.stepEmoji, isSmallScreen ? styles.stepEmojiTight : undefined]}>{STEPS[1].emoji}</Text>
          </View>
          <View style={styles.stepTextWrap}>
            <Text
              style={[
                styles.stepLabel,
                isCompactScreen ? styles.stepLabelCompact : undefined,
                isSmallScreen ? styles.stepLabelTight : undefined,
              ]}
            >
              {STEPS[1].label}
            </Text>
            <Text
              style={[
                styles.stepDescription,
                isCompactScreen ? styles.stepDescriptionCompact : undefined,
                isSmallScreen ? styles.stepDescriptionTight : undefined,
              ]}
            >
              {STEPS[1].description}
            </Text>
          </View>
        </Animated.View>
        <Animated.View
          style={[
            styles.stepCard,
            isCompactScreen ? styles.stepCardCompact : undefined,
            isSmallScreen ? styles.stepCardTight : undefined,
            card3Style,
          ]}
        >
          <View style={[styles.stepIconWrap, isSmallScreen ? styles.stepIconWrapTight : undefined]}>
            <Text style={[styles.stepEmoji, isSmallScreen ? styles.stepEmojiTight : undefined]}>{STEPS[2].emoji}</Text>
          </View>
          <View style={styles.stepTextWrap}>
            <Text
              style={[
                styles.stepLabel,
                isCompactScreen ? styles.stepLabelCompact : undefined,
                isSmallScreen ? styles.stepLabelTight : undefined,
              ]}
            >
              {STEPS[2].label}
            </Text>
            <Text
              style={[
                styles.stepDescription,
                isCompactScreen ? styles.stepDescriptionCompact : undefined,
                isSmallScreen ? styles.stepDescriptionTight : undefined,
              ]}
            >
              {STEPS[2].description}
            </Text>
          </View>
        </Animated.View>
      </View>

      <Animated.View
        style={[
          styles.bottomZone,
          isCompactScreen ? styles.bottomZoneCompact : undefined,
          isSmallScreen ? styles.bottomZoneTight : undefined,
          ctaStyle,
        ]}
      >
        <OnboardingButton
          title="Personalize app for me →"
          onPress={() => router.push("/onboarding/goal")}
          style={[styles.ctaButton, isSmallScreen ? styles.ctaButtonTight : undefined]}
          labelStyle={isSmallScreen ? styles.ctaButtonLabelTight : undefined}
          textStyle={isSmallScreen ? styles.ctaButtonLabelTight : undefined}
        />
        <Text style={[styles.caption, isSmallScreen ? styles.captionTight : undefined]}>
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
    paddingHorizontal: rs(Spacing.lg),
    paddingTop: rs(Spacing.md),
    paddingBottom: rs(Spacing.sm),
    gap: rs(Spacing.lg),
  },
  headerCompact: {
    paddingHorizontal: rs(Spacing.md + 2),
    paddingBottom: rs(Spacing.xs),
  },
  headerTight: {
    paddingHorizontal: rs(Spacing.md),
    paddingTop: rs(Spacing.xs),
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
  headerZoneCompact: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  headerZoneTight: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  zoneLabel: {
    fontSize: rf(9),
    fontWeight: "700",
    letterSpacing: 2,
    color: Colors.textSecondary,
    opacity: 0.9,
    marginBottom: Spacing.xs,
  },
  zoneLabelTight: {
    fontSize: rf(8),
    letterSpacing: 1.5,
    marginBottom: Spacing.xs / 2,
  },
  headline: {
    fontSize: rf(27),
    fontWeight: "600",
    color: Colors.text,
    lineHeight: rf(34),
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  headlineCompact: {
    fontSize: rf(24),
    lineHeight: rf(30),
  },
  headlineTight: {
    fontSize: rf(22),
    lineHeight: rf(28),
  },
  headlineItalic: {
    fontStyle: "italic",
    color: Colors.primary,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: rf(16),
    fontWeight: "400",
    color: Colors.text,
    opacity: 0.75,
    lineHeight: rf(22),
    textAlign: "center",
    maxWidth: rs(300),
  },
  subtitleCompact: {
    fontSize: rf(15),
    lineHeight: rf(20),
  },
  subtitleTight: {
    fontSize: rf(13),
    lineHeight: rf(18),
    maxWidth: rs(280),
  },
  scannerZone: {
    flex: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
  },
  scannerZoneCompact: {
    paddingVertical: Spacing.sm,
  },
  scannerZoneTight: {
    paddingVertical: Spacing.sm * 2,
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
    fontSize: rf(36),
  },
  scannerIconTight: {
    fontSize: rf(30),
  },
  stepsZone: {
    flex: 1,
    minHeight: 0,
    justifyContent: "center",
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  stepsZoneCompact: {
    paddingHorizontal: Spacing.xl,
  },
  stepsZoneTight: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
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
  stepCardCompact: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  stepCardTight: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  stepIconWrap: {
    width: rs(36),
    height: rs(36),
    borderRadius: BorderRadius.sm,
    backgroundColor: `${Colors.primary}18`,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  stepIconWrapTight: {
    width: rs(30),
    height: rs(30),
    marginRight: Spacing.sm,
  },
  stepEmoji: {
    fontSize: rf(18),
  },
  stepEmojiTight: {
    fontSize: rf(16),
  },
  stepTextWrap: {
    flex: 1,
  },
  stepLabel: {
    fontSize: rf(14),
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 1,
  },
  stepLabelCompact: {
    fontSize: rf(13),
  },
  stepLabelTight: {
    fontSize: rf(11.5),
  },
  stepDescription: {
    fontSize: rf(12),
    fontWeight: "400",
    color: Colors.textSecondary,
    lineHeight: rf(16),
  },
  stepDescriptionCompact: {
    fontSize: rf(11.5),
  },
  stepDescriptionTight: {
    fontSize: rf(10),
    lineHeight: rf(13),
  },
  bottomZone: {
    flex: 0,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    alignItems: "center",
  },
  bottomZoneCompact: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  bottomZoneTight: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  ctaButton: {
    width: "100%",
    marginBottom: Spacing.sm,
    ...Shadows.md,
  },
  ctaButtonTight: {
    marginBottom: Spacing.xs,
  },
  ctaButtonLabelTight: {
    fontSize: rf(13),
  },
  caption: {
    fontSize: rf(11),
    color: Colors.textSecondary,
    opacity: 0.8,
    textAlign: "center",
  },
  captionTight: {
    fontSize: rf(10),
  },
});
