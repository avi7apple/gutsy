import { Platform } from "react-native";
import type {
  CustomerInfo,
  LogInResult,
  PurchasesError,
  PurchasesOfferings,
  PurchasesPackage,
} from "react-native-purchases";
import { PURCHASES_ERROR_CODE } from "react-native-purchases";

type PurchasesType = typeof import("react-native-purchases").default;

// We only load the native RevenueCat module on iOS/Android builds.
let purchasesModule: PurchasesType | null = null;

if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const required = require("react-native-purchases");
    purchasesModule = required?.default ?? required;
  } catch (error) {
    console.warn("RevenueCat SDK unavailable:", error);
    purchasesModule = null;
  }
}

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
const ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID;

type ConfigureOptions = {
  userId?: string | null;
};

const runtimeState = {
  configuredKey: null as string | null,
  currentUserId: null as string | null,
};

function getPlatformApiKey(): string | undefined {
  return Platform.select({ ios: IOS_KEY, android: ANDROID_KEY }) ?? undefined;
}

export function isRevenueCatSupported(): boolean {
  return Boolean(purchasesModule && getPlatformApiKey());
}

/** Configure RC if needed without logging out the current identified user. */
export async function ensureRevenueCatConfigured(): Promise<boolean> {
  if (!purchasesModule) return false;
  const apiKey = getPlatformApiKey();
  if (!apiKey) return false;

  const needsFreshConfigure = runtimeState.configuredKey !== apiKey;

  if (needsFreshConfigure) {
    purchasesModule.configure({
      apiKey,
      appUserID: runtimeState.currentUserId ?? undefined,
    });
    runtimeState.configuredKey = apiKey;
  }

  return true;
}

export async function configureRevenueCat(
  options: ConfigureOptions = {},
): Promise<boolean> {
  if (!purchasesModule) return false;
  const apiKey = getPlatformApiKey();
  if (!apiKey) return false;

  const { userId } = options;
  const needsFreshConfigure = runtimeState.configuredKey !== apiKey;

  if (needsFreshConfigure) {
    purchasesModule.configure({
      apiKey,
      appUserID: userId ?? runtimeState.currentUserId ?? undefined,
    });
    runtimeState.configuredKey = apiKey;
    runtimeState.currentUserId = userId ?? runtimeState.currentUserId ?? null;
    return true;
  }

  if (userId && runtimeState.currentUserId !== userId) {
    await purchasesModule.logIn(userId);
    runtimeState.currentUserId = userId;
  }

  return true;
}

export async function logInRevenueCatUser(userId: string): Promise<CustomerInfo | null> {
  if (!userId) return null;
  const ready = await configureRevenueCat({ userId });
  if (!ready || !purchasesModule) return null;
  const result: LogInResult = await purchasesModule.logIn(userId);
  runtimeState.currentUserId = userId;
  return result.customerInfo;
}

export async function logOutRevenueCatUser(): Promise<void> {
  if (!purchasesModule) return;
  if (!runtimeState.currentUserId) return;
  await purchasesModule.logOut();
  runtimeState.currentUserId = null;
}

export async function getRevenueCatCustomerInfo(): Promise<CustomerInfo | null> {
  if (!purchasesModule) return null;
  const ready = await ensureRevenueCatConfigured();
  if (!ready) return null;
  return purchasesModule.getCustomerInfo();
}

export async function restoreRevenueCatPurchases(): Promise<CustomerInfo | null> {
  if (!purchasesModule) return null;
  const ready = await ensureRevenueCatConfigured();
  if (!ready) return null;
  return purchasesModule.restorePurchases();
}

export async function getRevenueCatOfferings(): Promise<PurchasesOfferings | null> {
  if (!purchasesModule) return null;
  const ready = await ensureRevenueCatConfigured();
  if (!ready) return null;
  return purchasesModule.getOfferings();
}

export async function purchaseRevenueCatPackage(
  selectedPackage: PurchasesPackage,
): Promise<CustomerInfo | null> {
  if (!purchasesModule) return null;
  const ready = await ensureRevenueCatConfigured();
  if (!ready) return null;
  const result = await purchasesModule.purchasePackage(selectedPackage);
  return result.customerInfo ?? null;
}

export function isRevenueCatPurchaseCancelled(error: unknown): boolean {
  if (!error) return false;
  const rcError = error as PurchasesError;
  if (typeof rcError?.userCancelled === "boolean") {
    return rcError.userCancelled;
  }
  if (typeof rcError?.code === "string" || typeof rcError?.code === "number") {
    return rcError.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
  }
  return false;
}

export type RevenueCatPackage = PurchasesPackage;
export type RevenueCatOfferings = PurchasesOfferings;

export function hasActiveRevenueCatEntitlement(
  info: CustomerInfo | null | undefined,
): boolean {
  if (!info) return false;
  if (!ENTITLEMENT_ID) return false;
  return Boolean(info.entitlements?.active?.[ENTITLEMENT_ID]);
}

export function getRevenueCatEntitlementId(): string | undefined {
  return ENTITLEMENT_ID;
}

type ActiveEntitlement = NonNullable<
  CustomerInfo["entitlements"]["active"]
>[string];

export function getActiveRevenueCatEntitlement(
  info: CustomerInfo | null | undefined,
): ActiveEntitlement | null {
  if (!info) return null;
  if (!ENTITLEMENT_ID) return null;
  return info.entitlements?.active?.[ENTITLEMENT_ID] ?? null;
}
