import { BorderRadius, Colors, Fonts, Shadows, Spacing } from "@/constants/theme";
import { useBlockBack } from "@/lib/hooks/use-block-back";
import { recordPaywallFunnelStep } from "@/lib/subscription-access";
import { supabase } from "@/lib/supabase";
import { rf, rs, useBreakpoint } from "@/lib/hooks/use-responsive";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import {
    SafeAreaView,
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
    withSpring,
    withTiming,
} from "react-native-reanimated";

const BELL_SIZE = 120;
const RING_OUTER = 180;
const RING_INNER = 155;
const BADGE_SIZE = 28;

const CARD_CONTENT = [
  {
    emoji: "🔔",
    text: "We'll remind you before your trial turns into a subscription.",
  },
  {
    emoji: "✋",
    text: "Cancel anytime from your device settings — no hassle.",
  },
  { emoji: "💳", text: "Full refund within 7 days if you're not satisfied." },
] as const;

export default function ReminderPromiseScreen() {
  const router = useRouter();
  const breakpoint = useBreakpoint();
  const isSmallScreen = breakpoint === "small";
  const isCompactScreen = breakpoint === "small" || breakpoint === "medium";
  useBlockBack();

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await recordPaywallFunnelStep(user.id, "reminder_promise");
      }
    })();
  }, []);

  const bellSize = isSmallScreen ? rs(BELL_SIZE * 0.85) : rs(BELL_SIZE);
  const ringOuterSize = isSmallScreen ? rs(RING_OUTER * 0.9) : rs(RING_OUTER);
  const ringInnerSize = isSmallScreen ? rs(RING_INNER * 0.9) : rs(RING_INNER);
  const badgeSize = isSmallScreen ? rs(BADGE_SIZE * 0.85) : rs(BADGE_SIZE);

  const ringInnerOpacity = useSharedValue(0.12);
  const ringOuterOpacity = useSharedValue(0.08);
  const wiggle = useSharedValue(0);
  const badgeScale = useSharedValue(0);
  const card1Opacity = useSharedValue(0);
  const card1Y = useSharedValue(20);
  const card2Opacity = useSharedValue(0);
  const card2Y = useSharedValue(20);
  const card3Opacity = useSharedValue(0);
  const card3Y = useSharedValue(20);

  useEffect(() => {
    ringInnerOpacity.value = withRepeat(
      withTiming(0.35, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    ringOuterOpacity.value = withDelay(
      200,
      withRepeat(
        withTiming(0.25, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );

    const wiggleSequence = withSequence(
      withTiming(1, { duration: 140, easing: Easing.out(Easing.ease) }),
      withTiming(2, { duration: 140, easing: Easing.inOut(Easing.ease) }),
      withTiming(3, { duration: 120, easing: Easing.inOut(Easing.ease) }),
      withTiming(4, { duration: 100, easing: Easing.inOut(Easing.ease) }),
      withTiming(5, { duration: 90, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: 0 }),
    );
    const wiggleDuration = 590;
    wiggle.value = withDelay(
      280,
      withRepeat(
        withSequence(
          wiggleSequence,
          withDelay(3500 - wiggleDuration, withTiming(0, { duration: 0 })),
        ),
        -1,
        false,
      ),
    );

    badgeScale.value = withDelay(
      350,
      withSpring(1, { damping: 12, stiffness: 200 }),
    );

    card1Opacity.value = withDelay(350, withTiming(1, { duration: 280 }));
    card1Y.value = withDelay(
      350,
      withSpring(0, { damping: 14, stiffness: 140 }),
    );
    card2Opacity.value = withDelay(450, withTiming(1, { duration: 280 }));
    card2Y.value = withDelay(
      450,
      withSpring(0, { damping: 14, stiffness: 140 }),
    );
    card3Opacity.value = withDelay(550, withTiming(1, { duration: 280 }));
    card3Y.value = withDelay(
      550,
      withSpring(0, { damping: 14, stiffness: 140 }),
    );
  }, []);

  const ringInnerStyle = useAnimatedStyle(() => ({
    opacity: ringInnerOpacity.value,
  }));
  const ringOuterStyle = useAnimatedStyle(() => ({
    opacity: ringOuterOpacity.value,
  }));

  const bellContainerStyle = useAnimatedStyle(() => {
    "worklet";
    const deg = interpolate(
      wiggle.value,
      [0, 1, 2, 3, 4, 5],
      [0, -4, 3, -2, 1, 0],
    );
    return { transform: [{ rotate: `${deg}deg` }] };
  });

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
    opacity: badgeScale.value,
  }));

  const card1Style = useAnimatedStyle(() => ({
    opacity: card1Opacity.value,
    transform: [{ translateY: card1Y.value }],
  }));
  const card2Style = useAnimatedStyle(() => ({
    opacity: card2Opacity.value,
    transform: [{ translateY: card2Y.value }],
  }));
  const card3Style = useAnimatedStyle(() => ({
    opacity: card3Opacity.value,
    transform: [{ translateY: card3Y.value }],
  }));

  const handleBack = () => router.back();
  const handleContinue = () => router.push("/trial-timeline");

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.content, isCompactScreen && styles.contentCompact]}>
        {/* Nav */}
        <View style={[styles.nav, isSmallScreen && styles.navCompact]}>
          <TouchableOpacity
            onPress={handleBack}
            style={[styles.navBtn, isSmallScreen && styles.navBtnTight]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Headline */}
        <Text style={[styles.headline, isSmallScreen && styles.headlineTight]}>
          {"We'll"} send you a reminder{"\n"}before your {" "}
          <Text style={styles.headlineHighlight}>free trial ends</Text>.
        </Text>

        {/* Bell hero + cards (flex to fill) */}
        <View style={[styles.middleSection, isSmallScreen && styles.middleSectionTight]}>
          <View
            style={[
              styles.bellWrap,
              { height: ringOuterSize + rs(isSmallScreen ? 24 : 40) },
              isSmallScreen && styles.bellWrapTight,
            ]}
          >
            <Animated.View
              style={[
                styles.ring,
                styles.ringOuter,
                { width: ringOuterSize, height: ringOuterSize },
                ringOuterStyle,
              ]}
            />
            <Animated.View
              style={[
                styles.ring,
                styles.ringInner,
                { width: ringInnerSize, height: ringInnerSize },
                ringInnerStyle,
              ]}
            />
            <Animated.View style={[styles.bellContainer, bellContainerStyle]}>
              <View
                style={[
                  styles.bellCircle,
                  {
                    width: bellSize + rs(40),
                    height: bellSize + rs(40),
                    borderRadius: (bellSize + rs(40)) / 2,
                  },
                ]}
              >
                <Text style={[styles.bellEmoji, isSmallScreen && styles.bellEmojiTight]}>🔔</Text>
                <Animated.View
                  style={[
                    styles.badge,
                    {
                      width: badgeSize,
                      height: badgeSize,
                      borderRadius: badgeSize / 2,
                    },
                    badgeStyle,
                  ]}
                >
                  <Text style={styles.badgeText}>1</Text>
                </Animated.View>
              </View>
            </Animated.View>
          </View>

          <View style={[styles.cards, isSmallScreen && styles.cardsTight]}>
            <Animated.View style={[styles.card, isSmallScreen && styles.cardTight, card1Style]}>
              <Text style={[styles.cardEmoji, isSmallScreen && styles.cardEmojiTight]}>{CARD_CONTENT[0].emoji}</Text>
              <Text style={[styles.cardText, isSmallScreen && styles.cardTextTight]}>{CARD_CONTENT[0].text}</Text>
            </Animated.View>
            <Animated.View style={[styles.card, isSmallScreen && styles.cardTight, card2Style]}>
              <Text style={[styles.cardEmoji, isSmallScreen && styles.cardEmojiTight]}>{CARD_CONTENT[1].emoji}</Text>
              <Text style={[styles.cardText, isSmallScreen && styles.cardTextTight]}>{CARD_CONTENT[1].text}</Text>
            </Animated.View>
            <Animated.View style={[styles.card, isSmallScreen && styles.cardTight, card3Style]}>
              <Text style={[styles.cardEmoji, isSmallScreen && styles.cardEmojiTight]}>{CARD_CONTENT[2].emoji}</Text>
              <Text style={[styles.cardText, isSmallScreen && styles.cardTextTight]}>{CARD_CONTENT[2].text}</Text>
            </Animated.View>
          </View>
        </View>

        {/* Bottom zone */}
        <View style={[styles.bottomZone, isCompactScreen && styles.bottomZoneCompact]}>
          <Text style={[styles.noPayment, isSmallScreen && styles.noPaymentTight]}>✓ No Payment Due Now.</Text>
          <TouchableOpacity
            style={[styles.primaryBtn, isSmallScreen && styles.primaryBtnTight]}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryBtnText, isSmallScreen && styles.primaryBtnTextTight]}>Continue for FREE.</Text>
          </TouchableOpacity>
          <Text style={[styles.pricing, isSmallScreen && styles.pricingTight]}>Just $49.99 per year ($0.96/week)</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
    justifyContent: "space-between",
  },
  contentCompact: {
    paddingHorizontal: Spacing.xl,
     paddingBottom: Spacing.xl,
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
  },
  navCompact: {
    marginTop: Spacing.xs,
  },
  navBtn: {
    padding: Spacing.sm,
  },
  navBtnTight: {
    padding: Spacing.xs,
  },
  headline: {
    fontFamily: Fonts.cardTitle,
    fontSize: rf(24),
    lineHeight: rf(32),
    color: Colors.text,
    textAlign: "center",
    marginTop: Spacing.lg,
  },
  headlineTight: {
    fontSize: rf(22),
    lineHeight: rf(30),
    marginTop: Spacing.md,
  },
  headlineHighlight: {
    color: Colors.primary,
    fontStyle: "italic",
  },
  middleSection: {
    flex: 1,
    justifyContent: "center",
    minHeight: 0,
    marginVertical: Spacing.lg,
  },
  middleSectionTight: {
    marginVertical: Spacing.md,
  },
  bellWrap: {
    height: RING_OUTER + 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  bellWrapTight: {
    marginBottom: Spacing.lg,
  },
  ring: {
    position: "absolute",
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  ringOuter: {
    width: RING_OUTER,
    height: RING_OUTER,
  },
  ringInner: {
    width: RING_INNER,
    height: RING_INNER,
  },
  bellContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  bellCircle: {
    backgroundColor: `${Colors.accent}18`,
    borderWidth: 1,
    borderColor: `${Colors.accent}40`,
    alignItems: "center",
    justifyContent: "center",
  },
  bellEmoji: {
    fontSize: rf(64),
  },
  bellEmojiTight: {
    fontSize: rf(54),
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: Colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontFamily: Fonts.cardTitle,
    fontSize: rf(14),
    color: "#FFFFFF",
  },
  cards: {
    gap: Spacing.sm,
  },
  cardsTight: {
    gap: Spacing.xs,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    backgroundColor: `${Colors.primary}0A`,
    borderWidth: 1,
    borderColor: `${Colors.primary}18`,
  },
  cardTight: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  cardEmoji: {
    fontSize: rf(20),
    marginRight: Spacing.sm,
  },
  cardEmojiTight: {
    fontSize: rf(18),
    marginRight: Spacing.xs,
  },
  cardText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: rf(13),
    color: Colors.textSecondary,
    lineHeight: rf(18),
  },
  cardTextTight: {
    fontSize: rf(12),
    lineHeight: rf(17),
  },
  bottomZone: {
    alignItems: "center",
  },
  bottomZoneCompact: {
    paddingHorizontal: Spacing.lg,
  },
  noPayment: {
    fontFamily: Fonts.body,
    fontSize: rf(15),
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  noPaymentTight: {
    fontSize: rf(14),
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xxxl,
    borderRadius: BorderRadius.lg,
    width: "100%",
    alignItems: "center",
    ...Shadows.md,
  },
  primaryBtnTight: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xxl,
  },
  primaryBtnText: {
    fontFamily: Fonts.button,
    fontSize: rf(18),
    color: "#FFFFFF",
  },
  primaryBtnTextTight: {
    fontSize: rf(16),
  },
  pricing: {
    fontFamily: Fonts.body,
    fontSize: rf(12),
    color: Colors.textMuted,
    marginTop: Spacing.md,
  },
  pricingTight: {
    marginTop: Spacing.sm,
  },
});
