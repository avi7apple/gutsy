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
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();

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
        console.warn("Auth check skipped due to network issue; continuing with onboarding fallback.");
      } else {
        console.error("Error checking auth/onboarding:", error);
      }
      // Default to onboarding on error
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
