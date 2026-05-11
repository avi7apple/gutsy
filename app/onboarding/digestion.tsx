import ProgressBar from "@/components/onboarding/ProgressBar";
import { Fonts, ONBOARDING_TOTAL_STEPS, Shadows, Spacing } from "@/constants/theme";
import { rf, rs, useBreakpoint } from "@/lib/hooks/use-responsive";
import { saveOnboardingDigestion } from "@/lib/onboarding-storage";
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

const DIGESTION_OPTIONS = [
  { id: "irregular", label: "Irregular: cramping, constipation or urgency." },
  { id: "sluggish", label: "Sluggish: takes a while to feel settled." },
  { id: "usually_fine", label: "Usually fine but the occasional off day" },
  { id: "smooth", label: "Smooth and regular every day." },
] as const;

const CURRENT_STEP = 5;

export default function DigestionScreen() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const breakpoint = useBreakpoint();
  const isSmallScreen = breakpoint === "small";
  const isCompactScreen = breakpoint === "small" || breakpoint === "medium";

  const handleBack = () => {
    router.back();
  };

  const handleSelect = (id: string, label: string) => {
    setSelectedId(id);
    saveOnboardingDigestion(label).then(() => {
      router.push("/onboarding/energy-mood" as Href);
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.header, isCompactScreen && styles.headerCompact]}>
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
          contentContainerStyle={[
            styles.scrollContent,
            isCompactScreen && styles.scrollContentCompact,
            isSmallScreen && styles.scrollContentTight,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, isCompactScreen && styles.titleCompact, isSmallScreen && styles.titleTight]}>
            How would you describe your digestion?
          </Text>

          <View
            style={[
              styles.cards,
              isCompactScreen && styles.cardsCompact,
              isSmallScreen && styles.cardsTight,
            ]}
          >
            {DIGESTION_OPTIONS.map((option) => {
              const isSelected = selectedId === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  activeOpacity={0.8}
                  onPress={() => handleSelect(option.id, option.label)}
                  style={[
                    styles.card,
                    isCompactScreen && styles.cardCompact,
                    isSmallScreen && styles.cardTight,
                    isSelected && styles.cardSelected,
                  ]}
                >
                  <Text
                    style={[styles.cardLabel, isCompactScreen && styles.cardLabelCompact, isSmallScreen && styles.cardLabelTight]}
                  >
                    {option.label}
                  </Text>
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
    paddingBottom: rs(Spacing.xl),
    gap: rs(Spacing.md),
  },
  backButton: {
    width: rs(44),
    height: rs(44),
    borderRadius: rs(22),
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
    paddingHorizontal: rs(Spacing.xxl),
    paddingTop: rs(Spacing.xxxl),
    paddingBottom: rs(Spacing.massive),
    flexGrow: 1,
  },
  scrollContentCompact: {
    paddingHorizontal: rs(Spacing.xl),
    paddingTop: rs(Spacing.xxl),
    paddingBottom: rs(Spacing.xxxl),
  },
  scrollContentTight: {
    paddingHorizontal: rs(Spacing.lg),
    paddingTop: rs(Spacing.xxl),
    paddingBottom: rs(Spacing.xxl),
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
    lineHeight: rf(30),
    marginBottom: rs(Spacing.xxl),
    textAlign: "center",
  },
  titleTight: {
    fontSize: rf(18),
    lineHeight: rf(26),
    marginTop: rs(Spacing.lg),
    marginBottom: rs(Spacing.xl),
    textAlign: "center",
  },
  cards: {
    gap: rs(18),
  },
  cardsCompact: {
    gap: rs(18),
    marginTop: rs(Spacing.lg),
  },
  cardsTight: {
    gap: rs(16),
    marginTop: rs(Spacing.xl),
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    minHeight: rs(72),
    paddingVertical: rs(Spacing.xl),
    paddingHorizontal: rs(Spacing.xxl),
    borderRadius: rs(16),
    borderWidth: 1,
    borderColor: "#E5E7EB",
    ...Shadows.sm,
  },
  cardCompact: {
    minHeight: rs(78),
    paddingVertical: rs(Spacing.xl + 2),
    paddingHorizontal: rs(Spacing.xxl),
    borderRadius: rs(17),
  },
  cardTight: {
    minHeight: rs(82),
    paddingVertical: rs(Spacing.xl + 4),
    paddingHorizontal: rs(Spacing.xl),
    borderRadius: rs(18),
  },
  cardSelected: {
    borderColor: "#325C3A",
  },
  cardLabel: {
    fontFamily: Fonts.body,
    fontSize: rf(15),
    color: "#2E2E2E",
  },
  cardLabelCompact: {
    fontSize: rf(14),
    lineHeight: rf(20),
  },
  cardLabelTight: {
    fontSize: rf(13),
    lineHeight: rf(18),
  },
});
