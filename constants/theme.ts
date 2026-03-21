/**
 * Gutsy Design System
 * Based on the product spec: clean, wellness-focused, accessible
 */

export const Colors = {
  primary: "#325C3A",
  primaryLight: "#3D6E46",
  primaryDark: "#274A2E",
  accent: "#8EB66D",
  accentLight: "#A5C98A",
  text: "#2E2E2E",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  background: "#F8F9F6",
  backgroundWhite: "#FFFFFF",
  surface: "#FFFFFF",
  border: "#E5E7EB",
  borderLight: "#F0F1ED",
  success: "#34D399",
  warning: "#FBBF24",
  error: "#EF4444",
  scoreGreen: "#34D399",
  scoreYellow: "#FBBF24",
  scoreRed: "#EF4444",
};

/** Accent color per bucket for Gut Health Score screen */
export const ScoreBucketColors = {
  needs_attention: "#EF4444",
  imbalanced: "#F59E0B",
  good_foundation: Colors.primary,
  thriving: Colors.primaryLight,
} as const;

export type ScoreBucketId = keyof typeof ScoreBucketColors;

/**
 * Font weights by element type (Manrope).
 * 800 = Extra Bold, 700 = Bold, 600 = Semi Bold, 500 = Medium.
 */
export const Fonts = {
  /** Page Titles (e.g. "Dashboard", "History") — 800 */
  pageTitle: "Manrope_800ExtraBold",
  /** Section Headers (e.g. "HEALTH METRICS") — 700 */
  sectionHeader: "Manrope_700Bold",
  /** Card Titles (e.g. "Gut Health Score", "This Week") — 700 */
  cardTitle: "Manrope_700Bold",
  /** Score Numbers (all numerical scores) — 800 */
  scoreNumber: "Manrope_800ExtraBold",
  /** Product/Item Names — 600 */
  productName: "Manrope_600SemiBold",
  /** Button Text — 700 */
  button: "Manrope_700Bold",
  /** Body Text / Descriptions — 500 */
  body: "Manrope_500Medium",
  /** Tab Bar Labels — 600 */
  tabBarLabel: "Manrope_600SemiBold",
  /** Timestamps / Metadata — 500 */
  timestamp: "Manrope_500Medium",
  /** Small Labels (e.g. "/100", "day streak", day letters) — 600 */
  smallLabel: "Manrope_600SemiBold",
  /** Status Bar — 600 */
  statusBar: "Manrope_600SemiBold",
  /** User Name (Profile) — 800 */
  userName: "Manrope_800ExtraBold",
  /** Subtitles (e.g. "5 of 7 days tracked") — 500 */
  subtitle: "Manrope_500Medium",
  /** Badge Text (e.g. "Pro", "On") — 700 */
  badge: "Manrope_700Bold",
  /** Goal Labels — 600 */
  goalLabel: "Manrope_600SemiBold",
  /** Stats Grid Values — 800 */
  statsGridValue: "Manrope_800ExtraBold",
  /** Stats Grid Labels — 600 */
  statsGridLabel: "Manrope_600SemiBold",
  /** Legacy aliases */
  headingBold: "Manrope_700Bold",
  headingBlack: "Manrope_800ExtraBold",
  bodyMedium: "Manrope_500Medium",
} as const;

export const Typography = {
  h1: { fontFamily: Fonts.pageTitle, fontSize: 28, lineHeight: 36, letterSpacing: -0.5 },
  h2: { fontFamily: Fonts.sectionHeader, fontSize: 24, lineHeight: 32, letterSpacing: -0.3 },
  h3: { fontFamily: Fonts.cardTitle, fontSize: 20, lineHeight: 28 },
  body: { fontFamily: Fonts.body, fontSize: 16, lineHeight: 24 },
  bodySmall: { fontFamily: Fonts.body, fontSize: 14, lineHeight: 20 },
  button: { fontFamily: Fonts.button, fontSize: 17, lineHeight: 22 },
  caption: { fontFamily: Fonts.subtitle, fontSize: 12, lineHeight: 16 },
  score: { fontFamily: Fonts.scoreNumber, fontSize: 48, lineHeight: 56 },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  massive: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
};

export const HitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

/** Total steps in the full onboarding flow (welcome → … → improve-gut → goal → … → all-set) */
export const ONBOARDING_TOTAL_STEPS = 20;

/** Fixed position for primary CTA across onboarding (Get Started / Continue) */
export const OnboardingButtonBar = {
  paddingTop: Spacing.lg,
  paddingBottom: Spacing.xxl,
  paddingHorizontal: Spacing.xxl,
};
