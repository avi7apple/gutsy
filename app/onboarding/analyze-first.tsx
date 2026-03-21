import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
} from "react-native-reanimated";
import OnboardingButton from "@/components/onboarding/OnboardingButton";
import { Spacing, Colors, OnboardingButtonBar, Shadows } from "@/constants/theme";

const SYSTEM_CARDS = [
  { emoji: "🌱", title: "Gut Microbiome", subtitle: "Trillions of bacteria process every bite you take." },
  { emoji: "✨", title: "Skin", subtitle: "Gut bacteria regulate inflammation that shows up on your face." },
  { emoji: "💨", title: "Digestion & Bloating", subtitle: "An imbalanced gut can't break down food properly." },
  { emoji: "⚡", title: "Energy & Focus", subtitle: "Your gut produces 90% of your serotonin and powers your brain." },
];

const TITLE_DURATION = 500;
const SUBTITLE_DELAY = 200;
const SUBTITLE_DURATION = 450;
const CARD_STAGGER = 180;
const CARD_DURATION = 450;
const BUTTON_DELAY = 600;

export default function AnalyzeFirstScreen() {
  const router = useRouter();

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

        <View style={styles.content}>
          <View style={styles.hero}>
            <Animated.View style={[styles.titleBlock, titleStyle]}>
              <Text style={styles.title}>One organ.{"\n"}Four systems affected.</Text>
            </Animated.View>
            <Animated.View style={[styles.subtitleBlock, subtitleStyle]}>
              <Text style={styles.subtitle}>
                Modern packaged foods contain hundreds of ingredients your gut was never designed to handle.
              </Text>
            </Animated.View>
          </View>

          <View style={styles.cardsSection}>
            {SYSTEM_CARDS.map((card, i) => (
              <Animated.View key={card.title} style={[styles.systemCard, cardStyles[i]]}>
                <Text style={styles.cardEmoji}>{card.emoji}</Text>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
                </View>
              </Animated.View>
            ))}
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <Animated.View style={[buttonStyle, styles.buttonWrap]}>
            <OnboardingButton
              title="Analyze My Gut Health →"
              onPress={handleAnalyze}
              style={styles.primaryButton}
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
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  backButton: {
    padding: Spacing.xs,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  hero: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  titleBlock: {
    marginBottom: Spacing.lg,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 36,
    color: Colors.text,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  subtitleBlock: {
    alignItems: "center",
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  cardsSection: {
    width: "100%",
    gap: 18,
    marginBottom: Spacing.massive,
  },
  systemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xxl,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    ...Shadows.sm,
  },
  cardEmoji: {
    fontSize: 28,
    marginRight: Spacing.lg,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
  },
  buttonContainer: {
    ...OnboardingButtonBar,
  },
  buttonWrap: {
    width: "100%",
  },
  primaryButton: {
    width: "100%",
    ...Shadows.md,
  },
});
