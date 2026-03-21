# Scan Results Section - UI Elements & Data Structure

## Overview
The scan results section is a bottom sheet modal that appears after scanning a food item (photo or barcode). It displays comprehensive analysis of how the food affects the user's gut health, skin, energy, and digestion based on their personalized profile.

## Layout Structure (Top to Bottom)

### 1. Header Section
**Layout**: Horizontal row with two elements side-by-side
- **Left Side**: Product information
  - Product name (`result.product_name` or `result.food_name`) - bold, 20px, max 2 lines
  - Manufacturer name (`result.manufacturer`) - only shown if `result.scan_type === "barcode"` and manufacturer exists, smaller gray text below product name
- **Right Side**: Product image thumbnail
  - 80×80px rounded image (`result.image_url`) - only shown if image exists
  - Rounded corners, shadow, gray background placeholder

### 2. Gut Score Section
**Layout**: Centered block
- **Label**: "GUT SCORE" - uppercase, small gray text, letter-spaced, positioned above the ring
- **Circular Progress Ring**: 
  - Size: 88px diameter, 8px stroke width
  - SVG-based animated ring that fills to percentage (0-100%)
  - Background: Light gray circle
  - Progress: Primary green color (`Colors.primary`), fills clockwise from top
  - Center: Shows score number (large bold) and "/ 100" below it
  - Animation: Smooth fill animation over 800ms

### 3. "How it affects you" Section
**Section Title**: "How it affects you" - 18px semibold, with generous top margin

**Summary Text** (if exists):
- `analysis.summary` - 15px regular text, gray, line-height 22px

**Impact Rows** (always shown in this order):
Each row has:
- Left icon (18px Ionicons) in primary color
- Right content area with:
  - Top row: Label (semibold) + Score (right-aligned, primary color)
  - Bottom: Description text (regular, gray)

**Row 1: Skin** (conditional - only if `analysis.skin` exists)
- Icon: `body-outline`
- Label: "Skin"
- Score: `result.skin_score` / 10 (0-10 scale)
- Text: `analysis.skin`

**Row 2: Bloating** (always shown)
- Icon: `water-outline`
- Label: "Bloating"
- Score: `Math.round(result.bloat_score / 10)` / 10 (converted from 0-100 scale)
- Text: `analysis.digestion` OR fallback text based on bloat_score ranges

**Row 3: Digestion** (always shown)
- Icon: `nutrition-outline`
- Label: "Digestion"
- Score: `result.digestion_score` / 10 (0-10 scale)
- Text: `analysis.digestion` OR fallback: "How this food may affect your digestion and comfort."

**Row 4: Energy & mood** (conditional - only if `analysis.mood` exists)
- Icon: `flash-outline`
- Label: "Energy & mood"
- Score: `result.energy_score` / 10 (0-10 scale)
- Text: `analysis.mood`

### 4. Goal-Specific Section (conditional - only if user has a goal)
**Section Title**: "🎯 For your {goal} goal" - where goal is lowercase (e.g., "more energy", "clear skin", "better digestion")

**Card**: White background, border, shadow, rounded corners, padding
- **Content**:
  - First tip: `analysis.tips[0]` (if exists) - regular text
  - Second tip: `analysis.tips[1]` (if exists) - regular text, with spacing
  - Goal-specific highlight: Based on user's goal, shows relevant analysis:
    - "Clear skin" → `analysis.skin` (highlighted in primary color)
    - "More energy" → `analysis.mood` (highlighted in primary color)
    - "Better digestion" → `analysis.digestion` (highlighted in primary color)
  - CTA button: "See how to improve this" - secondary style

