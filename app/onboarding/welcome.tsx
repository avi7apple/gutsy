import OnboardingButton from "@/components/onboarding/OnboardingButton";
import { BorderRadius, Colors, Fonts, OnboardingButtonBar, Shadows, Spacing } from "@/constants/theme";
import { finalizePostAuth, signInWithProvider, syncOnboardingToAccount } from "@/lib/auth";
import { rf, rs } from "@/lib/hooks/use-responsive";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter, type Href } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    useWindowDimensions,
    View,
} from "react-native";
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SHEET_HEIGHT = rs(220);
const NEW_ACCOUNT_SHEET_HEIGHT = rs(360);

const MIN_IMAGE_WIDTH = rs(280);
const MIN_IMAGE_HEIGHT = rs(200);

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const [showSignInSheet, setShowSignInSheet] = useState(false);
  const [sheetClosing, setSheetClosing] = useState(false);
  const [loading, setLoading] = useState<"apple" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNewAccountSheet, setShowNewAccountSheet] = useState(false);
  const [newAccountSheetClosing, setNewAccountSheetClosing] = useState(false);

  const sheetTranslateY = useSharedValue(SHEET_HEIGHT);
  const newAccountTranslateY = useSharedValue(NEW_ACCOUNT_SHEET_HEIGHT);

  // Animation values
  const logoOpacity = useSharedValue(0);
  const logoTranslateY = useSharedValue(-20);
  const logoScale = useSharedValue(0.9);

  const imageOpacity = useSharedValue(0);
  const imageScale = useSharedValue(0.8);

  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(30);

  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(30);

  const signInOpacity = useSharedValue(0);

  useEffect(() => {
    // Logo animation - fade in from top with scale
    logoOpacity.value = withTiming(1, {
      duration: 600,
      easing: Easing.out(Easing.ease),
    });
    logoTranslateY.value = withSpring(0, {
      damping: 15,
      stiffness: 100,
    });
    logoScale.value = withSpring(1, {
      damping: 12,
      stiffness: 100,
    });

    // Image animation - fade in with scale up
    imageOpacity.value = withDelay(
      200,
      withTiming(1, {
        duration: 800,
        easing: Easing.out(Easing.ease),
      })
    );
    imageScale.value = withDelay(
      200,
      withSpring(1, {
        damping: 12,
        stiffness: 80,
      })
    );

    // Text animation - slide up with fade
    textOpacity.value = withDelay(
      400,
      withTiming(1, {
        duration: 700,
        easing: Easing.out(Easing.ease),
      })
    );
    textTranslateY.value = withDelay(
      400,
      withSpring(0, {
        damping: 15,
        stiffness: 100,
      })
    );

    // Button animation - slide up with fade
    buttonOpacity.value = withDelay(
      600,
      withTiming(1, {
        duration: 600,
        easing: Easing.out(Easing.ease),
      })
    );
    buttonTranslateY.value = withDelay(
      600,
      withSpring(0, {
        damping: 15,
        stiffness: 100,
      })
    );

    // Sign in text - fade in
    signInOpacity.value = withDelay(
      800,
      withTiming(1, {
        duration: 500,
        easing: Easing.out(Easing.ease),
      })
    );
    // Intentionally empty deps - animations should only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showSignInSheet) {
      setError(null);
      setSheetClosing(false);
      sheetTranslateY.value = withTiming(0, {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [showSignInSheet]);

  useEffect(() => {
    if (showNewAccountSheet) {
      setNewAccountSheetClosing(false);
      newAccountTranslateY.value = withTiming(0, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [showNewAccountSheet]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const newAccountSheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: newAccountTranslateY.value }],
  }));

  // Animated styles
  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { translateY: logoTranslateY.value },
      { scale: logoScale.value },
    ],
  }));

  const imageAnimatedStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
    transform: [{ scale: imageScale.value }],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonTranslateY.value }],
  }));

  const signInAnimatedStyle = useAnimatedStyle(() => ({
    opacity: signInOpacity.value,
  }));

  const handleGetStarted = () => {
    router.push("/onboarding/analyze-first" as Href);
  };

  const openSignInSheet = () => setShowSignInSheet(true);
  const closeSignInSheet = () => {
    if (loading) return;
    setSheetClosing(true);
    sheetTranslateY.value = withTiming(
      SHEET_HEIGHT,
      { duration: 220 },
      (finished) => {
        if (finished) {
          runOnJS(setShowSignInSheet)(false);
          runOnJS(setSheetClosing)(false);
        }
      }
    );
  };

  const closeNewAccountSheet = (onClosed?: () => void) => {
    setNewAccountSheetClosing(true);
    newAccountTranslateY.value = withTiming(
      NEW_ACCOUNT_SHEET_HEIGHT,
      { duration: 240 },
      (finished) => {
        if (finished) {
          runOnJS(setShowNewAccountSheet)(false);
          runOnJS(setNewAccountSheetClosing)(false);
          if (onClosed) runOnJS(onClosed)();
        }
      }
    );
  };

  const handleStartOnboarding = () => {
    closeNewAccountSheet(() => {
      router.push("/onboarding/analyze-first" as Href);
    });
  };

  const handleSignInWithProvider = async (provider: "apple" | "google") => {
    setError(null);
    setLoading(provider);
    try {
      const { error: err } = await signInWithProvider(provider);
      if (err) {
        setError(err.message);
        setLoading(null);
        return;
      }

      // Check whether this OAuth account already has a Gutsy profile with
      // completed onboarding. If not, treat it as a fresh sign-up and steer
      // the user into the onboarding funnel via the welcome sheet below.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let hasExistingAccount = false;
      if (user) {
        try {
          const { data } = await supabase
            .from("user_profiles")
            .select("onboarding")
            .eq("id", user.id)
            .single();
          hasExistingAccount = Boolean(
            (data?.onboarding as { goal?: unknown } | null)?.goal,
          );
        } catch (lookupErr) {
          console.warn("user_profiles lookup failed:", lookupErr);
        }
      }

      await syncOnboardingToAccount();
      setLoading(null);

      if (hasExistingAccount) {
        setShowSignInSheet(false);
        await finalizePostAuth(router);
      } else {
        setShowSignInSheet(false);
        setShowNewAccountSheet(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
      setLoading(null);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        {/* Logo at top */}
        <Animated.View style={[styles.logoContainer, { width: winWidth * 0.28 }, logoAnimatedStyle]}>
          <Image
            source={require("@/assets/images/logo.png")}
            style={styles.logo}
            contentFit="contain"
          />
        </Animated.View>

        {/* Welcome Image - use current dimensions so size is correct on load */}
        <Animated.View
          style={[
            styles.imageContainer,
            {
              width: Math.max(winWidth * 0.9, MIN_IMAGE_WIDTH),
              maxHeight: Math.max(winHeight * 0.4, MIN_IMAGE_HEIGHT),
            },
            imageAnimatedStyle,
          ]}
        >
          <Image
            source={require("@/assets/images/welcome.png")}
            style={styles.welcomeImage}
            contentFit="contain"
          />
        </Animated.View>

        {/* Main Text */}
        <Animated.View style={[styles.textContainer, textAnimatedStyle]}>
          <Text style={styles.mainText}>
            Fix your gut.{"\n"}Fix everything.
          </Text>
        </Animated.View>

        {/* Bottom: CTA + Sign In (kept higher) */}
        <View style={styles.bottomSection}>
          <Animated.View style={[styles.ctaSection, buttonAnimatedStyle]}>
            <OnboardingButton
              title="Get Started"
              onPress={handleGetStarted}
              style={styles.getStartedButton}
            />
          </Animated.View>
          <Animated.View style={[styles.signInContainer, signInAnimatedStyle]}>
            <OnboardingButton
              title="Already have an account? Sign in"
              onPress={openSignInSheet}
              variant="text"
              style={styles.signInButton}
              textStyle={styles.signInText}
            />
          </Animated.View>
        </View>
      </SafeAreaView>

      <Modal
        visible={showSignInSheet || sheetClosing}
        transparent
        animationType="none"
        onRequestClose={closeSignInSheet}
      >
        <TouchableWithoutFeedback onPress={closeSignInSheet}>
          <View style={styles.sheetBackdrop} />
        </TouchableWithoutFeedback>
        <Animated.View
          style={[
            styles.sheetContainer,
            { paddingBottom: Math.max(insets.bottom, Spacing.lg) },
            sheetAnimatedStyle,
          ]}
          pointerEvents="box-none"
        >
          <TouchableWithoutFeedback>
            <View style={styles.sheetContent}>
              <View style={styles.sheetHandle} />
              {error ? (
                <View style={styles.sheetError}>
                  <Ionicons name="alert-circle" size={18} color={Colors.error} />
                  <Text style={styles.sheetErrorText}>{error}</Text>
                </View>
              ) : null}
              <View style={styles.sheetButtons}>
                <TouchableOpacity
                  style={[styles.providerBtn, styles.appleBtn]}
                  onPress={() => handleSignInWithProvider("apple")}
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
                  onPress={() => handleSignInWithProvider("google")}
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
            </View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </Modal>

      <Modal
        visible={showNewAccountSheet || newAccountSheetClosing}
        transparent
        animationType="none"
        onRequestClose={() => closeNewAccountSheet()}
      >
        <View style={styles.sheetBackdrop} />
        <Animated.View
          style={[
            styles.newAccountSheetContainer,
            { paddingBottom: Math.max(insets.bottom, Spacing.lg) },
            newAccountSheetAnimatedStyle,
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.newAccountSheetContent}>
            <View style={styles.sheetHandle} />
            <View style={styles.newAccountIconWrap}>
              <Ionicons name="sparkles" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.newAccountHeading}>Welcome to Gutsy!</Text>
            <Text style={styles.newAccountBody}>
              Looks like you don&apos;t have an account yet. Let&apos;s set you
              up with a personalized gut health plan — it only takes a couple
              of minutes.
            </Text>
            <TouchableOpacity
              style={styles.newAccountPrimaryBtn}
              onPress={handleStartOnboarding}
              activeOpacity={0.85}
            >
              <Text style={styles.newAccountPrimaryBtnText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF8F3",
  },
  safeArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: rs(Spacing.xxl),
    paddingBottom: rs(Spacing.xxxl),
  },

  // Logo (width set inline from useWindowDimensions)
  logoContainer: {
    height: rs(44),
    marginTop: rs(Spacing.lg),
    marginBottom: rs(Spacing.xl),
  },
  logo: {
    width: "100%",
    height: "100%",
  },

  // Welcome Image (width/maxHeight set inline from useWindowDimensions)
  imageContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: rs(Spacing.xl),
  },
  welcomeImage: {
    width: "100%",
    height: "100%",
  },

  // Text
  textContainer: {
    paddingHorizontal: rs(Spacing.xxl),
    marginBottom: rs(Spacing.xxxl),
    alignItems: "center",
  },
  mainText: {
    fontSize: rf(36),
    fontWeight: "700",
    color: "#2E2E2E",
    textAlign: "center",
    lineHeight: rf(44),
    letterSpacing: -0.8,
  },

  bottomSection: {
    width: "100%",
    paddingTop: rs(OnboardingButtonBar.paddingTop),
    paddingBottom: rs(OnboardingButtonBar.paddingBottom),
    paddingHorizontal: rs(OnboardingButtonBar.paddingHorizontal),
  },
  ctaSection: {
    width: "100%",
    marginBottom: rs(Spacing.lg),
  },
  getStartedButton: {
    backgroundColor: "#325C3A",
    ...Shadows.md,
  },

  // Sign In
  signInContainer: {
    width: "100%",
  },
  signInButton: {
    alignSelf: "center",
  },
  signInText: {
    color: "#2E2E2E",
    fontSize: rf(15),
    fontWeight: "500",
  },

  // Sign-in sheet (same buttons as auth page)
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    backgroundColor: Colors.background,
    ...Shadows.lg,
  },
  sheetContent: {
    paddingHorizontal: rs(Spacing.xxl),
    paddingTop: rs(Spacing.md),
  },
  sheetHandle: {
    width: rs(36),
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: rs(Spacing.lg),
  },
  sheetError: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  sheetErrorText: {
    fontFamily: Fonts.body,
    fontSize: rf(13),
    color: Colors.error,
    flex: 1,
  },
  sheetButtons: {
    gap: rs(Spacing.lg),
    paddingBottom: rs(Spacing.lg),
  },
  providerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: rs(Spacing.xl),
    paddingHorizontal: rs(Spacing.xxl),
    borderRadius: rs(BorderRadius.lg),
    gap: rs(Spacing.md),
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
    fontFamily: Fonts.pageTitle,
    fontSize: rf(17),
  },
  appleBtnText: {
    color: "#FFF",
  },
  googleBtnText: {
    color: "#374151",
  },

  // New-account bottom sheet
  newAccountSheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    backgroundColor: Colors.background,
    ...Shadows.lg,
  },
  newAccountSheetContent: {
    paddingHorizontal: rs(Spacing.xxl),
    paddingTop: rs(Spacing.md),
    paddingBottom: rs(Spacing.lg),
    alignItems: "center",
  },
  newAccountIconWrap: {
    width: rs(56),
    height: rs(56),
    borderRadius: rs(28),
    backgroundColor: `${Colors.primary}1A`,
    alignItems: "center",
    justifyContent: "center",
    marginTop: rs(Spacing.md),
    marginBottom: rs(Spacing.lg),
  },
  newAccountHeading: {
    fontFamily: Fonts.pageTitle,
    fontSize: rf(22),
    color: Colors.text,
    textAlign: "center",
    marginBottom: rs(Spacing.sm),
  },
  newAccountBody: {
    fontFamily: Fonts.body,
    fontSize: rf(15),
    lineHeight: rf(22),
    color: Colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: rs(Spacing.sm),
    marginBottom: rs(Spacing.xl),
  },
  newAccountPrimaryBtn: {
    width: "100%",
    paddingVertical: rs(Spacing.lg),
    borderRadius: rs(BorderRadius.lg),
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.md,
  },
  newAccountPrimaryBtnText: {
    fontFamily: Fonts.pageTitle,
    fontSize: rf(17),
    color: "#FFF",
  },
});
