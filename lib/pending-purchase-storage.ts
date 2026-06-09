import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CustomerInfo } from "react-native-purchases";

const PENDING_PURCHASE_KEY = "gutsy:pending_revenuecat_purchase";

export type PendingPurchaseContext = {
  pricePaid?: number | null;
  currency?: string | null;
};

export type PendingPurchaseRecord = {
  savedAt: string;
  customerInfo: CustomerInfo;
  purchase?: PendingPurchaseContext;
};

export async function savePendingPurchase(
  customerInfo: CustomerInfo,
  purchase?: PendingPurchaseContext,
): Promise<void> {
  const record: PendingPurchaseRecord = {
    savedAt: new Date().toISOString(),
    customerInfo,
    purchase,
  };
  await AsyncStorage.setItem(PENDING_PURCHASE_KEY, JSON.stringify(record));
}

export async function getPendingPurchase(): Promise<PendingPurchaseRecord | null> {
  const raw = await AsyncStorage.getItem(PENDING_PURCHASE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PendingPurchaseRecord;
    if (!parsed?.customerInfo) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPendingPurchase(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_PURCHASE_KEY);
}