### 5. Trigger Alert (conditional - only if trigger detected)
**Card**: Red/pink background (#FFEBEE), red border (#FFCDD2), padding
- Title: "Trigger food alert" - red text
- Body: "This may contain: {triggerLabel}" - where triggerLabel comes from user's profile
- Confidence: "High risk" - red semibold
- CTA: "See alternatives without these triggers" - secondary button

### 6. Key Insights Section
**Section Title**: "Key insights" - 18px semibold

**Insights List**: Up to 3 insights, each with:
- **Number Badge**: Circular badge (28×28px) with gray background (`Colors.textMuted`), white number (1, 2, or 3)
- **Content**:
  - Title: Semibold, 14px
  - Detail: Regular, 13px gray
  - Tip: Regular, 12px muted gray, prefixed with 💡
- **Divider**: Thin gray line between insights (not after last one)

**Insight Generation Logic**:
- Insight 1: High sodium warning (if `nutrition.sodium_mg > 400`) OR bloat risk (if `bloat_score > 60`)
- Insight 2: Bloat risk assessment (always shown)
- Insight 3: Skin impact (if `analysis.skin` exists) OR default "Overall" insight

### 7. "Make it better" Section
**Container Card**: Light background, border, rounded, padding

**Title**: "💡 Make it better" - 18px semibold
**Subheader**: "Simple swaps to improve your score:" - 14px regular gray

**Option 1 Card**: White background, border, shadow
- Title: "Option 1: Minor changes"
- Skip items (❌):
  - "Skip: Extra salt & heavy toppings"
  - "Skip: Large portion"
- Keep item (✓): "Keep everything else" - green text
- Score row:
  - "New bloat score: {calculated}/100" - where calculated = `Math.min(100, Math.round(result.bloat_score - 15))`
  - "+{points} points better!" - where points = `Math.min(15, Math.max(0, Math.round(result.bloat_score - 45)))`
- CTA: "Apply these changes →" - primary color, semibold

**Option 2 Card**: White background, border, shadow
- Title: "Option 2: Different meal"
- Thumbnail: 64×64px rounded placeholder with restaurant icon (gray)
- Meal name: "Chicken power bowl" - semibold
- Scores row:
  - "Bloat score: 38/100 🟢"
  - "Skin score: 8/10 🟢"
- Subtext: "Same restaurant, better for your goals" - muted gray
- CTA: "See full analysis →" - primary color, semibold

**Footer Link**: "See more alternatives →" - centered, primary color

### 8. Timing Section (conditional - only if meal is late)
**Condition**: Shows if current hour >= 20 (8pm) OR < 6 (before 6am)

**Section Title**: "Timing matters" - 18px semibold

**Card**: Yellow background (#FFF8E1), padding, rounded
- Text: "Eating late can affect sleep and next-day bloat. Try dinner before 7pm when possible."
- CTA: "Set dinner reminder" - small button style

### 9. Nutrition Details Section
**Section Title**: "Nutrition details" - 18px semibold

**Expand Card**: White background, border, shadow, rounded, tappable
- **Left Side**:
  - Icon: Nutrition icon (24px) in rounded box (44×44px) with light background
  - Text column:
    - Title: "View nutrition details" (when collapsed) OR "Hide nutrition" (when expanded) - semibold
    - Hint: "Calories, protein, carbs & more" - small gray
- **Right Side**: Button
  - Text: "Expand" (when collapsed) OR "Collapse" (when expanded) - medium weight
  - Chevron icon: Down (when collapsed) OR Up (when expanded)

**Nutrition Grid** (shown when expanded):
- Layout: Flex row, wrap, gap spacing
- Items: Card-style (30% width, min 90px)
  - Each card shows:
    - Value: Large bold number (20px)
    - Unit: Medium weight, smaller (12px)
    - Label: Regular, smallest (12px), centered
- Data shown:
  - Calories (kcal)
  - Protein (g)
  - Carbs (g)
  - Fat (g)
  - Fiber (g)
  - Sodium (mg)
  - Sugar (g)

### 10. Action Buttons Section
**Primary Button**: "Log as Eaten"
- Green background (`Colors.primary`), white text, rounded, shadow
- Shows loading spinner when saving
- Disabled state when saving or saved

**Secondary Button**: "See Better Options"
- Outlined style (border, no fill), primary color text

**Link Row**: Horizontal row of chips
- "Save as Favorite" / "Saved" (with checkmark icon) - conditional based on saved state
- "Share" (with share icon)
- "Add Notes" (with create icon)
- All chips: Small, primary color, icon + text

**Scan Again Button**: "🔄 Scan Another Meal"
- Text-only link style, primary color

## Data Structure

### ScanResult Type
```typescript
{
  scan_type: "photo" | "barcode" | "manual"
  food_name: string
  product_name?: string  // Full product name for barcode scans
  manufacturer?: string  // Brand/manufacturer for barcode scans
  identified_foods: string[]
  gut_score?: number  // 0-100, overall gut health score
  bloat_score: number  // 0-100, lower = less bloating
  skin_score: number  // 0-10
  energy_score: number  // 0-10
  digestion_score: number  // 0-10
  analysis: {
    summary: string
    tips: string[]
    skin?: string
    digestion?: string
    mood?: string
  }
  nutrition: {
    calories?: number
    protein_g?: number
    carbs_g?: number
    fat_g?: number
    fiber_g?: number
    sugar_g?: number
    sodium_mg?: number
  }
  image_url?: string
  // ... other fields
}
```

### OnboardingProfile Type
```typescript
{
  goal: string | null  // e.g., "Clear skin", "More energy", "Better digestion", "Reduce bloating"
  trigger: string | null  // User's trigger foods
  // ... other fields
}
```

## Styling Guidelines

### Spacing
- **Section titles**: `marginTop: Spacing.xl` (20px), `marginBottom: Spacing.md` (12px)
- **Major sections**: `marginBottom: Spacing.xxxl` (32px) for cards/blocks
- **Impact rows**: `marginBottom: Spacing.lg` (16px)
- **Cards**: Padding `Spacing.xxl` (24px) or `Spacing.lg` (16px) depending on size

### Colors
- **Primary**: `#325C3A` (green)
- **Text**: `#2E2E2E` (dark gray)
- **Text Secondary**: `#6B7280` (medium gray)
- **Text Muted**: `#9CA3AF` (light gray)
- **Background**: `#F8F9F6` (light green-tinted)
- **Surface**: `#FFFFFF` (white)
- **Border**: `#E5E7EB` (light gray)

### Typography
- **Section titles**: Inter 600 SemiBold, 18px
- **Card titles**: Inter 600 SemiBold, 15-16px
- **Body text**: Inter 400 Regular, 14-15px
- **Scores**: Inter 600 SemiBold, 13-14px, primary color
- **Small text**: Inter 400 Regular, 12-13px

### Visual Design
- **Cards**: White background, 1px border, subtle shadow, rounded corners (12-16px)
- **Icons**: 18-24px, primary color
- **Badges**: Circular, colored background, white text
- **Buttons**: Rounded (12px), appropriate padding, shadows for primary actions

## User Interactions

1. **Sheet Gesture**: Pan down to dismiss, snaps to peek position or fully dismisses
2. **Nutrition Expand**: Tap card to toggle nutrition grid visibility
3. **Save**: Tap "Log as Eaten" to save scan to database
4. **Scan Again**: Dismisses sheet and resets scan state
5. **All CTAs**: Navigate to respective screens (not fully implemented yet)

## Conditional Rendering Logic

- **Manufacturer**: Only shown for barcode scans (`scan_type === "barcode"`)
- **Product Image**: Only shown if `image_url` exists
- **Skin Row**: Only shown if `analysis.skin` exists
- **Energy & Mood Row**: Only shown if `analysis.mood` exists
- **Goal Section**: Only shown if `profile?.goal` exists
- **Trigger Alert**: Only shown if trigger detected in food name/identified foods
- **Timing Section**: Only shown if current hour >= 20 OR < 6
- **Nutrition Grid**: Only shown when `nutritionExpanded` state is true

## Score Calculations

- **Gut Score**: `result.gut_score` OR calculated: `100 - (bloat_score * 0.4) + (skin_score / 10 * 20) + (energy_score / 10 * 20) + (digestion_score / 10 * 20)`, clamped 0-100
- **Bloat Score Display**: Converted from 0-100 to 0-10 scale: `Math.round(bloat_score / 10)`
- **Other Scores**: Used directly (already 0-10 scale)
