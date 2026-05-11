import { FadeIn, ProfileSkeleton, Shimmer, ShimmerCircle } from "@/components/SkeletonCard";
import { AnimatedNumber, SmoothScale } from "@/components/SmoothUpdate";
import {
    BorderRadius,
    Colors,
    Fonts,
    Shadows,
    Spacing,
} from "@/constants/theme";
import { useAuthUserQuery } from "@/lib/hooks/use-auth-user-query";
import { rf, rs } from "@/lib/hooks/use-responsive";
import { shouldRetryQuery } from "@/lib/network-errors";
import { getOnboardingProfile } from "@/lib/onboarding-storage";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface UserProfile {
  primary_goal: string | null;
  skin_type: string | null;
  trigger_foods: string[] | null;
  water_intake: string | null;
  subscription_tier: string | null;
  total_scans: number | null;
  current_streak: number | null;
  longest_streak: number | null;
  scan_stats: any | null;
}

async function fetchProfile(userId: string) {
  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.warn("Profile fetch error:", error);
  }

  return data || null;
}

async function fetchUserData(
  user: ReturnType<typeof useAuthUserQuery>["user"],
  profile: ReturnType<typeof useAuthUserQuery>["profile"]
) {
  if (!user) {
    return {
      email: null,
      userName: null,
      memberSince: null,
    };
  }

  return {
    email: user.email ?? null,
    userName: profile.firstName || null,
    memberSince: profile.memberSince,
  };
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile: authProfile, isLoading: isAuthLoading } = useAuthUserQuery();
  
  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ["userProfile", user?.id ?? "anon"],
    queryFn: () => fetchProfile(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
    retry: shouldRetryQuery,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
    refetchInterval: 1000 * 60 * 5,
  });

  const { data: userData } = useQuery({
    queryKey: ["userData", user?.id ?? "anon"],
    queryFn: () => fetchUserData(user, authProfile),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
    retry: shouldRetryQuery,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
    refetchInterval: 1000 * 60 * 5,
  });

  const [onboardingProfile, setOnboardingProfile] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const showInitialSkeleton = isAuthLoading && !userData;

  useEffect(() => {
    getOnboardingProfile().then(setOnboardingProfile);
  }, []);

  async function handleRefresh() {
    setIsRefreshing(true);
    await Promise.all([refetchProfile()]);
    setIsRefreshing(false);
  }

  async function handleDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone and will permanently delete:\n\n• Your profile information\n• All scan history\n• Achievement progress\n• Personalized recommendations\n\nThis action is irreversible.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: async () => {
            // Show confirmation dialog
            Alert.alert(
              "Final Confirmation",
              "Type 'DELETE' to confirm account deletion. This is your last chance to cancel.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete Forever",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      // Get current user
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) {
                        throw new Error("No user found");
                      }

                      // Delete user data from database
                      const { error: deleteError } = await supabase
                        .from("user_profiles")
                        .delete()
                        .eq("id", user.id);

                      if (deleteError) {
                        throw deleteError;
                      }

                      // Delete meal scans
                      await supabase
                        .from("meal_scans")
                        .delete()
                        .eq("user_id", user.id);

                      // Delete user from auth
                      const { error: authError } = await supabase.auth.admin.deleteUser(
                        user.id
                      );

                      if (authError) {
                        // If admin delete fails, try regular sign out
                        await supabase.auth.signOut();
                        Alert.alert(
                          "Account Deleted",
                          "Your account data has been deleted. You've been signed out."
                        );
                      } else {
                        Alert.alert(
                          "Account Deleted",
                          "Your account and all associated data have been permanently deleted."
                        );
                      }

                      // Navigate to onboarding
                      router.replace("/onboarding/welcome");
                    } catch (error) {
                      console.error("Error deleting account:", error);
                      Alert.alert(
                        "Error",
                        "We couldn't delete your account. Please contact support for assistance."
                      );
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }

  async function handleSignOut() {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace("/onboarding/welcome");
          },
        },
      ]
    );
  }

  function renderProfileRow(emoji: string, label: string, value: string | null) {
    return (
      <View style={styles.profileRow}>
        <Text style={styles.profileRowEmoji}>{emoji}</Text>
        <Text style={styles.profileRowLabel}>{label}</Text>
        <Text style={styles.profileRowValue} numberOfLines={1}>
          {value || "Not set"}
        </Text>
      </View>
    );
  }

  function renderSettingItem({
    icon,
    label,
    value,
    onPress,
    showChevron = true,
    destructive = false,
  }: {
    icon: string;
    label: string;
    value?: string;
    onPress?: () => void;
    showChevron?: boolean;
    destructive?: boolean;
  }) {
    return (
      <TouchableOpacity
        style={[
          styles.settingItem,
          destructive && styles.destructiveSettingItem
        ]}
        onPress={onPress}
        disabled={!onPress}
      >
        <View style={[
          styles.settingIcon,
          destructive && styles.destructiveSettingIcon
        ]}>
          <Ionicons 
            name={icon as any} 
            size={20} 
            color={destructive ? Colors.error : Colors.primary} 
          />
        </View>
        <View style={styles.settingContent}>
          <Text style={[
            styles.settingLabel,
            destructive && styles.destructiveSettingLabel
          ]}>
            {label}
          </Text>
          {value && <Text style={styles.settingValue}>{value}</Text>}
        </View>
        {showChevron && (
          <Ionicons 
            name="chevron-forward" 
            size={20} 
            color={destructive ? Colors.error : Colors.textMuted} 
          />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} > 
      <StatusBar style="dark" />
      {showInitialSkeleton ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Profile</Text>
          </View>
          <ProfileSkeleton />
        </ScrollView>
      ) : (
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
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* Personal Info Header Section */}
        <View style={styles.personalInfoContainer}>
          {userData?.email ? (
            <FadeIn visible={true}>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>
                  {userData.email.charAt(0).toUpperCase()}
                </Text>
              </View>
            </FadeIn>
          ) : (
            <ShimmerCircle size={72} />
          )}
          <View style={styles.personalInfoText}>
            {userData?.userName || onboardingProfile?.name ? (
              <FadeIn visible={true}>
                <Text style={styles.userName} numberOfLines={1}>
                  {userData?.userName || onboardingProfile?.name}
                </Text>
              </FadeIn>
            ) : (
              <Shimmer width={150} height={22} style={{ marginBottom: 6 }} />
            )}
            {userData?.memberSince ? (
              <FadeIn visible={true}>
                <Text style={styles.membershipInfo}>
                  Member since {userData?.memberSince}
                </Text>
              </FadeIn>
            ) : (
              <Shimmer width={100} height={14} />
            )}
          </View>
        </View>

        {/* Stats Overview */}
        <View style={styles.statsCard}>
          <Text style={styles.sectionTitle}>Your Stats</Text>
          {profile ? (
            <FadeIn visible={true}>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <SmoothScale trigger={profile?.total_scans}>
                    <AnimatedNumber value={profile?.total_scans ?? 0} style={styles.statValue} />
                  </SmoothScale>
                  <Text style={styles.statLabel}>Total Scans</Text>
                </View>
                <View style={styles.statItem}>
                  <SmoothScale trigger={profile?.current_streak}>
                    <AnimatedNumber value={profile?.current_streak ?? 0} style={styles.statValue} />
                  </SmoothScale>
                  <Text style={styles.statLabel}>Current Streak</Text>
                </View>
                <View style={styles.statItem}>
                  <SmoothScale trigger={(profile?.scan_stats as any)?.average_score}>
                    <Text style={styles.statValue}>
                      {((profile?.scan_stats as any)?.average_score ?? 0).toFixed(1)}
                    </Text>
                  </SmoothScale>
                  <Text style={styles.statLabel}>Average Score</Text>
                </View>
              </View>
            </FadeIn>
          ) : (
            <View style={styles.statsGrid}>
              {[1, 2, 3].map((index) => (
                <View key={index} style={styles.statItem}>
                  <Shimmer width={48} height={28} borderRadius={8} />
                  <Shimmer width={56} height={12} style={{ marginTop: 6 }} />
                </View>
              ))}
            </View>
          )}
        </View>

            {/* Settings */}
            <View style={styles.settingsCard}>
              <Text style={styles.sectionTitle}>Settings</Text>
              {renderSettingItem({
                icon: "person-outline",
                label: "Edit Profile",
                onPress: () => router.push("/profile/edit-profile"),
              })}
              {renderSettingItem({
                icon: "notifications-outline",
                label: "Notifications",
                onPress: () => router.push("/profile/notifications"),
              })}
              {renderSettingItem({
                icon: "lock-closed-outline",
                label: "Privacy Policy",
                onPress: () => router.push("/profile/privacy"),
              })}
              {renderSettingItem({
                icon: "document-text-outline",
                label: "Terms of Use",
                onPress: () => router.push("/profile/terms-of-use"),
              })}
              {renderSettingItem({
                icon: "refresh-outline",
                label: "Restore Purchases",
                onPress: () => {
                  // TODO: Implement restore purchases
                  Alert.alert("Coming Soon", "Restore purchases will be available soon.");
                },
              })}
            </View>

            {/* Account Actions */}
            <View style={styles.accountCard}>
              <Text style={styles.sectionTitle}>Account</Text>
              {renderSettingItem({
                icon: "log-out-outline",
                label: "Sign Out",
                onPress: handleSignOut,
                showChevron: false,
              })}
              {renderSettingItem({
                icon: "trash-outline",
                label: "Delete Account",
                onPress: handleDeleteAccount,
                showChevron: false,
                destructive: true,
              })}
            </View>
      </ScrollView>
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
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.massive,
  },
  header: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontFamily: Fonts.pageTitle,
    fontSize: rf(28),
    color: Colors.text,
  },
  personalInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: rs(24),
    paddingBottom: rs(20),
    marginBottom: rs(4),
    gap: rs(16),
  },
  avatarContainer: {
    width: rs(72),
    height: rs(72),
    borderRadius: rs(36),
    backgroundColor: Colors.primary,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "rgba(45,106,79,0.2)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  avatarText: {
    fontSize: rf(28),
    fontWeight: "800",
    color: "#FFFFFF",
    fontFamily: Fonts.body,
  },
  personalInfoText: {
    flex: 1,
  },
  userName: {
    fontFamily: Fonts.pageTitle,
    fontSize: rf(24),
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: rs(4),
    letterSpacing: 0,
    maxWidth: "100%",
  },
  membershipInfo: {
    fontFamily: Fonts.body,
    fontSize: rf(14),
    fontWeight: "500",
    color: "#95918A",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  profileRowEmoji: {
    fontSize: rf(18),
  },
  profileRowLabel: {
    fontFamily: Fonts.smallLabel,
    fontSize: rf(15),
    color: Colors.text,
    minWidth: rs(100),
  },
  profileRowValue: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: rf(15),
    color: Colors.text,
  },
  profileCardDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
    opacity: 0.5,
  },
  statsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xxl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  sectionTitle: {
    fontFamily: Fonts.sectionHeader,
    fontSize: rf(18),
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontFamily: Fonts.statsGridValue,
    fontSize: rf(24),
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  statLabel: {
    fontFamily: Fonts.statsGridLabel,
    fontSize: rf(12),
    color: Colors.textSecondary,
    textAlign: "center",
  },
  settingsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xxl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingIcon: {
    width: rs(32),
    height: rs(32),
    borderRadius: rs(16),
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontFamily: Fonts.smallLabel,
    fontSize: rf(15),
    color: Colors.text,
  },
  settingValue: {
    fontFamily: Fonts.body,
    fontSize: rf(13),
    color: Colors.textSecondary,
    marginTop: rs(2),
  },
  accountCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xxl,
    marginBottom: 120,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  // Destructive styles for delete account
  destructiveSettingItem: {
    // Remove the red bottom border to match other items
  },
  destructiveSettingIcon: {
    backgroundColor: "#FEF2F2",
  },
  destructiveSettingLabel: {
    color: Colors.error,
  },
});


