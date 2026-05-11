import { Colors, Fonts } from "@/constants/theme";
import { rf, rs } from "@/lib/hooks/use-responsive";
import type { AnalyzedIngredient } from "@/lib/ingredient-analysis";
import { ruleBasedAnalyzeIngredients } from "@/lib/ingredient-analysis";
import type { OnboardingProfile } from "@/lib/onboarding-storage";
import type { AlternativeProduct } from "@/lib/product-alternatives";
import type { ScanResult } from "@/types/scan";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated as AnimatedRN,
    Dimensions,
    Image,
    PanResponder,
    Pressable,
    Easing as RNEasing,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import {
    Easing as ReanimatedEasing,
    createAnimatedComponent,
    useAnimatedProps,
    useSharedValue,
    withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

interface ScanResultSheetProps {
  variant: "page" | "sheet";
  result: ScanResult;
  profile: OnboardingProfile | null;
  onDismiss: () => void;
  onContinue: () => void;
  saved: boolean;
  saving: boolean;
  savedScanId: string | null;
  loggedAsEaten: boolean;
  onLogAsEaten: () => void;
  onScanAgain: () => void;
  fromOnboarding: boolean;
  savedAlternatives: AlternativeProduct[] | null;
  alternativesLoading?: boolean;
  // Sheet-specific props
  sheetHeightAnim?: AnimatedRN.Value;
  onSheetStateChange?: (fullScreen: boolean) => void;
}

type TabId = "overview" | "ingredients" | "nutrition";
type IngredientImpact = "bad" | "warning" | "neutral";
type HealthAreaId = "skin" | "bloat" | "dig" | "energy";
type ImpactAreaId = "skin" | "bloating" | "digestion" | "energy";

interface IngredientItem {
  name: string;
  status: IngredientImpact;
  concern: string | null;
  tier?: "main" | "supporting" | "micro";
  estimatedGrams?: number;
}

interface GutHealthFlag {
  severity: "critical" | "warning" | "benefit";
  label: string;
  description: string;
}

const AnimatedCircle = createAnimatedComponent(Circle);

const HEADER_BODY_HEIGHT = rs(64);
const H_PADDING = rs(20);
const RING_SIZE = rs(78);
const RING_STROKE = rs(6);
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const DARK_BG = Colors.background;
const DARK_SURFACE = Colors.surface;
const DARK_SURFACE_ALT = Colors.surface;
const DARK_BORDER = Colors.border;
const DARK_TEXT = Colors.text;
const DARK_MUTED = Colors.textSecondary;
const DARK_SOFT = Colors.textMuted;

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const normalized = value.length === 3 ? value.split("").map((v) => v + v).join("") : value;
  const int = Number.parseInt(normalized, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function toTitleCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\s+/g, " ");
}

function formatProductName(name: string): string {
  if (!name) return name;
  return toTitleCase(name);
}

function formatIngredientName(name: string): string {
  if (!name) return name;
  return toTitleCase(name);
}

function getScoreColor(score: number): { main: string; glow: string } {
  if (score >= 70) return { main: Colors.success, glow: hexToRgba(Colors.success, 0.3) };
  if (score >= 40) return { main: Colors.warning, glow: hexToRgba(Colors.warning, 0.3) };
  return { main: Colors.error, glow: hexToRgba(Colors.error, 0.3) };
}

function getScoreLabel(score: number): string {
  if (score <= 45) return "Poor for Gut";
  if (score <= 65) return "Moderate Risk";
  if (score <= 80) return "Gut-Friendly";
  return "Excellent Choice";
}

function getIngredientStatusColor(status: IngredientImpact): { bg: string; border: string; text: string } {
  if (status === "bad") {
    return {
      bg: hexToRgba(Colors.error, 0.12),
      border: hexToRgba(Colors.error, 0.35),
      text: Colors.error,
    };
  }
  if (status === "warning") {
    return {
      bg: hexToRgba(Colors.warning, 0.12),
      border: hexToRgba(Colors.warning, 0.35),
      text: Colors.warning,
    };
  }
  return {
    bg: hexToRgba(Colors.success, 0.12),
    border: hexToRgba(Colors.success, 0.35),
    text: Colors.success,
  };
}

function formatNutritionLabel(key: string): string {
  return key
    .replace(/_g$/i, "")
    .replace(/_mg$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatNutritionValue(key: string, value: number): string {
  if (key === "calories") return `${Math.round(value)}`;
  if (key.endsWith("_mg")) {
    const mg = Math.round(value);
    const grams = (value / 1000).toFixed(1);
    return `${mg}mg (${grams}g)`;
  }
  if (key.endsWith("_g")) return `${Math.round(value * 10) / 10}g`;
  return `${Math.round(value * 10) / 10}`;
}

function mapIngredients(result: ScanResult): IngredientItem[] {
  const ai = result.analysis.ingredientAnalysis;
  if (ai?.items?.length) {
    const tierOrder: Record<"main" | "supporting" | "micro", number> = {
      main: 0,
      supporting: 1,
      micro: 2,
    };

    return [...ai.items]
      .sort((a, b) => {
        const aTier = a.tier ?? "supporting";
        const bTier = b.tier ?? "supporting";
        if (tierOrder[aTier] !== tierOrder[bTier]) return tierOrder[aTier] - tierOrder[bTier];
        return (b.estimatedGrams ?? 0) - (a.estimatedGrams ?? 0);
      })
      .map((item) => ({
      name: formatIngredientName(item.displayName),
      status: item.impact === "negative" ? "bad" : item.impact === "moderate" ? "warning" : "neutral",
      concern:
        item.whyMatters ||
        (item.impact === "positive" ? "Generally considered gut-friendly for most people." : null),
      tier: item.tier,
      estimatedGrams: item.estimatedGrams,
    }));
  }

  const fallbackIngredients =
    result.ingredients?.filter((name) => typeof name === "string" && name.trim().length > 0) ??
    result.identified_foods?.filter((name) => typeof name === "string" && name.trim().length > 0) ??
    [];

  if (fallbackIngredients.length) {
    // Run the deterministic rule-based classifier so we show real impact
    // levels and why-matters text instead of a flat "all safe" list when the
    // stored scan is missing `ingredientAnalysis` (older scans, AI failures).
    const ruleResult = ruleBasedAnalyzeIngredients(fallbackIngredients);
    if (ruleResult.items.length > 0) {
      const tierOrder: Record<"main" | "supporting" | "micro", number> = {
        main: 0,
        supporting: 1,
        micro: 2,
      };
      const impactOrder: Record<"negative" | "moderate" | "positive", number> = {
        negative: 0,
        moderate: 1,
        positive: 2,
      };
      return [...ruleResult.items]
        .sort((a: AnalyzedIngredient, b: AnalyzedIngredient) => {
          const aTier = a.tier ?? "supporting";
          const bTier = b.tier ?? "supporting";
          if (tierOrder[aTier] !== tierOrder[bTier]) return tierOrder[aTier] - tierOrder[bTier];
          return impactOrder[a.impact] - impactOrder[b.impact];
        })
        .map((item) => ({
          name: formatIngredientName(item.displayName),
          status: item.impact === "negative" ? "bad" : item.impact === "moderate" ? "warning" : "neutral",
          concern:
            item.whyMatters ||
            (item.impact === "positive" ? "Generally considered gut-friendly for most people." : null),
          tier: item.tier,
          estimatedGrams: item.estimatedGrams,
        }));
    }
  }

  return [];
}

const AREA_FALLBACK_DESCRIPTION: Record<HealthAreaId, string> = {
  skin: "Several ingredients in this product can drive inflammation, oil production, or blood-sugar spikes — all triggers for reactive skin. Review the ingredients of concern below to see which may affect your complexion most.",
  bloat: "This product contains ingredients that commonly ferment in the gut, pull in water, or disrupt the mucus layer — a common recipe for gas and bloating in sensitive digestion. The ingredients of concern below are the likely culprits.",
  dig: "Some ingredients in this product can disrupt microbiome balance, irritate the gut lining, or slow digestion. The ingredients of concern below are the ones most likely to impact how your gut feels after eating this.",
  energy: "This product contains ingredients that can spike blood sugar, promote post-meal crashes, or disrupt steady energy and focus. Check the ingredients of concern below for the biggest drivers.",
};

const HEALTH_AREA_KEYWORDS: Record<HealthAreaId, string[]> = {
  skin: [
    "skin",
    "acne",
    "breakout",
    "inflammation",
    "inflammatory",
    "irritation",
    "sebum",
    "complexion",
    "dermatitis",
    "flare-up",
    "flare up",
  ],
  bloat: [
    "bloat",
    "bloating",
    "gas",
    "distension",
    "fodmap",
    "water retention",
    "puffiness",
    "cramping",
    "ferment",
  ],
  dig: [
    "digestion",
    "digestive",
    "digest",
    "gut",
    "stomach",
    "bowel",
    "intestinal",
    "intestine",
    "microbiome",
    "microbiota",
    "microbial",
    "dysbiosis",
    "motility",
    "constipation",
    "diarrhea",
    "loose stool",
    "reflux",
    "colon",
    "mucus layer",
    "gut lining",
    "gut barrier",
    "permeability",
  ],
  energy: [
    "energy",
    "fatigue",
    "crash",
    "crashes",
    "glucose",
    "blood sugar",
    "blood-sugar",
    "sugar spike",
    "spike",
    "alert",
    "alertness",
    "mood",
    "focus",
    "tired",
    "sleep",
    "insulin",
    "metabolic",
  ],
};

function extractMeaningfulKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 5);

  const stop = new Set([
    "which",
    "their",
    "there",
    "about",
    "would",
    "could",
    "should",
    "because",
    "these",
    "those",
    "product",
    "health",
    "impact",
    "ingredients",
    "concern",
  ]);

  return Array.from(new Set(words.filter((w) => !stop.has(w)))).slice(0, 14);
}

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

