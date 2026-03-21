import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";
import { getOnboardingProfile } from "@/lib/onboarding-storage";

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

  await supabase.from("user_profiles").upsert(
    {
      id: user.id,
      email: user.email ?? undefined,
      full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? undefined,
      onboarding,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
}
