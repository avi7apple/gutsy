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
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ProgressBar from "@/components/onboarding/ProgressBar";
import OnboardingButton from "@/components/onboarding/OnboardingButton";
import { saveOnboardingTrigger } from "@/lib/onboarding-storage";
import { Fonts, Spacing, Shadows, OnboardingButtonBar, ONBOARDING_TOTAL_STEPS } from "@/constants/theme";

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
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Any foods that bother you?</Text>

          <View style={styles.cards}>
            {TRIGGERS.map((trigger) => {
              const isSelected = selectedIds.has(trigger.id);
              return (
                <TouchableOpacity
                  key={trigger.id}
                  activeOpacity={0.8}
                  onPress={() => toggleTrigger(trigger.id)}
                  style={[styles.card, isSelected && styles.cardSelected]}
                >
                  <Text style={styles.cardLabel}>{trigger.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.buttonContainer}>
          <OnboardingButton
            title="Continue"
            onPress={handleContinue}
            disabled={!hasSelection}
            style={styles.continueButton}
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
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
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
  },
  title: {
    fontFamily: Fonts.cardTitle,
    fontSize: 24,
    color: "#2E2E2E",
    marginBottom: Spacing.xxl,
    lineHeight: 32,
  },
  cards: {
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  card: {
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
  cardLabel: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: "#2E2E2E",
  },
  buttonContainer: {
    ...OnboardingButtonBar,
  },
  continueButton: {
    ...Shadows.md,
  },
});
