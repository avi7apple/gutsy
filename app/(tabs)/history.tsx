import { FadeIn, HistorySkeleton } from "@/components/SkeletonCard";
import { AnimatedListItem } from "@/components/SmoothUpdate";
import {
    BorderRadius,
    Colors,
    Fonts,
    Shadows,
    Spacing,
} from "@/constants/theme";
import { useAuthUserQuery } from "@/lib/hooks/use-auth-user-query";
import { useGutScore } from "@/lib/hooks/use-gut-score-query";
import { rf, rs } from "@/lib/hooks/use-responsive";
import { shouldRetryQuery } from "@/lib/network-errors";
import { supabase } from "@/lib/supabase";
import { capitalizeWords } from "@/lib/utils/text-formatting";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useMemo, useState } from "react";
import {
    Alert,
    Image,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ScanItem {
  id: string;
  food_name: string;
  product_name?: string | null;
  image_url: string | null;
  bloat_score: number | null;
  gut_score?: number | null;
  created_at: string;
  scan_type: "photo" | "barcode" | "manual";
}

async function fetchAllScans(userId: string): Promise<ScanItem[]> {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from("meal_scans")
      .select("id, food_name, product_name, image_url, bloat_score, gut_score, created_at, scan_type, analysis")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100); // Add reasonable limit for performance

    if (error) {
      console.error("[History] Error fetching scans:", error);
      throw error;
    }

    console.log(`[History] Fetched ${data?.length || 0} scans for user ${userId}`);
    return (data || []).map((scan) => {
      const gutScore =
        scan.gut_score ??
        (scan.analysis && typeof scan.analysis === "object"
          ? (scan.analysis as any).gut_score ?? scan.bloat_score ?? null
          : scan.bloat_score ?? null);
      return { ...scan, gut_score: gutScore } as ScanItem;
    });
  } catch (error) {
    console.error("[History] Failed to fetch scans:", error);
    throw error;
  }
}

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthUserQuery();
  const { refetch: refetchGutScore } = useGutScore();

  const { data: scans = [], isLoading, error, refetch: refetchScans } = useQuery({
    queryKey: ["allScans", user?.id ?? "anon"],
    queryFn: () => fetchAllScans(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 15,
    retry: shouldRetryQuery,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
    refetchInterval: 1000 * 60 * 3,
    placeholderData: (previousData) => previousData,
  });

  useFocusEffect(
    React.useCallback(() => {
      console.log("[History] Focus effect - refetching scans");
      refetchGutScore();
      refetchScans();
    }, [refetchGutScore, refetchScans])
  );
  
  // Debug logging
  React.useEffect(() => {
    console.log("[History] Scans data updated:", {
      scansCount: scans.length,
      isLoading,
      error: error instanceof Error ? error.message : String(error),
      userId: user?.id
    });
  }, [scans, isLoading, error, user?.id]);
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "high" | "medium" | "low">("all");

  const filteredScans = useMemo(() => {
    let filtered = [...scans];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const displayName = (s: ScanItem) =>
        (s.product_name ?? s.food_name ?? "").toLowerCase();
      filtered = filtered.filter((scan) => displayName(scan).includes(query));
    }

    // Apply score filter
    if (filter !== "all") {
      filtered = filtered.filter((scan) => {
        const score = scan.gut_score ?? scan.bloat_score ?? 50;
        if (filter === "high") return score >= 70;
        if (filter === "medium") return score >= 40 && score < 70;
        if (filter === "low") return score < 40;
        return true;
      });
    }

    return filtered;
  }, [scans, searchQuery, filter]);

  const handleDeleteScan = useCallback(async (scanId: string) => {
    if (!user?.id) return;
    const { error } = await supabase
      .from("meal_scans")
      .delete()
      .eq("id", scanId)
      .eq("user_id", user.id);
    if (!error) refetchScans();
  }, [refetchScans, user?.id]);

  const scansByDate = useMemo(() => {
    const map = new Map<string, ScanItem[]>();
    for (const scan of filteredScans) {
      const key = getDateKey(scan.created_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(scan);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (a > b ? -1 : a < b ? 1 : 0))
      .map(([key, items]) => [
        key,
        [...items].sort((first, second) => {
          const firstTs = new Date(first.created_at).getTime();
          const secondTs = new Date(second.created_at).getTime();
          return secondTs - firstTs;
        }),
      ] as [string, ScanItem[]]);
  }, [filteredScans]);

  async function handleRefresh() {
    setIsRefreshing(true);
    await refetchScans();
    setIsRefreshing(false);
  }

  function getDateKey(dateString: string): string {
    const d = new Date(dateString);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${month}-${day}`;
  }

  function getSectionLabel(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const sy = date.getFullYear();
    const sm = date.getMonth();
    const sd = date.getDate();
    const ny = now.getFullYear();
    const nm = now.getMonth();
    const nd = now.getDate();
    if (sy === ny && sm === nm && sd === nd) return "Today";
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (sy === yesterday.getFullYear() && sm === yesterday.getMonth() && sd === yesterday.getDate()) return "Yesterday";
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: sy !== ny ? "numeric" : undefined,
    });
  }

  function formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getScoreColor(score: number | null): string {
    if (score === null) return Colors.textMuted;
    if (score >= 70) return Colors.success;
    if (score >= 40) return Colors.warning;
    return Colors.error;
  }

  function renderScanItem(item: ScanItem) {
    const score = item.gut_score ?? item.bloat_score ?? null;
    const scoreColor = getScoreColor(score);

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.scanItem}
        onPress={() => router.push(`/scan-result?id=${item.id}`)}
      >
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.scanImage} />
        ) : (
          <View style={styles.scanImagePlaceholder}>
            <Ionicons name="camera" size={24} color={Colors.textMuted} />
          </View>
        )}
        <View style={styles.scanContent}>
          <Text style={styles.scanFoodName} numberOfLines={1}>
            {capitalizeWords(item.product_name ?? item.food_name)}
          </Text>
          <View style={styles.scanMeta}>
            <Text style={styles.scanTime}>{formatTime(item.created_at)}</Text>
          </View>
        </View>
        {score !== null && (
          <View style={[styles.scoreBadge, { backgroundColor: scoreColor + "20" }]}>
            <Text style={[styles.scoreText, { color: scoreColor }]}>
              {Math.round(score)}
            </Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
      </TouchableOpacity>
    );
  }

  const showInitialLoading = isLoading && !isRefreshing;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {showInitialLoading ? (
        <View style={{ flex: 1 }}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Scan History</Text>
          </View>
          <HistorySkeleton />
        </View>
      ) : (
        <FadeIn visible={!showInitialLoading} style={{ flex: 1 }}>
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
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Scan History</Text>
          </View>

          {/* Search and Filters */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search foods..."
                placeholderTextColor={Colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.filterContainer}>
              {(["all", "high", "medium", "low"] as const).map((filterOption) => (
                <TouchableOpacity
                  key={filterOption}
              style={[
                styles.filterButton,
                filter === filterOption && styles.filterButtonActive,
              ]}
              onPress={() => setFilter(filterOption)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filter === filterOption && styles.filterButtonTextActive,
                ]}
              >
                    {filterOption === "all"
                      ? "All"
                      : filterOption === "high"
                      ? "High"
                      : filterOption === "medium"
                      ? "Medium"
                      : "Low"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Scans List */}
          {error ? (
            <View style={styles.emptyState}>
              <Ionicons name="warning-outline" size={64} color={Colors.error} />
              <Text style={styles.emptyStateText}>Error loading scans</Text>
              <Text style={styles.emptyStateSubtext}>
                {error instanceof Error ? error.message : "Please try again"}
              </Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() => refetchScans()}
              >
                <Text style={styles.emptyStateButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : filteredScans.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="list-outline" size={64} color={Colors.textMuted} />
              <Text style={styles.emptyStateText}>
                {searchQuery || filter !== "all"
                  ? "No scans match your filters"
                  : "No scans yet"}
              </Text>
              <Text style={styles.emptyStateSubtext}>
                {searchQuery || filter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Start scanning foods to see your history here"}
              </Text>
            </View>
          ) : (
            <View style={styles.listContent}>
              {scansByDate.map(([dateKey, items]) => (
                <View key={dateKey} style={styles.section}>
                  <Text style={styles.sectionHeader}>
                    {getSectionLabel(items[0].created_at)}
                  </Text>
                  {items.map((item, index) => (
                    <AnimatedListItem 
                      key={item.id} 
                      isEntering={true} 
                      delay={index * 30}
                    >
                      <Swipeable
                        friction={1.1}
                        overshootFriction={10}
                        rightThreshold={28}
                        renderRightActions={() => (
                          <Pressable
                            style={styles.deleteAction}
                            onPress={() => {
                              Alert.alert(
                                "Delete scan?",
                                "Are you sure you want to delete this scan? This cannot be undone.",
                                [
                                  { text: "Cancel", style: "cancel" },
                                  { text: "Delete", style: "destructive", onPress: () => handleDeleteScan(item.id) },
                                ]
                              );
                            }}
                          >
                            <View style={styles.deleteActionIconWrap}>
                              <Ionicons name="trash-outline" size={20} color={Colors.error} />
                            </View>
                          </Pressable>
                        )}
                      >
                        {renderScanItem(item)}
                      </Swipeable>
                    </AnimatedListItem>
                  ))}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
        </FadeIn>
      )}
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
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.massive,
  },
  header: {
    paddingHorizontal: rs(Spacing.xxl),
    paddingTop: rs(Spacing.lg),
    paddingBottom: rs(Spacing.md),
  },
  headerTitle: {
    fontFamily: Fonts.pageTitle,
    fontSize: rf(28),
    color: Colors.text,
  },
  searchContainer: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.md,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: rf(15),
    color: Colors.text,
    padding: 0,
  },
  filterContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  filterButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterButtonText: {
    fontFamily: Fonts.smallLabel,
    fontSize: rf(13),
    color: Colors.text,
  },
  filterButtonTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.massive,
  },
  deleteAction: {
    width: rs(56),
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  deleteActionIconWrap: {
    width: rs(36),
    height: rs(36),
    borderRadius: rs(18),
    borderWidth: 1.5,
    borderColor: Colors.error,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    fontFamily: Fonts.sectionHeader,
    fontSize: rf(13),
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  scanItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  scanImage: {
    width: rs(56),
    height: rs(56),
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.borderLight,
  },
  scanImagePlaceholder: {
    width: rs(56),
    height: rs(56),
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.borderLight,
    justifyContent: "center",
    alignItems: "center",
  },
  scanContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  scanFoodName: {
    fontFamily: Fonts.productName,
    fontSize: rf(15),
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  scanMeta: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  scanDate: {
    fontFamily: Fonts.timestamp,
    fontSize: rf(12),
    color: Colors.textSecondary,
  },
  scanTime: {
    fontFamily: Fonts.timestamp,
    fontSize: rf(12),
    color: Colors.textSecondary,
  },
  scoreBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
  },
  scoreText: {
    fontFamily: Fonts.scoreNumber,
    fontSize: rf(16),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xxl,
    minHeight: 200,
  },
  emptyStateText: {
    fontFamily: Fonts.cardTitle,
    fontSize: rf(18),
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  emptyStateSubtext: {
    fontFamily: Fonts.body,
    fontSize: rf(14),
    color: Colors.textSecondary,
    textAlign: "center",
  },
  emptyStateButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  emptyStateButtonText: {
    fontFamily: Fonts.body,
    fontSize: rf(16),
    color: "#FFFFFF",
    textAlign: "center",
  },
});
