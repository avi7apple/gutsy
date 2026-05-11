import OnboardingButton from "@/components/onboarding/OnboardingButton";
import { Fonts, OnboardingButtonBar, Shadows, Spacing } from "@/constants/theme";
import { rf, rs, useBreakpoint } from "@/lib/hooks/use-responsive";
import { getOnboardingProfile, type OnboardingProfile } from "@/lib/onboarding-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from "react-native";

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
  isSmallScreen,
}: {
  emoji: string;
  label: string;
  value: string | null;
  isSmallScreen: boolean;
}) {
  const display = value && value.trim() !== "" ? value : "Not set";
  return (
    <View style={[styles.profileRow, isSmallScreen ? styles.profileRowTight : undefined]}>
      <Text style={styles.profileRowEmoji}>{emoji}</Text>
      <Text style={[styles.profileRowLabel, isSmallScreen ? styles.profileRowLabelTight : undefined]}>{label}</Text>
      <Text style={[styles.profileRowValue, isSmallScreen ? styles.profileRowValueTight : undefined]} numberOfLines={1}>
        {display}
      </Text>
    </View>
  );
}

export default function AllSetScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const breakpoint = useBreakpoint();
  const isSmallScreen = breakpoint === "small";
  const isCompactScreen = breakpoint === "small" || breakpoint === "medium";

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
          contentContainerStyle={[
            styles.scrollContent,
            isCompactScreen ? styles.scrollContentCompact : undefined,
            isSmallScreen ? styles.scrollContentTight : undefined,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[styles.checkSection, isCompactScreen ? styles.checkSectionCompact : undefined, isSmallScreen ? styles.checkSectionTight : undefined]}
          >
            <View style={[styles.checkCircle, isSmallScreen ? styles.checkCircleTight : undefined]}>
              <Ionicons name="checkmark" size={isSmallScreen ? 36 : 48} color="#325C3A" />
            </View>
            <Text style={[styles.title, isSmallScreen ? styles.titleTight : undefined]}>You're all set! 🎉</Text>
            <Text style={[styles.subtitle, isSmallScreen ? styles.subtitleTight : undefined]}>Here's your personalized profile:</Text>
          </View>

          <View style={[styles.profileCard, isSmallScreen ? styles.profileCardTight : undefined]}>
            <ProfileRow emoji="🎯" label="Goal:" value={profile?.goal ?? null} isSmallScreen={isSmallScreen} />
            <View style={styles.profileCardDivider} />
            <ProfileRow
              emoji="✨"
              label="Skin type:"
              value={profile?.skinType ?? null}
              isSmallScreen={isSmallScreen}
            />
            <View style={styles.profileCardDivider} />
            <ProfileRow
              emoji="💧"
              label="Water:"
              value={profile?.water ?? null}
              isSmallScreen={isSmallScreen}
            />
            <View style={styles.profileCardDivider} />
            <ProfileRow
              emoji="⚠️"
              label="Triggers:"
              value={profile?.trigger ?? null}
              isSmallScreen={isSmallScreen}
            />
          </View>

          <View style={styles.divider} />

          <View style={[styles.productSection, isSmallScreen ? styles.productSectionTight : undefined]}>
            <View
              style={[
                styles.productSectionInner,
                isSmallScreen ? styles.productSectionInnerTight : undefined,
              ]}
            >
              <Text style={[styles.sectionTitle, isSmallScreen ? styles.sectionTitleTight : undefined]}>⭐ For every product, you'll see:</Text>
              <View
                style={[
                  styles.bulletList,
                  isSmallScreen ? styles.bulletListTight : undefined,
                  isSmallScreen ? styles.bulletListAlignStart : undefined,
                ]}
              >
                {PRODUCT_BULLETS.map((item) => (
                  <View key={item} style={styles.bulletRow}>
                    <View style={[styles.bulletCheckBox, isSmallScreen ? styles.bulletCheckBoxTight : undefined]}>
                      <Text style={[styles.bulletCheck, isSmallScreen ? styles.bulletCheckTight : undefined]}>✓</Text>
                    </View>
                    <Text style={[styles.bulletText, isSmallScreen ? styles.bulletTextTight : undefined]}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>

        <View
          style={[styles.buttonContainer, isCompactScreen ? styles.buttonContainerCompact : undefined, isSmallScreen ? styles.buttonContainerTight : undefined]}
        >
          <Text style={[styles.analyzeText, isSmallScreen ? styles.analyzeTextTight : undefined]}>
            We'll analyze every product based on YOUR body
          </Text>
          <OnboardingButton
            title="Scan my first product →"
            onPress={handleScanProduct}
            style={styles.button}
            textStyle={isSmallScreen ? styles.buttonLabelTight : undefined}
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
    paddingHorizontal: rs(Spacing.xxl),
    paddingTop: rs(Spacing.xxxl),
    paddingBottom: rs(Spacing.xl),
  },
  scrollContentCompact: {
    paddingHorizontal: rs(Spacing.xl),
  },
  scrollContentTight: {
    paddingHorizontal: rs(Spacing.lg),
    paddingTop: rs(Spacing.xxxl * 1.4),
    paddingBottom: rs(Spacing.xl),
  },
  checkSection: {
    alignItems: "center",
    marginBottom: rs(Spacing.xxl),
  },
  checkSectionCompact: {
    marginBottom: rs(Spacing.xl),
  },
  checkSectionTight: {
    marginBottom: rs(Spacing.lg),
  },
  checkCircle: {
    width: rs(88),
    height: rs(88),
    borderRadius: rs(44),
    backgroundColor: "#E6EFE9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: rs(Spacing.lg),
  },
  checkCircleTight: {
    width: rs(70),
    height: rs(70),
    borderRadius: rs(35),
  },
  title: {
    fontFamily: Fonts.cardTitle,
    fontSize: rf(26),
    color: "#2E2E2E",
    lineHeight: rf(34),
    marginBottom: rs(Spacing.sm),
    textAlign: "center",
  },
  titleTight: {
    fontSize: rf(20),
    lineHeight: rf(28),
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: rf(16),
    color: "#6B7280",
    lineHeight: rf(24),
    textAlign: "center",
  },
  subtitleTight: {
    fontSize: rf(14),
    lineHeight: rf(20),
  },
  profileCard: {
    backgroundColor: "#E6F0E2",
    borderRadius: rs(16),
    borderWidth: 2,
    borderColor: "#325C3A",
    padding: rs(Spacing.xxl),
    marginBottom: rs(Spacing.xxl),
  },
  profileCardTight: {
    padding: rs(Spacing.lg),
    marginBottom: rs(Spacing.xl),
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
  profileRowTight: {
    gap: Spacing.xs,
  },
  profileRowEmoji: {
    fontSize: rf(18),
  },
  profileRowLabel: {
    fontFamily: Fonts.body,
    fontSize: rf(15),
    color: "#2E2E2E",
    minWidth: rs(88),
  },
  profileRowLabelTight: {
    fontSize: rf(12),
    minWidth: rs(65),
  },
  profileRowValue: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: rf(15),
    color: "#2E2E2E",
  },
  profileRowValueTight: {
    fontSize: rf(12),
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
  productSectionTight: {
    marginBottom: Spacing.lg,
  },
  productSectionInner: {
    alignSelf: "center",
  },
  productSectionInnerTight: {
    alignItems: "flex-start",
  },
  sectionTitle: {
    fontFamily: Fonts.cardTitle,
    fontSize: rf(18),
    color: "#2E2E2E",
    lineHeight: rf(26),
    marginBottom: rs(Spacing.lg),
    textAlign: "left",
  },
  sectionTitleTight: {
    fontSize: rf(15),
    textAlign: "left",
  },
  bulletList: {
    gap: Spacing.md,
  },
  bulletListTight: {
    gap: Spacing.sm,
  },
  bulletListAlignStart: {
    alignItems: "flex-start",
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bulletCheckBox: {
    width: rs(22),
    alignItems: "center",
    justifyContent: "center",
  },
  bulletCheckBoxTight: {
    width: rs(18),
  },
  bulletCheck: {
    fontFamily: Fonts.body,
    fontSize: rf(16),
    color: "#325C3A",
  },
  bulletCheckTight: {
    fontSize: rf(13),
  },
  bulletText: {
    fontFamily: Fonts.body,
    fontSize: rf(15),
    color: "#2E2E2E",
    lineHeight: rf(22),
  },
  bulletTextTight: {
    fontSize: rf(12),
    lineHeight: rf(18),
  },
  buttonContainer: {
    paddingHorizontal: rs(OnboardingButtonBar.paddingHorizontal),
    paddingTop: rs(OnboardingButtonBar.paddingTop),
    paddingBottom: rs(OnboardingButtonBar.paddingBottom),
  },
  buttonContainerCompact: {
    paddingHorizontal: rs(OnboardingButtonBar.paddingHorizontal - Spacing.sm),
  },
  buttonContainerTight: {
    paddingHorizontal: rs(OnboardingButtonBar.paddingHorizontal - Spacing.md),
    paddingBottom: rs(OnboardingButtonBar.paddingBottom - Spacing.sm),
  },
  analyzeText: {
    fontFamily: Fonts.body,
    fontSize: rf(15),
    color: "#6B7280",
    lineHeight: rf(22),
    marginBottom: rs(Spacing.lg),
    textAlign: "center",
  },
  analyzeTextTight: {
    fontSize: rf(13),
    lineHeight: rf(18),
    marginBottom: rs(Spacing.md),
  },
  button: {
    backgroundColor: "#325C3A",
    ...Shadows.md,
  },
  buttonLabelTight: {
    fontSize: rf(14),
    lineHeight: rf(18),
  },
});
