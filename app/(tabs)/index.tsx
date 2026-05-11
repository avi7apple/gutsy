import { RecentScansSkeleton, ShimmerCircle } from "@/components/SkeletonCard";
import { SmoothFade } from "@/components/SmoothUpdate";
import {
    BorderRadius,
    Colors,
    Fonts,
    Shadows,
    Spacing
} from "@/constants/theme";
import { getScoreProfile } from "@/lib/gut-score";
import { useAuthUserQuery } from "@/lib/hooks/use-auth-user-query";
import { useGutScore } from "@/lib/hooks/use-gut-score-query";
import { useRecentScans } from "@/lib/hooks/use-recent-scans-query";
import { rf, rs } from "@/lib/hooks/use-responsive";
import { useScansForDay } from "@/lib/hooks/use-scans-for-day-query";
import { useUserStats } from "@/lib/hooks/use-user-stats-query";
import { useWeekData } from "@/lib/hooks/use-week-data-query";
import { supabase } from "@/lib/supabase";
import { capitalizeWords } from "@/lib/utils/text-formatting";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect } from "react";
import {
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming, } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Circle, Defs, RadialGradient, Rect, Stop, Svg } from "react-native-svg";

/** Home section background and streak colors per spec */
const HOME_BG = "#FAF8F3";
const STREAK_ORANGE = "#EA580C";
const CARD_BG = "#FFFFFF";
const CARD_BORDER = "rgba(0,0,0,0.06)";
const SECTION_PADDING_H = rs(24);
const DAY_GRID_GAP = rs(8);

/** Weekly calendar — single accent (primary green) for tracked days */
const WEEK_CALENDAR_PRIMARY = "#2D6A4F";
const WEEK_UNTRACKED_BG = "#F5F3EF";
const WEEK_UNTRACKED_BORDER = "#E8E4DC";
const WEEK_DAY_OUTLINE = "#E0DDD8";
const WEEK_CARD_BORDER = "#E8E4DC";
const WEEK_MUTED_TEXT = "#95918A";
const WEEK_DARK_TEXT = "#1A1A1A";

/** Time-based greeting */
function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}


const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Section 2: Hero gut score ring — 90×90, stroke 8, R ~41 */
const HERO_RING_SIZE = rs(90);
const HERO_RING_STROKE = rs(8);
const HERO_RING_R = (HERO_RING_SIZE - HERO_RING_STROKE) / 2;
const HERO_RING_CIRCUMFERENCE = 2 * Math.PI * HERO_RING_R;

/** CTA gradient (green spectrum) */
const CTA_GRADIENT = [Colors.primaryLight, Colors.primary] as const;
const IMPACT_POSITIVE = "#52B788";
const IMPACT_NEGATIVE = "#D64545";
const IMPACT_NEUTRAL = "rgba(0,0,0,0.4)";

function getGutRingColor(score: number): string {
  if (score >= 70) return Colors.success;
  if (score >= 40) return Colors.warning;
  return Colors.error;
}

function GutScoreHeroRing({ score, color }: { score: number; color: string }) {
  const progress = useSharedValue(0);
  React.useEffect(() => {
    progress.value = withDelay(
      200,
      withTiming(score / 100, { duration: 1500, easing: Easing.out(Easing.ease) })
    );
  }, [score]);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: HERO_RING_CIRCUMFERENCE * (1 - progress.value),
  }));
  return (
    <View style={styles.heroRingWrap}>
      <Svg
        width={HERO_RING_SIZE}
        height={HERO_RING_SIZE}
        style={[styles.heroRingSvg, { transform: [{ rotate: "-90deg" }] }]}
      >
        <Circle
          cx={HERO_RING_SIZE / 2}
          cy={HERO_RING_SIZE / 2}
          r={HERO_RING_R}
          stroke={Colors.borderLight}
          strokeWidth={HERO_RING_STROKE}
          fill="none"
          strokeOpacity={0.5}
        />
        <AnimatedCircle
          cx={HERO_RING_SIZE / 2}
          cy={HERO_RING_SIZE / 2}
          r={HERO_RING_R}
          stroke={color}
          strokeWidth={HERO_RING_STROKE}
          fill="none"
          strokeDasharray={HERO_RING_CIRCUMFERENCE}
          strokeLinecap="round"
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={styles.heroRingCenter}>
        <Text style={[styles.heroRingScore, { color }]}>{Math.round(score)}</Text>
        <Text style={styles.heroRingMax}>/100</Text>
      </View>
    </View>
  );
}

