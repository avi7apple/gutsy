import { BorderRadius, Colors, Fonts, Shadows, Spacing } from "@/constants/theme";
import { getRedirectUri, signInWithOAuth, syncOnboardingToAccount } from "@/lib/auth";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Linking,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function CreateAccountScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState<"apple" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOAuthRedirect = useCallback(async (url: string) => {
    const redirectTo = getRedirectUri();
    if (!url.startsWith(redirectTo.split("#")[0]) && !url.includes("access_token")) return;
    const hash = url.includes("#") ? url.split("#")[1] : "";
    if (!hash) return;
    const params = Object.fromEntries(new URLSearchParams(hash));
    const access_token = params.access_token;
    const refresh_token = params.refresh_token;
    if (!access_token || !refresh_token) return;

    const { supabase } = await import("@/lib/supabase");
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
    router.replace("/(tabs)" as any);
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
      const { error: err } = await signInWithOAuth(provider);
      if (err) {
        setError(err.message);
        setLoading(null);
        return;
      }
      await syncOnboardingToAccount();
      setLoading(null);
      router.replace("/(tabs)" as any);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
      setLoading(null);
    }
  };

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
            <Ionicons name="alert-circle" size={20} color={Colors.error} />
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
                  <Ionicons name="logo-apple" size={24} color="#FFF" />
                  <Text style={[styles.providerBtnText, styles.appleBtnText]}>Sign in with Apple</Text>
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
                  <Ionicons name="logo-google" size={24} color="#374151" />
                  <Text style={[styles.providerBtnText, styles.googleBtnText]}>Sign in with Google</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.massive,
    alignItems: "center",
    justifyContent: "space-between",
  },
  topSection: {
    alignItems: "center",
    width: "100%",
  },
  titleContainer: {
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  logoSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  logo: {
    width: 180,
    height: 180,
  },
  titleLine: {
    fontFamily: Fonts.cardTitle,
    fontSize: 32,
    color: Colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: Spacing.lg,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
    alignSelf: "stretch",
  },
  errorText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.error,
    flex: 1,
  },
  bottomSection: {
    width: "100%",
    alignItems: "center",
  },
  buttons: {
    width: "100%",
    gap: Spacing.lg,
    marginBottom: Spacing.xxxl,
  },
  providerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xxl,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
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
    fontSize: 17,
  },
  appleBtnText: {
    color: "#FFF",
  },
  googleBtnText: {
    color: "#374151",
  },
  footer: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
});
