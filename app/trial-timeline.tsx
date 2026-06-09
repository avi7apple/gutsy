import {
  BorderRadius,
  Colors,
  Fonts,
  Shadows,
} from "@/constants/theme";
import { finalizePostAuth, syncOnboardingToAccount } from "@/lib/auth";
import { useBlockBack } from "@/lib/hooks/use-block-back";
import {
  getRevenueCatEntitlementId,
  getRevenueCatOfferings,
  isRevenueCatPurchaseCancelled,
  isRevenueCatSupported,
  logInRevenueCatUser,
  purchaseRevenueCatPackage,
  type RevenueCatPackage,
} from "@/lib/revenuecat";
import { savePendingPurchase } from "@/lib/pending-purchase-storage";
import {
  applyRevenueCatCustomerInfo,
  recordPaywallFunnelStep,
} from "@/lib/subscription-access";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  SafeAreaView,
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

// ─── Scaling system ────────────────────────────────────────────────────────────
// Design baseline: iPhone 14 Pro Max (430pt width).
// All values scale linearly with screen width so the layout looks identical
// on every device — just proportionally smaller on narrower screens.
const { width: SCREEN_W } = Dimensions.get("window");
const BASE_W = 430;
const SCALE = Math.min(SCREEN_W / BASE_W, 1);

/** Scale a spacing/size value */
const s = (v: number) => Math.round(v * SCALE);
/** Scale a font size */
const f = (v: number) => Math.round(v * SCALE);

