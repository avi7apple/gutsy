import { supabase } from "@/lib/supabase";

const TRIAL_DURATION_DAYS = 3;

export type SubscriptionProfile = {
  subscription_status: string | null;
  subscription_tier: string | null;
  has_seen_paywall: boolean | null;
  is_trial_active: boolean | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
};

export async function getSubscriptionProfile(
  userId: string,
): Promise<SubscriptionProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "subscription_status, subscription_tier, has_seen_paywall, is_trial_active, trial_started_at, trial_ends_at",
    )
    .eq("id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw error;
  }

  return data;
}

export function hasPaidAccess(profile: SubscriptionProfile | null): boolean {
  if (!profile) return false;

  const normalizedStatus = (profile.subscription_status ?? "").toLowerCase();
  if (normalizedStatus === "active") return true;

  if (normalizedStatus === "trialing") {
    return isTrialNotExpired(profile.trial_ends_at);
  }

  if (profile.is_trial_active) {
    return isTrialNotExpired(profile.trial_ends_at);
  }

  return false;
}

export async function startTrialAccess(userId: string): Promise<void> {
  const now = new Date();
  const trialEnds = new Date(now);
  trialEnds.setDate(trialEnds.getDate() + TRIAL_DURATION_DAYS);

  const { error } = await supabase
    .from("user_profiles")
    .update({
      has_seen_paywall: true,
      subscription_tier: "premium",
      subscription_status: "trialing",
      is_trial_active: true,
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnds.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", userId);

  if (error) {
    throw error;
  }
}

export async function markPaywallSeen(userId: string): Promise<void> {
  const { error } = await supabase
    .from("user_profiles")
    .update({ has_seen_paywall: true, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    throw error;
  }
}

export async function expireTrialIfNeeded(
  userId: string,
  profile: SubscriptionProfile,
): Promise<boolean> {
  const trialStillValid = isTrialNotExpired(profile.trial_ends_at);

  if (profile.is_trial_active && !trialStillValid) {
    const { error } = await supabase
      .from("user_profiles")
      .update({
        is_trial_active: false,
        subscription_status: "inactive",
        subscription_tier: "free",
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      throw error;
    }

    return false;
  }

  return trialStillValid;
}

function isTrialNotExpired(trialEndsAt: string | null): boolean {
  if (!trialEndsAt) return false;
  const endsAtMs = new Date(trialEndsAt).getTime();
  if (!Number.isFinite(endsAtMs)) return false;
  return Date.now() < endsAtMs;
}
