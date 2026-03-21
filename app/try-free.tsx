import { BorderRadius, Colors, Fonts, Shadows, Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const PHONE_HEIGHT_RATIO = 0.4;
const VIEWFINDER_SIZE = 140;
const SCAN_LINE_HEIGHT = 3;
const NOTCH_WIDTH = 100;
const NOTCH_HEIGHT = 28;

export default function TryFreeScreen() {
  const router = useRouter();
  const { height: winHeight, width: winWidth } = useWindowDimensions();

  const phoneFloat = useSharedValue(0);
  const phoneRotate = useSharedValue(0);
  const scanLineY = useSharedValue(0);

  useEffect(() => {
    phoneFloat.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    phoneRotate.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    scanLineY.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const phoneAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(phoneFloat.value, [0, 1], [0, 8]) },
      { rotate: `${interpolate(phoneRotate.value, [0, 1], [-0.8, 0.8])}deg` },
    ],
  }));

  const scanLineAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scanLineY.value,
          [0, 1],
          [0, VIEWFINDER_SIZE - SCAN_LINE_HEIGHT],
        ),
      },
    ],
  }));

  const handleClose = () => router.back();
  const handleRestore = () => {
    /* TODO: restore purchases */
  };
  const handleTryFree = () => router.push("/reminder-promise");

  const phoneHeight = winHeight * PHONE_HEIGHT_RATIO;
  const phoneWidth = Math.min(phoneHeight * 0.52, winWidth * 0.7);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {/* Navigation row */}
      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleClose}
          hitSlop={12}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={22} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleRestore}
          hitSlop={12}
          activeOpacity={0.7}
        >
          <Text style={styles.restoreText}>Restore</Text>
        </TouchableOpacity>
      </View>

      {/* Headline */}
      <View style={styles.headlineBlock}>
        <Text style={styles.headlineLine1}>We want you to</Text>
        <Text style={styles.headlineLine2}>try Gutsy for free.</Text>
      </View>

      {/* Phone mockup */}
      <View style={[styles.phoneWrap, { height: phoneHeight }]}>
        <Animated.View
          style={[
            styles.phoneFrame,
            {
              width: phoneWidth,
              height: phoneHeight,
              borderRadius: phoneWidth * 0.12,
            },
            phoneAnimatedStyle,
          ]}
        >
          {/* Notch */}
          <View
            style={[
              styles.notch,
              {
                width: NOTCH_WIDTH,
                height: NOTCH_HEIGHT,
                borderRadius: NOTCH_HEIGHT / 2,
              },
            ]}
          />
          {/* Screen content */}
          <View style={styles.phoneScreen}>
            <View
              style={[
                styles.viewfinder,
                { width: VIEWFINDER_SIZE, height: VIEWFINDER_SIZE },
              ]}
            >
              {/* L-shaped corner brackets */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              {/* Product emoji */}
              <Text style={styles.emoji}>📦</Text>
              {/* Scan line */}
              <View
                style={[
                  styles.scanLineContainer,
                  { width: VIEWFINDER_SIZE, height: VIEWFINDER_SIZE },
                ]}
              >
                <Animated.View
                  style={[styles.scanLineWrap, scanLineAnimatedStyle]}
                >
                  <LinearGradient
                    colors={["transparent", Colors.accent, "transparent"]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.scanLine}
                  />
                </Animated.View>
              </View>
            </View>
            {/* Toolbar pill */}
            <View style={styles.toolbarPill}>
              <Text style={styles.toolbarLabel}>Scan</Text>
              <View style={styles.toolbarIcons}>
                <View style={styles.toolbarIcon} />
                <View style={styles.toolbarIcon} />
                <View style={styles.toolbarIcon} />
              </View>
            </View>
            {/* Shutter button */}
            <View style={styles.shutterBtn} />
          </View>
        </Animated.View>
      </View>

      {/* Bottom action zone */}
      <View style={styles.bottomZone}>
        <Text style={styles.noPayment}>✓ No Payment Due Now.</Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleTryFree}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Try for $0.00</Text>
        </TouchableOpacity>
        <Text style={styles.pricing}>Just $39.99 per year ($0.77/week) </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, 
    backgroundColor: Colors.background,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  restoreText: {
    fontFamily: Fonts.body,
    fontSize: 16,
    color: Colors.textMuted,
  },
  headlineBlock: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    alignItems: "center",
  },
  headlineLine1: {
    fontFamily: Fonts.cardTitle,
    fontSize: 32,
    color: Colors.text,
    lineHeight: 40,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  headlineLine2: {
    fontFamily: Fonts.cardTitle,
    fontSize: 32,
    color: Colors.primary,
    lineHeight: 40,
    letterSpacing: -0.5,
    fontStyle: "italic",
    marginTop: 2,
    textAlign: "center",
  },
  phoneWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 220,
  },
  phoneFrame: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.3)",
    overflow: "hidden",
    ...Shadows.lg,
  },
  notch: {
    position: "absolute",
    top: 8,
    left: "50%",
    marginLeft: -NOTCH_WIDTH / 2,
    backgroundColor: "#0d0d0d",
    zIndex: 2,
  },
  phoneScreen: {
    flex: 1,
    backgroundColor: "#0d0d0d",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: NOTCH_HEIGHT + 16,
    paddingBottom: 24,
  },
  viewfinder: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
  },
  corner: {
    position: "absolute",
    width: 20,
    height: 20,
    borderColor: Colors.accent,
    borderWidth: 2,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  emoji: {
    fontSize: 48,
  },
  scanLineContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-start",
    overflow: "hidden",
  },
  scanLineWrap: {
    width: "100%",
    height: SCAN_LINE_HEIGHT,
    justifyContent: "center",
  },
  scanLine: {
    height: SCAN_LINE_HEIGHT,
    width: VIEWFINDER_SIZE,
  },
  toolbarPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginTop: 24,
    minWidth: 120,
  },
  toolbarLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },
  toolbarIcons: {
    flexDirection: "row",
    gap: 6,
  },
  toolbarIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  shutterBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.5)",
    backgroundColor: "transparent",
    marginTop: 12,
  },
  bottomZone: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxxl + 8,
    alignItems: "center",
  },
  noPayment: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xxxl,
    borderRadius: BorderRadius.lg,
    width: "100%",
    alignItems: "center",
    ...Shadows.md,
  },
  primaryBtnText: {
    fontFamily: Fonts.cardTitle,
    fontSize: 18,
    color: "#FFFFFF",
  },
  pricing: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: Spacing.lg,
  },
});
