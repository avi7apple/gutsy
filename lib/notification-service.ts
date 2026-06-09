import { NOTIFICATION_TEMPLATES } from "@/types/notifications";
import { NotificationSettings } from "@/types/profile";
import { requestNotificationPermissions } from "@/lib/notification-permissions";
import * as Notifications from "expo-notifications";

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class NotificationService {
  private static instance: NotificationService;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async scheduleDailyScanReminders(enabled: boolean): Promise<void> {
    try {
      // Cancel existing daily reminders
      await this.cancelNotificationsByTag('daily-reminder');

      if (!enabled) return;

      // Schedule daily reminders at 8 AM, 1 PM, and 7 PM
      const times = [
        { hour: 8, minute: 0 },  // Breakfast
        { hour: 13, minute: 0 }, // Lunch
        { hour: 19, minute: 0 }, // Dinner
      ];

      for (const time of times) {
        const trigger = new Date();
        trigger.setHours(time.hour, time.minute, 0, 0);
        
        // If time has passed today, schedule for tomorrow
        if (trigger <= new Date()) {
          trigger.setDate(trigger.getDate() + 1);
        }

        await Notifications.scheduleNotificationAsync({
          content: {
            title: NOTIFICATION_TEMPLATES.dailyScanReminder.title,
            body: NOTIFICATION_TEMPLATES.dailyScanReminder.body,
            data: { type: 'daily-reminder' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            hour: time.hour,
            minute: time.minute,
            repeats: true,
          },
        });
      }
    } catch (error) {
      console.error("Error scheduling daily scan reminders:", error);
    }
  }

  async scheduleWeeklyProgressReports(enabled: boolean): Promise<void> {
    try {
      // Cancel existing weekly reports
      await this.cancelNotificationsByTag('weekly-report');

      if (!enabled) return;

      // Schedule weekly report on Sunday at 6 PM
      await Notifications.scheduleNotificationAsync({
        content: {
          title: NOTIFICATION_TEMPLATES.weeklyProgress.title,
          body: NOTIFICATION_TEMPLATES.weeklyProgress.body,
          data: { type: 'weekly-report' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          weekday: 0, // Sunday
          hour: 18,
          minute: 0,
          repeats: true,
        },
      });
    } catch (error) {
      console.error("Error scheduling weekly progress reports:", error);
    }
  }

  async scheduleGutHealthTips(enabled: boolean): Promise<void> {
    try {
      // Cancel existing health tips
      await this.cancelNotificationsByTag('health-tip');

      if (!enabled) return;

      const tips = [
        "Drinking water before meals can improve digestion.",
        "Chewing food thoroughly helps reduce bloating.",
        "Fiber-rich foods support healthy gut bacteria.",
        "Probiotics can help balance your gut microbiome.",
        "Eating slowly can prevent overeating and improve digestion.",
        "Fermented foods like yogurt and kimchi are great for gut health.",
      ];

      // Schedule health tips every 3 days at 10 AM
      for (let i = 0; i < tips.length; i++) {
        const date = new Date();
        date.setDate(date.getDate() + (i * 3));
        date.setHours(10, 0, 0, 0);

        await Notifications.scheduleNotificationAsync({
          content: {
            title: NOTIFICATION_TEMPLATES.gutHealthTip.title,
            body: NOTIFICATION_TEMPLATES.gutHealthTip.body.replace('{tip}', tips[i]),
            data: { type: 'health-tip', tipIndex: i },
          },
          trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: date,
        },
        });
      }
    } catch (error) {
      console.error("Error scheduling gut health tips:", error);
    }
  }

  async triggerAchievementAlert(title: string, body: string): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: 'achievement' },
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error("Error triggering achievement alert:", error);
    }
  }

  async updateNotificationSettings(settings: NotificationSettings): Promise<void> {
    try {
      await Promise.all([
        this.scheduleDailyScanReminders(settings.dailyScanReminders),
        this.scheduleWeeklyProgressReports(settings.weeklyProgressReports),
        this.scheduleGutHealthTips(settings.gutHealthTips),
      ]);
    } catch (error) {
      console.error("Error updating notification settings:", error);
    }
  }

  private   async cancelNotificationsByTag(tag: string): Promise<void> {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      
      for (const notification of scheduledNotifications) {
        if (notification.content.data?.type === tag) {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
      }
    } catch (error) {
      console.error(`Error canceling notifications with tag ${tag}:`, error);
    }
  }

  /**
   * Schedule trial-end reminders promised in the paywall funnel:
   * - ~2 days before billing (step 2 of trial-timeline)
   * - ~1 day before as a backup nudge
   */
  async scheduleTrialEndReminders(trialEndsAt: string): Promise<void> {
    try {
      await this.cancelTrialEndReminders();

      const permission = await requestNotificationPermissions();
      if (permission !== "granted") return;

      const endMs = new Date(trialEndsAt).getTime();
      if (!Number.isFinite(endMs) || endMs <= Date.now()) return;

      const twoDayMs = endMs - 2 * 24 * 60 * 60 * 1000;
      const oneDayMs = endMs - 1 * 24 * 60 * 60 * 1000;
      const now = Date.now();

      const reminders: { atMs: number; body: string }[] = [];

      if (twoDayMs > now) {
        reminders.push({
          atMs: twoDayMs,
          body: "Your Gutsy free trial ends in 2 days. Cancel anytime in Settings if you don't want to continue.",
        });
      }

      if (oneDayMs > now) {
        reminders.push({
          atMs: oneDayMs,
          body: "Your Gutsy free trial ends tomorrow. You'll be charged unless you cancel in your subscription settings.",
        });
      }

      // Sandbox trials can be shorter than 2 days — always schedule at least one
      // reminder one hour before expiry when the 2-day window has already passed.
      if (reminders.length === 0) {
        const oneHourMs = endMs - 60 * 60 * 1000;
        if (oneHourMs > now) {
          reminders.push({
            atMs: oneHourMs,
            body: "Your Gutsy free trial is ending soon. Cancel anytime in Settings if you don't want to continue.",
          });
        }
      }

      for (const reminder of reminders) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Trial ending soon",
            body: reminder.body,
            data: { type: "trial-end-reminder" },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(reminder.atMs),
          },
        });
      }
    } catch (error) {
      console.error("Error scheduling trial end reminders:", error);
    }
  }

  async cancelTrialEndReminders(): Promise<void> {
    await this.cancelNotificationsByTag("trial-end-reminder");
  }

  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error("Error canceling all notifications:", error);
    }
  }

  async getScheduledNotificationsCount(): Promise<number> {
    try {
      const notifications = await Notifications.getAllScheduledNotificationsAsync();
      return notifications.length;
    } catch (error) {
      console.error("Error getting scheduled notifications count:", error);
      return 0;
    }
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();