// ─── Design tokens (at 430px baseline) ────────────────────────────────────────
const NODE_ROW_HEIGHT = s(100);
const NODE_CIRCLE_SIZE = s(50);
const TRACK_HEIGHT = NODE_ROW_HEIGHT * 2;
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
    price: "$9.99/week",
    caption: "Then $9.99/week.",
  },
  {
    id: "yearly",
    name: "Yearly",
    price: "$0.96/week",
    caption: "3 days free, then $49.99 per year ($0.96/week)",
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
  useBlockBack();

  const [packages, setPackages] = useState<RevenueCatPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  const fillProgress = useSharedValue(0);

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await recordPaywallFunnelStep(user.id, "trial_timeline");
      }
    })();
  }, []);

  useEffect(() => {
    fillProgress.value = withSequence(
      withTiming(1 / 3, { duration: FILL_DURATION }),
      withDelay(FILL_PAUSE, withTiming(2 / 3, { duration: FILL_DURATION })),
      withDelay(FILL_PAUSE, withTiming(1, { duration: FILL_DURATION })),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!isRevenueCatSupported()) {
        if (!cancelled) setPackagesLoading(false);
        return;
      }
      try {
        const offerings = await getRevenueCatOfferings();
        const available = offerings?.current?.availablePackages ?? [];
        if (!cancelled) setPackages(available);
      } catch (err) {
        console.warn("Failed to load RevenueCat offerings:", err);
      } finally {
        if (!cancelled) setPackagesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedPackage = useMemo<RevenueCatPackage | null>(() => {
    if (packages.length === 0) return null;
    const wantsAnnual = selectedPlan === "yearly";
    const match = packages.find((pkg) => {
      const type = String(pkg.packageType ?? "").toUpperCase();
      return wantsAnnual ? type === "ANNUAL" : type === "WEEKLY";
    });
    return match ?? packages[0];
  }, [packages, selectedPlan]);

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

  const handleStartTrial = useCallback(async () => {
    if (purchasing) return;

    if (!isRevenueCatSupported()) {
      Alert.alert(
        "Purchases unavailable",
        "In-app purchases require a development build. Continuing to account setup.",
        [{ text: "OK", onPress: () => router.push("/create-account") }],
      );
      return;
    }

    if (!selectedPackage) {
      Alert.alert(
        "Plan unavailable",
        packagesLoading
          ? "Still loading plans. Please try again in a moment."
          : "We couldn't find an active plan. Check your RevenueCat offering setup.",
      );
      return;
    }

    setPurchasing(true);
    try {
      const purchaseInfo = await purchaseRevenueCatPackage(selectedPackage);
      if (!purchaseInfo) {
        throw new Error("We couldn't complete the purchase. Please try again.");
      }

      const purchaseContext = {
        pricePaid: selectedPackage.product.price ?? null,
        currency: selectedPackage.product.currencyCode ?? null,
      };

      await savePendingPurchase(purchaseInfo, purchaseContext);

      const entitlementId = getRevenueCatEntitlementId() ?? "pro";
      const diagEnt = purchaseInfo?.entitlements?.active?.[entitlementId];
      console.log("[RC-DIAG] post-purchase entitlement", {
        entitlementId,
        packageId: selectedPackage.identifier,
        productId: selectedPackage.product.identifier,
        productPrice: selectedPackage.product.price,
        productCurrency: selectedPackage.product.currencyCode,
        hasIntroPrice: Boolean(selectedPackage.product.introPrice),
        introPrice: selectedPackage.product.introPrice,
        entActive: Boolean(diagEnt),
        entIdentifier: diagEnt?.identifier ?? null,
        periodType: diagEnt?.periodType ?? null,
        willRenew: diagEnt?.willRenew ?? null,
        originalPurchaseDate: diagEnt?.originalPurchaseDate ?? null,
        latestPurchaseDate: diagEnt?.latestPurchaseDate ?? null,
        expirationDate: diagEnt?.expirationDate ?? null,
        store: diagEnt?.store ?? null,
        productIdOnEnt: diagEnt?.productIdentifier ?? null,
        originalAppUserId: purchaseInfo?.originalAppUserId ?? null,
      });

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/create-account");
        return;
      }

      await syncOnboardingToAccount();

      if (isRevenueCatSupported()) {
        try {
          await logInRevenueCatUser(user.id);
        } catch (err) {
          console.warn("RC logIn after purchase failed:", err);
        }
      }

      const unlocked = await applyRevenueCatCustomerInfo(
        user.id,
        purchaseInfo,
        purchaseContext,
      );
      if (unlocked) {
        await recordPaywallFunnelStep(user.id, "purchase_completed");
        router.replace("/(tabs)" as any);
        return;
      }

      await finalizePostAuth(router);
    } catch (err) {
      if (isRevenueCatPurchaseCancelled(err)) {
        return;
      }
      Alert.alert(
        "Purchase failed",
        err instanceof Error ? err.message : "Please try again in a moment.",
      );
    } finally {
      setPurchasing(false);
    }
  }, [purchasing, packagesLoading, selectedPackage, router]);

  const selectedCaption =
    PLANS.find((p) => p.id === selectedPlan)?.caption ?? PLANS[1].caption;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        {/* Nav */}
        <View style={styles.nav}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.navBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={s(24)} color={Colors.text} />
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
            <View style={styles.nodesColumn}>
              <View
                style={[
                  styles.timelineTrackBg,
                  {
                    left: NODE_CIRCLE_SIZE / 2 - s(2),
                    top: NODE_ROW_HEIGHT / 2,
                    height: TRACK_HEIGHT,
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.timelineFillWrap,
                  {
                    left: NODE_CIRCLE_SIZE / 2 - s(2),
                    top: NODE_ROW_HEIGHT / 2,
                    height: TRACK_HEIGHT,
                  },
                  fillHeightStyle,
                ]}
              >
                <LinearGradient
                  colors={[
                    Colors.primary,
                    `${Colors.primary}40`,
                    `${Colors.primary}15`,
                  ]}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
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

        {/* Plan selector */}
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
                <Text style={styles.planPrice}>$9.99/week</Text>
              </View>
              <View
                style={[
                  styles.radio,
                  selectedPlan === "weekly" && styles.radioSelected,
                ]}
              >
                {selectedPlan === "weekly" && (
                  <Ionicons name="checkmark" size={s(14)} color="#FFF" />
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
                <Text style={styles.planPrice}>$0.96/week</Text>
              </View>
              <View
                style={[
                  styles.radio,
                  selectedPlan === "yearly" && styles.radioSelected,
                ]}
              >
                {selectedPlan === "yearly" && (
                  <Ionicons name="checkmark" size={s(14)} color="#FFF" />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Bottom button bar */}
      <View style={styles.bottomZone}>
        <Text style={styles.noPayment}>
          {selectedPlan === "yearly"
            ? "✓ No Payment Due Now."
            : "Charged today: $9.99"}
        </Text>
        <TouchableOpacity
          style={[styles.primaryBtn, purchasing && styles.primaryBtnDisabled]}
          onPress={() => {
            void handleStartTrial();
          }}
          disabled={purchasing || packagesLoading}
          activeOpacity={0.85}
        >
          {purchasing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {selectedPlan === "yearly"
                ? "Start My 3-Day Free Trial"
                : "Start My Journey"}
            </Text>
          )}
        </TouchableOpacity>
        <Text style={styles.pricing}>{selectedCaption}</Text>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────
// Every value uses s() or f() so it scales proportionally with screen width.
// No breakpoints, no conditional styles — identical visual at every size.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: s(24),
    paddingTop: s(8),
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: s(16),
  },
  navBtn: {
    padding: s(8),
  },
  headlineWrap: {
    alignItems: "center",
    marginBottom: s(20),
  },
  headline: {
    fontFamily: Fonts.cardTitle,
    fontSize: f(22),
    lineHeight: f(30),
    color: Colors.text,
    textAlign: "center",
  },
  headlineAccent: {
    color: Colors.primary,
  },
  timelineSection: {
    position: "relative",
    flex: 1,
    justifyContent: "center",
    marginBottom: s(16),
  },
  featureListSection: {
    flex: 1,
    marginBottom: s(16),
  },
  featureListHeading: {
    fontFamily: Fonts.cardTitle,
    fontSize: f(22),
    lineHeight: f(30),
    color: Colors.text,
    marginBottom: s(24),
    textAlign: "center",
  },
  featureItemsContainer: {
    marginTop: 0,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: s(18),
  },
  featureCheck: {
    fontFamily: Fonts.cardTitle,
    fontSize: f(16),
    color: Colors.text,
    marginRight: s(12),
    marginTop: s(4),
  },
  featureTextBlock: {
    flex: 1,
  },
  featureTitle: {
    fontFamily: Fonts.cardTitle,
    fontSize: f(16),
    color: Colors.text,
    marginBottom: s(2),
  },
  featureDescription: {
    fontFamily: Fonts.body,
    fontSize: f(14),
    color: Colors.textSecondary,
    lineHeight: f(20),
  },
  timelineTrackBg: {
    position: "absolute",
    width: s(4),
    borderRadius: s(2),
    backgroundColor: `${Colors.text}12`,
  },
  timelineFillWrap: {
    position: "absolute",
    width: s(4),
    borderRadius: s(2),
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  nodesColumn: {
    marginTop: 0,
  },
  nodeRow: {
    flexDirection: "row",
    alignItems: "center",
    height: NODE_ROW_HEIGHT,
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
    fontSize: f(24),
  },
  nodeTextBlock: {
    flex: 1,
    marginLeft: s(14),
    justifyContent: "center",
  },
  nodeLabel: {
    fontFamily: Fonts.cardTitle,
    fontSize: f(16),
    color: Colors.text,
    marginBottom: s(2),
  },
  nodeDescription: {
    fontFamily: Fonts.body,
    fontSize: f(13),
    color: Colors.textMuted,
    lineHeight: f(18),
  },
  planRow: {
    flexDirection: "row",
    gap: s(12),
    marginTop: "auto",
    paddingTop: s(12),
    alignItems: "flex-start",
  },
  planCardContainer: {
    flex: 1,
    position: "relative",
    minWidth: 0,
  },
  yearlyBadge: {
    position: "absolute",
    top: s(-10),
    alignSelf: "center",
    left: "50%",
    marginLeft: s(-46),
    backgroundColor: Colors.primary,
    paddingHorizontal: s(8),
    paddingVertical: s(3),
    borderRadius: BorderRadius.sm,
    zIndex: 1,
  },
  yearlyBadgeText: {
    fontFamily: Fonts.cardTitle,
    fontSize: f(9),
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  planCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: s(14),
    paddingHorizontal: s(14),
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.backgroundWhite,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  planCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}08`,
  },
  planCardContent: {},
  planName: {
    fontFamily: Fonts.cardTitle,
    fontSize: f(14),
    color: Colors.text,
    marginBottom: s(2),
  },
  planPrice: {
    fontFamily: Fonts.cardTitle,
    fontSize: f(15),
    color: Colors.text,
  },
  radio: {
    width: s(20),
    height: s(20),
    borderRadius: s(10),
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
    paddingHorizontal: s(24),
    paddingBottom: s(24),
    alignItems: "center",
  },
  noPayment: {
    fontFamily: Fonts.body,
    fontSize: f(14),
    color: Colors.textMuted,
    marginTop: s(12),
    marginBottom: s(12),
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: s(16),
    paddingHorizontal: s(32),
    borderRadius: BorderRadius.lg,
    width: "100%",
    alignItems: "center",
    ...Shadows.md,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontFamily: Fonts.cardTitle,
    fontSize: f(17),
    color: "#FFFFFF",
  },
  pricing: {
    fontFamily: Fonts.body,
    fontSize: f(11),
    color: Colors.textMuted,
    marginTop: s(12),
  },
});
