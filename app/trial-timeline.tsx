import {
  BorderRadius,
  Colors,
  Fonts,
  OnboardingButtonBar,
  Shadows,
  Spacing,
} from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const NODE_ROW_HEIGHT = 110;
const TRACK_HEIGHT = NODE_ROW_HEIGHT * 2; // from first center to third center
const NODE_CIRCLE_SIZE = 56;
const FILL_DURATION = 400;
const FILL_PAUSE = 400;

const TIMELINE_NODES = [
  {
    emoji: "🔒",
    label: "Today",
    description: "You get full access to everything right away.",
    isAccentWhenActive: true,
  },
  {
    emoji: "🔔",
    label: "In 2 Days - Reminder",
    description: "We'll send you a reminder before your trial ends.",
    isAccentWhenActive: true,
  },
  {
    emoji: "👑",
    label: "In 3 Days - Billing Starts",
    description: "", // filled with dynamic date below
    isAccentWhenActive: false,
  },
] as const;

function getBillingDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

type PlanId = "weekly" | "yearly";

const PLANS: { id: PlanId; name: string; price: string; caption: string }[] = [
  {
    id: "weekly",
    name: "Weekly",
    price: "$5.99/week",
    caption: "Then $5.99/week.",
  },
  {
    id: "yearly",
    name: "Yearly",
    price: "$0.77/week",
    caption: "3 days free, then $39.99 per year ($0.77/week)",
  },
];

const WEEKLY_FEATURES = [
  {
    title: "Gut health scanning",
    description:
      "Get instant insights with a quick scan of your meals and symptoms.",
  },
  {
    title: "Personalized recommendations",
    description:
      "Tailored to your gut profile so you know what to eat and avoid.",
  },
  {
    title: "Track your progress",
    description:
      "See your gut score and trends over time with simple dashboards.",
  },
] as const;

