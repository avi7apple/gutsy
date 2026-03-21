import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ProgressBar from "@/components/onboarding/ProgressBar";
import OnboardingButton from "@/components/onboarding/OnboardingButton";
import { Fonts, Spacing, Shadows, OnboardingButtonBar, ONBOARDING_TOTAL_STEPS } from "@/constants/theme";

const AGES = Array.from({ length: 88 }, (_, i) => i + 13);
const ROW_HEIGHT = 52;
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;
const DEFAULT_AGE = 25;
const DEFAULT_INDEX = AGES.indexOf(DEFAULT_AGE);
const CURRENT_STEP = 16;

export default function AgeScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [selectedAge, setSelectedAge] = useState<number | null>(null);

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

        <View style={styles.content}>
          <Text style={styles.title}>What is your age?</Text>

          <View style={styles.wheelWrapper}>
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
                <View key={age} style={styles.wheelRow}>
                  <Text
                    style={[
                      styles.wheelRowText,
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
            <Text style={styles.selectedLabel}>Selected: {selectedAge} years</Text>
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
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxxl,
    alignItems: "center",
  },
  title: {
    fontFamily: Fonts.cardTitle,
    fontSize: 24,
    color: "#2E2E2E",
    marginBottom: Spacing.xxxl,
    lineHeight: 32,
    textAlign: "center",
  },
  wheelWrapper: {
    width: "100%",
    maxWidth: 200,
    height: WHEEL_HEIGHT,
    position: "relative",
    marginBottom: Spacing.xxxl,
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
    fontSize: 20,
    color: "#000000",
  },
  wheelRowTextSelected: {
    fontFamily: Fonts.cardTitle,
    fontSize: 24,
    color: "#000000",
  },
  selectedLabel: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: "#6B7280",
    marginBottom: Spacing.xl,
  },
  bottomSection: {
    paddingHorizontal: OnboardingButtonBar.paddingHorizontal,
    paddingTop: OnboardingButtonBar.paddingTop,
    paddingBottom: OnboardingButtonBar.paddingBottom,
  },
  continueButton: {
    backgroundColor: "#325C3A",
    ...Shadows.md,
  },
});
