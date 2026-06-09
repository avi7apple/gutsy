import { BorderRadius, Colors, Fonts, Shadows } from "@/constants/theme";
import { finalizePostAuth, getRedirectUri, signInWithProvider, syncOnboardingToAccount } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Linking,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

// ─── Scaling system ────────────────────────────────────────────────────────────
// Design baseline: iPhone 14 Pro Max (430pt).
// Every value scales linearly so the layout is pixel-identical at any width.
const { width: SCREEN_W } = Dimensions.get("window");
const BASE_W = 430;
const SCALE = Math.min(SCREEN_W / BASE_W, 1);
const s = (v: number) => Math.round(v * SCALE);
const f = (v: number) => Math.round(v * SCALE);

export default function CreateAccountScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState<"apple" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  const handleOAuthRedirect = useCallback(async (url: string) => {
    const redirectTo = getRedirectUri();
    if (!url.startsWith(redirectTo.split("#")[0]) && !url.includes("access_token")) return;
    const hash = url.includes("#") ? url.split("#")[1] : "";
    if (!hash) return;
    const params = Object.fromEntries(new URLSearchParams(hash));
    const access_token = params.access_token;
    const refresh_token = params.refresh_token;
    if (!access_token || !refresh_token) return;

    const { error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (sessionError) {
      setError(sessionError.message);
      return;
    }
    setLoading(null);
    await syncOnboardingToAccount();
    await finalizePostAuth(router);
  }, [router]);

  // If the user landed here while already authenticated (e.g. they signed
  // in via the welcome page, went through onboarding, and just completed a
  // purchase), skip the sign-in UI entirely and finalize routing instead of
  // making them re-authenticate.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (user) {
          await syncOnboardingToAccount();
          await finalizePostAuth(router);
          return;
        }
      } catch (err) {
        console.warn("create-account auth bootstrap failed:", err);
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) handleOAuthRedirect(url);
    });
    const sub = Linking.addEventListener("url", ({ url }) => handleOAuthRedirect(url));
    return () => sub.remove();
  }, [handleOAuthRedirect]);

  const handleSignIn = async (provider: "apple" | "google") => {
    setError(null);
    setLoading(provider);
    try {
      const { error: err } = await signInWithProvider(provider);
      if (err) {
        setError(err.message);
        setLoading(null);
        return;
      }
      await syncOnboardingToAccount();
      setLoading(null);
      await finalizePostAuth(router);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
      setLoading(null);
    }
  };

  if (bootstrapping) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.bootstrapState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.topSection}>
          <View style={styles.titleContainer}>
            <Text style={styles.titleLine}>Create your</Text>
            <Text style={styles.titleLine}>Gutsy Account</Text>
          </View>
          <Text style={styles.subtitle}>
            Save your scans and get personalized gut health insights across all your devices.
          </Text>
        </View>

        <View style={styles.logoSection}>
          <Image
            source={require("@/assets/images/logo1.png")}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Gutsy logo"
          />
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={s(20)} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.bottomSection}>
          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.providerBtn, styles.appleBtn]}
              onPress={() => handleSignIn("apple")}
              disabled={!!loading}
              activeOpacity={0.8}
            >
              {loading === "apple" ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={s(24)} color="#FFF" />
                  <Text style={[styles.providerBtnText, styles.appleBtnText]}>
                    Sign in with Apple
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.providerBtn, styles.googleBtn]}
              onPress={() => handleSignIn("google")}
              disabled={!!loading}
              activeOpacity={0.8}
            >
              {loading === "google" ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={s(24)} color="#374151" />
                  <Text style={[styles.providerBtnText, styles.googleBtnText]}>
                    Sign in with Google
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>
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
    paddingTop: s(48),
    alignItems: "center",
    justifyContent: "space-between",
  },
  topSection: {
    alignItems: "center",
    width: "100%",
  },
  titleContainer: {
    alignItems: "center",
    marginBottom: s(8),
  },
  bootstrapState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  logo: {
    width: s(180),
    height: s(180),
  },
  titleLine: {
    fontFamily: Fonts.cardTitle,
    fontSize: f(32),
    color: Colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: f(16),
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: f(24),
    paddingHorizontal: s(16),
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    paddingVertical: s(12),
    paddingHorizontal: s(16),
    borderRadius: BorderRadius.md,
    marginBottom: s(20),
    gap: s(8),
    alignSelf: "stretch",
  },
  errorText: {
    fontFamily: Fonts.body,
    fontSize: f(14),
    color: Colors.error,
    flex: 1,
  },
  bottomSection: {
    width: "100%",
    alignItems: "center",
    marginTop: "auto",
  },
  buttons: {
    width: "100%",
    gap: s(16),
    marginBottom: s(32),
  },
  providerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: s(18),
    paddingHorizontal: s(24),
    borderRadius: BorderRadius.lg,
    gap: s(12),
    ...Shadows.md,
  },
  appleBtn: {
    backgroundColor: Colors.primary,
  },
  googleBtn: {
    backgroundColor: "#FFF",
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  providerBtnText: {
    fontFamily: Fonts.cardTitle,
    fontSize: f(17),
  },
  appleBtnText: {
    color: "#FFF",
  },
  googleBtnText: {
    color: "#374151",
  },
  footer: {
    fontFamily: Fonts.body,
    fontSize: f(12),
    color: Colors.textMuted,
    textAlign: "center",
    paddingHorizontal: s(20),
    marginBottom: s(16),
  },
});
