import {
  getActiveRevenueCatEntitlement,
  getRevenueCatCustomerInfo,
  isRevenueCatSupported,
  logInRevenueCatUser,
  restoreRevenueCatPurchases,
} from "@/lib/revenuecat";
import { notificationService } from "@/lib/notification-service";
import {
  clearPendingPurchase,
  getPendingPurchase,
  type PendingPurchaseContext,
} from "@/lib/pending-purchase-storage";
import { supabase } from "@/lib/supabase";
import type { CustomerInfo } from "react-native-purchases";

export type SubscriptionProfile = {
  subscription_status: string | null;
  subscription_tier: string | null;
  has_seen_paywall: boolean | null;
  is_trial_active: boolean | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  product_id: string | null;
};

export type SubscriptionAccessResult = {
  profile: SubscriptionProfile | null;
  hasPaidAccess: boolean;
  paidViaRevenueCat: boolean;
};

export type PurchaseContext = PendingPurchaseContext;

export async function getSubscriptionProfile(
  userId: string,
): Promise<SubscriptionProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "subscription_status, subscription_tier, has_seen_paywall, is_trial_active, trial_started_at, trial_ends_at, current_period_ends_at, product_id",
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

/** Guarantee a user_profiles row exists before subscription writes. */
export async function ensureUserProfileRow(userId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("user_profiles").upsert(
    {
      id: userId,
      email: user?.id === userId ? (user.email ?? undefined) : undefined,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    throw error;
  }
}

export async function evaluateSubscriptionAccess(
  userId: string,
): Promise<SubscriptionAccessResult> {
  const profile = await getSubscriptionProfile(userId);
  const paidViaSupabase = hasPaidAccess(profile);

  let paidViaRevenueCat = false;
  let resolvedProfile = profile;

  if (!paidViaSupabase && isRevenueCatSupported()) {
    let customerInfo = await logInRevenueCatUser(userId);
    if (!customerInfo) {
      customerInfo = await getRevenueCatCustomerInfo();
    }

    paidViaRevenueCat = await syncProfileWithRevenueCat(userId, customerInfo);

    if (paidViaRevenueCat) {
      resolvedProfile = await getSubscriptionProfile(userId);
    }
  }

  const hasAccess =
    paidViaSupabase || paidViaRevenueCat || hasPaidAccess(resolvedProfile);

  return {
    profile: resolvedProfile,
    hasPaidAccess: hasAccess,
    paidViaRevenueCat,
  };
}

export async function refreshRevenueCatAccess(userId: string): Promise<boolean> {
  if (!isRevenueCatSupported()) return false;
  const info =
    (await logInRevenueCatUser(userId)) ?? (await getRevenueCatCustomerInfo());
  return syncProfileWithRevenueCat(userId, info);
}

export async function restoreRevenueCatAccess(userId: string): Promise<boolean> {
  if (!isRevenueCatSupported()) return false;
  await logInRevenueCatUser(userId);
  const info = await restoreRevenueCatPurchases();
  return syncProfileWithRevenueCat(userId, info);
}

/**
 * After sign-in, apply a purchase that happened while the user was anonymous
 * (trial-timeline funnel) and sync Supabase from RevenueCat.
 */
export async function applyPendingPurchaseForUser(
  userId: string,
): Promise<boolean> {
  const pending = await getPendingPurchase();
  if (!pending) return false;

  if (isRevenueCatSupported()) {
    await logInRevenueCatUser(userId);
  }

  let unlocked = await applyRevenueCatCustomerInfo(
    userId,
    pending.customerInfo,
    pending.purchase,
  );

  if (!unlocked && isRevenueCatSupported()) {
    unlocked = await refreshRevenueCatAccess(userId);
  }

  if (unlocked) {
    await clearPendingPurchase();
  }

  return unlocked;
}

export async function applyRevenueCatCustomerInfo(
  userId: string,
  info: CustomerInfo | null,
  purchase?: PurchaseContext,
): Promise<boolean> {
  return syncProfileWithRevenueCat(userId, info, purchase);
}

type EntitlementSnapshot = {
  store: string | null;
  product_id: string | null;
  will_renew: boolean | null;
  current_period_ends_at: string | null;
  original_purchase_date: string | null;
  cancelled_at: string | null;
  revenuecat_app_user_id: string | null;
};

function snapshotEntitlement(
  info: CustomerInfo | null,
  entitlement: NonNullable<ReturnType<typeof getActiveRevenueCatEntitlement>>,
): EntitlementSnapshot {
  return {
    store: (entitlement as { store?: string }).store
      ? String((entitlement as { store?: string }).store)
      : null,
    product_id: (entitlement as { productIdentifier?: string }).productIdentifier ?? null,
    will_renew:
      typeof (entitlement as { willRenew?: boolean }).willRenew === "boolean"
        ? (entitlement as { willRenew?: boolean }).willRenew
        : null,
    current_period_ends_at: entitlement.expirationDate ?? null,
    original_purchase_date: entitlement.originalPurchaseDate ?? null,
    cancelled_at:
      (entitlement as { unsubscribeDetectedAt?: string | null }).unsubscribeDetectedAt ??
      null,
    revenuecat_app_user_id: info?.originalAppUserId ?? null,
  };
}

async function updateSubscriptionProfile(
  userId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await ensureUserProfileRow(userId);

  const { data, error } = await supabase
    .from("user_profiles")
    .update({
      ...fields,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.id) {
    throw new Error(
      `Subscription sync failed: no user_profiles row updated for ${userId}`,
    );
  }
}

async function promoteProfileToActive(
  userId: string,
  snapshot: EntitlementSnapshot,
  purchase?: PurchaseContext,
): Promise<void> {
  await updateSubscriptionProfile(userId, {
    has_seen_paywall: true,
    subscription_tier: "premium",
    subscription_status: "active",
    is_trial_active: false,
    trial_ends_at: null,
    ...snapshot,
    ...(purchase?.pricePaid != null ? { price_paid: purchase.pricePaid } : {}),
    ...(purchase?.currency ? { currency: purchase.currency } : {}),
  });
}

async function promoteProfileToTrial(
  userId: string,
  snapshot: EntitlementSnapshot,
  purchase?: PurchaseContext,
): Promise<void> {
  const { data: existing } = await supabase
    .from("user_profiles")
    .select("subscription_status, trial_started_count, trial_started_at")
    .eq("id", userId)
    .maybeSingle();

  const wasAlreadyTrialing = existing?.subscription_status === "trialing";
  const incrementedTrialCount = wasAlreadyTrialing
    ? (existing?.trial_started_count ?? 0)
    : (existing?.trial_started_count ?? 0) + 1;

  const trialStartedAt =
    snapshot.original_purchase_date ??
    existing?.trial_started_at ??
    new Date().toISOString();

  await updateSubscriptionProfile(userId, {
    has_seen_paywall: true,
    subscription_tier: "premium",
    subscription_status: "trialing",
    is_trial_active: true,
    trial_started_at: trialStartedAt,
    trial_ends_at: snapshot.current_period_ends_at,
    trial_started_count: incrementedTrialCount,
    ...snapshot,
    ...(purchase?.pricePaid != null ? { price_paid: purchase.pricePaid } : {}),
    ...(purchase?.currency ? { currency: purchase.currency } : {}),
  });

  if (snapshot.current_period_ends_at) {
    await notificationService.scheduleTrialEndReminders(
      snapshot.current_period_ends_at,
    );
  }
}

async function demoteProfileToFree(userId: string): Promise<void> {
  await updateSubscriptionProfile(userId, {
    subscription_tier: "free",
    subscription_status: "inactive",
    is_trial_active: false,
    trial_started_at: null,
    trial_ends_at: null,
    current_period_ends_at: null,
    will_renew: false,
  });

  await notificationService.cancelTrialEndReminders();
}

function hadPriorSubscription(profile: SubscriptionProfile | null): boolean {
  if (!profile) return false;

  const status = (profile.subscription_status ?? "").toLowerCase();
  if (status === "active" || status === "trialing") return true;
  if (profile.product_id) return true;
  if (profile.current_period_ends_at || profile.trial_ends_at) return true;

  return false;
}

async function syncProfileWithRevenueCat(
  userId: string,
  info: CustomerInfo | null,
  purchase?: PurchaseContext,
): Promise<boolean> {
  const activeEntitlement = getActiveRevenueCatEntitlement(info);

  if (!activeEntitlement) {
    const existing = await getSubscriptionProfile(userId);
    const periodEnd =
      existing?.current_period_ends_at ?? existing?.trial_ends_at;
    const periodMs = periodEnd ? new Date(periodEnd).getTime() : NaN;
    const stillWithinPeriod =
      Number.isFinite(periodMs) && periodMs > Date.now();

    if (stillWithinPeriod) {
      return hasPaidAccess(existing);
    }

    // Never synced — don't demote a row that was never subscribed.
    if (!hadPriorSubscription(existing)) {
      return false;
    }

    await demoteProfileToFree(userId);
    return false;
  }

  const snapshot = snapshotEntitlement(info, activeEntitlement);
  const period = String(activeEntitlement.periodType ?? "").toUpperCase();
  const isTrial = period === "TRIAL" || period === "INTRO";

  if (isTrial) {
    await promoteProfileToTrial(userId, snapshot, purchase);
  } else {
    await promoteProfileToActive(userId, snapshot, purchase);
  }

  await clearPendingPurchase();
  return true;
}

export async function markPaywallSeen(userId: string): Promise<void> {
  await ensureUserProfileRow(userId);

  const { data: existing } = await supabase
    .from("user_profiles")
    .select("paywall_view_count")
    .eq("id", userId)
    .maybeSingle();

  const nextCount = (existing?.paywall_view_count ?? 0) + 1;
  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from("user_profiles")
    .update({
      has_seen_paywall: true,
      paywall_view_count: nextCount,
      last_paywall_seen_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", userId);

  if (error) {
    throw error;
  }
}

export type PaywallFunnelStep =
  | "try_free"
  | "reminder_promise"
  | "trial_timeline"
  | "purchase_completed";

/** Track progress through the 3-step paywall funnel in user_profiles. */
export async function recordPaywallFunnelStep(
  userId: string,
  step: PaywallFunnelStep,
): Promise<void> {
  await ensureUserProfileRow(userId);

  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    has_seen_paywall: true,
    last_paywall_seen_at: nowIso,
    updated_at: nowIso,
  };

  if (step === "try_free") {
    patch.onboarding_started_at = nowIso;
  }

  if (step === "trial_timeline" || step === "purchase_completed") {
    patch.onboarding_completed_at = nowIso;
  }

  const { error } = await supabase
    .from("user_profiles")
    .update(patch)
    .eq("id", userId);

  if (error) {
    console.warn("recordPaywallFunnelStep failed:", error.message);
  }
}

export async function touchLastActive(userId: string): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("user_profiles")
    .update({ last_active_at: nowIso })
    .eq("id", userId);

  if (error) {
    console.warn("touchLastActive failed:", error.message);
  }
}

function isTrialNotExpired(trialEndsAt: string | null): boolean {
  if (!trialEndsAt) return false;
  const endsAtMs = new Date(trialEndsAt).getTime();
  if (!Number.isFinite(endsAtMs)) return false;
  return Date.now() < endsAtMs;
}

export type RestorePurchasesResult = "restored" | "missing" | "no-user";

export async function restorePurchasesForCurrentUser(): Promise<RestorePurchasesResult> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    return "no-user";
  }

  const restored = await restoreRevenueCatAccess(user.id);
  return restored ? "restored" : "missing";
}
