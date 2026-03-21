import { NotificationSettings } from "./profile";

export type NotificationPermissionStatus = "granted" | "denied" | "undetermined";

export interface NotificationChannel {
  id: string;
  name: string;
  description: string;
  importance?: "default" | "high" | "max";
}

export interface ScheduledNotification {
  id: string;
  type: keyof NotificationSettings;
  title: string;
  body: string;
  scheduledTime: Date;
  data?: Record<string, any>;
}

export interface NotificationContent {
  title: string;
  body: string;
  data?: Record<string, any>;
}

export const NOTIFICATION_CHANNELS: NotificationChannel[] = [
  {
    id: "daily-reminders",
    name: "Daily Reminders",
    description: "Reminders to scan your meals and track your gut health",
    importance: "default",
  },
  {
    id: "achievements",
    name: "Achievements",
    description: "Alerts for milestones and achievements",
    importance: "high",
  },
  {
    id: "progress-reports",
    name: "Progress Reports",
    description: "Weekly summaries of your gut health progress",
    importance: "default",
  },
  {
    id: "health-tips",
    name: "Health Tips",
    description: "Educational content about gut health and nutrition",
    importance: "default",
  },
];

export const NOTIFICATION_TEMPLATES = {
  dailyScanReminder: {
    title: "Time for your gut check! 🥗",
    body: "Scan your meal to track how it affects your gut health today.",
  },
  achievementUnlocked: {
    title: "Achievement Unlocked! 🎉",
    body: "You've reached a new milestone in your gut health journey!",
  },
  streakMilestone: {
    title: "Amazing Streak! 🔥",
    body: "You've been scanning for {days} days straight. Keep it up!",
  },
  weeklyProgress: {
    title: "Your Weekly Gut Report 📊",
    body: "See how your gut health improved this week and get personalized insights.",
  },
  gutHealthTip: {
    title: "Gut Health Tip 💡",
    body: "Did you know? {tip}",
  },
  scoreImprovement: {
    title: "Great Progress! 📈",
    body: "Your gut score improved by {points} points this week!",
  },
};
