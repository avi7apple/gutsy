 import { Colors, Fonts, Shadows, Spacing } from "@/constants/theme";
import { useRouter, type Href } from "expo-router";
import React, { useEffect } from "react";
import {
    ActivityIndicator,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from "react-native-reanimated";

const LOADING_DURATION_MS = 10000;

const KNOWLEDGE_SECTIONS = [
  {
    title: "Gut & skin",
    bullets: [
      "Your gut and skin are connected. What you eat shows up as glow, breakouts, or dullness within days.",
      "The right foods can give you clearer, calmer skin without guessing.",
    ],
    gutsyHelp: "Gutsy shows you which foods support your skin so you can eat for the glow you want.",
  },
  {
    title: "Gut & bloating",
    bullets: [
      "Bloating and discomfort don't have to be normal. They're often your body saying certain foods aren't working.",
      "Small, consistent changes can make a real difference in how you feel every day.",
    ],
    gutsyHelp: "Gutsy helps you track what you eat and how you feel so you can see what works for your body and reduce bloating for good.",
  },
  {
    title: "Gut & mood",
    bullets: [
      "Most of your feel-good serotonin is made in your gut. When your gut is off, your mood and energy pay the price.",
      "Sluggishness, irritability, and afternoon crashes often start with what’s on your plate.",
    ],
    gutsyHelp: "Gutsy helps you choose foods that keep you steady and energized instead of drained or anxious.",
  },
  {
    title: "Gut & digestion",
    bullets: [
      "Digestion is the foundation of how you absorb nutrients and feel after meals.",
      "The right balance of fiber, hydration, and mindful eating supports daily comfort.",
    ],
    gutsyHelp: "Gutsy tracks your meals and symptoms so you can spot patterns and improve your digestion over time.",
  },
];

const CARD_ANIM_DELAY = 400;
const CARD_STAGGER = 180;

function AnimatedCard({
  section,
  index,
}: {
  section: (typeof KNOWLEDGE_SECTIONS)[0];
  index: number;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(24);

  useEffect(() => {
    opacity.value = withDelay(
      CARD_ANIM_DELAY + index * CARD_STAGGER,
      withTiming(1, { duration: 400 })
    );
    translateY.value = withDelay(
      CARD_ANIM_DELAY + index * CARD_STAGGER,
      withSpring(0, { damping: 16, stiffness: 120 })
    );
  }, [index]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.topicCard, animatedStyle]}>
      <Text style={styles.topicTitle}>{section.title}</Text>
      <View style={styles.bulletList}>
        {section.bullets.map((bullet, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>{bullet}</Text>
          </View>
        ))}
      </View>
      <View style={styles.helpBox}>
        <Text style={styles.helpLabel}>How Gutsy helps</Text>
        <Text style={styles.helpText}>{section.gutsyHelp}</Text>
      </View>
    </Animated.View>
  );
}

export default function CreatingProfileScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/onboarding/all-set" as Href);
    }, LOADING_DURATION_MS);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.loaderSection}>
            <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
            <Text style={styles.loaderText}>Creating your gut profile...</Text>
          </View>

          <View style={styles.knowledgeSection}>
            <Text style={styles.sectionTitle}>Your gut affects everything</Text>
            <Text style={styles.sectionSubtitle}>
              See how your gut shapes your skin, mood, and daily comfort, and how Gutsy helps you take control.
            </Text>

            {KNOWLEDGE_SECTIONS.map((section, index) => (
              <AnimatedCard key={section.title} section={section} index={index} />
            ))}
          </View>
        </ScrollView>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.huge,
    paddingBottom: Spacing.massive,
    flexGrow: 1,
  },
  loaderSection: {
    alignItems: "center",
    marginBottom: Spacing.xxxl,
  },
  loader: {
    marginBottom: Spacing.lg,
  },
  loaderText: {
    fontFamily: Fonts.body,
    fontSize: 17,
    color: "#2E2E2E",
    lineHeight: 24,
  },
  knowledgeSection: {
    gap: Spacing.xxl,
  },
  sectionTitle: {
    fontFamily: Fonts.cardTitle,
    fontSize: 20,
    color: "#2E2E2E",
    lineHeight: 28,
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: "#6B7280",
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  topicCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: Spacing.xxl,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    ...Shadows.sm,
  },
  topicTitle: {
    fontFamily: Fonts.cardTitle,
    fontSize: 17,
    color: "#325C3A",
    lineHeight: 24,
    marginBottom: Spacing.md,
    textTransform: "capitalize",
  },
  bulletList: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  bullet: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: "#6B7280",
    lineHeight: 22,
  },
  bulletText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 15,
    color: "#2E2E2E",
    lineHeight: 22,
  },
  helpBox: {
    backgroundColor: "#F8F9F6",
    borderRadius: 12,
    padding: Spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: "#325C3A",
  },
  helpLabel: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: "#325C3A",
    marginBottom: Spacing.xs,
  },
  helpText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: "#2E2E2E",
    lineHeight: 20,
  },
});
