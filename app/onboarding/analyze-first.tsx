import OnboardingButton from "@/components/onboarding/OnboardingButton";
import { Colors, ROnboardingButtonBar, Shadows, Spacing } from "@/constants/theme";
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

const SYSTEM_CARDS = [
  { emoji: "🌱", title: "Gut Microbiome", subtitle: "Trillions of bacteria process every bite you take." },
  { emoji: "✨", title: "Skin", subtitle: "Gut bacteria regulate inflammation that shows up on your face." },
  { emoji: "💨", title: "Digestion & Bloating", subtitle: "An imbalanced gut can't break down food properly." },
  { emoji: "⚡", title: "Energy & Focus", subtitle: "Your gut produces 90% of your serotonin and powers your brain." },
];

const TITLE_DURATION = 400;
const SUBTITLE_DELAY = 120;
const SUBTITLE_DURATION = 380;
const CARD_STAGGER = 140;
const CARD_DURATION = 360;
const BUTTON_DELAY = 480;

export default function AnalyzeFirstScreen() {
  const router = useRouter();
  const breakpoint = useBreakpoint();
  const isSmallScreen = breakpoint === "small";
  const isCompactScreen = breakpoint === "small" || breakpoint === "medium";

  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(24);
  const subtitleOpacity = useSharedValue(0);
  const subtitleTranslateY = useSharedValue(16);

  const card1Opacity = useSharedValue(0);
  const card1TranslateY = useSharedValue(20);
  const card2Opacity = useSharedValue(0);
  const card2TranslateY = useSharedValue(20);
  const card3Opacity = useSharedValue(0);
  const card3TranslateY = useSharedValue(20);
  const card4Opacity = useSharedValue(0);
  const card4TranslateY = useSharedValue(20);

  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(20);

  useEffect(() => {
    titleOpacity.value = withTiming(1, {
      duration: TITLE_DURATION,
      easing: Easing.out(Easing.cubic),
    });
    titleTranslateY.value = withSpring(0, { damping: 18, stiffness: 120 });

    subtitleOpacity.value = withDelay(
      SUBTITLE_DELAY,
      withTiming(1, { duration: SUBTITLE_DURATION, easing: Easing.out(Easing.cubic) })
    );
    subtitleTranslateY.value = withDelay(
      SUBTITLE_DELAY,
      withSpring(0, { damping: 16, stiffness: 110 })
    );

    card1Opacity.value = withDelay(CARD_STAGGER, withTiming(1, { duration: CARD_DURATION }));
    card1TranslateY.value = withDelay(CARD_STAGGER, withSpring(0, { damping: 16, stiffness: 120 }));
    card2Opacity.value = withDelay(CARD_STAGGER * 2, withTiming(1, { duration: CARD_DURATION }));
    card2TranslateY.value = withDelay(CARD_STAGGER * 2, withSpring(0, { damping: 16, stiffness: 120 }));
    card3Opacity.value = withDelay(CARD_STAGGER * 3, withTiming(1, { duration: CARD_DURATION }));
    card3TranslateY.value = withDelay(CARD_STAGGER * 3, withSpring(0, { damping: 16, stiffness: 120 }));
    card4Opacity.value = withDelay(CARD_STAGGER * 4, withTiming(1, { duration: CARD_DURATION }));
    card4TranslateY.value = withDelay(CARD_STAGGER * 4, withSpring(0, { damping: 16, stiffness: 120 }));

    buttonOpacity.value = withDelay(BUTTON_DELAY, withTiming(1, { duration: 400 }));
    buttonTranslateY.value = withDelay(BUTTON_DELAY, withSpring(0, { damping: 14, stiffness: 100 }));
  }, []);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));
  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleTranslateY.value }],
  }));
  const card1Style = useAnimatedStyle(() => ({
    opacity: card1Opacity.value,
    transform: [{ translateY: card1TranslateY.value }],
  }));
  const card2Style = useAnimatedStyle(() => ({
    opacity: card2Opacity.value,
    transform: [{ translateY: card2TranslateY.value }],
  }));
  const card3Style = useAnimatedStyle(() => ({
    opacity: card3Opacity.value,
    transform: [{ translateY: card3TranslateY.value }],
  }));
  const card4Style = useAnimatedStyle(() => ({
    opacity: card4Opacity.value,
    transform: [{ translateY: card4TranslateY.value }],
  }));
  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonTranslateY.value }],
  }));

  const handleAnalyze = () => {
    router.push("/onboarding/skin-feel" as Href);
  };

  const cardStyles = [card1Style, card2Style, card3Style, card4Style];
  const buttonLabelStyle = isSmallScreen ? styles.buttonTextSmall : undefined;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={[
            styles.content,
            isCompactScreen && styles.contentCompact,
            isSmallScreen && styles.contentTight,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.hero, isSmallScreen && styles.heroTight]}>
            <Animated.View style={[styles.titleBlock, titleStyle]}>
              <Text
                style={[
                  styles.title,
                  isCompactScreen && styles.titleCondensed,
                  isSmallScreen && styles.titleExtraCondensed,
                ]}
              >
                One organ.{"\n"}Four systems affected.
              </Text>
            </Animated.View>
            <Animated.View style={[styles.subtitleBlock, subtitleStyle]}>
              <Text
                style={[
                  styles.subtitle,
                  isCompactScreen && styles.subtitleCondensed,
                  isSmallScreen && styles.subtitleExtraCondensed,
                ]}
              >
                Modern packaged foods contain hundreds of ingredients your gut was never designed to handle.
              </Text>
            </Animated.View>
          </View>

          <View
            style={[
              styles.cardsSection,
              isCompactScreen && styles.cardsSectionCompact,
              isSmallScreen && styles.cardsSectionTight,
            ]}
          >
            {SYSTEM_CARDS.map((card, i) => (
              <Animated.View
                key={card.title}
                style={[
                  styles.systemCard,
                  isCompactScreen && styles.systemCardCompact,
                  isSmallScreen && styles.systemCardTight,
                  cardStyles[i],
                ]}
              >
                <Text style={[styles.cardEmoji, isSmallScreen && styles.cardEmojiTight]}>{card.emoji}</Text>
                <View style={styles.cardContent}>
                  <Text
                    style={[styles.cardTitle, isCompactScreen && styles.cardTitleCondensed, isSmallScreen && styles.cardTitleTight]}
                  >
                    {card.title}
                  </Text>
                  <Text
                    style={[
                      styles.cardSubtitle,
                      isCompactScreen && styles.cardSubtitleCondensed,
                      isSmallScreen && styles.cardSubtitleTight,
                    ]}
                  >
                    {card.subtitle}
                  </Text>
                </View>
              </Animated.View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.buttonContainer}>
          <Animated.View style={[buttonStyle, styles.buttonWrap]}>
            <OnboardingButton
              title="Analyze My Gut Health →"
              onPress={handleAnalyze}
              style={styles.primaryButton}
              textStyle={buttonLabelStyle}
            />
          </Animated.View>
        </View>
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
    paddingHorizontal: rs(Spacing.md),
    paddingTop: rs(Spacing.sm),
    paddingBottom: rs(Spacing.xs),
  },
  backButton: {
    padding: rs(Spacing.xs),
  },
  contentScroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: rs(Spacing.xxl),
    paddingTop: rs(Spacing.lg),
    paddingBottom: rs(Spacing.lg),
  },
  contentCompact: {
    paddingHorizontal: rs(Spacing.xl),
    paddingBottom: rs(Spacing.sm),
  },
  contentTight: {
    paddingHorizontal: rs(Spacing.lg),
    paddingTop: rs(Spacing.md),
    paddingBottom: rs(Spacing.xs),
  },
  hero: {
    alignItems: "center",
    marginBottom: rs(Spacing.xl),
  },
  heroTight: {
    marginBottom: rs(Spacing.lg),
  },
  titleBlock: {
    marginBottom: rs(Spacing.lg),
    alignItems: "center",
  },
  title: {
    fontSize: rf(28),
    fontWeight: "700",
    lineHeight: rf(36),
    color: Colors.text,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  titleCondensed: {
    fontSize: rf(26),
    lineHeight: rf(34),
  },
  titleExtraCondensed: {
    fontSize: rf(24),
    lineHeight: rf(32),
  },
  subtitleBlock: {
    alignItems: "center",
  },
  subtitle: {
    fontSize: rf(16),
    lineHeight: rf(24),
    color: Colors.textSecondary,
    textAlign: "center",
  },
  subtitleCondensed: {
    fontSize: rf(15),
    lineHeight: rf(22),
  },
  subtitleExtraCondensed: {
    fontSize: rf(14),
    lineHeight: rf(20),
  },
  cardsSection: {
    width: "100%",
    gap: rs(18),
    marginBottom: rs(Spacing.massive),
  },
  cardsSectionCompact: {
    gap: rs(14),
    marginBottom: rs(Spacing.xxl),
  },
  cardsSectionTight: {
    gap: rs(12),
    marginBottom: rs(Spacing.xl),
  },
  systemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: rs(Spacing.xl),
    paddingHorizontal: rs(Spacing.xxl),
    borderRadius: rs(16),
    borderWidth: 1,
    borderColor: "#E5E7EB",
    ...Shadows.sm,
  },
  systemCardCompact: {
    paddingVertical: rs(Spacing.lg),
    paddingHorizontal: rs(Spacing.xl),
    borderRadius: rs(14),
  },
  systemCardTight: {
    paddingVertical: rs(Spacing.md),
    paddingHorizontal: rs(Spacing.lg),
    borderRadius: rs(12),
  },
  cardEmoji: {
    fontSize: rf(28),
    marginRight: rs(Spacing.lg),
  },
  cardEmojiTight: {
    fontSize: rf(24),
    marginRight: rs(Spacing.md),
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: rf(16),
    fontWeight: "700",
    color: Colors.text,
    marginBottom: rs(4),
  },
  cardTitleCondensed: {
    fontSize: rf(15),
  },
  cardTitleTight: {
    fontSize: rf(14),
    marginBottom: rs(2),
  },
  cardSubtitle: {
    fontSize: rf(14),
    lineHeight: rf(21),
    color: Colors.textSecondary,
  },
  cardSubtitleCondensed: {
    fontSize: rf(13),
    lineHeight: rf(19),
  },
  cardSubtitleTight: {
    fontSize: rf(12),
    lineHeight: rf(18),
  },
  buttonContainer: {
    ...ROnboardingButtonBar,
  },
  buttonWrap: {
    width: "100%",
  },
  primaryButton: {
    width: "100%",
    ...Shadows.md,
  },
  buttonTextSmall: {
    fontSize: rf(15),
    lineHeight: rf(21),
  },
});
