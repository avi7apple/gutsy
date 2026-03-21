import { notificationService } from "./notification-service";
import { fetchProfileSettings } from "./profile-settings";
import { supabase } from "./supabase";

/**
 * Initialize notification system when app starts
 * Should be called from app root or onboarding completion
 */
export async function initializeNotificationSystem(): Promise<void> {
  try {
    // Initialize notification channels
    const { initializeNotificationChannels } = await import("./notification-permissions");
    await initializeNotificationChannels();

    // Get user's notification preferences
    try {
      const profileSettings = await fetchProfileSettings();
      await notificationService.updateNotificationSettings(profileSettings.notifications);
    } catch (error) {
      // User might not be logged in yet, that's okay
      console.log("Could not load notification settings during init:", error);
    }
  } catch (error) {
    console.error("Failed to initialize notification system:", error);
  }
}

/**
 * Trigger achievement notifications
 * Call this when user reaches milestones
 */
export async function triggerAchievementNotification(
  type: "streak" | "score" | "scans" | "goal",
  value: number | string
): Promise<void> {
  try {
    // Check if user has achievement alerts enabled
    const profileSettings = await fetchProfileSettings();
    if (!profileSettings.notifications.achievementAlerts) return;

    let title = "";
    let body = "";

    switch (type) {
      case "streak":
        const days = typeof value === "number" ? value : parseInt(value);
        title = "Amazing Streak! 🔥";
        body = `You've been scanning for ${days} days straight. Keep it up!`;
        break;
      case "score":
        const score = typeof value === "number" ? value : parseInt(value);
        if (score >= 80) {
          title = "Excellent Gut Health! 🎉";
          body = `Your gut score of ${score} puts you in the thriving zone!`;
        } else if (score >= 60) {
          title = "Great Progress! 📈";
          body = `Your gut score improved to ${score}. Keep up the good work!`;
        }
        break;
      case "scans":
        const scanCount = typeof value === "number" ? value : parseInt(value);
        title = "Scan Milestone! 📊";
        body = `You've completed ${scanCount} scans. You're building a healthy habit!`;
        break;
      case "goal":
        title = "Goal Achieved! 🎯";
        body = `You've reached your goal: ${value}`;
        break;
    }

    if (title && body) {
      await notificationService.triggerAchievementAlert(title, body);
    }
  } catch (error) {
    console.error("Failed to trigger achievement notification:", error);
  }
}

/**
 * Call this after a successful scan to check for achievements
 */
export async function checkAndTriggerScanAchievements(
  newScanCount: number,
  newStreak: number,
  newScore?: number
): Promise<void> {
  try {
    // Check for streak milestones (5, 10, 25, 50, 100 days)
    const streakMilestones = [5, 10, 25, 50, 100];
    if (streakMilestones.includes(newStreak)) {
      await triggerAchievementNotification("streak", newStreak);
    }

    // Check for scan count milestones (10, 25, 50, 100, 200 scans)
    const scanMilestones = [10, 25, 50, 100, 200];
    if (scanMilestones.includes(newScanCount)) {
      await triggerAchievementNotification("scans", newScanCount);
    }

    // Check for score improvements
    if (newScore && newScore >= 80) {
      await triggerAchievementNotification("score", newScore);
    }
  } catch (error) {
    console.error("Failed to check scan achievements:", error);
  }
}

/**
 * Setup real-time listeners for database changes that should trigger notifications
 */
export function setupNotificationListeners(): () => void {
  // Listen for user profile changes (streak updates, etc.)
  const profileSubscription = supabase
    .channel('profile-changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_profiles',
        filter: 'id=eq.user_id' // This will need to be replaced with actual user ID
      },
      async (payload) => {
        const newProfile = payload.new;
        const oldProfile = payload.old;

        // Check for streak increases
        if (newProfile.current_streak > oldProfile.current_streak) {
          await triggerAchievementNotification("streak", newProfile.current_streak);
        }

        // Check for total scan increases
        if (newProfile.total_scans > oldProfile.total_scans) {
          await triggerAchievementNotification("scans", newProfile.total_scans);
        }
      }
    )
    .subscribe();

  // Return cleanup function
  return () => {
    profileSubscription.unsubscribe();
  };
}

/**
 * Schedule weekly progress report notification
 * This would typically be called by a scheduled job or cron
 */
export async function scheduleWeeklyProgressReport(userId: string): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!profile) return;

    // Check if user has weekly reports enabled
    const { data: settings } = await supabase
      .from('user_profiles')
      .select('notification_settings')
      .eq('id', userId)
      .single();

    const notificationSettings = settings?.notification_settings as any;
    if (!notificationSettings?.weeklyProgressReports) return;

    // Calculate weekly progress
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { data: weeklyScans } = await supabase
      .from('meal_scans')
      .select('gut_score, created_at')
      .eq('user_id', userId)
      .gte('created_at', oneWeekAgo.toISOString())
      .order('created_at', { ascending: false });

    if (!weeklyScans || weeklyScans.length === 0) return;

    // Calculate average score for the week
    const scoresWithValues = weeklyScans.filter(scan => scan.gut_score !== null);
    const averageScore = scoresWithValues.length > 0 
      ? scoresWithValues.reduce((sum, scan) => sum + scan.gut_score!, 0) / scoresWithValues.length
      : 0;

    // Trigger notification
    const title = "Your Weekly Gut Report 📊";
    const body = `This week you scanned ${weeklyScans.length} meals with an average gut score of ${averageScore.toFixed(1)}. Keep up the great work!`;

    await notificationService.triggerAchievementAlert(title, body);
  } catch (error) {
    console.error("Failed to schedule weekly progress report:", error);
  }
}
