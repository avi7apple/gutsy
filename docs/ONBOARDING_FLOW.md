# Onboarding Flow

This document describes the current onboarding flow in the Gutsy app: screen order, data collected, and where it is stored.

## Entry point

- **App index** (`app/index.tsx`) redirects to `/onboarding/welcome`.
- Onboarding screens live under `app/onboarding/` and use a **Stack** layout with no header, slide-from-right animation, and back gesture disabled only on **creating-profile**.

---

## Screen flow (order)

```
welcome → analyze-first → … → gut-score → improve-gut → goal → triggers
    → skin-concerns → water → success → gender → age → activity → skin-type
    → creating-profile → all-set → /scan
```

| Step | Screen | Route | What it does |
|------|--------|--------|--------------|
| 1 | **Welcome** | `/onboarding/welcome` | Entry: logo, tagline “Fix your gut. Fix everything.”, **Get Started** and **Sign in** (Sign in is TODO). Get Started → analyze-first. |
| 2 | **Analyze first** | `/onboarding/analyze-first` | “Let’s analyze your gut health first”: stats, **Scan a product** (→ `/scan?fromOnboarding=1&mode=photo`) or **Skip for now** (→ goal). From scan result sheet, **Continue to goal** → goal. |
| 3 | **Goal** | `/onboarding/goal` | User picks one primary goal. Options: Reduce bloating, Clear skin, More energy, Better digestion. Saves **goal** (label), then → triggers. |
| 4 | **Triggers** | `/onboarding/triggers` | Multi-select (with “Not sure yet” as single option): Dairy, Gluten/wheat, Beans & legumes, Spicy food, Carbonated drinks, Artificial sweeteners. Saves **trigger** (first selected label), then → skin-concerns. |
| 5 | **Skin concerns** | `/onboarding/skin-concerns` | Multi-select: Acne or breakouts, Dullness or uneven tone, Redness or sensitivity, Dark circles or puffiness, None. Saves **skinConcern** (first selected label), then → water. |
| 6 | **Water** | `/onboarding/water` | Single choice: &lt;4, 4–6, 6–8, 8+ glasses. Saves **water** (label), then → success. |
| 7 | **Success** | `/onboarding/success` | Motivational screen with “72% vs 18%” style chart. **Continue** → gender. |
| 8 | **Gender** | `/onboarding/gender` | Single choice: Male, Female, Other. No persistence in current profile. → age. |
| 9 | **Age** | `/onboarding/age` | Scrollable wheel, 18–99, default 25. No persistence in current profile. → activity. |
| 10 | **Activity** | `/onboarding/activity` | Single choice: Sedentary, Moderate, Active, Very Active. No persistence in current profile. → skin-type. |
| 11 | **Skin type** | `/onboarding/skin-type` | Single choice: Normal, Dry, Oily, Combination, Sensitive. Saves **skinType** (label), then → creating-profile. |
| 12 | **Creating profile** | `/onboarding/creating-profile` | Loading screen: “Creating your gut profile…” for ~10 seconds, then `replace` → all-set. Back gesture disabled. |
| 13 | **All set** | `/onboarding/all-set` | Summary: “You’re all set!” and a card showing **Goal**, **Skin type**, **Water**, **Triggers**. Bullets for “For every product, you’ll see:” (skin, bloating, energy, alternatives). **Scan my first product →** → `/scan`. |

---

## Stored profile (`lib/onboarding-storage.ts`)

Only the following are persisted (AsyncStorage):

| Key | Set on screen | Example value |
|-----|----------------|----------------|
| `onboarding_goal` | goal | `"Reduce bloating"` |
| `onboarding_trigger` | triggers | `"Dairy products"` |
| `onboarding_skin_concern` | skin-concerns | `"Acne or breakouts"` |
| `onboarding_water` | water | `"6-8 glasses"` |
| `onboarding_skin_type` | skin-type | `"Combination"` |

**Not stored:** gender, age, activity (collected in UI but not written to the current `OnboardingProfile`).

`getOnboardingProfile()` returns `{ goal, skinConcern, skinType, water, trigger }` and is used by the scan flow (scores, tips, insights).

---

## UI details

- **Progress bar:** Shown on goal, triggers, skin-concerns, water, success, gender, age, activity, skin-type (e.g. “step X of 20”). Total steps is 20; current step is per-screen.
- **Back button:** Header back on all screens except welcome; creating-profile has `gestureEnabled: false` so user cannot swipe back during “Creating your gut profile…”
- **All-set:** Displays only goal, skin type, water, and triggers on the profile card; skin concern is saved but not shown there.

---

## File reference

| File | Purpose |
|------|--------|
| `app/index.tsx` | Redirect to `/onboarding/welcome` |
| `app/onboarding/_layout.tsx` | Stack, no header, slide animation |
| `app/onboarding/welcome.tsx` | Entry + Get Started / Sign in |
| `app/onboarding/analyze-first.tsx` | “Analyze your gut first” + Scan / Skip → scan or goal |
| `app/onboarding/goal.tsx` | Primary goal → save goal, push triggers |
| `app/onboarding/triggers.tsx` | Triggers (multi) → save trigger, push skin-concerns |
| `app/onboarding/skin-concerns.tsx` | Skin concerns (multi) → save skinConcern, push water |
| `app/onboarding/water.tsx` | Water intake → save water, push success |
| `app/onboarding/success.tsx` | Motivational → push gender |
| `app/onboarding/gender.tsx` | Gender → push age |
| `app/onboarding/age.tsx` | Age wheel → push activity |
| `app/onboarding/activity.tsx` | Activity level → push skin-type |
| `app/onboarding/skin-type.tsx` | Skin type → save skinType, push creating-profile |
| `app/onboarding/creating-profile.tsx` | Loading → replace all-set after delay |
| `app/onboarding/all-set.tsx` | Profile summary + “Scan my first product” → replace /scan |
| `lib/onboarding-storage.ts` | AsyncStorage read/write for profile fields |
