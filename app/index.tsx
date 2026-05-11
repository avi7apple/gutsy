import { Colors } from "@/constants/theme";
import { isNetworkRequestFailure } from "@/lib/network-errors";
import { getOnboardingProfile } from "@/lib/onboarding-storage";
import { supabase } from "@/lib/supabase";
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
      // Prefer persisted session on startup to avoid false logouts when network/getUser is flaky.
      const { data: { session } } = await supabase.auth.getSession();
      let user = session?.user ?? null;

      // If no persisted session user exists, try server validation as fallback.
      if (!user) {
        const { data } = await supabase.auth.getUser();
        user = data.user ?? null;
      }

      if (user) {
        // User is authenticated - check if they have completed onboarding
        const profile = await getOnboardingProfile();
        
        if (profile?.goal) {
          // Onboarding complete - direct access to app
          setRedirectTo("/(tabs)");
        } else {
          // Authenticated but onboarding not complete
          setRedirectTo("/onboarding/welcome");
        }
      } else {
        // Not authenticated - check if onboarding data exists
        const profile = await getOnboardingProfile();
        
        if (profile?.goal) {
          // Has onboarding data but not authenticated - go to create account
          setRedirectTo("/create-account");
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