function deriveGutHealthFlags(result: ScanResult): GutHealthFlag[] {
  const flags: GutHealthFlag[] = [];

  const addFlag = (flag: GutHealthFlag, condition: boolean) => {
    if (!condition || flags.some((f) => f.label === flag.label)) return;
    flags.push(flag);
  };

  const ingredientItems = result.analysis.ingredientAnalysis?.items ?? [];
  const ingredientNames = ingredientItems.map((item) => item.displayName.toLowerCase());
  const carbs = result.nutrition?.carbs_g ?? 0;
  const sugar = result.nutrition?.sugar_g ?? 0;
  const sodium = result.nutrition?.sodium_mg ?? 0;
  const fiber = result.nutrition?.fiber_g ?? 0;
  const calories = result.nutrition?.calories ?? 0;
  const redCount = result.analysis.ingredientAnalysis?.redCount ?? 0;
  const warningCount = result.analysis.ingredientAnalysis?.yellowCount ?? 0;
  const gutScore = typeof result.gut_score === "number" ? result.gut_score : 50;

  const combinedText = [
    result.analysis.summary,
    ...ingredientItems.map((item) => `${item.displayName} ${item.whyMatters}`),
    ...(result.ingredients ?? []),
    ...(result.analysis.tips ?? []),
    result.analysis.impactDetails?.bloating?.description,
    result.analysis.impactDetails?.digestion?.description,
    ...(Array.isArray(result.analysis.personalizedInsights)
      ? result.analysis.personalizedInsights
          .filter((item) => {
            const type = String((item as { type?: unknown }).type ?? "");
            return type === "trigger" || type === "warning";
          })
          .map((item) => `${item.title} ${item.detail}`)
      : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const hasCue = (phrases: string[]) => includesAny(combinedText, phrases);
  const hasIngredient = (phrases: string[]) => ingredientNames.some((name) => phrases.some((phrase) => name.includes(phrase)));

  const criticalCandidates: GutHealthFlag[] = [];
  const warningCandidates: GutHealthFlag[] = [];
  const benefitCandidates: GutHealthFlag[] = [];

  const addCandidate = (list: GutHealthFlag[], flag: GutHealthFlag, condition: boolean) => {
    if (!condition || list.some((f) => f.label === flag.label)) return;
    list.push(flag);
  };

  addCandidate(
    criticalCandidates,
    {
      severity: "critical",
      label: "Ultra-Processed",
      description:
        "Heavy processing and multiple risk additives can reduce microbiome diversity and increase gut inflammation burden.",
    },
    redCount >= 2 || (redCount + warningCount >= 4 && ingredientItems.length >= 4) || hasCue(["ultra-processed", "highly processed"])
  );

  addCandidate(
    criticalCandidates,
    {
      severity: "critical",
      label: "Inflammatory Seed Oils",
      description:
        "Refined omega-6 dominant oils may amplify inflammatory signaling and worsen gut sensitivity in frequent intake.",
    },
    hasCue(["sunflower oil", "corn oil", "soybean oil", "canola oil", "seed oil", "omega-6", "vegetable oil"]) ||
      hasIngredient(["sunflower oil", "corn oil", "soybean oil", "canola oil", "vegetable oil"])
  );

  addCandidate(
    criticalCandidates,
    {
      severity: "critical",
      label: "Blood Sugar Spike",
      description:
        "Higher sugar/refined-carb exposure can cause rapid glucose swings, which may aggravate cravings, fatigue, and gut discomfort.",
    },
    sugar >= 12 || (carbs >= 35 && fiber <= 3) || hasCue(["refined carb", "glucose spike", "energy crash", "added sugar"])
  );

  addCandidate(
    criticalCandidates,
    {
      severity: "critical",
      label: "Gut Barrier Concern",
      description:
        "Some additives and emulsifying agents are linked to increased intestinal permeability and digestive irritation in sensitive users.",
    },
    hasCue(["emulsifier", "carrageenan", "polysorbate", "carboxymethylcellulose", "intestinal permeability", "gut barrier"]) ||
      hasIngredient(["carrageenan", "polysorbate", "carboxymethylcellulose"])
  );

  addCandidate(
    criticalCandidates,
    {
      severity: "critical",
      label: "Artificial Sweeteners",
      description:
        "Some non-nutritive sweeteners are associated with microbiome disruption and may increase bloating in sensitive users.",
    },
    hasCue(["sucralose", "aspartame", "acesulfame", "saccharin", "artificial sweetener"]) ||
      hasIngredient(["sucralose", "aspartame", "acesulfame", "saccharin"])
  );

  addCandidate(
    warningCandidates,
    {
      severity: "warning",
      label: "High Sodium",
      description:
        "Elevated sodium load can promote temporary water retention and bloating, especially when hydration and potassium are low.",
    },
    sodium >= 350 || hasCue(["high sodium", "salt", "water retention"])
  );

  addCandidate(
    warningCandidates,
    {
      severity: "warning",
      label: "Moderate Sodium",
      description:
        "Sodium level is moderate but may still contribute to minor water retention in sensitive individuals.",
    },
    sodium >= 120 && sodium < 350
  );

  addCandidate(
    warningCandidates,
    {
      severity: "warning",
      label: "Preservatives",
      description:
        "Frequent preservative exposure may contribute to gut irritation and reduced tolerance to processed foods over time.",
    },
    hasCue(["preservative", "sodium benzoate", "potassium sorbate", "nitrite", "nitrate", "bht", "bha"]) ||
      hasIngredient(["sodium benzoate", "potassium sorbate", "nitrite", "nitrate", "bht", "bha"])
  );

  addCandidate(
    warningCandidates,
    {
      severity: "warning",
      label: "Added Sugars",
      description:
        "Higher added sugar intake can feed less favorable gut bacteria and increase post-meal inflammation risk.",
    },
    sugar >= 8 || hasCue(["added sugar", "corn syrup", "glucose syrup", "dextrose", "fructose"])
  );

  addCandidate(
    warningCandidates,
    {
      severity: "warning",
      label: "Low Fiber",
      description:
        "Lower fiber content provides limited prebiotic support for beneficial gut bacteria and stool regularity.",
    },
    fiber > 0 && fiber < 2
  );

  addCandidate(
    warningCandidates,
    {
      severity: "warning",
      label: "Refined Grains",
      description:
        "Refined grain profile provides less fiber and micronutrient support than whole-food carbohydrate sources.",
    },
    hasCue(["refined", "enriched flour", "white flour", "maida"])
  );

  addCandidate(
    warningCandidates,
    {
      severity: "warning",
      label: "Natural Flavors",
      description:
        "Natural flavor blends are not fully disclosed and may include compounds that trigger symptoms in sensitive users.",
    },
    hasCue(["natural flavor", "natural flavours", "flavoring"])
  );

  addCandidate(
    warningCandidates,
    {
      severity: "warning",
      label: "Modified Starches",
      description:
        "Modified starches can be harder to digest for some users and may contribute to gas or post-meal bloating.",
    },
    hasCue(["modified starch", "modified food starch", "dextrin", "maltodextrin"])
  );

  addCandidate(
    benefitCandidates,
    {
      severity: "benefit",
      label: "Probiotic-Rich",
      description:
        "Contains live beneficial bacteria that can support microbiome balance and improve digestive resilience.",
    },
    hasCue(["probiotic", "live culture", "lactobacillus", "bifidobacterium", "active cultures"])
  );

  addCandidate(
    benefitCandidates,
    {
      severity: "benefit",
      label: "High Fiber",
      description:
        "Higher fiber acts as prebiotic fuel for beneficial bacteria and supports gut motility and regularity.",
    },
    fiber >= 7
  );

  addCandidate(
    benefitCandidates,
    {
      severity: "benefit",
      label: "Good Fiber Content",
      description:
        "Fiber amount is supportive for daily microbiome nourishment and steadier digestion.",
    },
    fiber >= 3 && fiber < 7
  );

  addCandidate(
    benefitCandidates,
    {
      severity: "benefit",
      label: "Anti-Inflammatory Oils",
      description:
        "Fat source appears to favor oils associated with lower inflammatory signaling and better gut tolerance.",
    },
    hasCue(["olive oil", "avocado oil", "flax", "chia", "omega-3", "walnut oil"]) ||
      hasIngredient(["olive oil", "avocado oil", "flax", "chia", "walnut oil"])
  );

  addCandidate(
    benefitCandidates,
    {
      severity: "benefit",
      label: "Fermented",
      description:
        "Fermentation can improve digestibility and may provide beneficial metabolites for gut function.",
    },
    hasCue(["fermented", "kimchi", "kefir", "kombucha", "miso", "tempeh", "sauerkraut"])
  );

  addCandidate(
    benefitCandidates,
    {
      severity: "benefit",
      label: "Whole Food Ingredients",
      description:
        "Ingredient profile appears minimally processed and easier for the gut to handle versus heavily engineered foods.",
    },
    redCount === 0 && warningCount <= 1 && ingredientItems.length > 0 && ingredientItems.length <= 8
  );

  addCandidate(
    benefitCandidates,
    {
      severity: "benefit",
      label: "Low Glycemic",
      description:
        "Lower sugar load with supportive fiber can help maintain steadier blood glucose and gut-brain signaling.",
    },
    sugar <= 5 && fiber >= 3 && carbs <= 30
  );

  if (result.digestion_score <= 4 && !criticalCandidates.some((flag) => flag.label === "Gut Barrier Concern")) {
    addCandidate(
      criticalCandidates,
      {
        severity: "critical",
        label: "Digestive Irritation Risk",
        description:
          "Low digestion score indicates this item has properties that are more likely to trigger GI discomfort for your gut profile.",
      },
      true
    );
  }

  if (gutScore <= 40) {
    criticalCandidates.slice(0, 4).forEach((flag) => addFlag(flag, true));
    warningCandidates.slice(0, 2).forEach((flag) => addFlag(flag, true));

    if (flags.length < 4) {
      warningCandidates.slice(2, 5).forEach((flag) => addFlag(flag, true));
    }

    [
      {
        severity: "critical" as const,
        label: "Likely Gut Stressors",
        description:
          "This scan shows multiple patterns associated with lower gut tolerance, so treat this item as a higher-risk choice.",
      },
      {
        severity: "warning" as const,
        label: "Limit Frequency",
        description:
          "Frequent intake of this product profile may increase cumulative microbiome stress and digestive discomfort.",
      },
      {
        severity: "warning" as const,
        label: "Digestive Load",
        description:
          "Overall composition suggests this product may be heavier on digestion than cleaner alternatives.",
      },
    ].forEach((fallback) => addFlag(fallback, flags.length < 4));
  } else if (gutScore <= 75) {
    warningCandidates.slice(0, 3).forEach((flag) => addFlag(flag, true));
    benefitCandidates.slice(0, 1).forEach((flag) => addFlag(flag, true));

    if (flags.length < 2) {
      criticalCandidates.slice(0, 1).forEach((flag) => addFlag(flag, true));
      benefitCandidates.slice(1, 3).forEach((flag) => addFlag(flag, true));
    }

    [
      {
        severity: "warning" as const,
        label: "Moderate Processing",
        description:
          "This item appears acceptable in moderation, but improving ingredient quality would better support long-term gut health.",
      },
      {
        severity: "benefit" as const,
        label: "Some Gut-Friendly Traits",
        description:
          "The product includes a few supportive features, but still has room for cleaner, higher-fiber alternatives.",
      },
    ].forEach((fallback) => addFlag(fallback, flags.length < 2));
  } else {
    benefitCandidates.slice(0, 3).forEach((flag) => addFlag(flag, true));

    if (calories >= 500 || (carbs >= 40 && fiber < 3)) {
      addFlag(
        {
          severity: "warning",
          label: "Watch Portion Size",
          description:
            "Even gut-friendly items may still cause discomfort in very large servings, especially for sensitive digestion.",
        },
        true
      );
    }

    if (flags.length < 2) {
      warningCandidates.slice(0, 1).forEach((flag) => addFlag(flag, true));
      benefitCandidates.slice(3, 5).forEach((flag) => addFlag(flag, true));
    }

    [
      {
        severity: "benefit" as const,
        label: "Gut-Friendly Profile",
        description:
          "Overall composition appears supportive for digestion and microbiome balance compared with typical processed options.",
      },
      {
        severity: "benefit" as const,
        label: "Lower Irritant Load",
        description:
          "This scan indicates fewer common gut irritants, making it a generally better daily option.",
      },
    ].forEach((fallback) => addFlag(fallback, flags.length < 2));
  }

  flags.sort((a, b) => {
    const rankA = a.severity === "critical" ? 0 : a.severity === "warning" ? 1 : 2;
    const rankB = b.severity === "critical" ? 0 : b.severity === "warning" ? 1 : 2;
    return rankA - rankB;
  });

  const targetMax = gutScore <= 40 ? 6 : 4;
  return flags.slice(0, targetMax);
}

function HeroRing({
  score,
  color,
  scoreAnimated,
  displayScore,
}: {
  score: number;
  color: string;
  scoreAnimated: boolean;
  displayScore: number;
}) {
  const progress = useSharedValue(0);
  const trackColor = score >= 100 ? "transparent" : hexToRgba(color, 0.16);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_CIRCUMFERENCE * (1 - progress.value),
  }));

  useEffect(() => {
    progress.value = withTiming(scoreAnimated ? score / 100 : 0, {
      duration: 1200,
      easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
    });
  }, [score, scoreAnimated, progress]);

  return (
    <View style={styles.ringWrap}>
      <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={trackColor}
          strokeWidth={RING_STROKE}
        />
        <AnimatedCircle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={[styles.ringScore, { color }]}>{displayScore}</Text>
        <Text style={styles.ringOutOf}>/100</Text>
      </View>
    </View>
  );
}

