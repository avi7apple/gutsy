import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import OnboardingButton from "@/components/onboarding/OnboardingButton";
import { getOnboardingProfile, type OnboardingProfile } from "@/lib/onboarding-storage";
import { Fonts, Spacing, Shadows, OnboardingButtonBar } from "@/constants/theme";

const PRODUCT_BULLETS = [
  "How it affects YOUR skin",
  "Bloating prediction",
  "Energy impact",
  "Better alternatives",
];

function ProfileRow({
  emoji,
  label,
  value,
}: {
  emoji: string;
  label: string;
  value: string | null;
}) {
  const display = value && value.trim() !== "" ? value : "Not set";
  return (
    <View style={styles.profileRow}>
      <Text style={styles.profileRowEmoji}>{emoji}</Text>
      <Text style={styles.profileRowLabel}>{label}</Text>
      <Text style={styles.profileRowValue} numberOfLines={1}>
        {display}
      </Text>
    </View>
  );
}

export default function AllSetScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);

  useEffect(() => {
    getOnboardingProfile().then(setProfile);
  }, []);

  const handleScanProduct = () => {
    router.replace("/onboarding/scan" as Href);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.checkSection}>
            <View style={styles.checkCircle}>
              <Ionicons name="checkmark" size={48} color="#325C3A" />
            </View>
            <Text style={styles.title}>You're all set! 🎉</Text>
            <Text style={styles.subtitle}>Here's your personalized profile:</Text>
          </View>

          <View style={styles.profileCard}>
            <ProfileRow emoji="🎯" label="Goal:" value={profile?.goal ?? null} />
            <View style={styles.profileCardDivider} />
            <ProfileRow
              emoji="✨"
              label="Skin type:"
              value={profile?.skinType ?? null}
            />
            <View style={styles.profileCardDivider} />
            <ProfileRow
              emoji="💧"
              label="Water:"
              value={profile?.water ?? null}
            />
            <View style={styles.profileCardDivider} />
            <ProfileRow
              emoji="⚠️"
              label="Triggers:"
              value={profile?.trigger ?? null}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.productSection}>
            <View style={styles.productSectionInner}>
              <Text style={styles.sectionTitle}>⭐ For every product, you'll see:</Text>
              <View style={styles.bulletList}>
                {PRODUCT_BULLETS.map((item) => (
                  <View key={item} style={styles.bulletRow}>
                    <View style={styles.bulletCheckBox}>
                      <Text style={styles.bulletCheck}>✓</Text>
                    </View>
                    <Text style={styles.bulletText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.buttonContainer}>
          <Text style={styles.analyzeText}>
            We'll analyze every product based on YOUR body
          </Text>
          <OnboardingButton
            title="Scan my first product →"
            onPress={handleScanProduct}
            style={styles.button}
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.xl,
  },
  checkSection: {
    alignItems: "center",
    marginBottom: Spacing.xxl,
  },
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#E6EFE9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: Fonts.cardTitle,
    fontSize: 26,
    color: "#2E2E2E",
    lineHeight: 34,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 16,
    color: "#6B7280",
    lineHeight: 24,
    textAlign: "center",
  },
  profileCard: {
    backgroundColor: "#E6F0E2",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#325C3A",
    padding: Spacing.xxl,
    marginBottom: Spacing.xxl,
  },
  profileCardDivider: {
    height: 1,
    backgroundColor: "#325C3A",
    opacity: 0.25,
    marginVertical: Spacing.sm,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  profileRowEmoji: {
    fontSize: 18,
  },
  profileRowLabel: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: "#2E2E2E",
    minWidth: 88,
  },
  profileRowValue: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 15,
    color: "#2E2E2E",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginBottom: Spacing.xxl,
  },
  productSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  productSectionInner: {
    alignSelf: "center",
  },
  sectionTitle: {
    fontFamily: Fonts.cardTitle,
    fontSize: 18,
    color: "#2E2E2E",
    lineHeight: 26,
    marginBottom: Spacing.lg,
    textAlign: "left",
  },
  bulletList: {
    gap: Spacing.md,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bulletCheckBox: {
    width: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  bulletCheck: {
    fontFamily: Fonts.body,
    fontSize: 16,
    color: "#325C3A",
  },
  bulletText: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: "#2E2E2E",
    lineHeight: 22,
  },
  buttonContainer: {
    paddingHorizontal: OnboardingButtonBar.paddingHorizontal,
    paddingTop: OnboardingButtonBar.paddingTop,
    paddingBottom: OnboardingButtonBar.paddingBottom,
  },
  analyzeText: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: "#6B7280",
    lineHeight: 22,
    marginBottom: Spacing.lg,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#325C3A",
    ...Shadows.md,
  },
});
