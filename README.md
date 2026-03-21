Product Name: Gutsy
Tagline: Your Personalized Gut Health Companion
Version: 1.1
Last Updated: February 9, 2026

1. EXECUTIVE SUMMARY
   One-Line Pitch
   Gutsy is a mobile app that uses AI-powered food scanning to predict how meals affect your gut health, skin, and energy — personalized to each user’s body.
   Core Value Proposition
   Unlike generic nutrition apps, Gutsy learns each user’s personal triggers, habits, and responses to food to provide ultra-personalized insights.
   Users scan meals and instantly see:
   Bloating prediction

Skin impact

Energy forecast

Better alternatives

Primary Differentiation
AI photo scanning (not only barcodes)

Hyper-personalized models

Predictive insights

Gut-skin-energy integration

Long-term pattern learning

Target Audience
Primary: Women aged 25–40 with gut, skin, and energy issues.
Business Model
Freemium Subscription
Tier
Price
Features
Free
$0
3 scans/day, basic insights
Premium
$12.99/mo
Unlimited, advanced analytics

Revenue Target
$20k MRR within 12–18 months
≈ 1,500 paying users

2. PRODUCT VISION & STRATEGY
   Vision
   Help people understand their unique relationship with food through science-backed personalization.
   Mission
   Make gut health tracking as easy as taking a photo.
   Strategic Pillars
1. Personalization First
   No generic advice

Adaptive insights

User-specific scoring

2. Instant Value
   <90 sec to first scan

Immediate results

No friction

3. Science & Trust
   Evidence-based

Transparent reasoning

Educational insights

4. Habit Formation
   Streaks

Challenges

Rewards

Progress visuals

5. Community
   Shared results

Similar-user comparisons

Social challenges

3. TARGET MARKET & USER PERSONAS
   Market Overview
   Metric
   Size
   TAM
   200M
   SAM
   50M
   SOM (Year 1)
   100K

Demographics:
Age: 25–40

Gender: 75% female

Income: $40k–$100k+

Location: US/EU

Lifestyle: Wellness-focused

Primary Persona: “Bloated Sarah”
Age: 32
Job: Marketing Manager
Goals:
Reduce bloating

Clear acne

Stable energy

Pain Points:
No clear triggers

Failed diets

Conflicting advice

Quote:
“I’m tired of guessing what hurts me.”

Secondary Persona: “Fitness Emily”
Age: 27
Job: Content Creator
Goals:
Performance

Skin clarity

Visual debloating

Quote:
“I need data, not vibes.”

4. CORE FEATURES
1. AI Photo Scanning
   Identify foods

Estimate portions

Analyze nutrition

Predict effects

Tech:
GPT-4 Vision + USDA DB

2. Barcode Scanning
   Open Food Facts

Packaged food lookup

3. Bloat Score (0–100)
   Factors:
   Sodium

FODMAPs

Triggers

Hydration

Timing

Display:
Green / Yellow / Red

4. Skin Impact
   Personalized by:
   Skin type

Concerns

History

Output:
Warnings, positives, tips

5. Energy Prediction
   Analyzes:
   Glycemic load

Protein/fat

User patterns

Predicts crashes

6. Better Alternatives
   Examples:
   Portion changes

Ingredient swaps

Timing shifts

7. Food Diary & Pattern AI
   Auto logging

Correlation detection

Safe foods

Trigger foods

8. Progress Tracking
   Metrics:
   Avg bloat score

Streaks

Skin improvement

Energy stability

5. COMPLETE ONBOARDING FLOW (UPDATED – 15 SCREENS)
   Goal:
   Build trust → Collect data → Motivate → Activate
   Target Time: < 2 minutes
   Completion Goal: 75%

Screen 1 — Welcome
"Discover what’s affecting your gut, skin, and energy"
[ Get Started ]

Screen 2 — Main Goal
Options:
Debloat

Clear skin

Energy

Digestion

Screen 3 — Current Issues
Checkboxes:
Bloating

Crashes

Breakouts

Discomfort

Brain fog

Sleep issues

Screen 4 — Trigger Foods
Select:
Dairy