export function ScanResultSheet({
  variant,
  result,
  onDismiss,
  onContinue,
  saving,
  loggedAsEaten,
  onLogAsEaten,
  onScanAgain,
  fromOnboarding,
  savedAlternatives,
  alternativesLoading = false,
  sheetHeightAnim,
  onSheetStateChange,
}: ScanResultSheetProps) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [expandedIngredient, setExpandedIngredient] = useState<number | null>(null);
  const [scoreAnimated, setScoreAnimated] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const [showHealthModal, setShowHealthModal] = useState<string | null>(null);
  const [visibleAlternativeCount, setVisibleAlternativeCount] = useState(3);
  const [selectedAlternative, setSelectedAlternative] = useState<AlternativeProduct | null>(null);

  // Drag functionality for sheet variant - workaround: open in full-screen by default
  const [sheetFullScreen, setSheetFullScreen] = useState(true);
  const sheetFullScreenRef = useRef(false);
  
  // Get dimensions first with fallbacks
  const { height: windowHeight = 800 } = Dimensions.get("window"); // Fallback height
  const safeAreaTop = insets.top || 0; // Fallback for initial render
  const collapsedSheetHeight = windowHeight * 0.84;
  const expandedSheetHeight = windowHeight - safeAreaTop;
  const fullScreenHeight = windowHeight;
  
  // Validate dimensions before creating animation
  const validCollapsedHeight = Number.isFinite(collapsedSheetHeight) && collapsedSheetHeight > 0 ? collapsedSheetHeight : 600;
  
  // Use external animation if provided, otherwise create internal one
  const internalSheetHeightAnim = useRef(new AnimatedRN.Value(validCollapsedHeight)).current;
  const currentSheetHeightAnim = sheetHeightAnim || internalSheetHeightAnim;

  const gutScore = typeof result.gut_score === "number" ? Math.round(result.gut_score) : 50;
  const scoreColor = getScoreColor(gutScore);
  const productName = formatProductName(result.product_name || result.food_name || "Scanned Product");
  const brand = formatProductName(result.manufacturer || "Unknown brand");
  const servingText = result.analysis.serving_size_display;

  const ingredientItems = useMemo(() => mapIngredients(result), [result]);
  const flags = useMemo(() => deriveGutHealthFlags(result), [result]);
  const actionTips = useMemo(() => {
    const tips: string[] = [];

    if (typeof result.analysis.bloatDetails?.tip === "string" && result.analysis.bloatDetails.tip.trim().length > 0) {
      tips.push(result.analysis.bloatDetails.tip.trim());
    }

    (result.analysis.tips || []).forEach((tip) => {
      if (typeof tip === "string" && tip.trim().length > 0) tips.push(tip.trim());
    });

    (result.analysis.personalizedInsights || []).forEach((insight) => {
      if (typeof insight.tip === "string" && insight.tip.trim().length > 0) tips.push(insight.tip.trim());
    });

    const uniqueTips = Array.from(new Set(tips.map((tip) => tip.replace(/\s+/g, " ").trim()))).slice(0, 5);

    if (uniqueTips.length > 0) return uniqueTips;

    const fallbackTips: string[] = [];
    const labels = flags.map((flag) => flag.label.toLowerCase());

    if (labels.some((label) => label.includes("sugar") || label.includes("glycemic") || label.includes("spike"))) {
      fallbackTips.push("Pair this with protein or healthy fats to blunt blood-sugar spikes.");
    }
    if (labels.some((label) => label.includes("sodium") || label.includes("retention"))) {
      fallbackTips.push("Increase water and potassium-rich foods later today to offset sodium load.");
    }
    if (labels.some((label) => label.includes("fiber") || label.includes("refined") || label.includes("processed"))) {
      fallbackTips.push("Add a fiber-rich side like vegetables, lentils, or oats to support your microbiome.");
    }
    if (labels.some((label) => label.includes("sweetener") || label.includes("additive") || label.includes("preservative"))) {
      fallbackTips.push("Choose shorter ingredient-list alternatives with fewer additives on your next purchase.");
    }

    if (fallbackTips.length === 0) {
      fallbackTips.push("Keep portions moderate and combine this meal with whole-food ingredients for better gut tolerance.");
      fallbackTips.push("Track symptoms after eating to identify your personal triggers more accurately.");
    }

    return fallbackTips.slice(0, 4);
  }, [result.analysis, flags]);
  const nutritionEntries = useMemo(
    () =>
      Object.entries(result.nutrition ?? {}).filter(([, value]) => typeof value === "number") as [
        string,
        number,
      ][],
    [result.nutrition]
  );

  const visibleAlternatives = useMemo(
    () => (savedAlternatives ?? []).slice(0, visibleAlternativeCount),
    [savedAlternatives, visibleAlternativeCount]
  );

  useEffect(() => {
    setVisibleAlternativeCount(3);
  }, [savedAlternatives]);

  useEffect(() => {
    const enterTimer = setTimeout(() => setVisible(true), 120);
    const scoreTimer = setTimeout(() => {
      setScoreAnimated(true);
      let current = 0;
      const target = gutScore;
      const increment = Math.max(1, Math.ceil(target / 30));
      const interval = setInterval(() => {
        current = Math.min(current + increment, target);
        setDisplayScore(current);
        if (current >= target) clearInterval(interval);
      }, 38);
    }, 520);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(scoreTimer);
    };
  }, [gutScore]);

  // Update refs when sheet state changes
  useEffect(() => {
    sheetFullScreenRef.current = sheetFullScreen;
  }, [sheetFullScreen]);

  // Animate sheet height based on state (only for sheet variant)
  useEffect(() => {
    if (variant !== "sheet") return;
    
    const targetHeight = sheetFullScreen ? fullScreenHeight : collapsedSheetHeight;
    
    AnimatedRN.timing(currentSheetHeightAnim, {
      toValue: targetHeight,
      duration: 220,
      easing: RNEasing.out(RNEasing.cubic),
      useNativeDriver: false,
    }).start();
  }, [sheetFullScreen, collapsedSheetHeight, fullScreenHeight, currentSheetHeightAnim, variant]);

  // Notify parent of state changes
  useEffect(() => {
    if (onSheetStateChange) {
      onSheetStateChange(sheetFullScreen);
    }
  }, [sheetFullScreen, onSheetStateChange]);

  // PanResponder for drag gestures (only for sheet variant)
  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, gestureState) =>
        variant === "sheet" && visible && Math.abs(gestureState.dy) > 1,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        variant === "sheet" &&
        visible &&
        Math.abs(gestureState.dy) > 2 &&
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 0.5,
      onMoveShouldSetPanResponderCapture: (_, gestureState) =>
        variant === "sheet" &&
        visible &&
        Math.abs(gestureState.dy) > 3 &&
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 0.5,
      onPanResponderGrant: () => {
        // User started dragging - could add visual feedback here if needed
      },
      onPanResponderRelease: (_, gestureState) => {
        if (variant !== "sheet") return;
        
        const velocity = gestureState.vy;
        const dy = gestureState.dy;
        const isFull = sheetFullScreenRef.current;
        
        // Simplified 2-state model: collapsed (75%) <-> full (100%)
        // Very responsive thresholds
        if (dy < -15 || velocity < -0.15) {
          // Swiping up: go to full screen
          if (!isFull) {
            setSheetFullScreen(true);
          }
        } else if (dy > 20 || velocity > 0.2) {
          // Swiping down: go to collapsed
          if (isFull) {
            setSheetFullScreen(false);
          }
        }
        // Small gestures don't change state
      },
    })
  ).current;

  const healthCards = [
    { key: "skin", icon: "sparkles-outline" as const, label: "Skin", score: Math.round(result.skin_score), preview: result.analysis.impactDetails?.skin?.description },
    { key: "bloat", icon: "water-outline" as const, label: "Bloating", score: Math.round(result.bloat_score), preview: result.analysis.impactDetails?.bloating?.description },
    { key: "dig", icon: "leaf-outline" as const, label: "Digestion", score: Math.round(result.digestion_score), preview: result.analysis.impactDetails?.digestion?.description },
    { key: "energy", icon: "flash-outline" as const, label: "Energy", score: Math.round(result.energy_score), preview: result.analysis.impactDetails?.energy?.description },
  ];

  const selectedHealthCard = healthCards.find((item) => item.key === showHealthModal);
  const selectedImpactKey: ImpactAreaId | undefined =
    selectedHealthCard?.key === "bloat"
      ? "bloating"
      : selectedHealthCard?.key === "dig"
        ? "digestion"
        : (selectedHealthCard?.key as ImpactAreaId | undefined);
  const selectedImpactDetails = selectedImpactKey ? result.analysis.impactDetails?.[selectedImpactKey] : undefined;
  const modalTitleText = selectedImpactDetails?.learnMore?.title || `${selectedHealthCard?.label ?? "Health"} Impact`;
  const modalBodyText =
    selectedImpactDetails?.learnMore?.content ||
    selectedImpactDetails?.description ||
    (selectedHealthCard ? AREA_FALLBACK_DESCRIPTION[selectedHealthCard.key as HealthAreaId] ?? "" : "");

  const selectedConcernIngredients = useMemo(() => {
    if (!selectedHealthCard) return [];

    const areaId = selectedHealthCard.key as HealthAreaId;
    const areaKeywords = HEALTH_AREA_KEYWORDS[areaId];
    const contextualKeywords = extractMeaningfulKeywords(
      `${selectedImpactDetails?.description ?? ""} ${selectedImpactDetails?.learnMore?.content ?? ""}`
    );

    return ingredientItems
      .filter((ing) => {
        if (ing.status === "neutral" || !ing.concern) return false;
        const concernText = ing.concern.toLowerCase();
        const hasAreaMatch = areaKeywords.some((kw) => concernText.includes(kw));
        const hasContextMatch = contextualKeywords.some((kw) => concernText.includes(kw));
        return hasAreaMatch || hasContextMatch;
      })
      .slice(0, 6);
  }, [ingredientItems, selectedHealthCard, selectedImpactDetails]);

  const tabItems: { id: TabId; label: string }[] = [
    { id: "overview", label: "OVERVIEW" },
    { id: "ingredients", label: "INGREDIENTS" },
    { id: "nutrition", label: "NUTRITION" },
  ];

  const doShare = async () => {
    try {
      await Share.share({
        message: `${productName}\nGut Score: ${gutScore}/100\n${getScoreLabel(gutScore)}`,
      });
    } catch {
      // ignore
    }
  };

  const footerBottom = insets.bottom + 12;
  const headerHeight = safeAreaTop + HEADER_BODY_HEIGHT;
  const contentTopPadding = variant === "sheet" ? headerHeight + 18 : headerHeight + 10;

  return (
    <View style={[styles.container, variant === "page" && { paddingTop: safeAreaTop }]}> 
      {/* Drag handle for sheet variant */}
      {variant === "sheet" && (
        <View style={styles.sheetDragHandleZone} {...sheetPanResponder.panHandlers}>
          <View style={styles.sheetDragHandle} />
        </View>
      )}
      
      <View style={[styles.headerShell, { paddingTop: safeAreaTop }]}>
        <View style={styles.headerRow} {...(variant === "sheet" ? sheetPanResponder.panHandlers : {})}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={onDismiss} activeOpacity={0.85}>
            <Ionicons name="arrow-back" size={18} color={DARK_TEXT} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Scan Result</Text>

          <TouchableOpacity style={styles.headerIconBtn} onPress={doShare} activeOpacity={0.85}>
            <Ionicons name="share-social-outline" size={17} color={DARK_TEXT} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerDivider} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: contentTopPadding,
          paddingBottom: (fromOnboarding ? 94 : 132) + insets.bottom + 16,
          paddingHorizontal: H_PADDING,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroCard, visible && styles.visible]}>
          <View style={styles.heroGlow} />

          <View style={styles.heroRow}>
            <View style={styles.productImageWrap}>
              {result.image_url ? (
                <Image source={{ uri: result.image_url }} style={styles.productImage} />
              ) : (
                <Text style={styles.productEmoji}>🥗</Text>
              )}
            </View>

            <View style={styles.productInfoWrap}>
              <Text style={styles.productName} numberOfLines={2}>{productName}</Text>
              <Text style={styles.productMeta} numberOfLines={1}>{brand}</Text>
              <Text style={styles.servingLabel}>Serving size</Text>
              <Text style={styles.servingSize} numberOfLines={2}>{servingText}</Text>
            </View>

            <HeroRing
              score={gutScore}
              color={scoreColor.main}
              scoreAnimated={scoreAnimated}
              displayScore={displayScore}
            />
          </View>
        </View>

        <View style={styles.tabBar}>
          {tabItems.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabBtn, active && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.85}
              >
                <Text
                  style={[styles.tabLabel, active && styles.tabLabelActive]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View>
          {activeTab === "overview" && (
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionKicker}>HEALTH IMPACT</Text>
              <View style={styles.impactGrid}>
                {healthCards.map((item) => {
                  // Normalize 0-10 score to 0-100 scale for getScoreColor function
                  const normalizedScore = item.score * 10;
                  const color = getScoreColor(normalizedScore).main;
                  return (
                    <View key={item.key} style={[styles.impactCard, { borderColor: Colors.border }]}>
                      <View style={styles.impactTopRow}>
                        <Ionicons name={item.icon} size={18} color={Colors.textSecondary} />
                        <View style={styles.impactScoreWrap}>
                          <Text style={[styles.impactScore, { color }]}>{item.score}</Text>
                          <Text style={styles.impactOutOf}>/10</Text>
                        </View>
                      </View>
                      <Text style={styles.impactLabel}>{item.label}</Text>
                      {item.preview && (
                        <Text style={styles.impactPreview} numberOfLines={2} ellipsizeMode="tail">
                          {item.preview}
                        </Text>
                      )}
                      <TouchableOpacity style={styles.impactSeeMore} onPress={() => setShowHealthModal(item.key)}>
                        <Text style={styles.impactSeeMoreText}>See more</Text>
                        <Ionicons name="chevron-forward" size={12} color={Colors.primary} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>

              <Text style={styles.sectionKicker}>GUT HEALTH FLAGS</Text>
              {flags.length > 0 ? (
                flags.map((flag, idx) => {
                  const severityLabel =
                    flag.severity === "critical" ? "CRITICAL" : flag.severity === "warning" ? "WARNING" : "BENEFIT";
                  return (
                    <View key={`${flag.label}-${idx}`} style={styles.flagCard}>
                      <View style={styles.flagSeverityRow}>
                        <View
                          style={[
                            styles.flagCircle,
                            {
                              backgroundColor:
                                flag.severity === "critical"
                                  ? Colors.error
                                  : flag.severity === "warning"
                                    ? Colors.warning
                                    : Colors.success,
                            },
                          ]}
                        />
                        <Text style={styles.flagSeverity}>{severityLabel}</Text>
                      </View>
                      <Text style={styles.flagTitle}>{flag.label}</Text>
                      <Text style={styles.flagDesc}>{flag.description}</Text>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyCard}><Text style={styles.emptyText}>No major gut-health signals flagged for this scan.</Text></View>
              )}

              <View style={styles.actionCard}>
                <View style={styles.actionHeader}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} style={styles.actionIcon} />
                  <Text style={styles.actionLabel}>WHAT YOU CAN DO NOW</Text>
                </View>
                {actionTips.map((tip, idx) => (
                  <Text key={`action-tip-${idx}`} style={styles.actionTip}>• {tip}</Text>
                ))}
              </View>

              <Text style={[styles.sectionKicker, styles.altSectionKicker]}>BETTER ALTERNATIVES</Text>
              <Text style={styles.altIntro}>Similar products that are better for your gut health</Text>

              {alternativesLoading ? (
                <View style={styles.emptyCard}>
                  <View style={styles.altLoadingRow}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.emptyText}>Finding better alternatives...</Text>
                  </View>
                </View>
              ) : savedAlternatives && savedAlternatives.length > 0 ? (
                visibleAlternatives.map((alt, idx) => {
                  const altScore = Math.round(alt.scores.gut_score ?? 0);
                  const tone = getScoreColor(altScore);
                  const delta = Math.max(0, altScore - gutScore);

                  return (
                    <View key={`${alt.product.name}-${idx}`} style={styles.altCard}> 
                      <View style={styles.altTopRow}>
                        <View style={styles.altImageWrap}>
                          {alt.product.imageUrl ? (
                            <Image source={{ uri: alt.product.imageUrl }} style={styles.altImage} />
                          ) : (
                            <Ionicons name="leaf-outline" size={24} color={Colors.textSecondary} style={styles.altFallbackIcon} />
                          )}
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.altName}>{alt.product.name}</Text>
                          <Text style={styles.altMeta}>{alt.product.brand || "Brand unavailable"}</Text>
                        </View>

                        <View style={[styles.altScoreBadge, { borderColor: hexToRgba(tone.main, 0.45), backgroundColor: hexToRgba(tone.main, 0.14) }]}> 
                          <Text style={[styles.altScoreValue, { color: tone.main }]}>{altScore}</Text>
                          <Text style={styles.altScoreLabel}>SCORE</Text>
                        </View>
                      </View>

                      <View style={styles.altBottomRow}>
                        <Text style={styles.altWhy}>{alt.whyBetter || "Cleaner ingredients and lower inflammatory load for better gut resilience."}</Text>
                        <View style={styles.altActionsRow}>
                          <View style={styles.altDeltaBadge}>
                            <Text style={styles.altDeltaText}>+{delta} pts</Text>
                          </View>
                          <TouchableOpacity
                            style={styles.altCompareBtn}
                            onPress={() => setSelectedAlternative(alt)}
                            activeOpacity={0.86}
                          >
                            <Text style={styles.altCompareText}>Compare</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyCard}><Text style={styles.emptyText}>No alternatives available for this item yet.</Text></View>
              )}

              {!alternativesLoading && savedAlternatives && savedAlternatives.length > 3 ? (
                <TouchableOpacity
                  style={styles.altToggleBtn}
                  onPress={() =>
                    setVisibleAlternativeCount((count) =>
                      count >= savedAlternatives.length ? 3 : Math.min(savedAlternatives.length, count + 3)
                    )
                  }
                  activeOpacity={0.85}
                >
                  <Text style={styles.altToggleText}>
                    {visibleAlternativeCount >= savedAlternatives.length ? "Show fewer" : "Show more alternatives"}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {activeTab === "ingredients" && (
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionKicker}>INGREDIENT ANALYSIS</Text>

              <View style={styles.ingredientsStatsRow}>
                {[
                  { label: "Red Flags", value: ingredientItems.filter((i) => i.status === "bad").length, color: Colors.error },
                  { label: "Warnings", value: ingredientItems.filter((i) => i.status === "warning").length, color: Colors.warning },
                  { label: "Safe", value: ingredientItems.filter((i) => i.status === "neutral").length, color: Colors.success },
                ].map((stat) => (
                  <View key={stat.label} style={[styles.statCard, { borderColor: Colors.border, backgroundColor: Colors.backgroundWhite }]}> 
                    <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                  </View>
                ))}
              </View>

              {ingredientItems.length > 0 ? (
                ingredientItems.map((item, idx) => {
                  const isExpanded = expandedIngredient === idx;
                  const tone = getIngredientStatusColor(item.status);
                  return (
                    <TouchableOpacity
                      key={`${item.name}-${idx}`}
                      style={[styles.ingredientCard, { backgroundColor: Colors.backgroundWhite, borderColor: Colors.border }]}
                      onPress={() => setExpandedIngredient(isExpanded ? null : idx)}
                      activeOpacity={0.82}
                    >
                      <View style={styles.ingredientHeader}>
                        <View style={[styles.ingredientDot, { backgroundColor: tone.text }]} />
                        <View style={styles.ingredientHeaderTop}>
                          <View style={styles.ingredientTitleWrap}>
                            <Text style={styles.ingredientName}>{item.name}</Text>
                            {(item.tier || typeof item.estimatedGrams === "number") && (
                              <Text style={styles.ingredientMetaText}>
                                {item.tier ? `${item.tier.toUpperCase()}${typeof item.estimatedGrams === "number" ? " · " : ""}` : ""}
                                {typeof item.estimatedGrams === "number" ? `${Math.round(item.estimatedGrams * 10) / 10}g` : ""}
                              </Text>
                            )}
                            {item.concern && !isExpanded ? <Text style={styles.ingredientSubtitle}>Tap to learn why this matters</Text> : null}
                          </View>
                        </View>
                        {item.concern ? (
                          <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color={DARK_SOFT} />
                        ) : null}
                      </View>

                      {isExpanded && item.concern ? (
                        <View style={styles.ingredientExpand}>
                          <Text style={styles.ingredientExpandTitle}>WHY THIS MATTERS</Text>
                          <Text style={styles.ingredientExpandText}>{item.concern}</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptyCard}><Text style={styles.emptyText}>No ingredients data available for this scan.</Text></View>
              )}
            </View>
          )}

          {activeTab === "nutrition" && (
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionKicker}>NUTRITION FACTS</Text>
              <View style={styles.nutritionCard}>
                <Text style={styles.nutritionHeader}>Nutrition Facts</Text>
                <Text style={styles.nutritionServing}>
                  Serving Size: {servingText && typeof servingText === "string" && servingText.trim() ? servingText : "Unknown"}
                </Text>
                {nutritionEntries.map(([key, value], idx) => {
                  const concern = key.includes("sodium") || key.includes("sugar") || key.includes("saturated");
                  return (
                    <View
                      key={key}
                      style={[
                        styles.nutritionRow,
                        concern && styles.nutritionConcernRow,
                        idx === nutritionEntries.length - 1 && styles.nutritionRowLast,
                      ]}
                    >
                      <View style={styles.nutritionLeft}>
                        {concern ? <Text style={styles.concernIcon}>⚠️</Text> : null}
                        <Text style={styles.nutritionName}>{formatNutritionLabel(key)}</Text>
                      </View>
                      <Text style={styles.nutritionEntryValue}>{formatNutritionValue(key, value)}</Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.nutritionInsightCard}>
                <Text style={styles.nutritionInsightTitle}>NUTRITIONAL CONCERN</Text>
                <Text style={styles.nutritionInsightBody}>
                  High sodium and refined carbs can cause bloating and energy crashes within 30-60 minutes of consumption.
                </Text>
              </View>
            </View>
          )}

        </View>
      </ScrollView>

      {/* Health Impact Modal */}
      {selectedAlternative && (
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedAlternative(null)} />
          <View style={styles.compareModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Alternative Comparison</Text>
              <TouchableOpacity onPress={() => setSelectedAlternative(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.compareBody}>
              <Text style={styles.compareSubtitle}>{selectedAlternative.product.name}</Text>

              <View style={styles.compareRow}>
                <Text style={styles.compareLabel}>Gut score</Text>
                <Text style={[styles.compareValue, { color: Colors.primary }]}> 
                  {gutScore} → {Math.round(selectedAlternative.scores.gut_score ?? 0)}
                </Text>
              </View>

              <View style={styles.compareRow}>
                <Text style={styles.compareLabel}>Sugar</Text>
                <Text style={styles.compareValue}>
                  {Number(result.nutrition?.sugar_g ?? 0).toFixed(1)}g → {Number(selectedAlternative.product.nutrition?.sugar_g ?? 0).toFixed(1)}g
                </Text>
              </View>

              <View style={styles.compareRow}>
                <Text style={styles.compareLabel}>Sodium</Text>
                <Text style={styles.compareValue}>
                  {Math.round(Number(result.nutrition?.sodium_mg ?? 0))}mg ({(Number(result.nutrition?.sodium_mg ?? 0) / 1000).toFixed(1)}g) → {Math.round(Number(selectedAlternative.product.nutrition?.sodium_mg ?? 0))}mg ({(Number(selectedAlternative.product.nutrition?.sodium_mg ?? 0) / 1000).toFixed(1)}g)
                </Text>
              </View>

              <View style={styles.compareRow}>
                <Text style={styles.compareLabel}>Fiber</Text>
                <Text style={styles.compareValue}>
                  {Number(result.nutrition?.fiber_g ?? 0).toFixed(1)}g → {Number(selectedAlternative.product.nutrition?.fiber_g ?? 0).toFixed(1)}g
                </Text>
              </View>

              <View style={styles.compareNoteCard}>
                <Text style={styles.compareNoteTitle}>Why this is better</Text>
                <Text style={styles.compareNoteText}>
                  {selectedAlternative.whyBetter || "Cleaner ingredients and lower inflammatory load for better gut resilience."}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {showHealthModal && (
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowHealthModal(null)} />
          <View style={[styles.modalContent, { maxHeight: Math.min(windowHeight * 0.78, 600) }] }>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalTitleText}</Text>
              <TouchableOpacity onPress={() => setShowHealthModal(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={[styles.modalScroll, { maxHeight: Math.min(windowHeight * 0.52, 420) }]}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
              indicatorStyle="default"
            >
              {selectedHealthCard ? (
                <View style={styles.modalBody}>
                  {modalBodyText.length > 0 && <Text style={styles.modalContentText}>{modalBodyText}</Text>}

                  {selectedConcernIngredients.length > 0 && (
                    <View style={styles.modalIngredientsSection}>
                      <Text style={styles.modalSectionLabel}>Ingredients of Concern</Text>
                      <View style={styles.modalIngredientsGrid}>
                        {selectedConcernIngredients.map((ing, idx) => (
                          <View key={`${ing.name}-${idx}`} style={styles.modalIngredientChip}>
                            <View style={[styles.ingredientDot, { backgroundColor: getIngredientStatusColor(ing.status).text }]} />
                            <Text style={styles.modalIngredientName}>{ing.name}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {modalBodyText.length === 0 && selectedConcernIngredients.length === 0 && (
                    <View style={styles.modalEmptyState}>
                      <Text style={styles.modalEmptyText}>No area-specific details available for this result.</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.modalEmptyState}>
                  <Text style={styles.modalEmptyText}>Unable to load health impact details.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {fromOnboarding ? (
        <View style={[styles.footer, { paddingBottom: footerBottom }]}>
          <TouchableOpacity style={styles.primaryBtn} onPress={onContinue} disabled={saving}>
            <Text style={styles.primaryBtnText}>{saving ? "Saving..." : "Continue"}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.footer, { paddingBottom: footerBottom }]}>
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onScanAgain}>
              <Text style={styles.secondaryBtnText}>Scan another meal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtnCompact, loggedAsEaten && styles.disabledBtn]}
              onPress={onLogAsEaten}
              disabled={loggedAsEaten}
            >
              <Text style={styles.primaryBtnText}>{loggedAsEaten ? "Logged as eaten" : "Log as eaten"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  scrollView: {
    flex: 1,
  },

  headerShell: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    backgroundColor: Colors.background,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: H_PADDING,
    paddingVertical: rs(12),
  },
  headerIconBtn: {
    width: rs(40),
    height: rs(40),
    borderRadius: rs(12),
    borderWidth: 1,
    borderColor: DARK_BORDER,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: DARK_TEXT,
    fontSize: rf(16),
    fontFamily: Fonts.cardTitle,
  },
  headerDivider: {
    marginTop: rs(10),
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  heroCard: {
    borderRadius: rs(20),
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundWhite,
    padding: rs(22),
    marginBottom: rs(22),
    overflow: "hidden",
    opacity: 0.98,
  },
  visible: {
    opacity: 1,
  },
  heroGlow: {
    position: "absolute",
    top: -30,
    right: -30,
    width: rs(120),
    height: rs(120),
    borderRadius: rs(60),
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  productImageWrap: {
    width: rs(72),
    height: rs(72),
    borderRadius: rs(14),
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  productImage: {
    width: rs(72),
    height: rs(72),
    resizeMode: "cover",
  },
  productEmoji: {
    fontSize: rf(28),
  },
  productInfoWrap: {
    flex: 1,
    marginHorizontal: rs(18),
  },
  productName: {
    color: Colors.text,
    fontSize: rf(19),
    lineHeight: rf(24),
    fontFamily: Fonts.cardTitle,
    marginBottom: rs(4),
  },
  productMeta: {
    color: Colors.textSecondary,
    fontSize: rf(13),
    fontFamily: Fonts.subtitle,
    marginBottom: rs(3),
  },
  servingLabel: {
    color: Colors.textMuted,
    fontSize: rf(10),
    fontFamily: Fonts.smallLabel,
    textTransform: "uppercase",
    marginTop: rs(4),
  },
  servingSize: {
    color: Colors.textSecondary,
    fontSize: rf(12),
    fontFamily: Fonts.body,
  },
  scoreInfoRow: {
    gap: 8,
  },
  scoreBadge: {
    alignSelf: "flex-start",
    borderRadius: rs(10),
    borderWidth: 1,
    paddingHorizontal: rs(10),
    paddingVertical: rs(5),
  },
  scoreBadgeValue: {
    fontSize: rf(20),
    lineHeight: rf(22),
    fontFamily: Fonts.scoreNumber,
  },
  scoreBadgeLabel: {
    fontSize: rf(10),
    color: DARK_SOFT,
    letterSpacing: 0.5,
    fontFamily: Fonts.badge,
  },
  scoreStatus: {
    color: DARK_MUTED,
    fontSize: rf(12),
    fontFamily: Fonts.body,
  },

  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  ringCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  ringScore: {
    fontSize: rf(24),
    lineHeight: rf(26),
    fontFamily: Fonts.scoreNumber,
  },
  ringOutOf: {
    color: Colors.textSecondary,
    fontSize: rf(10),
    fontFamily: Fonts.smallLabel,
  },

  tabBar: {
    flexDirection: "row",
    gap: rs(10),
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: rs(18),
    paddingBottom: rs(12),
  },
  tabBtn: {
    borderRadius: rs(10),
    paddingVertical: rs(11),
    paddingHorizontal: rs(8),
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnActive: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabLabel: {
    color: "#000000",
    fontSize: rf(13),
    letterSpacing: 0.35,
    fontFamily: Fonts.tabBarLabel,
    textAlign: "center",
  },
  tabLabelActive: {
    color: "#000000",
  },

  sectionWrap: {
    paddingBottom: rs(16),
  },
  sectionKicker: {
    color: Colors.textSecondary,
    fontSize: rf(12),
    letterSpacing: 1,
    marginBottom: rs(14),
    fontFamily: Fonts.sectionHeader,
  },

  impactGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: rs(22),
    gap: rs(12),
  },
  impactCard: {
    width: "48%",
    borderRadius: rs(14),
    borderWidth: 1,
    backgroundColor: Colors.surface,
    paddingHorizontal: rs(15),
    paddingVertical: rs(15),
  },
  impactTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  impactIcon: {
    fontSize: rf(24),
  },
  impactScoreWrap: {
    alignItems: "flex-end",
  },
  impactScore: {
    fontSize: rf(22),
    lineHeight: rf(24),
    fontFamily: Fonts.scoreNumber,
  },
  impactOutOf: {
    color: Colors.textSecondary,
    fontSize: rf(13),
    fontFamily: Fonts.smallLabel,
  },
  impactDelta: {
    fontSize: rf(12),
    fontFamily: Fonts.smallLabel,
  },
  impactLabel: {
    marginTop: rs(8),
    color: "#000000",
    fontSize: rf(14),
    fontFamily: Fonts.cardTitle,
  },
  impactSeeMore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 4,
    marginTop: 8,
    paddingTop: 4,
  },
  impactSeeMoreText: {
    color: Colors.primary,
    fontSize: rf(12),
    fontFamily: Fonts.smallLabel,
  },
  impactPreview: {
    color: Colors.textSecondary,
    fontSize: rf(12),
    lineHeight: rf(16),
    fontFamily: Fonts.body,
    marginTop: rs(4),
  },

  seeMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    marginBottom: 16,
    paddingVertical: 8,
  },
  seeMoreText: {
    color: Colors.primary,
    fontSize: rf(14),
    fontFamily: Fonts.subtitle,
  },

  flagCard: {
    borderRadius: rs(14),
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundWhite,
    paddingHorizontal: rs(16),
    paddingVertical: rs(14),
    marginBottom: rs(12),
  },
  flagSeverity: {
    color: Colors.textMuted,
    fontSize: rf(11),
    letterSpacing: 0.8,
    fontFamily: Fonts.badge,
  },
  flagSeverityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 5,
  },
  flagCircle: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  flagTitle: {
    color: Colors.text,
    fontSize: rf(14),
    marginBottom: rs(4),
    fontFamily: Fonts.cardTitle,
  },
  flagDesc: {
    color: DARK_MUTED,
    fontSize: rf(13),
    lineHeight: rf(19),
    fontFamily: Fonts.body,
  },

  actionCard: {
    marginTop: rs(12),
    borderRadius: rs(14),
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundWhite,
    paddingHorizontal: rs(16),
    paddingVertical: rs(14),
  },
  actionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  actionIcon: {
    marginRight: 2,
  },
  actionLabel: {
    color: Colors.text,
    fontSize: rf(12),
    letterSpacing: 0.5,
    fontFamily: Fonts.badge,
  },
  actionTip: {
    color: DARK_SOFT,
    fontSize: rf(13),
    lineHeight: rf(19),
    fontFamily: Fonts.body,
    marginBottom: rs(8),
  },

  ingredientsStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    borderRadius: rs(14),
    borderWidth: 1,
    paddingVertical: rs(7),
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: rf(26),
    fontFamily: Fonts.scoreNumber,
    marginBottom: 2,
  },
  statLabel: {
    color: DARK_MUTED,
    fontSize: rf(10),
    fontFamily: Fonts.smallLabel,
  },

  ingredientCard: {
    borderRadius: rs(14),
    borderWidth: 1,
    paddingVertical: rs(20),
    paddingHorizontal: rs(16),
    marginBottom: rs(12),
  },
  ingredientHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ingredientHeaderTop: {
    flex: 1,
  },
  ingredientTitleWrap: {
    flex: 1,
  },
  ingredientDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 4,
  },
  ingredientName: {
    color: DARK_TEXT,
    fontSize: rf(14),
    fontFamily: Fonts.productName,
  },
  ingredientMetaText: {
    marginTop: 2,
    color: DARK_SOFT,
    fontSize: rf(11),
    fontFamily: Fonts.badge,
    letterSpacing: 0.3,
  },
  ingredientSubtitle: {
    marginTop: rs(4),
    color: DARK_SOFT,
    fontSize: rf(11),
    fontFamily: Fonts.subtitle,
  },
  ingredientConcern: {
    marginTop: 2,
    fontSize: rf(11),
    lineHeight: rf(15),
    fontFamily: Fonts.body,
  },
  ingredientExpand: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
  },
  ingredientExpandTitle: {
    color: DARK_SOFT,
    fontSize: rf(11),
    letterSpacing: 0.4,
    fontFamily: Fonts.badge,
    marginBottom: rs(4),
  },
  ingredientExpandText: {
    color: DARK_MUTED,
    fontSize: rf(13),
    lineHeight: rf(19),
    fontFamily: Fonts.body,
  },

  nutritionCard: {
    borderRadius: rs(16),
    borderWidth: 1,
    borderColor: DARK_BORDER,
    backgroundColor: DARK_SURFACE,
    padding: rs(16),
  },
  nutritionHeader: {
    color: DARK_TEXT,
    fontSize: rf(20),
    marginBottom: rs(10),
    fontFamily: Fonts.cardTitle,
  },
  nutritionServing: {
    color: DARK_MUTED,
    fontSize: rf(13),
    marginBottom: rs(10),
    fontFamily: Fonts.subtitle,
  },
  nutritionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: DARK_BORDER,
  },
  nutritionConcernRow: {
    backgroundColor: hexToRgba(Colors.warning, 0.06),
  },
  nutritionRowLast: {
    borderBottomWidth: 0,
  },
  nutritionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  concernIcon: {
    fontSize: rf(12),
  },
  nutritionName: {
    color: DARK_TEXT,
    fontSize: rf(14),
    fontFamily: Fonts.body,
  },
  nutritionEntryValue: {
    color: DARK_TEXT,
    fontSize: rf(14),
    fontFamily: Fonts.productName,
  },

  nutritionInsightCard: {
    marginTop: rs(16),
    borderRadius: rs(14),
    borderWidth: 1,
    borderColor: hexToRgba(Colors.error, 0.28),
    backgroundColor: hexToRgba(Colors.error, 0.1),
    paddingHorizontal: rs(14),
    paddingVertical: rs(12),
  },
  nutritionInsightTitle: {
    color: Colors.error,
    fontSize: rf(12),
    letterSpacing: 0.4,
    fontFamily: Fonts.badge,
    marginBottom: rs(5),
  },
  nutritionInsightBody: {
    color: DARK_MUTED,
    fontSize: rf(13),
    lineHeight: rf(19),
    fontFamily: Fonts.body,
  },

  altIntro: {
    color: DARK_MUTED,
    fontSize: rf(13),
    marginBottom: rs(12),
    fontFamily: Fonts.body,
  },
  altSectionKicker: {
    marginTop: rs(16),
  },
  altCard: {
    borderRadius: rs(14),
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundWhite,
    paddingHorizontal: rs(16),
    paddingVertical: rs(14),
    marginBottom: rs(12),
  },
  altTopRow: {
    flexDirection: "row",
    gap: rs(12),
    marginBottom: rs(10),
    alignItems: "center",
  },
  altImageWrap: {
    width: rs(64),
    height: rs(64),
    borderRadius: rs(14),
    borderWidth: 1,
    borderColor: DARK_BORDER,
    backgroundColor: DARK_SURFACE_ALT,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  altImage: {
    width: "100%",
    height: "100%",
  },
  altFallbackIcon: {
    alignSelf: "center",
  },
  altName: {
    color: DARK_TEXT,
    fontSize: rf(15),
    fontFamily: Fonts.cardTitle,
    marginBottom: rs(2),
  },
  altMeta: {
    color: DARK_SOFT,
    fontSize: rf(12),
    marginBottom: rs(10),
    fontFamily: Fonts.subtitle,
  },
  altBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  altScoreBadge: {
    borderWidth: 1,
    borderRadius: rs(9),
    paddingHorizontal: rs(10),
    paddingVertical: rs(5),
    alignSelf: "center",
  },
  altScoreValue: {
    fontSize: rf(18),
    lineHeight: rf(20),
    fontFamily: Fonts.scoreNumber,
  },
  altScoreLabel: {
    fontSize: rf(10),
    color: DARK_SOFT,
    fontFamily: Fonts.badge,
  },
  altDeltaBadge: {
    borderRadius: rs(9),
    backgroundColor: hexToRgba(Colors.success, 0.14),
    borderWidth: 1,
    borderColor: hexToRgba(Colors.success, 0.34),
    paddingHorizontal: rs(10),
    paddingVertical: rs(7),
  },
  altDeltaText: {
    color: Colors.success,
    fontSize: rf(12),
    fontFamily: Fonts.badge,
  },
  altWhy: {
    color: DARK_MUTED,
    fontSize: rf(13),
    lineHeight: rf(20),
    fontFamily: Fonts.body,
    flex: 1,
    marginRight: rs(10),
  },
  altActionsRow: {
    alignItems: "flex-end",
    gap: rs(8),
  },
  altCompareBtn: {
    borderRadius: rs(8),
    borderWidth: 1,
    borderColor: hexToRgba(Colors.primary, 0.28),
    backgroundColor: hexToRgba(Colors.primary, 0.08),
    paddingHorizontal: rs(10),
    paddingVertical: rs(6),
  },
  altCompareText: {
    color: Colors.primary,
    fontSize: rf(12),
    fontFamily: Fonts.badge,
  },
  altToggleBtn: {
    alignSelf: "center",
    marginTop: rs(2),
    marginBottom: rs(4),
    paddingHorizontal: rs(12),
    paddingVertical: rs(8),
  },
  altToggleText: {
    color: Colors.primary,
    fontSize: rf(13),
    fontFamily: Fonts.button,
  },
  altLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: rs(10),
  },

  emptyCard: {
    borderRadius: rs(14),
    borderWidth: 1,
    borderColor: DARK_BORDER,
    backgroundColor: DARK_SURFACE,
    padding: rs(14),
  },
  emptyText: {
    color: DARK_MUTED,
    fontSize: rf(13),
    fontFamily: Fonts.body,
  },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: H_PADDING,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: DARK_BORDER,
    backgroundColor: Colors.background,
  },
  footerRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryBtn: {
    borderRadius: rs(12),
    backgroundColor: Colors.primary,
    paddingVertical: rs(15),
    alignItems: "center",
  },
  primaryBtnCompact: {
    flex: 1,
    borderRadius: rs(12),
    backgroundColor: Colors.primary,
    paddingVertical: rs(15),
    alignItems: "center",
  },
  primaryBtnText: {
    color: "white",
    fontSize: rf(16),
    fontFamily: Fonts.button,
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: rs(12),
    borderWidth: 1,
    borderColor: DARK_BORDER,
    backgroundColor: DARK_SURFACE,
    paddingVertical: rs(15),
    alignItems: "center",
  },
  secondaryBtnText: {
    color: DARK_TEXT,
    fontSize: rf(15),
    fontFamily: Fonts.button,
  },
  disabledBtn: {
    opacity: 0.6,
  },

  // Modal styles
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
  },
  modalContent: {
    backgroundColor: Colors.backgroundWhite,
    borderRadius: rs(24),
    width: "86%",
    maxWidth: 460,
    maxHeight: "78%",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: hexToRgba(Colors.primary, 0.12),
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
    overflow: "hidden",
  },
  compareModalContent: {
    backgroundColor: Colors.backgroundWhite,
    borderRadius: rs(20),
    width: "88%",
    maxWidth: 460,
    borderWidth: 1,
    borderColor: hexToRgba(Colors.primary, 0.12),
    overflow: "hidden",
  },
  compareBody: {
    paddingHorizontal: rs(18),
    paddingVertical: rs(16),
    gap: rs(10),
  },
  compareSubtitle: {
    color: DARK_TEXT,
    fontSize: rf(15),
    fontFamily: Fonts.cardTitle,
    marginBottom: rs(4),
  },
  compareRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: hexToRgba(Colors.border, 0.8),
    paddingVertical: 8,
  },
  compareLabel: {
    color: DARK_MUTED,
    fontSize: rf(13),
    fontFamily: Fonts.body,
  },
  compareValue: {
    color: DARK_TEXT,
    fontSize: rf(13),
    fontFamily: Fonts.cardTitle,
  },
  compareNoteCard: {
    marginTop: rs(6),
    borderRadius: rs(12),
    borderWidth: 1,
    borderColor: hexToRgba(Colors.success, 0.24),
    backgroundColor: hexToRgba(Colors.success, 0.1),
    paddingHorizontal: rs(12),
    paddingVertical: rs(10),
  },
  compareNoteTitle: {
    color: Colors.success,
    fontSize: rf(12),
    fontFamily: Fonts.badge,
    marginBottom: rs(4),
  },
  compareNoteText: {
    color: DARK_TEXT,
    fontSize: rf(13),
    lineHeight: rf(19),
    fontFamily: Fonts.body,
  },
  modalAccentBar: {
    height: 6,
    width: "100%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: rs(20),
    paddingVertical: rs(16),
    borderBottomWidth: 1,
    borderBottomColor: hexToRgba(Colors.primary, 0.14),
  },
  modalTitle: {
    fontSize: rf(17),
    fontFamily: Fonts.cardTitle,
    color: Colors.text,
    flex: 1,
    paddingRight: rs(10),
  },
  modalCloseBtn: {
    width: rs(32),
    height: rs(32),
    borderRadius: rs(16),
    backgroundColor: hexToRgba(Colors.primary, 0.08),
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: {
    width: "100%",
  },
  modalScrollContent: {
    paddingBottom: 8,
  },
  modalBody: {
    paddingTop: rs(16),
    paddingBottom: rs(20),
    paddingHorizontal: rs(20),
  },
  modalContentText: {
    fontSize: rf(14),
    color: Colors.text,
    lineHeight: rf(20),
    fontFamily: Fonts.body,
    marginBottom: rs(20),
  },
  modalSectionLabel: {
    fontSize: rf(12),
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: Colors.textMuted,
    fontFamily: Fonts.smallLabel,
    marginBottom: rs(12),
  },
  modalIngredientsSection: {
    marginTop: 2,
  },
  modalIngredientsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: rs(10),
  },
  modalIngredientChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: rs(8),
    backgroundColor: hexToRgba(Colors.primary, 0.06),
    borderWidth: 1,
    borderColor: hexToRgba(Colors.primary, 0.2),
    borderRadius: rs(15),
    paddingHorizontal: rs(12),
    paddingVertical: rs(10),
  },
  modalIngredientName: {
    fontSize: rf(13),
    fontFamily: Fonts.productName,
    color: Colors.text,
  },
  modalEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: rs(32),
    paddingHorizontal: rs(12),
  },
  modalEmptyText: {
    fontSize: rf(13),
    color: Colors.textMuted,
    fontFamily: Fonts.body,
    textAlign: "center",
  },

  // Sheet drag handle styles
  sheetDragHandleZone: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: rs(20),
    paddingBottom: rs(16),
    minHeight: rs(50),
    backgroundColor: Colors.background,
  },
  sheetDragHandle: {
    width: rs(52),
    height: 6,
    borderRadius: 999,
    backgroundColor: Colors.border,
  },
});

// NOTE: This file lives under `app/` because it is co-located with the scan
// screens that consume it, but it is NOT a navigable route. expo-router will
// complain about a missing default export otherwise, so we provide an inert
// fallback component. It is never actually rendered as a route in normal use.
export default function ScanResultSheetRouteFallback() {
  return null;
}
