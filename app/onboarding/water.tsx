import ProgressBar from "@/components/onboarding/ProgressBar";
import { Fonts, ONBOARDING_TOTAL_STEPS, Shadows, Spacing } from "@/constants/theme";
import { rf, rs, useBreakpoint } from "@/lib/hooks/use-responsive";
import { saveOnboardingWater } from "@/lib/onboarding-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import React from "react";
import {
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const WATER_OPTIONS = [
  { id: "under4", emoji: "💧", label: "<4 glasses" },
  { id: "4to6", emoji: "💧💧", label: "4-6 glasses" },
  { id: "6to8", emoji: "💧💧💧", label: "6-8 glasses" },
  { id: "8plus", emoji: "💧💧💧💧", label: "8+ glasses" },
] as const;

const CURRENT_STEP = 13;

export default function WaterScreen() {
  const router = useRouter();
  const breakpoint = useBreakpoint();
  const isSmallScreen = breakpoint === "small";
  const isCompactScreen = breakpoint === "small" || breakpoint === "medium";

  const handleBack = () => {
    router.back();
  };

  const handleSelect = (label: string) => {
    saveOnboardingWater(label).then(() => {
      router.push("/onboarding/success" as Href);
    });
  };

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
            How much water do you drink daily?
          </Text>

          <View
            style={[
              styles.cards,
              isCompactScreen ? styles.cardsCompact : undefined,
              isSmallScreen ? styles.cardsTight : undefined,
            ]}
          >
            {WATER_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.id}
                activeOpacity={0.8}
                onPress={() => handleSelect(option.label)}
                style={[
                  styles.card,
                  isCompactScreen ? styles.cardCompact : undefined,
                  isSmallScreen ? styles.cardTight : undefined,
                ]}
              >
                <Text style={[styles.cardEmoji, isSmallScreen ? styles.cardEmojiTight : undefined]}>{option.emoji}</Text>
                <Text style={[styles.cardLabel, isSmallScreen ? styles.cardLabelTight : undefined]}>{option.label}</Text>
              </TouchableOpacity>
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
    paddingBottom: rs(Spacing.massive),
    flexGrow: 1,
  },
  scrollContentCompact: {
    paddingHorizontal: rs(Spacing.xl),
    paddingTop: rs(Spacing.xxxl),
  },
  scrollContentTight: {
    paddingHorizontal: rs(Spacing.lg),
    paddingTop: rs(Spacing.xxxl * 2),
    paddingBottom: rs(Spacing.xxxl),
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
    gap: rs(Spacing.lg),
  },
  cardsTight: {
    gap: rs(Spacing.xl),
    alignSelf: "stretch",
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
