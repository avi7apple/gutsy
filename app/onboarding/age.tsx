import OnboardingButton from "@/components/onboarding/OnboardingButton";
import ProgressBar from "@/components/onboarding/ProgressBar";
import { Fonts, ONBOARDING_TOTAL_STEPS, OnboardingButtonBar, Shadows, Spacing } from "@/constants/theme";
import { rf, rs, useBreakpoint } from "@/lib/hooks/use-responsive";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const AGES = Array.from({ length: 88 }, (_, i) => i + 13);
const ROW_HEIGHT = rs(52);
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;
const DEFAULT_AGE = 25;
const DEFAULT_INDEX = AGES.indexOf(DEFAULT_AGE);
const CURRENT_STEP = 16;

export default function AgeScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [selectedAge, setSelectedAge] = useState<number | null>(null);
  const breakpoint = useBreakpoint();
  const isSmallScreen = breakpoint === "small";
  const isCompactScreen = breakpoint === "small" || breakpoint === "medium";

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: DEFAULT_INDEX * ROW_HEIGHT,
        animated: false,
      });
      setSelectedAge(DEFAULT_AGE);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleBack = () => {
    router.back();
  };

  const computeSelectedIndex = useCallback((contentOffsetY: number) => {
    const centerY = WHEEL_HEIGHT / 2;
    const spacerHeight = ROW_HEIGHT * 2;
    const contentCenter = contentOffsetY + centerY;
    const index = Math.floor((contentCenter - spacerHeight) / ROW_HEIGHT);
    return Math.max(0, Math.min(index, AGES.length - 1));
  }, []);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const index = computeSelectedIndex(y);
      setSelectedAge(AGES[index]);
    },
    [computeSelectedIndex]
  );

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const index = computeSelectedIndex(y);
      setSelectedAge(AGES[index]);
    },
    [computeSelectedIndex]
  );

  const handleContinue = () => {
    if (selectedAge !== null) {
      router.push("/onboarding/activity" as Href);
    }
  };

  const hasSelection = selectedAge !== null;

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

        <View
          style={[styles.content, isCompactScreen ? styles.contentCompact : undefined, isSmallScreen ? styles.contentTight : undefined]}
        >
          <Text
            style={[styles.title, isCompactScreen ? styles.titleCompact : undefined, isSmallScreen ? styles.titleTight : undefined]}
          >
            What is your age?
          </Text>

          <View style={[styles.wheelWrapper, isSmallScreen ? styles.wheelWrapperTight : undefined]}>
            <View style={styles.wheelHighlight} pointerEvents="none" />
            <ScrollView
              ref={scrollRef}
              style={styles.wheel}
              contentContainerStyle={styles.wheelContent}
              showsVerticalScrollIndicator={false}
              snapToInterval={ROW_HEIGHT}
              snapToAlignment="center"
              decelerationRate="fast"
              onScroll={handleScroll}
              onMomentumScrollEnd={handleScrollEnd}
              onScrollEndDrag={handleScrollEnd}
              scrollEventThrottle={16}
            >
              <View style={styles.wheelSpacer} />
              {AGES.map((age) => (
                <View key={age} style={[styles.wheelRow, isSmallScreen ? styles.wheelRowTight : undefined]}>
                  <Text
                    style={[
                      styles.wheelRowText,
                      isSmallScreen ? styles.wheelRowTextTight : undefined,
                      selectedAge === age && styles.wheelRowTextSelected,
                    ]}
                  >
                    {age}
                  </Text>
                </View>
              ))}
              <View style={styles.wheelSpacer} />
            </ScrollView>
          </View>

          {selectedAge !== null && (
            <Text style={[styles.selectedLabel, isSmallScreen ? styles.selectedLabelTight : undefined]}>
              Selected: {selectedAge} years
            </Text>
          )}
        </View>

        <View style={styles.bottomSection}>
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
    paddingHorizontal: rs(Spacing.lg),
    paddingTop: rs(Spacing.md),
    paddingBottom: rs(Spacing.xl),
    gap: rs(Spacing.lg),
  },
  headerCompact: {
    paddingHorizontal: rs(Spacing.md),
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
  content: {
    flex: 1,
    paddingHorizontal: rs(Spacing.xxl),
    paddingTop: rs(Spacing.xxxl),
    alignItems: "center",
  },
  contentCompact: {
    paddingHorizontal: rs(Spacing.xl),
  },
  contentTight: {
    paddingHorizontal: rs(Spacing.lg),
    paddingTop: rs(Spacing.xxxl * 1.6),
  },
  title: {
    fontFamily: Fonts.cardTitle,
    fontSize: rf(24),
    color: "#2E2E2E",
    marginBottom: rs(Spacing.xxxl),
    lineHeight: rf(32),
    textAlign: "center",
  },
  titleCompact: {
    fontSize: rf(22),
    marginBottom: rs(Spacing.xxl),
  },
  titleTight: {
    fontSize: rf(18),
    lineHeight: rf(26),
    marginBottom: rs(Spacing.xxxl),
  },
  wheelWrapper: {
    width: "100%",
    maxWidth: rs(200),
    height: WHEEL_HEIGHT,
    position: "relative",
    marginBottom: rs(Spacing.xxxl),
  },
  wheelWrapperTight: {
    maxWidth: rs(180),
  },
  wheelHighlight: {
    position: "absolute",
    left: 0,
    right: 0,
    top: ROW_HEIGHT * 2,
    height: ROW_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "rgba(248,249,246,0.8)",
    zIndex: 1,
    borderRadius: 12,
  },
  wheel: {
    flex: 1,
  },
  wheelContent: {
    paddingVertical: 0,
  },
  wheelSpacer: {
    height: ROW_HEIGHT * 2,
  },
  wheelRow: {
    height: ROW_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  wheelRowText: {
    fontFamily: Fonts.body,
    fontSize: rf(20),
    color: "#000000",
  },
  wheelRowTextSelected: {
    fontFamily: Fonts.cardTitle,
    fontSize: rf(24),
    color: "#000000",
  },
  selectedLabel: {
    fontFamily: Fonts.body,
    fontSize: rf(15),
    color: "#6B7280",
    marginBottom: rs(Spacing.xl),
  },
  selectedLabelTight: {
    fontSize: rf(14),
  },
  bottomSection: {
    paddingHorizontal: rs(OnboardingButtonBar.paddingHorizontal),
    paddingTop: rs(OnboardingButtonBar.paddingTop),
    paddingBottom: rs(OnboardingButtonBar.paddingBottom),
  },
  bottomSectionTight: {
    paddingHorizontal: rs(OnboardingButtonBar.paddingHorizontal - Spacing.md),
  },
  continueButton: {
    backgroundColor: "#325C3A",
    ...Shadows.md,
  },
});
