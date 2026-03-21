import OnboardingButton from "@/components/onboarding/OnboardingButton";
import { BorderRadius, Colors, Fonts, OnboardingButtonBar, Shadows, Spacing } from "@/constants/theme";
import { signInWithOAuth, syncOnboardingToAccount } from "@/lib/auth";
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

const SHEET_HEIGHT = 220;

const MIN_IMAGE_WIDTH = 280;
const MIN_IMAGE_HEIGHT = 200;

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const [showSignInSheet, setShowSignInSheet] = useState(false);
  const [sheetClosing, setSheetClosing] = useState(false);
  const [loading, setLoading] = useState<"apple" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sheetTranslateY = useSharedValue(SHEET_HEIGHT);

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

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
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

  const handleSignInWithProvider = async (provider: "apple" | "google") => {
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
      setShowSignInSheet(false);
      router.replace("/(tabs)" as any);
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
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xxxl,
  },

  // Logo (width set inline from useWindowDimensions)
  logoContainer: {
    height: 44,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
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
    marginVertical: Spacing.xl,
  },
  welcomeImage: {
    width: "100%",
    height: "100%",
  },

  // Text
  textContainer: {
    paddingHorizontal: Spacing.xxl,
    marginBottom: Spacing.xxxl,
    alignItems: "center",
  },
  mainText: {
    fontSize: 36,
    fontWeight: "700",
    color: "#2E2E2E",
    textAlign: "center",
    lineHeight: 44,
    letterSpacing: -0.8,
  },

  bottomSection: {
    width: "100%",
    ...OnboardingButtonBar,
  },
  ctaSection: {
    width: "100%",
    marginBottom: Spacing.lg,
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
    fontSize: 15,
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
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.md,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: Spacing.lg,
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
    fontSize: 13,
    color: Colors.error,
    flex: 1,
  },
  sheetButtons: {
    gap: Spacing.lg,
    paddingBottom: Spacing.lg,
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
    fontFamily: Fonts.pageTitle,
    fontSize: 17,
  },
  appleBtnText: {
    color: "#FFF",
  },
  googleBtnText: {
    color: "#374151",
  },
});