Gluten

Beans

Spicy

Soda

Not sure

Screen 5 — Skin Concerns
Select:
Acne

Redness

Dryness

Dullness

Puffiness

None

Screen 6 — Water Intake
Options:
💧 <4
💧💧 4–6
💧💧💧 6–8
💧💧💧💧 8+

Screen 7 — Success Rate (Motivation Screen)
Visual Comparison:
Without Gutsy:
❌ 20% success
With Gutsy:
✅ 80% success
Text:
"Users who track meals consistently see real results."
Purpose: Confidence + belief

Screen 8 — Gender
Options:
Male

Female

Other

Prefer not to say

Screen 9 — Age
Ranges:
18–24

25–34

35–44

45+

Screen 10 — Activity Level
Options:
Low

Moderate

High

Screen 11 — Skin Type
Options:
Oily

Dry

Combination

Sensitive

Normal

Screen 12 — Profile Creation (Loading)
Animated loader
Text:
"Creating your personalized profile…"
Affirmations:
10,000+ users improved

87% see results

Science-backed system

Screen 13 — You’re All Set
Summary Card:
Goal
Skin type
Water
Triggers
Activity
[ Continue ]

Screen 14 — First Scan
Camera View
"Scan your first meal"
Buttons:
📷 Camera
🔍 Barcode
📁 Gallery

Screen 15 — Scan Results + Signup
Shows:
Bloat Score

Skin Score

Energy

Tips

CTA:
Sign up to save progress

6. DESIGN SYSTEM
   Colors
   Primary: #325C3A
   Accent: #8EB66D
   Text: #2E2E2E
   Background: #F8F9F6
   Typography
   Font: Inter / SF Pro
   Level
   Size
   H1
   24–28
   Body
   15–16
   Buttons
   16–18
   Score
   48

Components
Buttons:
56px height

12px radius

Cards:
16px radius

Soft shadows

Accessibility:
WCAG AA

44px min targets

7. TECHNICAL ARCHITECTURE
   Stack
   Frontend:
   React Native (Expo)

TypeScript

expo-router

Backend:
Supabase (PostgreSQL, Auth, Storage, Realtime)

Storage:
Supabase Storage (meal-images bucket)

AI (planned):
GPT-4 Vision

Nutrition lookup (USDA / Open Food Facts)

Integrations:
Stripe (subscription_tier, stripe_customer_id in users_profile)

Open Food Facts (barcode)

Security:
Row Level Security (RLS) on all user tables

Auth via Supabase Auth (auth.users)

Private storage paths per user: meal-images/{user_id}/...

8. MONETIZATION
   Free Tier
   3 scans/day

7-day history

Basic insights

Premium
Monthly: $12.99
Annual: $99
Lifetime: $199
Features:
Unlimited scans

Analytics

Meal plans

Export

Priority support

Additional Revenue
Affiliates

B2B licenses

API access

9. GROWTH & MARKETING
   Pre-Launch
   Waitlist

TikTok

Influencers

Beta

Launch
Product Hunt

Email rollout

Social blitz

Post-Launch
SEO

Referrals

UGC

Viral Features
Shareable meal cards

Challenge badges

Milestones

10. SUCCESS METRICS
    North Star
    Weekly Active Scanners (3+ meals)

KPIs
Acquisition
CPI < $3

Downloads 500+/week

Activation
Onboarding 75%

First scan 60%

Engagement
Day 7: 40%

Day 30: 25%

Monetization
Conversion: 8%

Churn: <15%

Product
Accuracy: 80%

Crash rate: <0.5%

11. PRODUCT ROADMAP
    Phase 1 — MVP (0–3 months)
    ✓ Core scanning
    ✓ Onboarding
    ✓ Subscriptions
    Phase 2 — Intelligence (4–6)
    Pattern AI

Trigger scoring

Weekly reports

Phase 3 — Community (7–9)
Food twins

Feed

Chat

Phase 4 — Expansion (10–12)
Wearables

AR menus

Reports

Year 2+
Microbiome

AI coach

B2B

Global

