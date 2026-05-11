import { BorderRadius, Colors, Spacing } from "@/constants/theme";
import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
    Easing,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";

// ─── Animated shimmer pulse ───────────────────────────────────────────
function useShimmer() {
  const pulse = useSharedValue(0);

  React.useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  return useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.35, 0.7]),
  }));
}

// ─── Fade-in wrapper ──────────────────────────────────────────────────
export function FadeIn({
  children,
  visible,
  duration = 350,
  style,
}: {
  children: React.ReactNode;
  visible: boolean;
  duration?: number;
  style?: any;
}) {
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, {
      duration,
      easing: Easing.out(Easing.ease),
    });
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}

// ─── Skeleton primitives ──────────────────────────────────────────────
export function Shimmer({
  width = "100%" as number | string,
  height = 16,
  borderRadius = 6,
  style,
}: {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}) {
  const shimmerStyle = useShimmer();
  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: "#E8E4DD",
        },
        shimmerStyle,
        style,
      ]}
    />
  );
}

export function ShimmerCircle({ size = 72, style }: { size?: number; style?: any }) {
  const shimmerStyle = useShimmer();
  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#E8E4DD",
        },
        shimmerStyle,
        style,
      ]}
    />
  );
}

// ─── Pre-built skeleton screens ───────────────────────────────────────

/** Profile screen skeleton */
export function ProfileSkeleton() {
  return (
    <View style={{ gap: 16 }}>
      {/* Avatar + name */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingTop: 24, paddingBottom: 20 }}>
        <ShimmerCircle size={72} />
        <View style={{ flex: 1, gap: 8 }}>
          <Shimmer width={150} height={22} />
          <Shimmer width={100} height={14} />
        </View>
      </View>
      {/* Stats card */}
      <View style={skeletonStyles.card}>
        <Shimmer width={100} height={18} style={{ marginBottom: 16 }} />
        <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ alignItems: "center", gap: 6 }}>
              <Shimmer width={48} height={28} borderRadius={8} />
              <Shimmer width={56} height={12} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/** History screen skeleton */
export function HistorySkeleton() {
  return (
    <View style={{ gap: 12, paddingHorizontal: Spacing.xxl }}>
      {/* Search bar skeleton */}
      <Shimmer width="100%" height={44} borderRadius={BorderRadius.md} />
      {/* Filter chips */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[1, 2, 3, 4].map((i) => (
          <Shimmer key={i} width={56} height={30} borderRadius={BorderRadius.sm} />
        ))}
      </View>
      {/* Section header */}
      <Shimmer width={60} height={13} style={{ marginTop: 12 }} />
      {/* Scan items */}
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[skeletonStyles.card, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
          <Shimmer width={56} height={56} borderRadius={BorderRadius.sm} />
          <View style={{ flex: 1, gap: 6 }}>
            <Shimmer width="70%" height={16} />
            <Shimmer width="40%" height={12} />
          </View>
          <Shimmer width={36} height={28} borderRadius={BorderRadius.sm} />
        </View>
      ))}
    </View>
  );
}

export function RecentScansSkeleton() {
  return (
    <View style={{ gap: 10 }}>
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          style={[
            skeletonStyles.card,
            {
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: Spacing.md,
            },
          ]}
        >
          <Shimmer width={56} height={56} borderRadius={BorderRadius.sm} />
          <View style={{ flex: 1, gap: 7 }}>
            <Shimmer width="64%" height={15} />
            <Shimmer width="34%" height={11} />
          </View>
          <Shimmer width={34} height={26} borderRadius={BorderRadius.sm} />
        </View>
      ))}
    </View>
  );
}

export function HomeHeaderSkeleton() {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <View style={{ flex: 1, gap: 8, paddingRight: 12 }}>
        <Shimmer width={110} height={14} borderRadius={6} />
        <Shimmer width={170} height={28} borderRadius={8} />
      </View>
      <ShimmerCircle size={44} />
    </View>
  );
}

/** Scan result loading skeleton */
export function ScanResultSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, padding: 24, gap: 20, paddingTop: 60 }}>
      {/* Image placeholder */}
      <Shimmer width="100%" height={200} borderRadius={BorderRadius.lg} />
      {/* Title */}
      <Shimmer width="60%" height={24} />
      {/* Score */}
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <ShimmerCircle size={64} />
        <View style={{ flex: 1, gap: 8 }}>
          <Shimmer width="80%" height={16} />
          <Shimmer width="50%" height={14} />
        </View>
      </View>
      {/* Content lines */}
      <Shimmer width="100%" height={14} />
      <Shimmer width="90%" height={14} />
      <Shimmer width="95%" height={14} />
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});

// ─── SkeletonCard component replaced with Shimmer component ────────────
export function SkeletonCard({ width = "100%", height = 120, style }: { width?: number | string; height?: number; style?: any }) {
  return (
    <Shimmer width={width} height={height} borderRadius={BorderRadius.lg} style={style} />
  );
}

export function SkeletonText({ width = "100%", height = 16, style }: { width?: number | string; height?: number; style?: any }) {
  return (
    <Shimmer width={width} height={height} borderRadius={4} style={style} />
  );
}

export function SkeletonAvatar({ size = 72, style }: { size?: number; style?: any }) {
  return (
    <ShimmerCircle size={size} style={style} />
  );
}

export function SkeletonStatsGrid() {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: Spacing.md }}>
      {[1, 2, 3].map((index) => (
        <View key={index} style={{ alignItems: "center", gap: Spacing.xs }}>
          <SkeletonCard width={60} height={24} style={{ marginBottom: Spacing.xs }} />
          <SkeletonText width={60} height={12} />
        </View>
      ))}
    </View>
  );
}
