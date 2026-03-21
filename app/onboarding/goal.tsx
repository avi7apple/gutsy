import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ProgressBar from "@/components/onboarding/ProgressBar";
import { saveOnboardingGoal } from "@/lib/onboarding-storage";
import { Fonts, Spacing, Shadows, ONBOARDING_TOTAL_STEPS } from "@/constants/theme";

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
              fillColor="#325C3A"
            />
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>What's your main goal?</Text>

          <View style={styles.cards}>
            {GOALS.map((goal) => {
              const isSelected = selectedId === goal.id;
              return (
                <TouchableOpacity
                  key={goal.id}
                  activeOpacity={0.8}
                  onPress={() => handleSelectGoal(goal.id, goal.label)}
                  style={[
                    styles.card,
                    isSelected && styles.cardSelected,
                  ]}
                >
                  <Text style={styles.cardEmoji}>{goal.emoji}</Text>
                  <Text style={styles.cardLabel}>{goal.label}</Text>
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
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
    paddingBottom: Spacing.massive,
    flexGrow: 1,
  },
  title: {
    fontFamily: Fonts.cardTitle,
    fontSize: 24,
    color: "#2E2E2E",
    marginBottom: Spacing.xxxl,
    lineHeight: 32,
  },
  cards: {
    gap: 18,
  },
  card: {
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
  cardSelected: {
    borderColor: "#325C3A",
  },
  cardEmoji: {
    fontSize: 28,
    marginRight: Spacing.lg,
  },
  cardLabel: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: "#2E2E2E",
  },
});
