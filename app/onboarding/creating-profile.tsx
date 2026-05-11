import { Colors, Fonts, Shadows, Spacing } from "@/constants/theme";
import { rf, rs } from "@/lib/hooks/use-responsive";
import { useRouter, type Href } from "expo-router";
import React, { useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
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
const MIN_SCREEN_WIDTH = 390;
const BASE_SCREEN_WIDTH = 430;
const SMALL_SCREEN_THRESHOLD = 400;
const SMALL_SPACING_MULTIPLIER = 1.08;
const SMALL_FONT_MULTIPLIER = 1.1;

type ProfileStyles = ReturnType<typeof createStyles>;

function AnimatedCard({
  section,
  index,
  styles,
}: {
  section: (typeof KNOWLEDGE_SECTIONS)[0];
  index: number;
  styles: ProfileStyles;
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
  const { width } = useWindowDimensions();
  const clampedWidth = Math.min(Math.max(width, MIN_SCREEN_WIDTH), BASE_SCREEN_WIDTH);
  const widthProgress = (clampedWidth - MIN_SCREEN_WIDTH) / (BASE_SCREEN_WIDTH - MIN_SCREEN_WIDTH);
  const isSmallWidth = clampedWidth <= SMALL_SCREEN_THRESHOLD;
  const spacingScaleBase = 0.65 + widthProgress * 0.35;
  const fontScaleBase = 0.75 + widthProgress * 0.25;
  const spacingScale = spacingScaleBase * (isSmallWidth ? SMALL_SPACING_MULTIPLIER : 1);
  const fontScale = fontScaleBase * (isSmallWidth ? SMALL_FONT_MULTIPLIER : 1);
  const styles = useMemo(() => createStyles(spacingScale, fontScale), [spacingScale, fontScale]);

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
            <Text style={styles.loaderText}>
              Creating your gut profile...
            </Text>
          </View>

          <View style={styles.knowledgeSection}>
            <Text style={styles.sectionTitle}>
              Your gut affects everything
            </Text>
            <Text style={styles.sectionSubtitle}>
              See how your gut shapes your skin, mood, and daily comfort, and how Gutsy helps you take control.
            </Text>

            {KNOWLEDGE_SECTIONS.map((section, index) => (
              <AnimatedCard key={section.title} section={section} index={index} styles={styles} />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (spacingScale: number, fontScale: number) => {
  const scaleSpace = (value: number) => Math.round(rs(value) * spacingScale);
  const scaleFont = (value: number) => Math.round(rf(value) * fontScale);
  const scaleRadius = (value: number) => Math.round(rs(value) * spacingScale);
  const borderLeft = Math.max(1, Math.round(spacingScale * 2));

  return StyleSheet.create({
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
      paddingHorizontal: scaleSpace(Spacing.xxl),
      paddingTop: scaleSpace(Spacing.huge),
      paddingBottom: scaleSpace(Spacing.massive),
      flexGrow: 1,
    },
    loaderSection: {
      alignItems: "center",
      marginBottom: scaleSpace(Spacing.xxxl),
    },
    loader: {
      marginBottom: scaleSpace(Spacing.lg),
    },
    loaderText: {
      fontFamily: Fonts.body,
      fontSize: scaleFont(17),
      color: "#2E2E2E",
      lineHeight: scaleFont(24),
      textAlign: "center",
    },
    knowledgeSection: {
      gap: scaleSpace(Spacing.xxl),
    },
    sectionTitle: {
      fontFamily: Fonts.cardTitle,
      fontSize: scaleFont(20),
      color: "#2E2E2E",
      lineHeight: scaleFont(28),
      marginBottom: scaleSpace(Spacing.xs),
      textAlign: "center",
    },
    sectionSubtitle: {
      fontFamily: Fonts.body,
      fontSize: scaleFont(15),
      color: "#6B7280",
      lineHeight: scaleFont(22),
      marginBottom: scaleSpace(Spacing.xl),
      textAlign: "center",
    },
    topicCard: {
      backgroundColor: "#FFFFFF",
      borderRadius: scaleRadius(16),
      paddingVertical: scaleSpace(Spacing.xl),
      paddingHorizontal: scaleSpace(Spacing.xxl),
      borderWidth: Math.max(1, Math.round(spacingScale)),
      borderColor: "#E5E7EB",
      ...Shadows.sm,
    },
    topicTitle: {
      fontFamily: Fonts.cardTitle,
      fontSize: scaleFont(17),
      color: "#325C3A",
      lineHeight: scaleFont(24),
      marginBottom: scaleSpace(Spacing.md),
      textTransform: "capitalize",
      textAlign: "left",
    },
    bulletList: {
      gap: scaleSpace(Spacing.sm),
      marginBottom: scaleSpace(Spacing.lg),
    },
    bulletRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: scaleSpace(Spacing.sm),
    },
    bullet: {
      fontFamily: Fonts.body,
      fontSize: scaleFont(15),
      color: "#6B7280",
      lineHeight: scaleFont(22),
    },
    bulletText: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: scaleFont(15),
      color: "#2E2E2E",
      lineHeight: scaleFont(22),
    },
    helpBox: {
      backgroundColor: "#F8F9F6",
      borderRadius: scaleRadius(12),
      paddingVertical: scaleSpace(Spacing.md),
      paddingHorizontal: scaleSpace(Spacing.lg),
      borderLeftWidth: borderLeft,
      borderLeftColor: "#325C3A",
    },
    helpLabel: {
      fontFamily: Fonts.body,
      fontSize: scaleFont(13),
      color: "#325C3A",
      marginBottom: scaleSpace(Spacing.xs),
    },
    helpText: {
      fontFamily: Fonts.body,
      fontSize: scaleFont(14),
      color: "#2E2E2E",
      lineHeight: scaleFont(20),
    },
  });
};
