import { NotificationPermissionStatus } from "@/types/notifications";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export async function requestNotificationPermissions(): Promise<NotificationPermissionStatus> {
  try {
    if (Platform.OS === 'ios') {
      const { status } = await Notifications.requestPermissionsAsync();
      return status as NotificationPermissionStatus;
    } else {
      const { status } = await Notifications.requestPermissionsAsync();
      return status as NotificationPermissionStatus;
    }
  } catch (error) {
    console.error("Error requesting notification permissions:", error);
    return "denied";
  }
}

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status as NotificationPermissionStatus;
  } catch (error) {
    console.error("Error getting notification permission status:", error);
    return "denied";
  }
}

export function getDeviceInstructions(): string {
  if (Platform.OS === 'ios') {
    return `To allow Gutsy notifications:

1. Open your device Settings
2. Scroll down and tap "Notifications"
3. Find "Gutsy" in the app list
4. Toggle "Allow Notifications" ON
5. Choose your preferred alert style

You may also want to enable:
- Sounds
- Badges
- Banners
- Show on Lock Screen`;
  } else {
    return `To allow Gutsy notifications:

1. Open your device Settings
2. Tap "Apps" or "Applications"
3. Find and tap "Gutsy"
4. Tap "Notifications"
5. Toggle "Allow notifications" ON
6. Select your preferred notification categories

You may also want to enable:
- Sound
- Vibration
- Show on lock screen`;
  }
}

export async function areNotificationsEnabled(): Promise<boolean> {
  try {
    const status = await getNotificationPermissionStatus();
    return status === "granted";
  } catch (error) {
    console.error("Error checking if notifications are enabled:", error);
    return false;
  }
}

export async function initializeNotificationChannels(): Promise<void> {
  try {
    // This is mainly for Android, but safe to call on iOS too
    if (Platform.OS === 'android') {
      // Channels are configured in app.json plugin
      // Additional channel setup can be done here if needed
      await Notifications.setNotificationChannelAsync('daily-reminders', {
        name: 'Daily Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
      
      await Notifications.setNotificationChannelAsync('achievements', {
        name: 'Achievements',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
      
      await Notifications.setNotificationChannelAsync('progress-reports', {
        name: 'Progress Reports',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
      
      await Notifications.setNotificationChannelAsync('health-tips', {
        name: 'Health Tips',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }
  } catch (error) {
    console.error("Error initializing notification channels:", error);
  }
}
