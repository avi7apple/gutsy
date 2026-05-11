import OnboardingButton from "@/components/onboarding/OnboardingButton";
import { BorderRadius, Colors, Fonts, OnboardingButtonBar, Shadows, Spacing } from "@/constants/theme";
import { rf, rs } from "@/lib/hooks/use-responsive";
import { getDeviceInstructions, getNotificationPermissionStatus, initializeNotificationChannels, requestNotificationPermissions } from "@/lib/notification-permissions";
import { notificationService } from "@/lib/notification-service";
import { fetchProfileSettings, updateNotificationSettings } from "@/lib/profile-settings";
import { NotificationPermissionStatus } from "@/types/notifications";
import { NotificationSettings } from "@/types/profile";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type NotificationItemProps = {
  title: string;
  description: string;
  value: boolean;
  onToggle: () => void;
  icon: string;
};

function NotificationItem({ title, description, value, onToggle, icon }: NotificationItemProps) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemIconContainer}>
        <Ionicons name={icon as any} size={20} color={Colors.primary} />
      </View>
      <View style={styles.itemTextContainer}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.itemDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: Colors.border, true: Colors.primaryLight }}
        thumbColor="#F4F3F4"
      />
    </View>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionStatus>("undetermined");
  const [showDeviceInstructions, setShowDeviceInstructions] = useState(false);

  useEffect(() => {
    loadSettings();
    checkPermissionStatus();
    initializeNotificationChannels();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      const profileSettings = await fetchProfileSettings();
      setSettings(profileSettings.notifications);
    } catch (error) {
      console.error("Failed to load notification settings:", error);
      Alert.alert("Error", "Couldn't load notification settings.");
    } finally {
      setLoading(false);
    }
  }

  async function checkPermissionStatus() {
    try {
      const status = await getNotificationPermissionStatus();
      setPermissionStatus(status);
    } catch (error) {
      console.error("Failed to check permission status:", error);
    }
  }

  async function handleRequestPermissions() {
    try {
      const status = await requestNotificationPermissions();
      setPermissionStatus(status);
      
      if (status === "granted") {
        Alert.alert("Success", "Notifications enabled successfully!");
        // Re-schedule notifications with new permissions
        if (settings) {
          await notificationService.updateNotificationSettings(settings);
        }
      } else {
        setShowDeviceInstructions(true);
      }
    } catch (error) {
      console.error("Failed to request permissions:", error);
      Alert.alert("Error", "Couldn't request notification permissions.");
    }
  }

  async function handleSave() {
    if (!settings) return;

    try {
      setSaving(true);
      
      // Save individual notification preferences
      await updateNotificationSettings(settings);
      
      // Update notification scheduling
      await notificationService.updateNotificationSettings(settings);
      
      Alert.alert("Saved", "Notification preferences updated.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Failed to save notification settings:", error);
      Alert.alert("Error", "We couldn't save your notification settings.");
    } finally {
      setSaving(false);
    }
  }

  async function triggerTestNotifications(): Promise<void> {
    try {
      // Test all notification types
      await notificationService.triggerAchievementAlert(
        "Test Achievement! 🎉", 
        "This is a test achievement notification to verify everything is working."
      );
      
      // Wait a bit before next notification
      setTimeout(async () => {
        await notificationService.triggerAchievementAlert(
          "Daily Reminder Test ⏰", 
          "This is what your daily scan reminder will look like."
        );
      }, 1000);
      
      // Wait a bit more for the last one
      setTimeout(async () => {
        await notificationService.triggerAchievementAlert(
          "Health Tip Test 💡", 
          "This is how your gut health tips will appear."
        );
      }, 2000);
      
      Alert.alert("Test Notifications Sent", "Check your notification panel to see if they arrived!");
    } catch (error) {
      console.error("Failed to trigger test notifications:", error);
      Alert.alert("Error", "Couldn't send test notifications.");
    }
  }

  function toggleSetting(key: keyof NotificationSettings) {
    if (!settings) return;
    setSettings({
      ...settings,
      [key]: !settings[key],
    });
  }

  if (loading || !settings) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}> 
        <StatusBar style="dark" />
        <View style={{ flex: 1 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Permission Status Card */}
        <View style={styles.card}>
          <View style={styles.permissionHeader}>
            <View style={styles.permissionIconContainer}>
              <Ionicons 
                name={permissionStatus === "granted" ? "checkmark-circle" : "alert-circle"} 
                size={24} 
                color={permissionStatus === "granted" ? Colors.success : Colors.warning} 
              />
            </View>
            <View style={styles.permissionTextContainer}>
              <Text style={styles.permissionTitle}>
                {permissionStatus === "granted" ? "Notifications Enabled" : "Notifications Disabled"}
              </Text>
              <Text style={styles.permissionDescription}>
                {permissionStatus === "granted" 
                  ? "You'll receive reminders, achievements, and progress updates."
                  : "Enable notifications to stay on track with your gut health journey."}
              </Text>
            </View>
          </View>
          
          {permissionStatus !== "granted" && (
            <TouchableOpacity 
              style={styles.enableButton} 
              onPress={handleRequestPermissions}
            >
              <Text style={styles.enableButtonText}>Enable Notifications</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Device Instructions */}
        {showDeviceInstructions && (
          <View style={styles.card}>
            <View style={styles.instructionHeader}>
              <Ionicons name="information-circle" size={24} color={Colors.primary} />
              <Text style={styles.instructionTitle}>Device Settings Required</Text>
            </View>
            <Text style={styles.instructionText}>
              {getDeviceInstructions()}
            </Text>
            <TouchableOpacity 
              style={styles.dismissButton} 
              onPress={() => setShowDeviceInstructions(false)}
            >
              <Text style={styles.dismissButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Test Section - Remove Later */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Testing</Text>
          <TouchableOpacity 
            style={styles.testButton} 
            onPress={triggerTestNotifications}
          >
            <Ionicons name="bug-outline" size={20} color={Colors.primary} />
            <Text style={styles.testButtonText}>Send Test Notifications</Text>
          </TouchableOpacity>
          <Text style={styles.testDescription}>
            Tap to receive 3 test notifications immediately. This button will be removed in production.
          </Text>
        </View>

        {/* Notification Settings */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Notification Types</Text>
          
          <NotificationItem
            title="Daily Scan Reminders"
            description="Get reminded to scan your meals at key times throughout the day."
            value={settings.dailyScanReminders}
            onToggle={() => toggleSetting("dailyScanReminders")}
            icon="time-outline"
          />
          
          <NotificationItem
            title="Achievement Alerts"
            description="Celebrate when you reach milestones and unlock new achievements."
            value={settings.achievementAlerts}
            onToggle={() => toggleSetting("achievementAlerts")}
            icon="trophy-outline"
          />
          
          <NotificationItem
            title="Weekly Progress Reports"
            description="Receive weekly summaries of your gut health progress and insights."
            value={settings.weeklyProgressReports}
            onToggle={() => toggleSetting("weeklyProgressReports")}
            icon="bar-chart-outline"
          />
          
          <NotificationItem
            title="Gut Health Tips"
            description="Learn about nutrition, digestion, and how to improve your gut health."
            value={settings.gutHealthTips}
            onToggle={() => toggleSetting("gutHealthTips")}
            icon="bulb-outline"
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <OnboardingButton
          title={saving ? "Saving..." : "Save Preferences"}
          onPress={handleSave}
          disabled={saving}
          loading={saving}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    fontFamily: Fonts.pageTitle,
    fontSize: rf(24),
    color: Colors.text,
  },
  content: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.massive,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xxl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  cardTitle: {
    fontFamily: Fonts.sectionHeader,
    fontSize: rf(18),
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  // Permission status styles
  permissionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  permissionIconContainer: {
    width: rs(40),
    height: rs(40),
    borderRadius: rs(20),
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionTextContainer: {
    flex: 1,
  },
  permissionTitle: {
    fontFamily: Fonts.smallLabel,
    fontSize: rf(16),
    fontWeight: "600",
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  permissionDescription: {
    fontFamily: Fonts.body,
    fontSize: rf(14),
    color: Colors.textSecondary,
    lineHeight: rf(20),
  },
  enableButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  enableButtonText: {
    fontFamily: Fonts.smallLabel,
    fontSize: rf(15),
    fontWeight: "600",
    color: "#FFFFFF",
  },
  // Device instructions styles
  instructionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  instructionTitle: {
    fontFamily: Fonts.smallLabel,
    fontSize: rf(16),
    fontWeight: "600",
    color: Colors.text,
  },
  instructionText: {
    fontFamily: Fonts.body,
    fontSize: rf(14),
    color: Colors.text,
    lineHeight: rf(20),
    marginBottom: Spacing.lg,
  },
  dismissButton: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  dismissButtonText: {
    fontFamily: Fonts.smallLabel,
    fontSize: rf(14),
    fontWeight: "500",
    color: Colors.primary,
  },
  // Test button styles
  testButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.primary,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  testButtonText: {
    fontFamily: Fonts.smallLabel,
    fontSize: rf(15),
    fontWeight: "600",
    color: Colors.primary,
  },
  testDescription: {
    fontFamily: Fonts.body,
    fontSize: rf(13),
    color: Colors.textSecondary,
    lineHeight: rf(18),
    textAlign: "center",
  },
  // Notification item styles
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.md,
  },
  itemIconContainer: {
    width: rs(32),
    height: rs(32),
    borderRadius: rs(16),
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  itemTextContainer: {
    flex: 1,
  },
  itemTitle: {
    fontFamily: Fonts.smallLabel,
    fontSize: rf(15),
    color: Colors.text,
  },
  itemDescription: {
    marginTop: Spacing.xs,
    fontFamily: Fonts.body,
    fontSize: rf(13),
    color: Colors.textSecondary,
    lineHeight: rf(18),
  },
  footer: {
    ...OnboardingButtonBar,
  },
});
