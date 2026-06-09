import { resolveAuthenticatedUser } from "@/lib/auth-session";
import { Colors } from "@/constants/theme";
import { isNetworkRequestFailure } from "@/lib/network-errors";
import { getOnboardingProfile } from "@/lib/onboarding-storage";
import { evaluateSubscriptionAccess, getSubscriptionProfile, hasPaidAccess } from "@/lib/subscription-access";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndOnboarding();
  }, []);

  async function checkAuthAndOnboarding() {
    try {
      const { user } = await resolveAuthenticatedUser();

      if (user) {
        // User is authenticated - check if they have completed onboarding
        const profile = await getOnboardingProfile();

        if (profile?.goal) {
          try {
            const access = await evaluateSubscriptionAccess(user.id);
            if (access.hasPaidAccess) {
              setRedirectTo("/(tabs)");
            } else {
              const hasSeenPaywall = Boolean(access.profile?.has_seen_paywall);
              setRedirectTo(hasSeenPaywall ? "/paywall" : "/try-free");
            }
          } catch (error) {
            console.error("Error evaluating subscription access:", error);
            try {
              const cachedProfile = await getSubscriptionProfile(user.id);
              if (hasPaidAccess(cachedProfile)) {
                setRedirectTo("/(tabs)");
                return;
              }
            } catch {
              // Ignore secondary read failure.
            }
            setRedirectTo("/paywall");
          }
        } else {
          // Authenticated but onboarding not complete
          setRedirectTo("/onboarding/welcome");
        }
      } else {
        // Not authenticated - check if onboarding data exists
        const profile = await getOnboardingProfile();

        if (profile?.goal) {
          // Onboarding done but no auth + no purchase yet -> re-enter the paywall funnel.
          // /try-free -> /reminder-promise -> /trial-timeline handles the anonymous purchase,
          // and /create-account is reached only after a successful purchase.
          setRedirectTo("/try-free");
        } else {
          // No onboarding data - start onboarding
          setRedirectTo("/onboarding/welcome");
        }
      }
    } catch (error) {
      if (isNetworkRequestFailure(error)) {
        console.warn("Auth check skipped due to network issue; using local onboarding fallback.");
      } else {
        console.error("Error checking auth/onboarding:", error);
      }
      // On unexpected startup errors, keep prior onboarding fallback behavior.
      setRedirectTo("/onboarding/welcome");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }} />
    );
  }

  if (!redirectTo) {
    return <Redirect href="/onboarding/welcome" />;
  }

  return <Redirect href={redirectTo as any} />;
}
