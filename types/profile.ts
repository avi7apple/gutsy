export type NotificationSettings = {
  dailyScanReminders: boolean;
  achievementAlerts: boolean;
  weeklyProgressReports: boolean;
  gutHealthTips: boolean;
};

export type PrivacySettings = {
  analyticsTracking: boolean;
  researchDataSharing: boolean;
  personalizedRecommendations: boolean;
};

export type ProfileSettings = {
  fullName: string;
  email: string;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  dailyScanReminders: true,
  achievementAlerts: true,
  weeklyProgressReports: true,
  gutHealthTips: true,
};

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  analyticsTracking: true,
  researchDataSharing: false,
  personalizedRecommendations: true,
};
