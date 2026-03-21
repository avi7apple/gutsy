import React from "react";
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
import { saveOnboardingWater } from "@/lib/onboarding-storage";
import { Fonts, Spacing, Shadows, ONBOARDING_TOTAL_STEPS } from "@/constants/theme";

const WATER_OPTIONS = [
  { id: "under4", emoji: "💧", label: "<4 glasses" },
  { id: "4to6", emoji: "💧💧", label: "4-6 glasses" },
  { id: "6to8", emoji: "💧💧💧", label: "6-8 glasses" },
  { id: "8plus", emoji: "💧💧💧💧", label: "8+ glasses" },
] as const;

const CURRENT_STEP = 13;

export default function WaterScreen() {
  const router = useRouter();

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
          <Text style={styles.title}>
            How much water do you drink daily?
          </Text>

          <View style={styles.cards}>
            {WATER_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.id}
                activeOpacity={0.8}
                onPress={() => handleSelect(option.label)}
                style={styles.card}
              >
                <Text style={styles.cardEmoji}>{option.emoji}</Text>
                <Text style={styles.cardLabel}>{option.label}</Text>
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
