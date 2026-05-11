import OnboardingButton from "@/components/onboarding/OnboardingButton";
import ProgressBar from "@/components/onboarding/ProgressBar";
import { Fonts, ONBOARDING_TOTAL_STEPS, OnboardingButtonBar, Shadows, Spacing } from "@/constants/theme";
import { rf, rs, useBreakpoint } from "@/lib/hooks/use-responsive";
import { saveOnboardingSkinConcern } from "@/lib/onboarding-storage";
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
  const breakpoint = useBreakpoint();
  const isSmallScreen = breakpoint === "small";
  const isCompactScreen = breakpoint === "small" || breakpoint === "medium";

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
            Any skin concerns?
          </Text>

          <View
            style={[
              styles.cards,
              isCompactScreen ? styles.cardsCompact : undefined,
              isSmallScreen ? styles.cardsTight : undefined,
            ]}
          >
            {CONCERNS.map((concern) => {
              const isSelected = selectedIds.has(concern.id);
              return (
                <TouchableOpacity
                  key={concern.id}
                  activeOpacity={0.8}
                  onPress={() => toggleConcern(concern.id)}
                  style={[
                    styles.card,
                    isCompactScreen ? styles.cardCompact : undefined,
                    isSmallScreen ? styles.cardTight : undefined,
                    isSelected && styles.cardSelected,
                  ]}
                >
                  <Text style={[styles.cardLabel, isSmallScreen ? styles.cardLabelTight : undefined]}>{concern.label}</Text>
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
    paddingBottom: rs(Spacing.xl),
    gap: rs(Spacing.lg),
  },
  headerCompact: {
    paddingHorizontal: rs(Spacing.md),
    paddingBottom: rs(Spacing.lg),
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
    paddingBottom: rs(Spacing.xxl),
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
    gap: rs(Spacing.xl),
    marginBottom: rs(Spacing.xl),
  },
  cardsCompact: {
    gap: rs(Spacing.lg),
  },
  cardsTight: {
    gap: rs(Spacing.xl),
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
    lineHeight: rf(22),
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
