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
import { saveOnboardingSkinConcern } from "@/lib/onboarding-storage";
import { Fonts, Spacing, Shadows, OnboardingButtonBar, ONBOARDING_TOTAL_STEPS } from "@/constants/theme";

const CONCERNS = [
  { id: "acne", label: "Acne or breakouts" },
  { id: "dullness", label: "Dullness or uneven tone" },
  { id: "redness", label: "Redness or sensitivity" },
  { id: "darkcircles", label: "Dark circles or puffiness" },
  { id: "none", label: "None - my skin is great!" },
] as const;

const CURRENT_STEP = 12;

export default function SkinConcernsScreen() {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleBack = () => {
    router.back();
  };

  const toggleConcern = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (id === "none") {
        if (next.has("none")) next.delete("none");
        else return new Set(["none"]);
        return next;
      }
      if (next.has(id)) next.delete(id);
      else {
        next.delete("none");
        next.add(id);
      }
      return next;
    });
  };

  const handleContinue = () => {
    if (selectedIds.size > 0) {
      const firstId = Array.from(selectedIds)[0];
      const label = CONCERNS.find((c) => c.id === firstId)?.label ?? firstId;
      saveOnboardingSkinConcern(label).then(() => {
        router.push("/onboarding/water" as Href);
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
        >
          <Text style={styles.title}>Any skin concerns?</Text>

          <View style={styles.cards}>
            {CONCERNS.map((concern) => {
              const isSelected = selectedIds.has(concern.id);
              return (
                <TouchableOpacity
                  key={concern.id}
                  activeOpacity={0.8}
                  onPress={() => toggleConcern(concern.id)}
                  style={[styles.card, isSelected && styles.cardSelected]}
                >
                  <Text style={styles.cardLabel}>{concern.label}</Text>
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
    paddingBottom: Spacing.xl,
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
    paddingBottom: Spacing.xxl,
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
    gap: Spacing.xl,
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
    lineHeight: 22,
  },
  buttonContainer: {
    ...OnboardingButtonBar,
  },
  continueButton: {
    ...Shadows.md,
  },
});