export default function TrialTimelineScreen() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("yearly");
  const billingDateStr = useMemo(() => getBillingDate(), []);

  const fillProgress = useSharedValue(0);

  useEffect(() => {
    fillProgress.value = withSequence(
      withTiming(1 / 3, { duration: FILL_DURATION }),
      withDelay(FILL_PAUSE, withTiming(2 / 3, { duration: FILL_DURATION })),
      withDelay(FILL_PAUSE, withTiming(1, { duration: FILL_DURATION })),
    );
  }, []);

  const fillHeightStyle = useAnimatedStyle(() => ({
    height: interpolate(fillProgress.value, [0, 1], [0, TRACK_HEIGHT]),
  }));

  const node1Style = useAnimatedStyle(() => ({
    opacity: interpolate(fillProgress.value, [0, 0.2], [0.5, 1], "clamp"),
    transform: [
      {
        translateX: interpolate(fillProgress.value, [0, 0.2], [-6, 0], "clamp"),
      },
    ],
  }));
  const node2Style = useAnimatedStyle(() => ({
    opacity: interpolate(fillProgress.value, [0.3, 0.55], [0.5, 1], "clamp"),
    transform: [
      {
        translateX: interpolate(
          fillProgress.value,
          [0.3, 0.55],
          [-6, 0],
          "clamp",
        ),
      },
    ],
  }));
  const node3Style = useAnimatedStyle(() => ({
    opacity: interpolate(fillProgress.value, [0.65, 0.9], [0.5, 1], "clamp"),
    transform: [
      {
        translateX: interpolate(
          fillProgress.value,
          [0.65, 0.9],
          [-6, 0],
          "clamp",
        ),
      },
    ],
  }));

  const handleBack = () => router.back();
  const handleRestore = () => {
    /* TODO */
  };
  const handleStartTrial = () => router.replace("/(tabs)" as any);

  const selectedCaption =
    PLANS.find((p) => p.id === selectedPlan)?.caption ?? PLANS[1].caption;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Nav */}
        <View style={styles.nav}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.navBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleRestore}
            style={styles.navBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.restoreText}>Restore</Text>
          </TouchableOpacity>
        </View>

        {/* Headline (shown only when Yearly is selected) */}
        {selectedPlan === "yearly" && (
          <View style={styles.headlineWrap}>
            <Text style={styles.headline}>
              {"You're"} starting a 3-day{" "}
              <Text style={styles.headlineAccent}>FREE</Text>
              {"\n"}
              trial to continue.
            </Text>
          </View>
        )}

        {/* Timeline (shown only when Yearly is selected) */}
        {selectedPlan === "yearly" && (
          <View style={styles.timelineSection}>
            <View style={styles.timelineTrackBg} />
            <Animated.View style={[styles.timelineFillWrap, fillHeightStyle]}>
              <LinearGradient
                colors={[
                  Colors.primary,
                  `${Colors.primary}40`,
                  `${Colors.primary}15`,
                ]}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <View style={styles.nodesColumn}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.nodeRow}>
                  <Animated.View
                    style={[
                      styles.nodeCircleWrap,
                      i === 0 && node1Style,
                      i === 1 && node2Style,
                      i === 2 && node3Style,
                    ]}
                  >
                    <View
                      style={[
                        styles.nodeCircle,
                        TIMELINE_NODES[i].isAccentWhenActive
                          ? styles.nodeCircleAccent
                          : styles.nodeCircleNeutral,
                      ]}
                    >
                      <Text style={styles.nodeEmoji}>
                        {TIMELINE_NODES[i].emoji}
                      </Text>
                    </View>
                  </Animated.View>
                  <View style={styles.nodeTextBlock}>
                    <Text style={styles.nodeLabel}>
                      {TIMELINE_NODES[i].label}
                    </Text>
                    <Text style={styles.nodeDescription}>
                      {i === 2
                        ? `On ${billingDateStr} you'll be charged. Cancel before then to avoid charges.`
                        : TIMELINE_NODES[i].description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Feature list (shown when Weekly is selected) */}
        {selectedPlan === "weekly" && (
          <View style={styles.featureListSection}>
            <Text style={styles.featureListHeading}>
              Unlock Gutsy to understand your gut better.
            </Text>
            <View style={styles.featureItemsContainer}>
              {WEEKLY_FEATURES.map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <Text style={styles.featureCheck}>✓</Text>
                  <View style={styles.featureTextBlock}>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <Text style={styles.featureDescription}>
                      {feature.description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Plan selector - sits just above bottom zone */}
        <View style={styles.planRow}>
          <View style={styles.planCardContainer}>
            <TouchableOpacity
              style={[
                styles.planCard,
                selectedPlan === "weekly" && styles.planCardSelected,
              ]}
              onPress={() => setSelectedPlan("weekly")}
              activeOpacity={0.8}
            >
              <View style={styles.planCardContent}>
                <Text style={styles.planName}>Weekly</Text>
                <Text style={styles.planPrice}>$5.99/week</Text>
              </View>
              <View
                style={[
                  styles.radio,
                  selectedPlan === "weekly" && styles.radioSelected,
                ]}
              >
                {selectedPlan === "weekly" && (
                  <Ionicons name="checkmark" size={14} color="#FFF" />
                )}
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.planCardContainer}>
            <View style={styles.yearlyBadge}>
              <Text style={styles.yearlyBadgeText}>3 DAYS FREE</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.planCard,
                selectedPlan === "yearly" && styles.planCardSelected,
              ]}
              onPress={() => setSelectedPlan("yearly")}
              activeOpacity={0.8}
            >
              <View style={styles.planCardContent}>
                <Text style={styles.planName}>Yearly</Text>
                <Text style={styles.planPrice}>$0.77/week</Text>
              </View>
              <View
                style={[
                  styles.radio,
                  selectedPlan === "yearly" && styles.radioSelected,
                ]}
              >
                {selectedPlan === "yearly" && (
                  <Ionicons name="checkmark" size={14} color="#FFF" />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Bottom button bar (outside ScrollView, like onboarding) */}
      <View style={styles.bottomZone}>
        <Text style={styles.noPayment}>✓ No Payment Due Now.</Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleStartTrial}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>
            {selectedPlan === "yearly"
              ? "Start My 3-Day Free Trial"
              : "Start My Journey"}
          </Text>
        </TouchableOpacity>
        <Text style={styles.pricing}>{selectedCaption}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: 0,
  },
  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xxl,
  },
  navBtn: { padding: Spacing.sm },
  restoreText: {
    fontFamily: Fonts.body,
    fontSize: 16,
    color: Colors.textMuted,
  },
  headlineWrap: {
    alignItems: "center",
    marginBottom: Spacing.xxxl,
  },
  headline: {
    fontFamily: Fonts.cardTitle,
    fontSize: 24,
    lineHeight: 32,
    color: Colors.text,
    textAlign: "center",
  },
  headlineAccent: {
    color: Colors.primary,
  },
  timelineSection: {
    position: "relative",
    marginBottom: Spacing.xxxl,
    paddingLeft: 0,
  },
  featureListSection: {
    marginBottom: Spacing.xxxl,
  },
  featureListHeading: {
    fontFamily: Fonts.cardTitle,
    fontSize: 24,
    lineHeight: 32,
    color: Colors.text,
    marginBottom: Spacing.xxxl,
    textAlign: "center",
  },
  featureItemsContainer: {
    marginTop: 0,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.xxl,
    marginTop: Spacing.sm,
  },
  featureCheck: {
    fontFamily: Fonts.cardTitle,
    fontSize: 16,
    color: Colors.text,
    marginRight: Spacing.md,
    marginTop: 8,
  },
  featureTextBlock: {
    flex: 1,
  },
  featureTitle: {
    fontFamily: Fonts.cardTitle,
    fontSize: 17,
    color: Colors.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  timelineTrackBg: {
    position: "absolute",
    left: NODE_CIRCLE_SIZE / 2 - 2,
    top: NODE_ROW_HEIGHT / 2,
    width: 4,
    height: TRACK_HEIGHT,
    borderRadius: 2,
    backgroundColor: `${Colors.text}12`,
  },
  timelineFillWrap: {
    position: "absolute",
    left: NODE_CIRCLE_SIZE / 2 - 2,
    top: NODE_ROW_HEIGHT / 2,
    width: 4,
    height: TRACK_HEIGHT,
    borderRadius: 2,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  nodesColumn: {
    marginTop: 0,
  },
  nodeRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: NODE_ROW_HEIGHT,
  },
  nodeCircleWrap: {
    width: NODE_CIRCLE_SIZE,
    height: NODE_CIRCLE_SIZE,
    borderRadius: NODE_CIRCLE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeCircle: {
    width: NODE_CIRCLE_SIZE,
    height: NODE_CIRCLE_SIZE,
    borderRadius: NODE_CIRCLE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeCircleAccent: {
    backgroundColor: `${Colors.primary}30`,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  nodeCircleNeutral: {
    backgroundColor: `${Colors.text}18`,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  nodeEmoji: {
    fontSize: 28,
  },
  nodeTextBlock: {
    flex: 1,
    marginLeft: Spacing.lg,
    justifyContent: "center",
  },
  nodeLabel: {
    fontFamily: Fonts.cardTitle,
    fontSize: 17,
    color: Colors.text,
    marginBottom: 4,
  },
  nodeDescription: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: Colors.textMuted,
    lineHeight: 22,
  },
  planRow: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: "auto",
    marginBottom: 0,
    alignItems: "flex-start",
  },
  planCardContainer: {
    flex: 1,
    position: "relative",
    minWidth: 0,
    maxWidth: "50%",
  },
  yearlyBadge: {
    position: "absolute",
    top: -10,
    left: "50%",
    marginLeft: -52,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    zIndex: 1,
  },
  yearlyBadgeText: {
    fontFamily: Fonts.cardTitle,
    fontSize: 10,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  planCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.backgroundWhite,
    borderWidth: 1.5,
    borderColor: Colors.border,
    height: 88,
    minHeight: 88,
    maxHeight: 88,
  },
  planCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}08`,
  },
  planCardContent: {},
  planName: {
    fontFamily: Fonts.cardTitle,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 4,
  },
  planPrice: {
    fontFamily: Fonts.cardTitle,
    fontSize: 17,
    color: Colors.text,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  bottomZone: {
    paddingHorizontal: OnboardingButtonBar.paddingHorizontal,
    paddingTop: 0,
    paddingBottom: OnboardingButtonBar.paddingBottom,
    alignItems: "center",
  },
  noPayment: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: Colors.textMuted,
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xxxl,
    borderRadius: BorderRadius.lg,
    width: "100%",
    alignItems: "center",
    ...Shadows.md,
  },
  primaryBtnText: {
    fontFamily: Fonts.cardTitle,
    fontSize: 18,
    color: "#FFFFFF",
  },
  pricing: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: Spacing.xl,
  },
});
