import { supabase } from "@/lib/supabase";
import { resolveDisplayFullName } from "@/lib/user-display-name";
import {
    DEFAULT_NOTIFICATION_SETTINGS,
    DEFAULT_PRIVACY_SETTINGS,
    NotificationSettings,
    PrivacySettings,
    ProfileSettings,
} from "@/types/profile";

type ProfileRow = {
  full_name: string | null;
  email: string | null;
  notification_settings: unknown;
  privacy_settings: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseNotificationSettings(value: unknown): NotificationSettings {
  if (!isObject(value)) return DEFAULT_NOTIFICATION_SETTINGS;
  return {
    dailyScanReminders: value.dailyScanReminders !== false,
    achievementAlerts: value.achievementAlerts !== false,
    weeklyProgressReports: value.weeklyProgressReports !== false,
    gutHealthTips: value.gutHealthTips === true,
  };
}

function parsePrivacySettings(value: unknown): PrivacySettings {
  if (!isObject(value)) return DEFAULT_PRIVACY_SETTINGS;
  return {
    analyticsTracking: value.analyticsTracking !== false,
    researchDataSharing: value.researchDataSharing === true,
    personalizedRecommendations: value.personalizedRecommendations !== false,
  };
}

async function getCurrentUserOrThrow() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You need to be signed in.");
  }

  return user;
}

async function upsertProfilePatch(
  userId: string,
  email: string | undefined,
  patch: Record<string, unknown>,
) {
  const { error } = await supabase.from("user_profiles").upsert(
    {
      id: userId,
      email,
      updated_at: new Date().toISOString(),
      ...patch,
    },
    { onConflict: "id" },
  );

  if (error) {
    throw error;
  }
}

export async function fetchProfileSettings(): Promise<ProfileSettings> {
  const user = await getCurrentUserOrThrow();

  const { data, error } = await supabase
    .from("user_profiles")
    .select("full_name,email,notification_settings,privacy_settings")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = data as ProfileRow | null;

  const fullName = resolveDisplayFullName(user, row?.full_name);

  return {
    fullName,
    email: row?.email ?? user.email ?? "",
    notifications: parseNotificationSettings(row?.notification_settings),
    privacy: parsePrivacySettings(row?.privacy_settings),
  };
}

export async function updateProfileName(fullName: string): Promise<void> {
  const user = await getCurrentUserOrThrow();

  const { error: authError } = await supabase.auth.updateUser({
    data: {
      full_name: fullName,
      name: fullName,
    },
  });

  if (authError) {
    throw authError;
  }

  await upsertProfilePatch(user.id, user.email ?? undefined, {
    full_name: fullName,
  });
}

export async function updateNotificationSettings(
  settings: NotificationSettings,
): Promise<void> {
  const user = await getCurrentUserOrThrow();
  await upsertProfilePatch(user.id, user.email ?? undefined, {
    notification_settings: settings,
  });
}

export async function updatePrivacySettings(settings: PrivacySettings): Promise<void> {
  const user = await getCurrentUserOrThrow();
  await upsertProfilePatch(user.id, user.email ?? undefined, {
    privacy_settings: settings,
  });
}
