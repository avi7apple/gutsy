import OnboardingButton from "@/components/onboarding/OnboardingButton";
import ProgressBar from "@/components/onboarding/ProgressBar";
import { Fonts, ONBOARDING_TOTAL_STEPS, OnboardingButtonBar, Shadows, Spacing } from "@/constants/theme";
import { rf, rs, useBreakpoint } from "@/lib/hooks/use-responsive";
import { saveOnboardingTrigger } from "@/lib/onboarding-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
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

const TRIGGERS = [
  { id: "dairy", label: "Dairy products" },
  { id: "gluten", label: "Gluten / wheat" },
  { id: "beans", label: "Beans & legumes" },
  { id: "spicy", label: "Spicy food" },
  { id: "carbonated", label: "Carbonated drinks" },
  { id: "sweeteners", label: "Artificial sweeteners" },
  { id: "notsure", label: "Not sure yet" },
] as const;

const CURRENT_STEP = 11;

export default function TriggersScreen() {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const breakpoint = useBreakpoint();
  const isSmallScreen = breakpoint === "small";
  const isCompactScreen = breakpoint === "small" || breakpoint === "medium";

  const handleBack = () => {
    router.back();
  };

  const toggleTrigger = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (id === "notsure") {
        if (next.has("notsure")) next.delete("notsure");
        else return new Set(["notsure"]);
        return next;
      }
      if (next.has(id)) next.delete(id);
      else {
        next.delete("notsure");
        next.add(id);
      }
      return next;
    });
  };

  const handleContinue = () => {
    if (selectedIds.size > 0) {
      const firstId = Array.from(selectedIds)[0];
      const label = TRIGGERS.find((t) => t.id === firstId)?.label ?? firstId;
      saveOnboardingTrigger(label).then(() => {
        router.push("/onboarding/skin-concerns" as Href);
      });
    }
  };

  const hasSelection = selectedIds.size > 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
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
          keyboardShouldPersistTaps="handled"
        >
          <Text
            style={[styles.title, isCompactScreen ? styles.titleCompact : undefined, isSmallScreen ? styles.titleTight : undefined]}
          >
            Any foods that bother you?
          </Text>

          <View
            style={[
              styles.cards,
              isCompactScreen ? styles.cardsCompact : undefined,
              isSmallScreen ? styles.cardsTight : undefined,
            ]}
          >
            {TRIGGERS.map((trigger) => {
              const isSelected = selectedIds.has(trigger.id);
              return (
                <TouchableOpacity
                  key={trigger.id}
                  activeOpacity={0.8}
                  onPress={() => toggleTrigger(trigger.id)}
                  style={[
                    styles.card,
                    isCompactScreen ? styles.cardCompact : undefined,
                    isSmallScreen ? styles.cardTight : undefined,
                    isSelected && styles.cardSelected,
                  ]}
                >
                  <Text style={[styles.cardLabel, isSmallScreen ? styles.cardLabelTight : undefined]}>{trigger.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View
          style={[
            styles.buttonContainer,
            isCompactScreen ? styles.buttonContainerCompact : undefined,
            isSmallScreen ? styles.buttonContainerTight : undefined,
          ]}
        >
          <OnboardingButton
            title="Continue"
            onPress={handleContinue}
            disabled={!hasSelection}
            style={styles.continueButton}
            textStyle={isSmallScreen ? styles.buttonLabelTight : undefined}
            disabledBackgroundColor="#A8B8AD"
          />
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
    paddingHorizontal: rs(Spacing.lg),
    paddingTop: rs(Spacing.md),
    paddingBottom: rs(Spacing.lg),
    gap: rs(Spacing.lg),
  },
  headerCompact: {
    paddingHorizontal: rs(Spacing.md),
    paddingBottom: rs(Spacing.md),
  },
  headerTight: {
    paddingHorizontal: rs(Spacing.md),
    paddingTop: rs(Spacing.sm),
    paddingBottom: rs(Spacing.md),
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
    paddingTop: rs(Spacing.xxl),
    paddingBottom: rs(Spacing.xl),
  },
  scrollContentCompact: {
    paddingHorizontal: rs(Spacing.xl),
    paddingTop: rs(Spacing.xxl),
  },
  scrollContentTight: {
    paddingHorizontal: rs(Spacing.lg),
    paddingTop: rs(Spacing.xxxl),
    paddingBottom: rs(Spacing.xxl),
    alignItems: "center",
  },
  title: {
    fontFamily: Fonts.cardTitle,
    fontSize: rf(24),
    color: "#2E2E2E",
    marginBottom: rs(Spacing.xxl),
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
    gap: rs(Spacing.lg),
    marginBottom: rs(Spacing.xl),
  },
  cardsCompact: {
    gap: rs(Spacing.md),
  },
  cardsTight: {
    gap: rs(Spacing.md + 4),
    alignSelf: "stretch",
  },
  card: {
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
  },
  cardSelected: {
    borderColor: "#325C3A",
  },
  cardLabel: {
    fontFamily: Fonts.body,
    fontSize: rf(15),
    color: "#2E2E2E",
  },
  cardLabelTight: {
    fontSize: rf(13),
  },
  buttonContainer: {
    paddingTop: rs(OnboardingButtonBar.paddingTop),
    paddingBottom: rs(OnboardingButtonBar.paddingBottom),
    paddingHorizontal: rs(OnboardingButtonBar.paddingHorizontal),
  },
  buttonContainerCompact: {
    paddingHorizontal: rs(OnboardingButtonBar.paddingHorizontal - Spacing.sm),
  },
  buttonContainerTight: {
    paddingHorizontal: rs(OnboardingButtonBar.paddingHorizontal - Spacing.md),
    paddingBottom: rs(OnboardingButtonBar.paddingBottom - Spacing.sm),
  },
  continueButton: {
    ...Shadows.md,
  },
  buttonLabelTight: {
    fontSize: rf(13),
    lineHeight: rf(18),
  },
});
