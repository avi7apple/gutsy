---
description: RevenueCat sandbox testing
tags: [mobile, subscriptions, qa]
---

# RevenueCat Sandbox Testing

This playbook walks through validating the new native paywall that talks directly to RevenueCat. Every gate, restore button, and downgrade path now depends solely on RevenueCat entitlements, so testing must happen on a native dev build (the purchases SDK is not available in Expo Go).

## 1. Prep RevenueCat + Environment

1. Populate `.env` with:
   - `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
   - `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
   - `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` (e.g., `premium_access`)
2. In the RevenueCat dashboard:
   - Create/confirm an offering where `current` references your 3-day-free-trial product.
   - Make sure that product is live in App Store Connect / Play Console with the same identifier used in RevenueCat.
3. Add yourself as an App Store sandbox tester (Settings ▸ App Store ▸ Sandbox Account) or a Play Store license tester.
4. In Supabase, make sure a `user_profiles` row exists for the account you’ll sign in with (completing onboarding once in the app does this automatically).

## 2. Build + Install a Dev Client

1. Generate a dev build that includes the RevenueCat native module:
   - iOS: `npx expo run:ios --device`
   - Android: `npx expo run:android`
2. Install the build on a physical device that’s logged into the sandbox tester account.
3. Launch the app, create/sign in, and complete onboarding until `/paywall` appears.

## 3. Purchase Flow Validation

1. The paywall screen now renders whatever is inside `offerings.current.availablePackages`.
2. Tap the package with the free trial → confirm the native purchase sheet shows the correct copy.
3. After confirming, the app calls `purchaseRevenueCatPackage` → `refreshRevenueCatAccess`. You should land in `/(tabs)` automatically.
4. In Supabase `user_profiles`, verify:
   - `subscription_status = "active"`
   - `subscription_tier = "premium"`
   - `trial_ends_at` matches the entitlement expiration reported by RevenueCat.

## 4. Restore + Logout Flows

1. Sign out from Profile ▸ Sign Out (this also calls `logOutRevenueCatUser`).
2. Sign back in, go to `/try-free`, `/reminder-promise`, `/trial-timeline`, or Profile ▸ Restore Purchases, and tap **Restore Purchases**.
3. The shared `useRestorePurchases` hook logs back into RevenueCat, calls `restoreRevenueCatPurchases()`, and routes you into `/(tabs)` if the entitlement exists.

## 5. Downgrade / Expiration Testing

1. In RevenueCat → Customers → (your sandbox user), manually expire the entitlement—or wait for the sandbox trial to end (~5 minutes on iOS).
2. Re-open the app or revisit `/paywall`. `refreshRevenueCatAccess` now demotes the Supabase profile (`subscription_status = "inactive"`, `subscription_tier = "free"`) and forces the hard paywall again.

## 6. Troubleshooting Checklist

- **“Paywall requires a development build”** → ensure you installed the dev client (`expo run:*`).
- **Offerings list is empty** → confirm RevenueCat has a published offering with at least one package marked as `current`.
- **Purchase succeeds but access stays locked** → verify the entitlement ID in `.env` matches the one granted by your product.
- **Restore shows “No purchases found”** → double-check the device is signed into the same sandbox Apple/Google account that made the purchase.
- **Need logs** → capture Xcode / Android Studio logs; the RevenueCat SDK prints entitlement changes and errors there.