12. SUPABASE BACKEND
   Overview
   The app uses Supabase for database (PostgreSQL), authentication (auth.users), and file storage. All user-scoped tables have Row Level Security (RLS) so users can only access their own data. See Supabase Dashboard → SQL Editor and Storage for the live schema.

   Database Tables

   users_profile
   Extended profile per auth.users row. One row per user (id = auth.users.id).
   Key columns: primary_goal, current_issues (TEXT[]), age_range, gender, activity_level, skin_concerns (TEXT[]), trigger_foods (TEXT[]), water_intake; subscription_tier, subscription_status, stripe_customer_id, stripe_subscription_id; total_scans, last_scan_at, current_streak, longest_streak, last_streak_date; notifications_enabled, email_notifications.
   CHECK enums: primary_goal IN ('debloat','skin','energy','digestion'), age_range IN ('18-24','25-34','35-44','45+'), gender IN ('male','female','other'), activity_level IN ('low','moderate','high'), water_intake IN ('<4','4-6','6-8','8+'), subscription_tier IN ('free','premium').

   meal_scans
   One row per scan. user_id → auth.users(id).
   Key columns: image_url, image_storage_path, scan_type ('photo'|'barcode'|'manual'); food_name, identified_foods (TEXT[]), ai_confidence, barcode; bloat_score (0–100), skin_score, energy_score, digestion_score (0–10); analysis (JSONB), nutrition (JSONB); user_rating, actual_bloating, actual_energy_crash, actual_skin_reaction, user_notes; meal_time ('breakfast'|'lunch'|'dinner'|'snack'), is_favorite, tags (TEXT[]).

   trigger_foods_tracking
   Per-user food–symptom correlations. UNIQUE(user_id, food_name).
   Key columns: food_name, times_eaten, times_bloated, times_skin_reaction, times_energy_crash; bloat_correlation, skin_correlation, energy_correlation (0.00–1.00); last_eaten_at.

   challenges
   Predefined challenges (read-only for app). id, title, description, challenge_type ('debloat'|'energy'|'skin'|'general'), duration_days, scans_per_day_required, badge_name, badge_icon_url, is_active. Seeded with e.g. 7-Day Debloat, 3-Day Energy Boost, 14-Day Skin Glow, First 5 Scans.

   user_challenges
   User progress in challenges. user_id, challenge_id, started_at, completed_at, current_day, scans_today, total_scans, status ('active'|'completed'|'abandoned'). UNIQUE(user_id, challenge_id, started_at).

   daily_stats
   One row per user per day. user_id, date (UNIQUE); scans_count, avg_bloat_score, avg_skin_score, avg_energy_score; bloated_today, energy_crash_today, skin_reaction_today.

   food_alternatives
   Suggested alternatives (read-only for app). original_food, alternative_food, improvement_type ('debloat'|'skin'|'energy'|'general'), score_improvement, description, times_suggested, times_accepted. UNIQUE(original_food, alternative_food).

   Row Level Security (RLS)
   Enabled on: users_profile, meal_scans, trigger_foods_tracking, user_challenges, daily_stats.
   Policies: users can SELECT/INSERT/UPDATE (and DELETE for meal_scans) only where auth.uid() = id or auth.uid() = user_id. challenges and food_alternatives: SELECT for authenticated users only.

   Storage
   Bucket: meal-images (private).
   Limits: 5 MB per file; MIME types image/jpeg, image/png, image/webp.
   Path layout: meal-images/{user_id}/scan_YYYY-MM-DD_HHMMSS.jpg (and similar).
   Policies: INSERT/SELECT/DELETE only when (storage.foldername(name))[1] = auth.uid()::text and bucket_id = 'meal-images'.

   App wiring
   Env: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY (see .env.example).
   Client: lib/supabase.ts creates the Supabase client with AsyncStorage for auth persistence (persistSession, autoRefreshToken, detectSessionInUrl: false).

APPENDIX
Key Numbers
Target MRR: $20k

Price: $12.99

Conversion: 8%

Onboarding: 90s

Core Colors
#325C3A

#8EB66D

#2E2E2E
