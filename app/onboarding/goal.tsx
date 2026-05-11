import ProgressBar from "@/components/onboarding/ProgressBar";
import { Fonts, ONBOARDING_TOTAL_STEPS, Shadows, Spacing } from "@/constants/theme";
import { rf, rs, useBreakpoint } from "@/lib/hooks/use-responsive";
import { saveOnboardingGoal } from "@/lib/onboarding-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const GOALS = [
  { id: "bloat", emoji: "🎈", label: "Reduce bloating" },
  { id: "skin", emoji: "✨", label: "Clear skin" },
  { id: "energy", emoji: "⚡", label: "More energy" },
  { id: "digestion", emoji: "🥗", label: "Better digestion" },
] as const;

const CURRENT_STEP = 10;

export default function GoalScreen() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const breakpoint = useBreakpoint();
  const isSmallScreen = breakpoint === "small";
  const isCompactScreen = breakpoint === "small" || breakpoint === "medium";

  const handleBack = () => {
    router.back();
  };

  const handleSelectGoal = (id: string, label: string) => {
    setSelectedId(id);
    saveOnboardingGoal(label).then(() => {
      router.push("/onboarding/triggers");
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        {/* Header: back + progress */}
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
              fillColor="#325C3A"
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
          <Text
            style={[styles.title, isCompactScreen ? styles.titleCompact : undefined, isSmallScreen ? styles.titleTight : undefined]}
          >
            What's your main goal?
          </Text>

          <View
            style={[
              styles.cards,
              isCompactScreen ? styles.cardsCompact : undefined,
              isSmallScreen ? styles.cardsTight : undefined,
            ]}
          >
            {GOALS.map((goal) => {
              const isSelected = selectedId === goal.id;
              return (
                <TouchableOpacity
                  key={goal.id}
                  activeOpacity={0.8}
                  onPress={() => handleSelectGoal(goal.id, goal.label)}
                  style={[
                    styles.card,
                    isCompactScreen ? styles.cardCompact : undefined,
                    isSmallScreen ? styles.cardTight : undefined,
                    isSelected && styles.cardSelected,
                  ]}
                >
                  <Text style={[styles.cardEmoji, isSmallScreen ? styles.cardEmojiTight : undefined]}>{goal.emoji}</Text>
                  <Text style={[styles.cardLabel, isSmallScreen ? styles.cardLabelTight : undefined]}>{goal.label}</Text>
                </TouchableOpacity>
              );
            })}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: rs(Spacing.lg),
    paddingTop: rs(Spacing.md),
    paddingBottom: rs(Spacing.xxl),
    gap: rs(Spacing.lg),
  },
  headerCompact: {
    paddingHorizontal: rs(Spacing.md),
    paddingBottom: rs(Spacing.xl),
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
    paddingBottom: rs(Spacing.massive),
    flexGrow: 1,
  },
  scrollContentCompact: {
    paddingHorizontal: rs(Spacing.xl),
    paddingTop: rs(Spacing.xxl),
  },
  scrollContentTight: {
    paddingHorizontal: rs(Spacing.lg),
    paddingTop: rs(Spacing.xxxl * 2),
    paddingBottom: rs(Spacing.xxl),
    alignItems: "center",
  },
  title: {
    fontFamily: Fonts.cardTitle,
    fontSize: rf(24),
    color: "#2E2E2E",
    marginBottom: rs(Spacing.xxxl),
    lineHeight: rf(32),
  },
  titleCompact: {
    fontSize: rf(22),
    marginBottom: rs(Spacing.xxl),
    textAlign: "center",
  },
  titleTight: {
    fontSize: rf(18),
    lineHeight: rf(26),
    marginBottom: rs(Spacing.xxxl),
    textAlign: "center",
  },
  cards: {
    gap: rs(18),
  },
  cardsCompact: {
    gap: rs(16),
  },
  cardsTight: {
    gap: rs(Spacing.xl),
    alignSelf: "stretch",
    alignItems: "stretch",
  },
  card: {
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
  cardCompact: {
    paddingVertical: rs(Spacing.lg),
    paddingHorizontal: rs(Spacing.xl),
  },
  cardTight: {
    paddingVertical: rs(Spacing.lg + 2),
    paddingHorizontal: rs(Spacing.xl),
    borderRadius: rs(16),
    alignSelf: "center",
    width: "100%",
    minHeight: rs(78),
  },
  cardSelected: {
    borderColor: "#325C3A",
  },
  cardEmoji: {
    fontSize: rf(28),
    marginRight: rs(Spacing.lg),
  },
  cardEmojiTight: {
    fontSize: rf(24),
    marginRight: rs(Spacing.md),
  },
  cardLabel: {
    fontFamily: Fonts.body,
    fontSize: rf(15),
    color: "#2E2E2E",
  },
  cardLabelTight: {
    fontSize: rf(13),
  },
});