function ShimmerButton({
  onPress,
  children,
  gradientColors,
  shimmer = true,
}: {
  onPress: () => void;
  children: React.ReactNode;
  gradientColors: readonly [string, string];
  shimmer?: boolean;
}) {
  const shimmerX = useSharedValue(-1);
  React.useEffect(() => {
    if (shimmer) {
      shimmerX.value = withRepeat(
        withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        -1,
        false
      );
    }
  }, [shimmer]);
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value * 400 }],
  }));
  return (
    <TouchableOpacity
      style={styles.ctaButtonWrap}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={[gradientColors[0], gradientColors[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.ctaButtonGradient}
      >
        <View style={styles.ctaButtonContent}>{children}</View>
        {shimmer && (
          <Animated.View style={[styles.ctaShimmer, shimmerStyle]}>
            <LinearGradient
              colors={["transparent", "rgba(255,255,255,0.2)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

function GutScoreCardHero({
  score,
  profile,
  severityColor,
  onScanPress,
  cardAnimatedStyle,
}: {
  score: number;
  profile: ReturnType<typeof getScoreProfile>;
  severityColor: string;
  onScanPress: () => void;
  cardAnimatedStyle: any;
}) {
  const ringColor = getGutRingColor(score);
  return (
    <Animated.View style={[styles.gutScoreHeroCard, cardAnimatedStyle]}>
      {/* Decorative corner accent */}
      <View style={styles.cornerAccentWrap} pointerEvents="none">
        <Svg width={100} height={100} style={styles.cornerAccentSvg}>
          <Defs>
            <RadialGradient
              id="gutScoreCornerGlow"
              cx="100%"
              cy="0%"
              rx="1"
              ry="1"
              fx="100%"
              fy="0%"
            >
              <Stop offset="0" stopColor={severityColor} stopOpacity={0.15} />
              <Stop offset="1" stopColor={severityColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={100}
            height={100}
            fill="url(#gutScoreCornerGlow)"
          />
        </Svg>
      </View>

      <View style={styles.gutScoreHeroRow}>
        <GutScoreHeroRing score={score} color={ringColor} />
        <View style={styles.gutScoreHeroRight}>
          <View
            style={[
              styles.gutScoreBadge,
              {
                backgroundColor: `${severityColor}26`,
                borderColor: `${severityColor}4D`,
              }]
            }
          >
            <Text style={[styles.gutScoreBadgeText, { color: severityColor }]}>
              {profile.pillLabel.toUpperCase().replace(/\s+/g, " ")}
            </Text>
          </View>
          <Text style={styles.gutScoreDescription} numberOfLines={3}>
            {profile.headline}
          </Text>
          <ShimmerButton
            onPress={onScanPress}
            gradientColors={CTA_GRADIENT}
            shimmer={false}
          >
            <Ionicons name="camera" size={20} color="#FFFFFF" style={styles.ctaButtonEmoji} />
            <Text style={styles.ctaButtonLabel}>Scan Your Next Food</Text>
          </ShimmerButton>
        </View>
      </View>
    </Animated.View>
  );
}

/** Section 3: Health Insights 2×2 grid */
const INSIGHT_ITEMS = [
  { key: "skin", label: "Skin", icon: "sparkle", color: "#E2B887" },
  { key: "bloating", label: "Bloating", icon: "drop.fill", color: "#6B9BD1" },
  { key: "energy", label: "Energy", icon: "flash", color: "#F4A261" },
  { key: "digestion", label: "Digestion", icon: "nutrients", color: "#8EB66D" },
] as const;

function getIonicon(iconName: string) {
  switch (iconName) {
    case "sparkle": return "sparkles";
    case "drop.fill": return "water";
    case "flash": return "flash";
    case "nutrients": return "nutrition";
    default: return "sparkles";
  }
}

function HealthInsightCard({
  icon,
  label,
  score,
  change,
  delayMs,
  color,
}: {
  icon: string;
  label: string;
  score: number;
  change: number;
  delayMs: number;
  color: string;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);
  React.useEffect(() => {
    opacity.value = withDelay(
      delayMs,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) })
    );
    translateY.value = withDelay(
      delayMs,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.ease) })
    );
  }, [delayMs]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  const changeColor =
    change > 0 ? IMPACT_POSITIVE : change < 0 ? IMPACT_NEGATIVE : IMPACT_NEUTRAL;
  return (
    <Animated.View style={[styles.insightCard, style]}>
      <Ionicons name={getIonicon(icon) as any} size={24} color={color} style={styles.insightIcon} />
      <Text style={styles.insightLabel}>{label}</Text>
        <View style={styles.insightScoreRow}>
          <Text style={styles.insightScoreNum}>{Math.round(score)}</Text>
          <Text style={[styles.insightChange, { color: changeColor }]}>
            {change > 0 ? `+${change}` : change < 0 ? String(change) : ""}
          </Text>
        </View>
    </Animated.View>
  );
}

function HealthInsightsGrid({
  subScores,
  delays,
}: {
  subScores: { skin: number; bloating: number; digestion: number; energy: number };
  delays: [number, number, number, number];
}) {
  const order = ["skin", "bloating", "energy", "digestion"] as const;
  return (
    <View style={styles.insightsGrid}>
      {order.map((key, i) => (
        <HealthInsightCard
          key={key}
          icon={INSIGHT_ITEMS[i].icon}
          label={INSIGHT_ITEMS[i].label}
          score={subScores[key]}
          change={0}
          delayMs={delays[i]}
          color={INSIGHT_ITEMS[i].color}
        />
      ))}
    </View>
  );
}

function QuickStatCard({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: string | number;
  icon: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.quickStatCard}>
      <View style={styles.quickStatIcon}>
        <Ionicons name="water" size={20} color={Colors.primary} />
      </View>
      <Text style={styles.quickStatValue}>{value}</Text>
      <Text style={styles.quickStatLabel}>{label}</Text>
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>;
  }

  return content;
}

const DELETE_ACTION_WIDTH = 56;

function RecentScanCard({
  scan,
  onPress,
  delayMs = 0,
}: {
  scan: {
    id: string;
    food_name: string;
    product_name?: string | null;
    image_url: string | null;
    gut_score?: number | null;
    created_at: string;
  };
  onPress: () => void;
  delayMs?: number;
}) {
  const score = scan.gut_score ?? null;
  const scoreColor = score !== null ? (score >= 70 ? Colors.scoreGreen : score >= 40 ? Colors.warning : Colors.error) : Colors.textMuted;
  const timeAgo = getTimeAgo(scan.created_at);
  const displayName = capitalizeWords(scan.product_name ?? scan.food_name);

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);
  React.useEffect(() => {
    opacity.value = withDelay(
      delayMs,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) })
    );
    translateY.value = withDelay(
      delayMs,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.ease) })
    );
  }, [delayMs]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={styles.recentScanCard}
        onPress={onPress}
        activeOpacity={0.9}
      >
        {scan.image_url ? (
          <Image source={{ uri: scan.image_url }} style={styles.recentScanImage} />
        ) : (
          <View style={styles.recentScanImagePlaceholder}>
            <Ionicons name="restaurant" size={20} color={Colors.textMuted} />
          </View>
        )}
        <View style={styles.recentScanContent}>
          <Text style={styles.recentScanFoodName} numberOfLines={1}>
            {displayName}
          </Text>
          <View style={styles.recentScanMeta}>
            <Text style={styles.recentScanTime}>{timeAgo}</Text>
          </View>
        </View>
        {score !== null && (
          <View style={[styles.recentScanScoreBadge, { backgroundColor: scoreColor + "20" }]}>
            <Text style={[styles.recentScanScoreText, { color: scoreColor }]}>
              {Math.round(score)}
            </Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile: authProfile, user, isLoading: isAuthLoading } = useAuthUserQuery();
  const today = React.useMemo(() => startOfDay(new Date()), []);
  const [selectedDate, setSelectedDate] = React.useState<Date>(() => startOfDay(new Date()));

  const {
    data: gutScoreData,
    refetch: refetchGutScore,
    isLoading: isGutScoreLoading,
  } = useGutScore(selectedDate);
  const {
    data: dayScans,
    refetch: refetchScans,
    isLoading: isScansLoading,
    isFetching: isScansFetching,
  } = useScansForDay(selectedDate);
  const {
    data: recentScans,
    refetch: refetchRecentScans,
    isLoading: isRecentScansLoading,
    isFetching: isRecentScansFetching,
  } = useRecentScans(5);
  const { data: stats, refetch: refetchStats, isLoading: isStatsLoading } = useUserStats();
  const { weekData, todayIndex, trackedCount, totalDays, refetch: refetchWeek } = useWeekData();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Prefer the real computed gut score; only fall back to neutral 50 if the
  // query genuinely has no data yet (first-ever launch with no onboarding data).
  // This prevents the "always 50" issue when users have scans or onboarding data.
  const gutScore = typeof gutScoreData?.gutScore === "number" ? gutScoreData.gutScore : 50;
  const subScores = gutScoreData?.subScores ?? { skin: 50, bloating: 50, digestion: 50, energy: 50 };
  const scoreSource = gutScoreData?.scoreSource || "onboarding";

  const isSelectedToday = isSameCalendarDay(selectedDate, today);

  // Refetch when user returns to Home so score and week data stay in sync
  useFocusEffect(
    React.useCallback(() => {
      refetchScans();
      refetchRecentScans();
    }, [refetchRecentScans, refetchScans])
  );

  const handleDeleteScan = useCallback(
    async (scanId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("meal_scans")
        .delete()
        .eq("id", scanId)
        .eq("user_id", user.id);
      if (!error) {
        refetchGutScore();
        refetchScans();
        refetchRecentScans();
        refetchWeek();
      }
    },
    [refetchGutScore, refetchRecentScans, refetchScans, refetchWeek]
  );

  const profile = getScoreProfile(gutScore);

  const firstName = authProfile.firstName;
  const avatarUrl = authProfile.avatarUrl;
  const isLoading = isGutScoreLoading || isStatsLoading || !weekData;
  const selectedDayScans = dayScans ?? [];
  const latestScans = recentScans ?? [];
  const isUsingLatestScanFallback = selectedDayScans.length === 0 && latestScans.length > 0;
  const scansToRender = isUsingLatestScanFallback ? latestScans : selectedDayScans;
  const showRecentScansSkeleton =
    isScansLoading ||
    (isScansFetching && selectedDayScans.length === 0) ||
    (selectedDayScans.length === 0 && latestScans.length === 0 && (isRecentScansLoading || isRecentScansFetching));
  const hasAuthUser = Boolean(user?.id);
  const streakCount = stats?.currentStreak || 0;

  // Clear refresh indicator once data has finished loading after pull-to-refresh
  useEffect(() => {
    if (isRefreshing && !isLoading) {
      setIsRefreshing(false);
    }
  }, [isRefreshing, isLoading]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    refetchGutScore();
    refetchScans();
    refetchRecentScans();
    refetchWeek();
    refetchStats();
  }, [refetchGutScore, refetchRecentScans, refetchScans, refetchWeek, refetchStats]);

  const sectionOpacity = useSharedValue(0);
  const sectionTranslateY = useSharedValue(24);
  useEffect(() => {
    sectionOpacity.value = withDelay(
      100,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) })
    );
    sectionTranslateY.value = withDelay(
      100,
      withTiming(0, { duration: 600, easing: Easing.out(Easing.ease) })
    );
  }, []);
  const animatedSectionStyle = useAnimatedStyle(() => ({
    opacity: sectionOpacity.value,
    transform: [{ translateY: sectionTranslateY.value }],
  }));

  const weekCardOpacity = useSharedValue(0);
  const weekCardScale = useSharedValue(0.96);
  useEffect(() => {
    weekCardOpacity.value = withDelay(
      100,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) })
    );
    weekCardScale.value = withDelay(
      100,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) })
    );
  }, []);
  const weekCardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: weekCardOpacity.value,
    transform: [{ scale: weekCardScale.value }],
  }));

  const gutScoreCardOpacity = useSharedValue(0);
  const gutScoreCardTranslateY = useSharedValue(24);
  useEffect(() => {
    if (isLoading) return;
    gutScoreCardOpacity.value = withDelay(
      100,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) })
    );
    gutScoreCardTranslateY.value = withDelay(
      100,
      withTiming(0, { duration: 600, easing: Easing.out(Easing.ease) })
    );
  }, [isLoading]);
  const gutScoreCardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: gutScoreCardOpacity.value,
    transform: [{ translateY: gutScoreCardTranslateY.value }],
  }));

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: HOME_BG }]}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Section overview: greeting, title, notification, weekly calendar card — slide-up fade-in */}
        <Animated.View style={[styles.sectionOverview, animatedSectionStyle]}>
          {/* Part 1: Header row */}
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionGreeting}>{getTimeGreeting()},</Text>
              <Text style={styles.sectionTitle}>
                {firstName ? firstName : "Your Gut Health"}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.profileAvatarButton}
              onPress={() => {}}
              activeOpacity={0.8}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {isAuthLoading && hasAuthUser ? (
                <ShimmerCircle size={44} />
              ) : avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.profileAvatarImage}
                />
              ) : (
                <View style={styles.profileAvatarFallback}>
                  <Text style={styles.profileAvatarInitial}>
                    {firstName ? firstName.charAt(0).toUpperCase() : "?"}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Part 2: Weekly calendar card */}
          <Animated.View style={[styles.weekCard, weekCardAnimatedStyle]}>
            <View style={styles.weekCardHeader}>
              <View style={styles.weekCardHeaderLeft}>
                <Text style={styles.weekCardHeaderTitle}>This Week</Text>
                <Text style={styles.weekCardHeaderSubtitle}>
                  {isLoading ? "—" : `${trackedCount} of ${totalDays} days tracked`}
                </Text>
              </View>
              <View style={styles.weekCardStreakBadge}>
                <Text style={styles.weekCardStreakText}>
                  {streakCount}-day streak
                </Text>
                <Ionicons name="flame" size={16} color="#FF6B35" style={styles.streakIcon} />
              </View>
            </View>
            <View style={styles.weekCardGrid}>
              {weekData.map((item, index) => {
                const isTracked = item.status !== "none";
                const isFutureDate = item.dateObj instanceof Date 
                  ? startOfDay(item.dateObj).getTime() > today.getTime()
                  : false;
                return (
                  <TouchableOpacity
                    key={`${item.date}-${index}`}
                    style={[styles.weekCardColumn, isFutureDate && styles.weekCardColumnDisabled]}
                    onPress={() => {
                      if (isFutureDate || !(item.dateObj instanceof Date)) return;
                      setSelectedDate(item.dateObj);
                    }}
                    activeOpacity={0.8}
                    disabled={isFutureDate}
                  >
                    <Text
                      style={[
                        styles.weekCardDayLabel,
                        item.isToday && styles.weekCardDayLabelToday,
                      ]}
                    >
                      {item.day}
                    </Text>
                    <View
                      style={[
                        styles.weekCardDateSquare,
                        isTracked && {
                          backgroundColor: `${WEEK_CALENDAR_PRIMARY}1A`,
                          borderColor: WEEK_DAY_OUTLINE,
                          borderWidth: item.isToday ? 2 : 1,
                          borderStyle: "solid" as const,
                        },
                        !isTracked && {
                          backgroundColor: WEEK_UNTRACKED_BG,
                          borderWidth: item.isToday ? 2 : 1,
                          borderColor: WEEK_DAY_OUTLINE,
                          borderStyle: "solid" as const,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.weekCardDateNum,
                          !isTracked && styles.weekCardDateNumMuted,
                        ]}
                      >
                        {item.date}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        </Animated.View>

        {/* Section 2: Gut Health Score Card — 20px below calendar */}
        <GutScoreCardHero
          score={gutScore}
          profile={profile}
          severityColor={Colors.primary}
          onScanPress={() => router.push("/(tabs)/scan")}
          cardAnimatedStyle={gutScoreCardAnimatedStyle}
        />
        {!isSelectedToday && !isLoading && (
          <Text style={styles.gutScoreDateHint}>
            {selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </Text>
        )}
        {(scoreSource === "scans_yesterday" || scoreSource === "scans_previous" || scoreSource === "none" || (scoreSource === "onboarding" && selectedDayScans.length > 0)) && !isLoading && (
          <Text style={styles.scoreSourceHint}>
            {scoreSource === "scans_yesterday"
              ? "No meals logged for this day. Showing yesterday's score."
              : scoreSource === "scans_previous"
              ? "No meals logged for this day. Showing your latest previous logged-day score."
              : scoreSource === "none"
              ? "No scans were recorded for this day yet."
              : "Log meals as eaten to see your gut score for this day."}
          </Text>
        )}

        {/* Section 3: Health Insights Grid — 24px below gut score */}
        <SmoothFade visible={!isLoading} delay={300}>
          {!isLoading && (
            <HealthInsightsGrid
              subScores={subScores}
              delays={[0, 100, 200, 300]}
            />
          )}
        </SmoothFade>

        {/* Section 4: Recent Scans — 24px below insights */}
        <View style={styles.recentScansSection}>
          <View style={styles.recentScansHeader}>
            <Text style={styles.recentScansTitle}>Recent Scans</Text>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/history")}
              style={styles.seeAllButton}
            >
              <Text style={styles.seeAllText}>See All →</Text>
            </TouchableOpacity>
          </View>

          {showRecentScansSkeleton ? (
            <RecentScansSkeleton />
          ) : scansToRender.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateIconWrap}>
                <Ionicons name="camera" size={48} color={Colors.primary} />
              </View>
              <Text style={styles.emptyStateText}>No scans yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Scan your first product to get started
              </Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() => router.push("/(tabs)/scan")}
              >
                <Text style={styles.emptyStateButtonText}>Scan Now</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.recentScansList}>
              {isUsingLatestScanFallback ? (
                <Text style={styles.recentScansFallbackHint}>No scans for this day. Showing your latest scans.</Text>
              ) : null}
              {scansToRender.slice(0, 5).map((scan: any, index: number) => (
                <SmoothFade key={scan.id} visible={true} delay={index * 50}>
                  <RecentScanCard
                    scan={scan}
                    onPress={() => router.push(`/scan-result?id=${scan.id}`)}
                    delayMs={0}
                  />
                </SmoothFade>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: HOME_BG,
  },
  scrollContent: {
    paddingHorizontal: SECTION_PADDING_H,
    paddingTop: rs(Spacing.xl),
    paddingBottom: rs(120),
  },
  sectionOverview: {
    paddingHorizontal: 0,
    marginBottom: rs(20),
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: rs(20),
  },
  sectionHeaderLeft: {
    flex: 1,
  },
  sectionGreeting: {
    fontFamily: Fonts.body,
    fontSize: rf(14),
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  sectionTitle: {
    fontFamily: Fonts.pageTitle,
    fontSize: rf(28),
    color: "#1a1a1a",
    letterSpacing: -0.5,
  },
  profileAvatarButton: {
    width: rs(44),
    height: rs(44),
    borderRadius: rs(22),
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    ...Shadows.sm,
  },
  profileAvatarImage: {
    width: rs(44),
    height: rs(44),
    borderRadius: rs(22),
  },
  profileAvatarFallback: {
    width: rs(44),
    height: rs(44),
    borderRadius: rs(22),
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  profileAvatarInitial: {
    fontFamily: Fonts.pageTitle,
    fontSize: rf(18),
    color: "#FFFFFF",
  },
  weekCard: {
    backgroundColor: CARD_BG,
    borderRadius: rs(20),
    borderWidth: 1,
    borderColor: WEEK_CARD_BORDER,
    padding: rs(20),
    marginBottom: rs(12),
  },
  weekCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: rs(16),
  },
  weekCardHeaderLeft: {
    gap: 2,
  },
  weekCardHeaderTitle: {
    fontFamily: Fonts.cardTitle,
    fontSize: rf(15),
    color: WEEK_DARK_TEXT,
  },
  weekCardHeaderSubtitle: {
    fontFamily: Fonts.subtitle,
    fontSize: rf(12),
    color: WEEK_MUTED_TEXT,
  },
  weekCardStreakBadge: {
    backgroundColor: `${WEEK_CALENDAR_PRIMARY}14`,
    borderRadius: rs(10),
    paddingHorizontal: rs(14),
    paddingVertical: rs(12),
    flexDirection: "row",
    alignItems: "center",
    gap: rs(6),
  },
  weekCardStreakText: {
    fontFamily: Fonts.smallLabel,
    fontSize: rf(13),
    color: WEEK_CALENDAR_PRIMARY,
  },
  streakIcon: {
    // Icon styling handled by Ionicons props
  },
  weekCardGrid: {
    flexDirection: "row",
    gap: rs(6),
  },
  weekCardColumn: {
    flex: 1,
    alignItems: "center",
    minWidth: 0,
  },
  weekCardColumnDisabled: {
    opacity: 0.45,
  },
  weekCardDayLabel: {
    fontFamily: Fonts.smallLabel,
    fontSize: rf(11),
    color: WEEK_MUTED_TEXT,
    marginBottom: rs(6),
  },
  weekCardDayLabelToday: {
    color: WEEK_CALENDAR_PRIMARY,
  },
  weekCardDateSquare: {
    width: "100%",
    aspectRatio: 1,
    minHeight: rs(40),
    borderRadius: rs(10),
    alignItems: "center",
    justifyContent: "center",
  },
  weekCardDateNum: {
    fontFamily: Fonts.smallLabel,
    fontSize: rf(13),
    color: WEEK_DARK_TEXT,
  },
  weekCardDateNumMuted: {
    color: WEEK_MUTED_TEXT,
  },
  gutScoreHeroCard: {
    backgroundColor: CARD_BG,
    borderRadius: rs(24),
    padding: SECTION_PADDING_H,
    marginBottom: rs(20),
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: "hidden",
    position: "relative",
    ...Shadows.md,
  },
  gutScoreHeroCardLoading: {
    minHeight: rs(160),
    justifyContent: "center",
    alignItems: "center",
  },
  cornerAccentWrap: {
    position: "absolute",
    top: -20,
    right: -20,
    width: 100,
    height: 100,
  },
  cornerAccentSvg: {
    position: "absolute",
    top: 0,
    right: 0,
  },
  gutScoreHeroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SECTION_PADDING_H,
  },
  heroRingWrap: {
    width: HERO_RING_SIZE,
    height: HERO_RING_SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  heroRingSvg: {
    position: "absolute",
  },
  heroRingCenter: {
    justifyContent: "center",
    alignItems: "center",
  },
  heroRingScore: {
    fontFamily: Fonts.scoreNumber,
    fontSize: rf(28),
    lineHeight: rf(34),
  },
  heroRingMax: {
    fontFamily: Fonts.smallLabel,
    fontSize: rf(13),
    color: Colors.textMuted,
    marginTop: -2,
  },
  gutScoreHeroRight: {
    flex: 1,
    minWidth: 0,
  },
  gutScoreBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: rs(12),
    paddingVertical: rs(4),
    borderRadius: rs(12),
    borderWidth: 1,
    marginBottom: rs(10),
  },
  gutScoreBadgeText: {
    fontFamily: Fonts.badge,
    fontSize: rf(10),
    letterSpacing: 0.5,
  },
  gutScoreDescription: {
    fontFamily: Fonts.body,
    fontSize: rf(15),
    color: "rgba(0,0,0,0.6)",
    lineHeight: rf(24),
    marginBottom: 0,
  },
  ctaButtonWrap: {
    marginTop: rs(20),
    borderRadius: rs(16),
    overflow: "hidden",
    ...Shadows.md,
  },
  ctaButtonGradient: {
    paddingVertical: rs(16),
    paddingHorizontal: rs(Spacing.lg),
    borderRadius: rs(16),
    overflow: "hidden",
    position: "relative",
  },
  ctaButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: rs(8),
  },
  ctaButtonEmoji: {
    fontSize: rf(18),
  },
  ctaButtonLabel: {
    fontFamily: Fonts.button,
    fontSize: rf(15),
    color: "#FFFFFF",
  },
  ctaShimmer: {
    position: "absolute",
    top: 0,
    left: -200,
    width: 200,
    height: "100%",
    backgroundColor: "transparent",
  },
  gutScoreDateHint: {
    fontFamily: Fonts.subtitle,
    fontSize: rf(13),
    color: Colors.textSecondary,
    marginBottom: rs(Spacing.sm),
    marginTop: -8,
  },
  scoreSourceHint: {
    fontFamily: Fonts.subtitle,
    fontSize: rf(13),
    color: Colors.textSecondary,
    marginBottom: rs(Spacing.lg),
  },
  insightsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: rs(12),
    marginBottom: rs(24),
  },
  insightCard: {
    flexBasis: "48%",
    maxWidth: "48%",
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: CARD_BG,
    borderRadius: rs(16),
    paddingHorizontal: rs(16),
    paddingVertical: rs(12),
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...Shadows.sm,
  },
  insightIcon: {
    marginBottom: rs(8),
  },
  insightLabel: {
    fontFamily: Fonts.statsGridLabel,
    fontSize: rf(13),
    color: "rgba(0,0,0,0.6)",
    marginBottom: rs(4),
  },
  insightScoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: rs(6),
  },
  insightScoreNum: {
    fontFamily: Fonts.scoreNumber,
    fontSize: rf(20),
    color: "#1A1A1A",
  },
  insightChange: {
    fontFamily: Fonts.smallLabel,
    fontSize: rf(11),
  },
  recentScansSection: {
    marginBottom: rs(24),
  },
  recentScansHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: rs(16),
  },
  recentScansTitle: {
    fontFamily: Fonts.sectionHeader,
    fontSize: rf(18),
    color: "#1A1A1A",
  },
  seeAllButton: {
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  seeAllText: {
    fontFamily: Fonts.smallLabel,
    fontSize: rf(13),
    color: IMPACT_POSITIVE,
  },
  recentScansList: {
    gap: rs(12),
  },
  recentScansFallbackHint: {
    fontFamily: Fonts.subtitle,
    fontSize: rf(12),
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  recentScanCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderRadius: rs(16),
    padding: rs(16),
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...Shadows.sm,
  },
  recentScanImage: {
    width: rs(36),
    height: rs(36),
    borderRadius: rs(BorderRadius.sm),
    backgroundColor: Colors.borderLight,
  },
  recentScanImagePlaceholder: {
    width: rs(36),
    height: rs(36),
    borderRadius: rs(BorderRadius.sm),
    backgroundColor: Colors.borderLight,
    justifyContent: "center",
    alignItems: "center",
  },
  recentScanContent: {
    flex: 1,
    marginLeft: rs(14),
    minWidth: 0,
  },
  recentScanFoodName: {
    fontFamily: Fonts.productName,
    fontSize: rf(15),
    color: "#1A1A1A",
    marginBottom: rs(4),
  },
  recentScanTime: {
    fontFamily: Fonts.timestamp,
    fontSize: rf(12),
    color: "rgba(0,0,0,0.5)",
  },
  recentScanMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  recentScanScoreBadge: {
    paddingHorizontal: rs(8),
    paddingVertical: rs(4),
    borderRadius: rs(12),
    minWidth: rs(32),
    alignItems: "center",
    justifyContent: "center",
  },
  recentScanScoreText: {
    fontFamily: Fonts.scoreNumber,
    fontSize: rf(14),
    fontWeight: "600",
  },
  recentScanImpact: {
    fontFamily: Fonts.scoreNumber,
    fontSize: rf(18),
    marginLeft: rs(8),
  },
  loadingContainer: {
    padding: Spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    padding: rs(Spacing.xxl),
    backgroundColor: CARD_BG,
    borderRadius: rs(16),
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  emptyStateIconWrap: {
    marginBottom: Spacing.xs,
  },
  emptyStateText: {
    fontFamily: Fonts.cardTitle,
    fontSize: rf(18),
    color: Colors.text,
    marginTop: rs(Spacing.md),
    marginBottom: rs(Spacing.xs),
  },
  emptyStateSubtext: {
    fontFamily: Fonts.body,
    fontSize: rf(14),
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: rs(Spacing.lg),
  },
  emptyStateButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: rs(Spacing.xl),
    paddingVertical: rs(Spacing.md),
    borderRadius: rs(BorderRadius.md),
    ...Shadows.sm,
  },
  emptyStateButtonText: {
    fontFamily: Fonts.button,
    fontSize: rf(15),
    color: "#FFFFFF",
  },
  quickStatCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: rs(BorderRadius.md),
    padding: rs(Spacing.md),
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  quickStatIcon: {
    width: rs(32),
    height: rs(32),
    borderRadius: rs(16),
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
    marginRight: rs(Spacing.md),
  },
  quickStatValue: {
    fontFamily: Fonts.cardTitle,
    fontSize: rf(18),
    color: Colors.text,
    marginRight: rs(Spacing.sm),
  },
  quickStatLabel: {
    fontFamily: Fonts.smallLabel,
    fontSize: rf(12),
    color: Colors.textSecondary,
  },
});
