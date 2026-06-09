import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import type { Router } from "expo-router";
import { Platform } from "react-native";
import { getOnboardingProfile } from "@/lib/onboarding-storage";
import { isRevenueCatSupported, logInRevenueCatUser } from "@/lib/revenuecat";
import {
  applyPendingPurchaseForUser,
  refreshRevenueCatAccess,
} from "@/lib/subscription-access";
import { supabase } from "@/lib/supabase";
import {
  formatAppleCredentialName,
  resolveDisplayFullName,
} from "@/lib/user-display-name";

// In Supabase Dashboard → Authentication → URL Configuration, add this redirect URL:
// gutsy://auth/callback (or your custom scheme + /auth/callback)

// Required for WebBrowser.authSession on web
WebBrowser.maybeCompleteAuthSession();

/** Fixed redirect URL so Supabase always redirects to the app, never to localhost. */
const APP_REDIRECT_SCHEME = "gutsy";
const APP_REDIRECT_PATH = "auth/callback";

/** Build redirect URL for OAuth. Always use app scheme to avoid localhost redirects in Expo Go. */
export function getRedirectUri(): string {
  return `${APP_REDIRECT_SCHEME}://${APP_REDIRECT_PATH}`;
}

/** Parse tokens from Supabase OAuth redirect URL (hash fragment) */
function parseSessionFromUrl(url: string): { access_token: string; refresh_token: string } | null {
  const hash = url.includes("#") ? url.split("#")[1] : "";
  if (!hash) return null;
  const params = Object.fromEntries(new URLSearchParams(hash));
  const access_token = params.access_token;
  const refresh_token = params.refresh_token;
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

/**
 * Persist the user's full name to Supabase auth metadata and user_profiles.
 * Called after native Apple sign-in when Apple returns fullName (first auth only).
 */
export async function persistUserFullName(fullName: string): Promise<void> {
  const trimmed = fullName.trim();
  if (!trimmed) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error: authError } = await supabase.auth.updateUser({
    data: {
      full_name: trimmed,
      name: trimmed,
    },
  });
  if (authError) {
    console.warn("persistUserFullName auth update failed:", authError.message);
  }

  await supabase.from("user_profiles").upsert(
    {
      id: user.id,
      email: user.email ?? undefined,
      full_name: trimmed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
}

/**
 * Native Sign in with Apple on iOS — captures fullName on the user's first authorization.
 */
export async function signInWithAppleNative(): Promise<{ error: Error | null }> {
  try {
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      return signInWithOAuth("apple");
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return { error: new Error("No identity token from Apple") };
    }

    const { error: signInError } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
    });
    if (signInError) return { error: signInError };

    const fullName = formatAppleCredentialName(credential.fullName);
    if (fullName) {
      await persistUserFullName(fullName);
    }

    return { error: null };
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "ERR_REQUEST_CANCELED") {
      return { error: new Error("Sign in cancelled") };
    }
    return {
      error: error instanceof Error ? error : new Error("Apple sign in failed"),
    };
  }
}

/**
 * Sign in with apple | google. On iOS, Apple uses the native sheet so we can
 * read the user's name from their Apple ID on first sign-in.
 */
export async function signInWithProvider(
  provider: "apple" | "google",
): Promise<{ error: Error | null }> {
  if (provider === "apple" && Platform.OS === "ios") {
    return signInWithAppleNative();
  }
  return signInWithOAuth(provider);
}

/**
 * Sign in with OAuth provider (apple | google).
 * Opens browser, then sets session from redirect URL.
 */
export async function signInWithOAuth(provider: "apple" | "google"): Promise<{ error: Error | null }> {
  const redirectTo = getRedirectUri();
  const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (oauthError) return { error: oauthError };
  if (!data?.url) return { error: new Error("No auth URL returned") };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== "success" || !result.url) {
    return { error: new Error(result.type === "cancel" ? "Sign in cancelled" : "Sign in failed") };
  }

  const tokens = parseSessionFromUrl(result.url);
  if (!tokens) return { error: new Error("Could not get session from redirect") };

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });

  if (sessionError) return { error: sessionError };

  return { error: null };
}

/**
 * After sign-in: sync local onboarding data to Supabase user_profiles.
 * Call this once the session is established.
 */
export async function syncOnboardingToAccount(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const profile = await getOnboardingProfile();
  const onboarding = {
    goal: profile.goal,
    skinConcern: profile.skinConcern,
    skinType: profile.skinType,
    water: profile.water,
    trigger: profile.trigger,
    skinFeel: profile.skinFeel,
    bloating: profile.bloating,
    digestion: profile.digestion,
    energyMood: profile.energyMood,
    processedFood: profile.processedFood,
  };

  const { data: existingProfile } = await supabase
    .from("user_profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const fullName = resolveDisplayFullName(user, existingProfile?.full_name);

  await supabase.from("user_profiles").upsert(
    {
      id: user.id,
      email: user.email ?? undefined,
      ...(fullName ? { full_name: fullName } : {}),
      onboarding,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
}

/**
 * Decide where to send the user after a successful sign-in / sign-up.
 *
 * Priority:
 * 1. No auth user → paywall (defensive, shouldn't happen).
 * 2. Active RevenueCat entitlement → /(tabs).
 * 3. Onboarding already completed in Supabase → /paywall (returning user, just needs to subscribe).
 * 4. No onboarding data yet → push into the onboarding funnel so they hit the paywall there.
 */
export async function finalizePostAuth(router: Router): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    router.replace("/paywall" as any);
    return;
  }

  try {
    await syncOnboardingToAccount();

    if (isRevenueCatSupported()) {
      await logInRevenueCatUser(user.id);
    }

    const pendingApplied = await applyPendingPurchaseForUser(user.id);
    if (pendingApplied) {
      router.replace("/(tabs)" as any);
      return;
    }

    const unlocked = await refreshRevenueCatAccess(user.id);
    if (unlocked) {
      router.replace("/(tabs)" as any);
      return;
    }
  } catch (err) {
    console.warn("Post-auth RevenueCat sync failed:", err);
  }

  // No active subscription. Decide between the paywall (returning user) and
  // the onboarding funnel (first-time user) based on whether onboarding has
  // been completed previously in Supabase.
  let hasOnboardingGoal = false;
  try {
    const { data } = await supabase
      .from("user_profiles")
      .select("onboarding")
      .eq("id", user.id)
      .single();
    hasOnboardingGoal = Boolean((data?.onboarding as { goal?: unknown } | null)?.goal);
  } catch (err) {
    console.warn("Failed to read onboarding state from Supabase:", err);
  }

  router.replace((hasOnboardingGoal ? "/paywall" : "/onboarding/analyze-first") as any);
}
