// Test file to verify notification system implementation
// This file is for development/testing purposes only

import { notificationService } from "./lib/notification-service";
import { initializeNotificationSystem, triggerAchievementNotification } from "./lib/notification-integration";
import { requestNotificationPermissions, getNotificationPermissionStatus } from "./lib/notification-permissions";

async function testNotificationSystem() {
  console.log("🧪 Testing Notification System...");
  
  try {
    // Test 1: Permission status
    console.log("📱 Checking permission status...");
    const status = await getNotificationPermissionStatus();
    console.log("Permission status:", status);
    
    // Test 2: Request permissions
    if (status !== "granted") {
      console.log("🔔 Requesting permissions...");
      const newStatus = await requestNotificationPermissions();
      console.log("New permission status:", newStatus);
    }
    
    // Test 3: Initialize notification system
    console.log("⚙️ Initializing notification system...");
    await initializeNotificationSystem();
    console.log("✅ Notification system initialized");
    
    // Test 4: Trigger test achievement
    console.log("🎉 Triggering test achievement notification...");
    await triggerAchievementNotification("streak", 5);
    console.log("✅ Achievement notification triggered");
    
    // Test 5: Schedule test notifications
    console.log("📅 Scheduling test notifications...");
    await notificationService.updateNotificationSettings({
      dailyScanReminders: true,
      achievementAlerts: true,
      weeklyProgressReports: true,
      gutHealthTips: true,
    });
    console.log("✅ Test notifications scheduled");
    
    // Test 6: Check scheduled notifications
    const count = await notificationService.getScheduledNotificationsCount();
    console.log(`📊 Scheduled notifications count: ${count}`);
    
    console.log("🎉 All notification system tests passed!");
    
  } catch (error) {
    console.error("❌ Notification system test failed:", error);
  }
}

// Export for use in development
export { testNotificationSystem };

// Instructions for testing:
// 1. Import this file in your app's entry point or a dev screen
// 2. Call testNotificationSystem() to verify the implementation
// 3. Check console logs for results
// 4. Verify notifications appear on device

console.log("📋 Notification System Test File Loaded");
console.log("🔍 Available test functions:");
console.log("  - testNotificationSystem(): Complete system test");
console.log("📱 To run: import and call testNotificationSystem()");
