import { Colors, Fonts, Spacing } from "@/constants/theme";
import { syncOnboardingToAccount } from "@/lib/auth";
import { useBlockBack } from "@/lib/hooks/use-block-back";
import { rf, rs } from "@/lib/hooks/use-responsive";
import { useRestorePurchases } from "@/lib/hooks/use-restore-purchases";
import {
  getRevenueCatOfferings,
  isRevenueCatPurchaseCancelled,
  isRevenueCatSupported,
  purchaseRevenueCatPackage,
  type RevenueCatPackage,
} from "@/lib/revenuecat";
import { savePendingPurchase } from "@/lib/pending-purchase-storage";
import {
  applyRevenueCatCustomerInfo,
  evaluateSubscriptionAccess,
  markPaywallSeen,
  recordPaywallFunnelStep,
  refreshRevenueCatAccess,
} from "@/lib/subscription-access";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const REVENUECAT_UNAVAILABLE_MESSAGE =
  "In-app purchases require a development build. Run `npx expo run:ios` or `npx expo run:android`.";

const BENEFITS = [
  "Unlimited scans + meal breakdowns",
  "Personalized gut report & scores",
  "Daily habits to stay on track",
];

export default function PaywallScreen() {
  const router = useRouter();
  const [packages, setPackages] = useState<RevenueCatPackage[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { restoring, handleRestore } = useRestorePurchases(router);

  useBlockBack();

  const loadOfferings = useCallback(async () => {
    if (!isRevenueCatSupported()) {
      setError(REVENUECAT_UNAVAILABLE_MESSAGE);
      setPackages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/create-account");
        return;
      }

      // Defensive: if the user already has an active entitlement (e.g. they
      // landed here right after a successful purchase that finalizePostAuth
      // couldn't immediately verify), skip the paywall entirely.
      try {
        const access = await evaluateSubscriptionAccess(user.id);
        if (access.hasPaidAccess) {
          router.replace("/(tabs)");
          return;
        }
      } catch (err) {
        console.warn("paywall pre-flight access check failed:", err);
      }

      setUserId(user.id);
      await markPaywallSeen(user.id);

      const offerings = await getRevenueCatOfferings();
      const availablePackages = offerings?.current?.availablePackages ?? [];

      if (availablePackages.length === 0) {
        throw new Error("No active products found. Configure an offering in RevenueCat.");
      }

      setPackages(availablePackages);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load products right now. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadOfferings();
  }, [loadOfferings]);

  const handlePurchase = useCallback(
    async (selectedPackage: RevenueCatPackage) => {
      if (!userId) {
        router.replace("/create-account");
        return;
      }
      if (purchasingId) return;
      setPurchasingId(selectedPackage.identifier);
      try {
        await syncOnboardingToAccount();

        const purchaseInfo = await purchaseRevenueCatPackage(selectedPackage);
        if (!purchaseInfo) {
          throw new Error("We couldn't complete the purchase. Please try again.");
        }

        // Prefer syncing from the CustomerInfo we just got back from the
        // purchase (freshest possible view, avoids cache race). Fall back to
        // a network refresh only if that doesn't reveal the entitlement.
        const purchaseContext = {
          pricePaid: selectedPackage.product.price ?? null,
          currency: selectedPackage.product.currencyCode ?? null,
        };

        await savePendingPurchase(purchaseInfo, purchaseContext);

        let unlocked = await applyRevenueCatCustomerInfo(
          userId,
          purchaseInfo,
          purchaseContext,
        );
        if (!unlocked) {
          unlocked = await refreshRevenueCatAccess(userId);
        }

        if (!unlocked) {
          throw new Error(
            "We couldn't verify your subscription yet. Please try again or contact support.",
          );
        }
        await recordPaywallFunnelStep(userId, "purchase_completed");
        router.replace("/(tabs)");
      } catch (err) {
        if (isRevenueCatPurchaseCancelled(err)) {
          return;
        }
        Alert.alert(
          "Purchase failed",
          err instanceof Error ? err.message : "Please try again in a moment.",
        );
      } finally {
        setPurchasingId(null);
      }
    },
    [purchasingId, router, userId],
  );

  const renderPackages = useMemo(() => {
    return packages.map((pkg) => {
      const introOffer = pkg.product.introPrice;
      const hasIntroOffer = Boolean(introOffer);
      const interval = getSubscriptionInterval(pkg);
      const priceLabel = `${pkg.product.priceString} / ${interval}`;
      const isProcessing = purchasingId === pkg.identifier;

      const subtitle = hasIntroOffer
        ? `Start with ${introOffer?.priceString ?? "free trial"}`
        : `Billed ${priceLabel}`;
      const buttonLabel = hasIntroOffer ? "Start free trial" : "Subscribe";

      return (
        <View key={pkg.identifier} style={styles.packageCard}>
          <Text style={styles.packageName}>{pkg.product.title}</Text>
          <Text style={styles.packagePrice}>{priceLabel}</Text>
          <Text style={styles.packageTrial}>{subtitle}</Text>
          <TouchableOpacity
            style={[styles.ctaButton, isProcessing && styles.ctaButtonDisabled]}
            activeOpacity={0.9}
            disabled={isProcessing || restoring}
            onPress={() => {
              void handlePurchase(pkg);
            }}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaButtonText}>{buttonLabel}</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    });
  }, [packages, purchasingId, handlePurchase, restoring]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading your plan options…</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>3-day free trial</Text>
        <Text style={styles.title}>Unlock your full gut health playbook</Text>
        <Text style={styles.subtitle}>
          Get unlimited scans, daily gut score coaching, and tailored plans built for you.
        </Text>

        <View style={styles.benefitsList}>
          {BENEFITS.map((benefit) => (
            <View key={benefit} style={styles.benefitRow}>
              <View style={styles.benefitDot} />
              <Text style={styles.benefitText}>{benefit}</Text>
            </View>
          ))}
        </View>

        {renderPackages}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.secondaryButton} onPress={() => void loadOfferings()}>
          <Text style={styles.secondaryButtonText}>Refresh options</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.restoreButton}
          onPress={() => {
            void handleRestore();
          }}
          disabled={restoring}
        >
          {restoring ? (
            <ActivityIndicator size="small" color={Colors.text} />
          ) : (
            <Text style={styles.restoreText}>Restore purchases</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.legalCopy}>
          Payments are handled by Apple/Google. Cancel anytime in your subscription settings.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function getSubscriptionInterval(pkg: RevenueCatPackage): string {
  const period = pkg.product.subscriptionPeriod;
  if (!period) return "period";
  if (typeof period === "string") {
    return period.toLowerCase();
  }

  const unit = (period as { unit?: string | null }).unit;
  if (!unit) return "period";
  return unit.toLowerCase();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.lg,
    fontFamily: Fonts.cardTitle,
    fontSize: rf(18),
    color: Colors.text,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  kicker: {
    marginTop: Spacing.xl,
    fontFamily: Fonts.body,
    fontSize: rf(14),
    color: Colors.primary,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    marginTop: Spacing.sm,
    fontFamily: Fonts.cardTitle,
    fontSize: rf(28),
    color: Colors.text,
    lineHeight: rf(34),
  },
  subtitle: {
    marginTop: Spacing.md,
    fontFamily: Fonts.body,
    fontSize: rf(16),
    color: Colors.textSecondary,
    lineHeight: rf(24),
  },
  benefitsList: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  benefitDot: {
    width: rs(10),
    height: rs(10),
    borderRadius: rs(5),
    backgroundColor: Colors.primary,
  },
  benefitText: {
    fontFamily: Fonts.body,
    fontSize: rf(15),
    color: Colors.text,
    flex: 1,
  },
  packageCard: {
    marginTop: Spacing.xl,
    borderRadius: rs(20),
    padding: Spacing.xl,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  packageName: {
    fontFamily: Fonts.cardTitle,
    fontSize: rf(20),
    color: Colors.text,
  },
  packagePrice: {
    marginTop: Spacing.xs,
    fontFamily: Fonts.body,
    fontSize: rf(16),
    color: Colors.text,
  },
  packageTrial: {
    marginTop: Spacing.sm,
    fontFamily: Fonts.body,
    fontSize: rf(14),
    color: Colors.textSecondary,
  },
  ctaButton: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: rs(16),
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaButtonText: {
    color: "#fff",
    fontFamily: Fonts.cardTitle,
    fontSize: rf(16),
  },
  secondaryButton: {
    marginTop: Spacing.xl,
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  secondaryButtonText: {
    fontFamily: Fonts.cardTitle,
    fontSize: rf(14),
    color: Colors.primary,
  },
  restoreButton: {
    marginTop: Spacing.md,
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  restoreText: {
    fontFamily: Fonts.body,
    fontSize: rf(14),
    color: Colors.text,
  },
  legalCopy: {
    marginTop: Spacing.lg,
    fontFamily: Fonts.body,
    fontSize: rf(12),
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: rf(18),
  },
  error: {
    marginTop: Spacing.lg,
    fontFamily: Fonts.body,
    fontSize: rf(14),
    color: Colors.error,
    textAlign: "center",
  },
});
