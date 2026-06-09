/**
 * Scan analysis pipeline:
 *
 * BARCODE FLOW:
 *   1. Look up product in databases (Open Food Facts → UPC ItemDB)
 *   2. If not found → throw "Product not found" (no LLM guessing)
 *   3. Compute scores deterministically from nutrition/ingredients
 *   4. Send verified product + scores to LLM for explanation text only
 *   5. Return ScanResult with real data + LLM explanations
 *
 * PHOTO FLOW:
 *   1. Quick meal detection (1-2s): Identify if meal vs product
 *   2. If meal: Multi-stage ingredient detection with portion estimation
 *   3. If product: Standard product identification
 *   4. Detailed analysis (2-3s): Nutrition calculation + scoring
 *   5. Return enhanced results with meal-specific data
 */
import { analyzeIngredients, type IngredientAnalysisResult } from "@/lib/ingredient-analysis";
import { getCommercialFoodNutrition, type NutritionixNutrition } from "@/lib/nutritionix-api";
import type { OnboardingProfile } from "@/lib/onboarding-storage";
import { lookupProduct, searchOFFByTerm, searchProductByName, type ProductInfo } from "@/lib/product-lookup";
import { buildProductInsight } from "@/lib/product-insight-generation";
import { computeScores, type ComputedScores } from "@/lib/scoring-engine";
import { getIngredientNutrition, type USDANutrition } from "@/lib/usda-database";
import type {
    AnalyzeScanRequest,
    CameraCaptureMetadata,
    CookingAnalysis,
    CookingMethod,
    DetectedIngredient,
    MealComponent,
    MealDetectionResult,
    PortionAdjustment,
    PortionEstimate,
    ScanNutrition,
    ScanResult,
} from "@/types/scan";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? "";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_TEXT_MODEL = "llama-3.1-8b-instant";

const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 600;
const REQUEST_TIMEOUT_MS = 8_000; // 8s — fast fail so scan feels snappy; LLM/vision fallback to score-only

// Meal detection configuration
const CONFIDENCE_THRESHOLD = 0.5; // Lower gate to avoid false negatives in meal photo mode
const INGREDIENT_LOOKUP_TIMEOUT_MS = 1_400;
const OFF_INGREDIENT_LOOKUP_TIMEOUT_MS = 900;
const MIN_INGREDIENT_GRAMS = 1;
const QUICK_MEAL_DETECTION_TIMEOUT_MS = 4_000;
const ENHANCEMENT_STAGE_TIMEOUT_MS = 1_800;

const INGREDIENT_NAME_ALIASES: Record<string, string> = {
  "sweet potatoes": "Sweet Potato",
  "sweet potato": "Sweet Potato",
  "chicken breast": "Chicken",
  chicken: "Chicken",
  "brown rice": "Brown Rice",
  "cherry tomato": "Cherry Tomatoes",
  "cherry tomatoes": "Cherry Tomatoes",
  cucumber: "Cucumber",
  avocado: "Avocado",
  "red onion": "Red Onion",
  "red onions": "Red Onion",
  onion: "Onion",
  greens: "Arugula",
  "mixed greens": "Arugula",
  "leafy greens": "Arugula",
  arugula: "Arugula",
  "balsamic vinegar": "Balsamic Vinegar",
  tzatziki: "Tzatziki",
};

type PortionPriorConfig = {
  defaultGrams: number;
  minGrams: number;
  maxGrams: number;
  visualReference: string;
};

type LearnedPrior = NonNullable<AnalyzeScanRequest["learnedPortionPriors"]>[number];
type VisualPrior = NonNullable<AnalyzeScanRequest["visualPortionPriors"]>[number];

type PhotoAnalysisStageUpdate = {
  stage: "detect" | "analyze" | "portion" | "validate";
  progress: number;
  message: string;
};

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toTitleCaseWords(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .replace(/\s+/g, " ");
}

function buildMealName(mealDetection: MealDetectionResult): string {
  const names = mealDetection.ingredients.map((i) => i.name.toLowerCase());
  const has = (patterns: RegExp[]) => patterns.some((p) => names.some((n) => p.test(n)));
  const findFirst = (pairs: Array<{ label: string; test: RegExp }>): string | null => {
    for (const pair of pairs) {
      if (names.some((n) => pair.test.test(n))) return pair.label;
    }
    return null;
  };

  if (has([/waffle/, /pancake/])) {
    const toppings = [
      findFirst([
        { label: "Berries", test: /(berry|strawberry|blueberry|raspberry)/ },
        { label: "Banana", test: /banana/ },
        { label: "Honey", test: /honey/ },
        { label: "Maple Syrup", test: /(maple|syrup)/ },
        { label: "Chocolate", test: /chocolate/ },
      ]),
    ].filter(Boolean) as string[];
    return toppings.length > 0 ? `Waffles with ${toppings.join(" and ")}` : "Waffles";
  }

  const protein = findFirst([
    { label: "Chicken", test: /chicken/ },
    { label: "Salmon", test: /salmon/ },
    { label: "Tuna", test: /tuna/ },
    { label: "Egg", test: /egg/ },
    { label: "Tofu", test: /tofu/ },
    { label: "Beef", test: /beef/ },
    { label: "Shrimp", test: /shrimp|prawn/ },
    { label: "Chickpea", test: /chickpea|garbanzo/ },
  ]);
  const hasSaladBase = has([/lettuce/, /arugula/, /spinach/, /greens/, /kale/, /cabbage/]);
  if (protein && hasSaladBase) {
    return `${protein} Salad`;
  }

  const method = (mealDetection.cookingMethods[0] || "").toLowerCase();
  const methodLabel =
    method === "sautéed"
      ? "Sauteed"
      : method
        ? toTitleCaseWords(method)
        : "";

  const base = findFirst([
    { label: "Rice", test: /rice/ },
    { label: "Quinoa", test: /quinoa/ },
    { label: "Pasta", test: /pasta|noodle/ },
    { label: "Bowl", test: /grain|lentil|bean/ },
  ]);

  if (protein && methodLabel) {
    return base ? `${methodLabel} ${protein} with ${base}` : `${methodLabel} ${protein}`;
  }
  if (protein) return base ? `${protein} with ${base}` : `${protein} Meal`;
  if (hasSaladBase) return "Mixed Salad";
  return `Custom Meal (${mealDetection.ingredients.length} ingredients)`;
}

function classifyMealIngredientTier(estimatedGrams: number): "main" | "supporting" | "micro" {
  if (estimatedGrams >= 20) return "main";
  if (estimatedGrams >= 5) return "supporting";
  return "micro";
}

function inferMealIngredientImpact(
  name: string,
  state: DetectedIngredient["state"],
  cookingMethod?: DetectedIngredient["cookingMethod"],
): "negative" | "moderate" | "positive" {
  const n = name.toLowerCase();
  if (/(leafy|spinach|arugula|kale|broccoli|cucumber|tomato|onion|garlic|ginger|turmeric|lentil|chickpea|beans|quinoa|oats|avocado|olive oil)/.test(n)) {
    return "positive";
  }
  if (
    /(sugar|syrup|fructose|maltodextrin|refined|processed meat|sausage|bacon|deep fry|fried|tortilla chips|fried tortilla|white flour|maida|shortening|hydrogenated|palm oil)/.test(
      n,
    )
  ) {
    return "negative";
  }
  if (cookingMethod === "fried") {
    return "negative";
  }
  if (state === "processed") {
    return "moderate";
  }
  return "moderate";
}

async function generateMealNameWithAI(mealDetection: MealDetectionResult): Promise<string | null> {
  try {
    const ingredientPayload = mealDetection.ingredients.map((ingredient) => ({
      name: ingredient.name,
      cookingMethod: ingredient.cookingMethod ?? null,
      state: ingredient.state,
      grams: ingredient.estimatedGrams ?? null,
    }));

    const raw = await callGroqRaw(
      [
        {
          role: "system",
          content:
            "You name meals from ingredient lists. Return JSON only: {\"meal_name\": string}. Keep name concise (2-5 words), specific, title-case, no brand names, no emojis, no trailing punctuation.",
        },
        {
          role: "user",
          content: `Generate the best meal name from this detected meal JSON: ${JSON.stringify({
            ingredients: ingredientPayload,
            cookingMethods: mealDetection.cookingMethods,
          })}`,
        },
      ],
      GROQ_TEXT_MODEL,
      1800,
    );

    const parsed = safeParse<{ meal_name?: string }>(raw);
    const mealName = parsed?.meal_name?.trim();
    if (!mealName) return null;
    const cleaned = mealName.replace(/[.!?]+$/g, "").replace(/\s+/g, " ").trim();
    if (!cleaned || cleaned.length < 4) return null;
    return cleaned;
  } catch {
    return null;
  }
}

function buildMealIngredientAnalysis(mealDetection: MealDetectionResult): IngredientAnalysisResult {
  const tierCounts = { main: 0, supporting: 0, micro: 0 };
  let redCount = 0;
  let yellowCount = 0;
  let greenCount = 0;

  const items = mealDetection.ingredients.map((ingredient) => {
    const grams = Math.max(MIN_INGREDIENT_GRAMS, ingredient.estimatedGrams ?? MIN_INGREDIENT_GRAMS);
    const tier = classifyMealIngredientTier(grams);
    tierCounts[tier] += 1;

    const impact = inferMealIngredientImpact(ingredient.name, ingredient.state, ingredient.cookingMethod);
    if (impact === "negative") redCount += 1;
    else if (impact === "moderate") yellowCount += 1;
    else greenCount += 1;

    const whyMatters =
      impact === "positive"
        ? `${ingredient.name} is generally gut-supportive at this portion and can help meal diversity for the microbiome.`
        : impact === "negative"
          ? `${ingredient.name} may increase gut irritation or inflammation sensitivity depending on portion and preparation.`
          : `${ingredient.name} is context-dependent for gut health; portion size and combination with fiber-rich foods matter.`;

    return {
      displayName: ingredient.name,
      impact,
      whyMatters,
      tier,
      estimatedGrams: grams,
    };
  });

  return {
    items,
    redCount,
    yellowCount,
    greenCount,
    tierCounts,
  };
}

function createFallbackMealDetection(
  learnedPriorMap?: Map<string, LearnedPrior>
): MealDetectionResult {
  return sanitizeMealDetection(
    {
      isMeal: true,
      confidence: 0.45,
      ingredients: [
        {
          name: "Mixed Meal",
          state: "cooked",
          confidence: 0.52,
          boundingBox: { x: 0, y: 0, width: 1, height: 1 },
          estimatedGrams: 320,
          itemCount: 1,
        },
      ],
      cookingMethods: [],
      portionEstimates: [
        {
          ingredientName: "Mixed Meal",
          estimatedGrams: 320,
          confidence: 0.5,
          visualReference: "full plate portion",
        },
      ],
      totalEstimatedCalories: undefined,
    },
    learnedPriorMap,
  );
}

function normalizeCookingMethod(raw?: string | null): CookingMethod | undefined {
  if (!raw) return undefined;
  const normalized = raw.toLowerCase().trim();
  if (normalized === "sauteed" || normalized === "saute") return "sautéed";
  if (
    normalized === "grilled" ||
    normalized === "fried" ||
    normalized === "boiled" ||
    normalized === "roasted" ||
    normalized === "steamed" ||
    normalized === "baked" ||
    normalized === "sautéed" ||
    normalized === "raw"
  ) {
    return normalized;
  }
  return undefined;
}

function normalizeIngredientName(raw: string): string {
  const cleaned = raw.toLowerCase().replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const aliased = INGREDIENT_NAME_ALIASES[cleaned] ?? cleaned;
  return aliased
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildLearnedPriorMap(
  priors?: AnalyzeScanRequest["learnedPortionPriors"]
): Map<string, LearnedPrior> {
  const out = new Map<string, LearnedPrior>();
  if (!Array.isArray(priors)) return out;
  for (const prior of priors) {
    const key = normalizeIngredientName(prior?.ingredientName ?? "").toLowerCase();
    if (!key) continue;
    const meanGrams = Number(prior?.meanGrams ?? 0);
    const confidence = Number(prior?.confidence ?? 0);
    const sampleCount = Number(prior?.sampleCount ?? 0);
    if (!isFinite(meanGrams) || meanGrams <= 0) continue;
    out.set(key, {
      ingredientName: normalizeIngredientName(prior.ingredientName),
      meanGrams,
      confidence: clampNumber(confidence, 0, 1),
      sampleCount: Math.max(0, Math.round(sampleCount)),
    });
  }
  return out;
}

function buildVisualPriorMap(
  priors?: AnalyzeScanRequest["visualPortionPriors"]
): Map<string, VisualPrior> {
  const out = new Map<string, VisualPrior>();
  if (!Array.isArray(priors)) return out;
  for (const prior of priors) {
    const key = normalizeIngredientName(prior?.ingredientName ?? "").toLowerCase();
    if (!key) continue;
    const conversionFactor = Number(prior?.conversionFactor ?? 0);
    const sampleCount = Number(prior?.sampleCount ?? 0);
    const confidence = Number(prior?.confidence ?? 0);
    if (!isFinite(conversionFactor) || conversionFactor <= 0 || !isFinite(sampleCount) || sampleCount < 2) continue;
    out.set(key, {
      ingredientName: normalizeIngredientName(prior.ingredientName),
      conversionFactor,
      sampleCount: Math.max(0, Math.round(sampleCount)),
      confidence: clampNumber(confidence, 0, 1),
    });
  }
  return out;
}

function getPortionVisualFallback(grams: number): string {
  if (grams <= 20) return `thumb-tip amount (~${grams}g)`;
  if (grams <= 45) return `thumb-sized amount (~${grams}g)`;
  if (grams <= 100) return `palm-sized portion (~${grams}g)`;
  if (grams <= 170) return `deck-of-cards portion (~${grams}g)`;
  if (grams <= 280) return `fist-sized portion (~${grams}g)`;
  return `two-palm portion (~${grams}g)`;
}

function applyMetadataAwarePortionCalibration(
  mealDetection: MealDetectionResult,
  learnedPriorMap?: Map<string, LearnedPrior>,
  visualPriorMap?: Map<string, VisualPrior>,
  cameraMetadata?: CameraCaptureMetadata,
): MealDetectionResult {
  if (!mealDetection.isMeal || mealDetection.ingredients.length === 0) return mealDetection;

  const hasCameraMetadata =
    !!cameraMetadata &&
    (typeof cameraMetadata.focalLengthMm === "number" ||
      typeof cameraMetadata.digitalZoomRatio === "number" ||
      typeof cameraMetadata.subjectDistanceM === "number" ||
      cameraMetadata.hasDepthData === true);
  const imageArea =
    typeof cameraMetadata?.width === "number" &&
    typeof cameraMetadata?.height === "number" &&
    cameraMetadata.width > 0 &&
    cameraMetadata.height > 0
      ? cameraMetadata.width * cameraMetadata.height
      : null;
  const hasDepthData = cameraMetadata?.hasDepthData === true;

  const ingredientByKey = new Map<string, DetectedIngredient>();
  for (const ingredient of mealDetection.ingredients) {
    ingredientByKey.set(ingredient.name.toLowerCase(), ingredient);
  }

  const calibratedPortions = mealDetection.portionEstimates.map((portion) => {
    const key = portion.ingredientName.toLowerCase();
    const ingredient = ingredientByKey.get(key);
    const prior = getPortionPrior(portion.ingredientName, ingredient, learnedPriorMap);
    const baseGrams = Math.max(MIN_INGREDIENT_GRAMS, Math.round(portion.estimatedGrams || prior.defaultGrams));

    const bboxAreaRaw = ingredient?.boundingBox
      ? Math.max(0, (ingredient.boundingBox.width || 0) * (ingredient.boundingBox.height || 0))
      : 0;
    const normalizedArea =
      bboxAreaRaw > 0
        ? bboxAreaRaw <= 1
          ? bboxAreaRaw
          : imageArea && imageArea > 0
            ? bboxAreaRaw / imageArea
            : null
        : null;

    const visualPrior = visualPriorMap?.get(key);
    const visualPriorEstimate =
      normalizedArea != null && visualPrior
        ? Math.round(normalizedArea * visualPrior.conversionFactor)
        : null;

    let metadataFactor = 1;
    if (hasCameraMetadata) {
      if (typeof cameraMetadata?.focalLengthMm === "number" && isFinite(cameraMetadata.focalLengthMm)) {
        metadataFactor *= clampNumber(cameraMetadata.focalLengthMm / 4.2, 0.82, 1.25);
      }
      if (typeof cameraMetadata?.digitalZoomRatio === "number" && isFinite(cameraMetadata.digitalZoomRatio) && cameraMetadata.digitalZoomRatio > 0) {
        metadataFactor *= clampNumber(1 / cameraMetadata.digitalZoomRatio, 0.82, 1.18);
      }
      if (typeof cameraMetadata?.subjectDistanceM === "number" && isFinite(cameraMetadata.subjectDistanceM) && cameraMetadata.subjectDistanceM > 0) {
        metadataFactor *= clampNumber(0.42 / cameraMetadata.subjectDistanceM, 0.8, 1.3);
      }
      if (hasDepthData) {
        metadataFactor *= 1.05;
      }
    }

    const metadataEstimate = hasCameraMetadata ? Math.round(baseGrams * metadataFactor) : null;

    let calibrated = baseGrams;
    if (visualPriorEstimate != null && metadataEstimate != null) {
      calibrated = Math.round(baseGrams * 0.35 + visualPriorEstimate * 0.35 + metadataEstimate * 0.3);
    } else if (visualPriorEstimate != null) {
      calibrated = Math.round(baseGrams * 0.45 + visualPriorEstimate * 0.55);
    } else if (metadataEstimate != null) {
      calibrated = Math.round(baseGrams * 0.55 + metadataEstimate * 0.45);
    }

    const clamped = Math.round(
      clampNumber(calibrated, Math.max(MIN_INGREDIENT_GRAMS, prior.minGrams), Math.max(prior.maxGrams, Math.round(prior.maxGrams * 1.8)))
    );

    const confidenceBoost =
      (metadataEstimate != null ? 0.06 : 0) +
      (visualPriorEstimate != null && visualPrior ? 0.08 * clampNumber(visualPrior.confidence, 0, 1) : 0);

    const visualReference =
      metadataEstimate != null
        ? `camera metadata${hasDepthData ? " + depth" : ""} calibrated, ${getPortionVisualFallback(clamped)}`
        : visualPriorEstimate != null
          ? `learned visual prior calibrated, ${getPortionVisualFallback(clamped)}`
          : portion.visualReference?.trim() || getPortionVisualFallback(clamped);

    return {
      ...portion,
      estimatedGrams: clamped,
      confidence: clampNumber((portion.confidence || 0.55) + confidenceBoost, 0.1, 1),
      visualReference,
    };
  });

  const calibratedIngredientByKey = new Map<string, number>();
  for (const portion of calibratedPortions) {
    calibratedIngredientByKey.set(portion.ingredientName.toLowerCase(), portion.estimatedGrams);
  }

  const calibratedIngredients = mealDetection.ingredients.map((ingredient) => {
    const grams = calibratedIngredientByKey.get(ingredient.name.toLowerCase());
    return {
      ...ingredient,
      estimatedGrams: grams ?? ingredient.estimatedGrams,
    };
  });

  return {
    ...mealDetection,
    ingredients: calibratedIngredients,
    portionEstimates: calibratedPortions,
  };
}

function validateMealDetectionResult(
  mealDetection: MealDetectionResult,
  learnedPriorMap?: Map<string, LearnedPrior>,
): MealDetectionResult {
  const validated = sanitizeMealDetection(mealDetection, learnedPriorMap);
  const coverage = scoreMealDetectionCoverage(validated);
  const confidenceBonus = coverage >= 20 ? 0.06 : coverage >= 14 ? 0.03 : 0;
  return {
    ...validated,
    confidence: clampNumber(validated.confidence + confidenceBonus, 0.1, 1),
  };
}

function getPortionPrior(
  name: string,
  ingredient?: DetectedIngredient,
  learnedPriorMap?: Map<string, LearnedPrior>
): PortionPriorConfig {
  // Use AI's estimated grams from the ingredient if available
  if (ingredient?.estimatedGrams && isFinite(ingredient.estimatedGrams)) {
    const estimatedGrams = Math.max(MIN_INGREDIENT_GRAMS, Math.round(ingredient.estimatedGrams));
    const itemCount = ingredient.itemCount || 1;
    
    // Generate visual reference from AI's analysis
    let visualReference = "AI-estimated portion";
    if (itemCount > 1) {
      visualReference = `${itemCount} items, ~${Math.round(estimatedGrams / itemCount)}g each`;
    } else if (estimatedGrams < 50) {
      visualReference = `small amount, ~${estimatedGrams}g`;
    } else if (estimatedGrams > 150) {
      visualReference = `large portion, ~${estimatedGrams}g`;
    } else {
      visualReference = `medium portion, ~${estimatedGrams}g`;
    }
    
    // Create reasonable range based on AI's estimate
    const minGrams = Math.max(MIN_INGREDIENT_GRAMS, Math.round(estimatedGrams * 0.7));
    const maxGrams = Math.round(estimatedGrams * 1.3);
    
    return {
      defaultGrams: estimatedGrams,
      minGrams,
      maxGrams,
      visualReference,
    };
  }
  
  // Fallback to learned priors if available
  const key = normalizeIngredientName(name).toLowerCase();
  const learned = key ? learnedPriorMap?.get(key) : undefined;
  if (learned && learned.sampleCount >= 2) {
    const learningWeight = clampNumber(learned.confidence, 0, 1) * 0.75;
    const baseDefault = 80; // Minimal fallback
    const blendedDefault = Math.round(baseDefault * (1 - learningWeight) + learned.meanGrams * learningWeight);
    const learnedMin = Math.max(MIN_INGREDIENT_GRAMS, Math.round(learned.meanGrams * 0.55));
    const learnedMax = Math.max(learnedMin + 10, Math.round(learned.meanGrams * 1.8));

    return {
      defaultGrams: blendedDefault,
      minGrams: Math.max(MIN_INGREDIENT_GRAMS, learnedMin),
      maxGrams: Math.max(baseDefault, learnedMax),
      visualReference: `learned portion (~${learned.meanGrams}g)`,
    };
  }
  
  // Final fallback - minimal default
  return {
    defaultGrams: 80,
    minGrams: MIN_INGREDIENT_GRAMS,
    maxGrams: 200,
    visualReference: "estimated portion",
  };
}

function sanitizeMealDetection(
  parsed: MealDetectionResult,
  learnedPriorMap?: Map<string, LearnedPrior>
): MealDetectionResult {
  const ingredientsByName = new Map<string, DetectedIngredient>();
  const rawIngredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];

  for (const ingredient of rawIngredients) {
    const normalizedName = normalizeIngredientName(ingredient?.name ?? "");
    if (!normalizedName) continue;
    const key = normalizedName.toLowerCase();
    const existing = ingredientsByName.get(key);
    const normalizedMethod = normalizeCookingMethod(ingredient?.cookingMethod);
    const next: DetectedIngredient = {
      name: normalizedName,
      state:
        ingredient?.state === "raw" || ingredient?.state === "processed" || ingredient?.state === "cooked"
          ? ingredient.state
          : normalizedMethod === "raw"
            ? "raw"
            : "cooked",
      cookingMethod: normalizedMethod,
      confidence: clampNumber(
        typeof ingredient?.confidence === "number" ? ingredient.confidence : 0.6,
        0.1,
        1
      ),
      boundingBox: ingredient?.boundingBox ?? { x: 0, y: 0, width: 1, height: 1 },
      estimatedGrams:
        typeof ingredient?.estimatedGrams === "number" && isFinite(ingredient.estimatedGrams)
          ? ingredient.estimatedGrams
          : undefined,
      itemCount: typeof ingredient?.itemCount === "number" && isFinite(ingredient.itemCount)
        ? Math.max(1, ingredient.itemCount)
        : 1,
    };

    if (!existing || next.confidence > existing.confidence) {
      ingredientsByName.set(key, next);
    }
  }

  const rawPortions = Array.isArray(parsed.portionEstimates) ? parsed.portionEstimates : [];
  const portionMap = new Map<string, PortionEstimate>();

  for (const estimate of rawPortions) {
    const normalizedName = normalizeIngredientName(estimate?.ingredientName ?? "");
    if (!normalizedName) continue;
    // Find matching ingredient for bounding box data
    const matchingIngredient = ingredientsByName.get(normalizedName.toLowerCase());
    const prior = getPortionPrior(normalizedName, matchingIngredient, learnedPriorMap);
    const rawGrams =
      typeof estimate?.estimatedGrams === "number" && isFinite(estimate.estimatedGrams)
        ? estimate.estimatedGrams
        : prior.defaultGrams;
    const normalizedEstimate: PortionEstimate = {
      ingredientName: normalizedName,
      estimatedGrams: Math.round(clampNumber(rawGrams, Math.max(MIN_INGREDIENT_GRAMS, prior.minGrams), prior.maxGrams)),
      confidence: clampNumber(typeof estimate?.confidence === "number" ? estimate.confidence : 0.55, 0.1, 1),
      visualReference: estimate?.visualReference?.trim() || prior.visualReference,
    };
    portionMap.set(normalizedName.toLowerCase(), normalizedEstimate);
  }

  for (const [key, estimate] of portionMap.entries()) {
    if (ingredientsByName.has(key)) continue;
    ingredientsByName.set(key, {
      name: estimate.ingredientName,
      state: "raw",
      confidence: Math.max(0.45, estimate.confidence - 0.1),
      boundingBox: { x: 0, y: 0, width: 1, height: 1 },
      estimatedGrams: estimate.estimatedGrams,
    });
  }

  const ingredients = [...ingredientsByName.values()];
  for (const ingredient of ingredients) {
    const key = ingredient.name.toLowerCase();
    const prior = getPortionPrior(ingredient.name, ingredient, learnedPriorMap);
    const existingPortion = portionMap.get(key);
    const candidateGrams =
      existingPortion?.estimatedGrams ??
      (typeof ingredient.estimatedGrams === "number" && isFinite(ingredient.estimatedGrams)
        ? ingredient.estimatedGrams
        : prior.defaultGrams);
    const clampedGrams = Math.round(
      clampNumber(candidateGrams, Math.max(MIN_INGREDIENT_GRAMS, prior.minGrams), prior.maxGrams)
    );

    portionMap.set(key, {
      ingredientName: ingredient.name,
      estimatedGrams: clampedGrams,
      confidence: existingPortion?.confidence ?? Math.max(ingredient.confidence - 0.1, 0.5),
      visualReference: existingPortion?.visualReference || prior.visualReference,
    });
    ingredient.estimatedGrams = clampedGrams;
  }

  const cookingMethods = (Array.isArray(parsed.cookingMethods) ? parsed.cookingMethods : [])
    .map((method) => normalizeCookingMethod(method))
    .filter((method): method is CookingMethod => !!method);

  return {
    ...parsed,
    ingredients,
    portionEstimates: [...portionMap.values()],
    cookingMethods,
    confidence: clampNumber(typeof parsed.confidence === "number" ? parsed.confidence : 0.6, 0.1, 1),
  };
}

function hasNamedIngredient(ingredients: DetectedIngredient[], name: string): boolean {
  const key = normalizeIngredientName(name).toLowerCase();
  return ingredients.some((ingredient) => ingredient.name.toLowerCase() === key);
}

function scoreMealDetectionCoverage(result: MealDetectionResult): number {
  const ingredientCount = result.ingredients.length;
  const hasPortionForAll = result.ingredients.every((ingredient) =>
    result.portionEstimates.some(
      (estimate) => estimate.ingredientName.toLowerCase() === ingredient.name.toLowerCase()
    )
  );

  let specificityBonus = 0;
  if (hasNamedIngredient(result.ingredients, "Cherry Tomatoes")) specificityBonus += 1;
  if (hasNamedIngredient(result.ingredients, "Cucumber")) specificityBonus += 1;
  if (hasNamedIngredient(result.ingredients, "Red Onion")) specificityBonus += 1;
  if (hasNamedIngredient(result.ingredients, "Arugula")) specificityBonus += 1;
  if (hasNamedIngredient(result.ingredients, "Balsamic Vinegar")) specificityBonus += 1;
  if (hasNamedIngredient(result.ingredients, "Tzatziki")) specificityBonus += 1;

  const microIngredientCount = result.ingredients.filter((ingredient) =>
    /(pepper|salt|herb|oregano|basil|cilantro|parsley|dill|chili|paprika|cumin|vinegar|sauce|dressing|oil|sesame)/i.test(
      ingredient.name,
    ),
  ).length;

  return ingredientCount * 3 + (hasPortionForAll ? 2 : 0) + specificityBonus + Math.min(8, microIngredientCount);
}

function mergeMealDetectionResults(
  base: MealDetectionResult,
  incoming: MealDetectionResult,
  learnedPriorMap?: Map<string, LearnedPrior>,
): MealDetectionResult {
  const mergedIngredients = new Map<string, DetectedIngredient>();
  for (const ingredient of base.ingredients) {
    mergedIngredients.set(ingredient.name.toLowerCase(), { ...ingredient });
  }

  for (const ingredient of incoming.ingredients) {
    const key = ingredient.name.toLowerCase();
    const existing = mergedIngredients.get(key);
    if (!existing) {
      mergedIngredients.set(key, { ...ingredient });
      continue;
    }

    const incomingWins = (ingredient.confidence ?? 0) > (existing.confidence ?? 0);
    mergedIngredients.set(key, {
      ...(incomingWins ? existing : ingredient),
      ...(incomingWins ? ingredient : existing),
      itemCount: Math.max(existing.itemCount ?? 1, ingredient.itemCount ?? 1),
      estimatedGrams: Math.max(existing.estimatedGrams ?? MIN_INGREDIENT_GRAMS, ingredient.estimatedGrams ?? MIN_INGREDIENT_GRAMS),
      confidence: Math.max(existing.confidence ?? 0.5, ingredient.confidence ?? 0.5),
    });
  }

  const mergedPortions = new Map<string, PortionEstimate>();
  for (const estimate of base.portionEstimates) {
    mergedPortions.set(estimate.ingredientName.toLowerCase(), { ...estimate });
  }
  for (const estimate of incoming.portionEstimates) {
    const key = estimate.ingredientName.toLowerCase();
    const existing = mergedPortions.get(key);
    if (!existing) {
      mergedPortions.set(key, { ...estimate });
      continue;
    }
    if ((estimate.confidence ?? 0) >= (existing.confidence ?? 0)) {
      mergedPortions.set(key, {
        ...estimate,
        estimatedGrams: Math.max(estimate.estimatedGrams ?? MIN_INGREDIENT_GRAMS, existing.estimatedGrams ?? MIN_INGREDIENT_GRAMS),
      });
    }
  }

  const merged: MealDetectionResult = {
    isMeal: base.isMeal || incoming.isMeal,
    confidence: Math.max(base.confidence ?? 0.5, incoming.confidence ?? 0.5),
    ingredients: [...mergedIngredients.values()],
    cookingMethods: Array.from(new Set([...(base.cookingMethods ?? []), ...(incoming.cookingMethods ?? [])])),
    portionEstimates: [...mergedPortions.values()],
    totalEstimatedCalories: incoming.totalEstimatedCalories ?? base.totalEstimatedCalories,
  };

  return sanitizeMealDetection(merged, learnedPriorMap);
}

function buildEnhancementPrompt(stage: "macro" | "micro" | "trace", baseResult: MealDetectionResult): string {
  const stageGoal =
    stage === "macro"
      ? "Focus on main ingredients and core components larger than ~5g."
      : stage === "micro"
        ? "Focus on small but meaningful ingredients: herbs, spices, toppings, sauces, dressings, oils."
        : "Focus on trace-level visible components and finishers: pepper flakes, herb dust, light sauce drizzles, seasoning residues.";

  return `Current detection JSON (may be incomplete): ${JSON.stringify(baseResult)}\n\n${stageGoal}\nReturn a corrected full JSON result for this same image. Include every clearly visible ingredient and provide realistic grams for each.`;
}

async function refineMealDetection(
  imageBase64: string,
  mimeType: string,
  baseResult: MealDetectionResult,
  learnedPriorMap?: Map<string, LearnedPrior>,
  stage: "macro" | "micro" | "trace" = "macro",
): Promise<MealDetectionResult | null> {
  if (!baseResult.isMeal) return null;

  const imageUrl = `data:${mimeType};base64,${imageBase64}`;
  const raw = await callGroqRaw(
    [
      {
        role: "system",
        content: `You are reviewing an existing meal-detection JSON for accuracy. Re-check the image and return a corrected JSON object only.

Keys (all required):
isMeal (boolean),
confidence (number 0-1),
ingredients (array: name, state "raw"|"cooked"|"processed", cookingMethod "grilled"|"fried"|"boiled"|"roasted"|"steamed"|"baked"|"sautéed"|"raw"|null, confidence 0-1, boundingBox {x,y,width,height}, itemCount number, estimatedGrams number),
cookingMethods (array),
portionEstimates (array: ingredientName, estimatedGrams, confidence, visualReference describing your visual portion analysis),
totalEstimatedCalories (number|null).

Rules:
- Count individual items when visible (e.g., "8 cherry tomatoes" not just "tomatoes").
- Prefer concrete ingredient names over umbrella labels (avoid just "greens").
- Include small but visible ingredients (cherry tomatoes, cucumber, red onion, dressings, sauces) when visible.
- Ensure each ingredient has a portion estimate with grams based on visual analysis.
- Provide detailed visual references that explain your reasoning (size, quantity, comparison).
- Keep estimates realistic for a single bowl/plate serving.
- Use itemCount to show how many separate pieces of each ingredient you can count.
- Every ingredient must include estimatedGrams based on visual analysis.`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: buildEnhancementPrompt(stage, baseResult),
          },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    GROQ_VISION_MODEL,
    ENHANCEMENT_STAGE_TIMEOUT_MS,
  );

  const parsed = safeParse<MealDetectionResult>(raw);
  if (!parsed || typeof parsed.isMeal !== "boolean") return null;
  return sanitizeMealDetection(parsed, learnedPriorMap);
}

// ---------------------------------------------------------------------------
// LLM explanation schema (analysis text only — scores come from engine)
// ---------------------------------------------------------------------------

const ANALYSIS_JSON_SCHEMA = `Respond with exactly one JSON object, no markdown or extra text. You are NOT computing scores — the scores are already calculated. Your job is to explain WHY the product got these scores and give personalized advice. Keys (all required):
summary (string, 1-2 sentence overview of how this product affects gut health),
tips (array of 2-3 actionable strings specific to THIS product),
skin (string, how this product affects skin and why),
digestion (string, how this product affects digestion and why),
mood (string, how this product affects energy/mood and why),
bloatDetails (object: expectedTime string e.g. "2-3 hours", tip string with a specific actionable tip),
impactDetails (object: skin object {description string, learnMore {title string, content string, sensitivity string}}, bloating object {description string, learnMore {title string, content string, timing string}}, digestion object {description string, learnMore {title string, content string}}, energy object {description string, learnMore {title string, content string}}),
goalPrediction (object: forecast array of {time string, risk string, description string}, improvements array of {action string, newScore string, impact string}),
personalizedInsights (array of 3 objects: type "trigger"|"quick_win"|"pattern"|"great_choice"|"warning", title string, detail string, tip string optional, stat string optional, swap object optional {from string, to string, scoreChange string}),
ingredientAnalysis (object: items array of {displayName string, impact string "negative"|"moderate"|"positive", whyMatters string}, redCount number, yellowCount number, greenCount number).
Output valid JSON only: no trailing commas, no unescaped newlines inside string values.`;

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

function extractJsonFromText(text: string): string {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return trimmed;
  return trimmed.slice(start, end + 1);
}

function repairJson(jsonStr: string): string {
  let out = jsonStr;
  out = out.replace(/,(\s*[}\]])/g, "$1");
  out = out.replace(/,(\s*),/g, ",");
  let i = 0;
  let result = "";
  while (i < out.length) {
    if (out[i] === '"') {
      result += '"';
      i++;
      while (i < out.length) {
        if (out[i] === "\\") {
          result += out[i] + (out[i + 1] ?? "");
          i += 2;
          continue;
        }
        if (out[i] === '"') { result += '"'; i++; break; }
        if (out[i] === "\n") { result += "\\n"; i++; continue; }
        if (out[i] === "\r") {
          result += out[i + 1] === "\n" ? "\\r\\n" : "\\r";
          i += out[i + 1] === "\n" ? 2 : 1;
          continue;
        }
        result += out[i];
        i++;
      }
      continue;
    }
    result += out[i];
    i++;
  }
  return result.length ? result : out;
}

function safeParse<T>(text: string): T | null {
  const jsonStr = extractJsonFromText(text);
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    try {
      return JSON.parse(repairJson(jsonStr)) as T;
    } catch {
      return null;
    }
  }
}

/**
 * Smart ingredient parser that splits an ingredient string into individual
 * ingredients, respecting brackets (parentheses and square brackets) so that
 * sub-ingredients listed inside brackets stay together with their parent.
 *
 * Handles:
 * - Comma, semicolon, newline separators
 * - Period separators (only when NOT preceded by a digit — avoids splitting "1. Corn")
 * - Nested parentheses: Vegetable Oil (Corn, Canola, and/or Sunflower Oil) → single item
 * - Square brackets: Artificial Color [Red 40 Lake, Yellow 6] → single item
 * - Numbered list prefixes ("1.", "2)", "3 -") are stripped from results
 * - Whitespace normalization
 */
function splitIngredientsRespectingParens(raw: string): string[] {
  // Normalize CRLF / multiple spaces
  const normalized = raw.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!normalized) return [];

  const parts: string[] = [];
  let depth = 0; // bracket nesting depth (handles both () and [])
  let current = "";

  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];

    // Track bracket depth — both () and []
    if (c === "(" || c === "[") {
      depth++;
      current += c;
      continue;
    }
    if (c === ")" || c === "]") {
      depth = Math.max(0, depth - 1); // guard against unbalanced brackets
      current += c;
      continue;
    }

    // Inside brackets — everything stays together
    if (depth > 0) {
      current += c;
      continue;
    }

    // Period separator: only when NOT preceded by a digit (avoids "1." numbered lists)
    const isPeriodSep =
      c === "." &&
      (i + 1 >= normalized.length || " \t\n".includes(normalized[i + 1])) &&
      !(i > 0 && /\d/.test(normalized[i - 1]));

    if (c === "," || c === ";" || c === "\n" || isPeriodSep) {
      const trimmed = current.trim();
      if (trimmed) parts.push(trimmed);
      current = "";
      // Skip whitespace after separator
      while (i + 1 < normalized.length && (normalized[i + 1] === " " || normalized[i + 1] === "\t")) i++;
    } else {
      current += c;
    }
  }

  // Push final segment
  const trimmed = current.trim();
  if (trimmed) parts.push(trimmed);

  // Post-process: strip numbered prefixes like "1.", "2)", "3 -", etc.
  return parts
    .map((p) => p.replace(/^\d+[\.\)\-:]\s*/, "").trim())
    .filter(Boolean);
}

function normalizeIngredientKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(and|or)\b/g, " ")
    .replace(/[^a-z0-9%\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeIngredientList(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = normalizeIngredientKey(item);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}

// ---------------------------------------------------------------------------
// Groq API
// ---------------------------------------------------------------------------

type GroqMessage =
  | { role: "system"; content: string }
  | {
      role: "user";
      content:
        | string
        | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
    };

async function callGroqRaw(
  messages: GroqMessage[],
  model: string,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error(
      "EXPO_PUBLIC_GROQ_API_KEY is not set. Add it to your .env file. Get a free key at https://console.groq.com"
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: 2048, temperature: 0.1 }),
      signal: controller.signal,
    });
  } catch (fetchErr) {
    clearTimeout(timeout);
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    if (msg.includes("aborted")) throw new Error("Request timed out. Try again.");
    throw fetchErr;
  } finally {
    clearTimeout(timeout);
  }

  let data: Record<string, unknown>;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new Error(`Groq returned invalid response (status ${res.status}).`);
  }

  if (!res.ok) {
    const errMsg =
      (data?.error as { message?: string })?.message ??
      (data?.error as { code?: string })?.code ??
      JSON.stringify(data);
    throw new Error(`Groq error ${res.status}: ${errMsg}`);
  }

  const text = (
    data?.choices as { message?: { content?: string } }[] | undefined
  )?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from Groq");
  return text;
}

// ---------------------------------------------------------------------------
// Barcode: LLM generates explanations only (product + scores are known)
// ---------------------------------------------------------------------------

function buildProfileContext(profile?: OnboardingProfile | null): string {
  if (!profile) return "";
  return `User profile: Goal="${profile.goal || "none"}", Trigger="${profile.trigger || "none"}", Skin concern="${profile.skinConcern || "none"}", Skin type="${profile.skinType || "none"}", Water intake="${profile.water || "none"}". `;
}

interface AnalysisText {
  summary?: string;
  tips?: string[];
  skin?: string;
  digestion?: string;
  mood?: string;
  bloatDetails?: { expectedTime?: string; tip?: string };
  impactDetails?: ScanResult["analysis"]["impactDetails"];
  goalPrediction?: ScanResult["analysis"]["goalPrediction"];
  personalizedInsights?: ScanResult["analysis"]["personalizedInsights"];
  ingredientAnalysis?: ScanResult["analysis"]["ingredientAnalysis"];
}

async function generateAnalysisText(
  product: ProductInfo,
  scores: ComputedScores,
  profile?: OnboardingProfile | null
): Promise<AnalysisText> {
  const ctx = buildProfileContext(profile);

  const productDesc = [
    `Product: ${product.name}`,
    product.brand ? `Brand: ${product.brand}` : "",
    product.ingredients ? `Ingredients: ${product.ingredients}` : "",
    product.categories ? `Categories: ${product.categories}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const nutritionDesc = Object.entries(product.nutrition)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const scoresDesc = `Bloat score: ${scores.bloat_score}/100 (lower=less bloating), Skin: ${scores.skin_score}/10, Energy: ${scores.energy_score}/10, Digestion: ${scores.digestion_score}/10, Overall gut: ${scores.gut_score}/100`;

  // Analyze ingredients for detailed classification
  let ingredientAnalysis: IngredientAnalysisResult | null = null;
  if (product.ingredients) {
    try {
      const ingredientList = dedupeIngredientList(splitIngredientsRespectingParens(product.ingredients));
      ingredientAnalysis = await analyzeIngredients(ingredientList, product.name, profile);
    } catch (error) {
      console.warn("[ingredient-analysis] Failed to analyze ingredients:", error);
    }
  }

  const system = `You are a gut-health and wellness assistant. The product and scores are already determined — do NOT change them. Your job is to explain WHY the product received these scores and give personalized, actionable advice. ${ctx}${ANALYSIS_JSON_SCHEMA}`;

  const userText = `${productDesc}\nNutrition per 100g: ${nutritionDesc || "not available"}\nComputed scores: ${scoresDesc}\n\nExplain why this product got these scores. Be specific about which ingredients or nutritional values drive each score. All tips and insights must be specific to "${product.name}", not generic.`;

  const raw = await callGroqRaw(
    [
      { role: "system", content: system },
      { role: "user", content: userText },
    ],
    GROQ_TEXT_MODEL
  );

  const analysisText = safeParse<AnalysisText>(raw) ?? { summary: `${product.name} analysis completed.`, tips: [] };
  
  // Use our dedicated ingredient analysis if available, otherwise use LLM's attempt
  if (ingredientAnalysis) {
    analysisText.ingredientAnalysis = ingredientAnalysis;
  }
  
  return analysisText;
}

// ---------------------------------------------------------------------------
// Photo: vision only to get product name, then same pipeline as barcode (DB + scores + LLM text)
// ---------------------------------------------------------------------------

/** Vision result with optional nutrition/ingredients extracted from the image. */
interface VisionProductResult {
  product_name: string;
  brand?: string;
  ingredients?: string;
  /** Serving size in grams as stated on the label (used to convert per-serving → per-100g). */
  serving_size_g?: number;
  /** Serving size as displayed on label (e.g. "1 pack (85g)", "1 cup (240ml)"). */
  serving_size_display?: string;
  /** Servings per container if shown on label. */
  servings_per_container?: number;
  /** Nutrition values as read from the label (per serving). */
  nutrition?: {
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
    sugar_g?: number;
    sodium_mg?: number;
    saturated_fat_g?: number;
  };
}

/** Vision call: identify product name, brand, and extract nutrition/ingredients if visible. */
async function getProductInfoFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<VisionProductResult> {
  const imageUrl = `data:${mimeType};base64,${imageBase64}`;
  const raw = await callGroqRaw(
    [
      {
        role: "system",
        content:
          `You are a food product identifier and nutrition reader. Look at the image carefully and extract EVERYTHING visible. Reply with ONLY a JSON object, no other text. Keys (all required in the JSON; use "" or null only when truly not visible):
product_name (string, the full product name as shown on package, e.g. "Lay's Classic Potato Chips". Required; use "" only if unreadable),
brand (string, brand name if visible, else ""),
ingredients (string, the COMPLETE ingredients list as printed on the label, in order. Copy the full text. Use "" only if the label has no ingredients. This is critical for the app),
serving_size_g (number: serving size in grams. If label says "per 100g" or "per 100ml" use 100. If "Serving Size 1 pack (85g)" use 85. If "1 cup (240ml)" use 240. If not shown, use null),
serving_size_display (string: exact serving size as shown on label, e.g. "1 pack (85g)", "1 cup (240ml)", "100g". Use "" if not visible),
servings_per_container (number: how many servings per container if stated, e.g. 2, 6. Use null if not on label),
nutrition (object with number values PER SERVING as printed: calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g. Extract every value that appears; use null only for missing fields. This is critical for scoring).
Always extract ingredients and nutrition when they appear on the package. If you cannot identify the product at all, set product_name to "".`,
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract all product info from this image: product name, brand, full ingredients list, serving size in grams, serving_size_display (exact text from label), servings_per_container (number if shown), and all nutrition facts (per serving). Reply with only the JSON object. Include ingredients and nutrition whenever they are visible on the package." },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    GROQ_VISION_MODEL,
  );
  const parsed = safeParse<{
    product_name?: string;
    brand?: string;
    ingredients?: string;
    serving_size_g?: unknown;
    serving_size_display?: string;
    servings_per_container?: unknown;
    nutrition?: Record<string, unknown>;
  }>(raw);

  const product_name = (parsed?.product_name ?? "").trim();
  const brand = (parsed?.brand ?? "").trim() || undefined;

  // Extract serving size
  const rawServing = parsed?.serving_size_g;
  const serving_size_g = ((): number | undefined => {
    if (rawServing == null) return undefined;
    const n = typeof rawServing === "number" ? rawServing : parseFloat(String(rawServing));
    return isFinite(n) && n > 0 ? n : undefined;
  })();
  // Handle ingredients as string or array
  const rawIngredients = parsed?.ingredients;
  const ingredients = (
    typeof rawIngredients === "string"
      ? rawIngredients.trim()
      : Array.isArray(rawIngredients)
        ? (rawIngredients as string[]).map(s => String(s).trim()).filter(Boolean).join(", ")
        : ""
  ) || undefined;

  // Parse nutrition — only keep valid numbers, handle alternate LLM key names
  const toNum = (v: unknown): number | undefined => {
    if (v == null) return undefined;
    const n = typeof v === "number" ? v : parseFloat(String(v));
    return isFinite(n) ? n : undefined;
  };
  const pick = (obj: Record<string, unknown>, ...keys: string[]): number | undefined => {
    for (const k of keys) {
      const v = toNum(obj[k]);
      if (v !== undefined) return v;
    }
    return undefined;
  };
  const rawNut: Record<string, unknown> | undefined =
    parsed?.nutrition && typeof parsed.nutrition === "object" ? (parsed.nutrition as Record<string, unknown>) : undefined;
  const nutrition = rawNut
    ? {
        calories: pick(rawNut, "calories", "energy_kcal", "kcal", "energy"),
        protein_g: pick(rawNut, "protein_g", "protein", "proteins"),
        carbs_g: pick(rawNut, "carbs_g", "carbs", "carbohydrates_g", "carbohydrates", "total_carbs", "total_carbohydrates"),
        fat_g: pick(rawNut, "fat_g", "fat", "total_fat", "total_fat_g", "fats"),
        fiber_g: pick(rawNut, "fiber_g", "fiber", "dietary_fiber", "dietary_fiber_g"),
        sugar_g: pick(rawNut, "sugar_g", "sugar", "sugars", "sugars_g", "total_sugar", "total_sugars"),
        sodium_mg: pick(rawNut, "sodium_mg", "sodium"),
        saturated_fat_g: pick(rawNut, "saturated_fat_g", "saturated_fat", "sat_fat", "sat_fat_g"),
      }
    : undefined;

  // Validate extracted nutrition values for reasonableness
  if (nutrition) {
    // Check for potential unit confusion (kJ vs kcal)
    if (nutrition.calories && nutrition.calories > 5000) {
      console.warn("[vision] Very high calorie value detected, possible kJ/kcal confusion:", nutrition.calories);
      // If it looks like kJ, convert to kcal
      if (nutrition.calories > 10000) {
        nutrition.calories = Math.round(nutrition.calories / 4.184);
        console.warn("[vision] Converted from kJ to kcal:", nutrition.calories);
      }
    }
    
    // Cap other extreme values
    if (nutrition.protein_g && nutrition.protein_g > 200) nutrition.protein_g = 200;
    if (nutrition.carbs_g && nutrition.carbs_g > 200) nutrition.carbs_g = 200;
    if (nutrition.fat_g && nutrition.fat_g > 200) nutrition.fat_g = 200;
    if (nutrition.sodium_mg && nutrition.sodium_mg > 10000) nutrition.sodium_mg = 10000;
  }

  const serving_size_display = (parsed?.serving_size_display != null && typeof parsed.serving_size_display === "string")
    ? parsed.serving_size_display.trim() || undefined
    : undefined;
  const rawServings = parsed?.servings_per_container;
  const servings_per_container =
    rawServings != null && typeof rawServings === "number" && isFinite(rawServings) && rawServings > 0
      ? rawServings
      : typeof rawServings === "string"
        ? (() => { const n = parseFloat(rawServings); return isFinite(n) && n > 0 ? n : undefined; })()
        : undefined;

  console.log("[vision] extracted →", {
    product_name,
    brand,
    serving_size_g,
    serving_size_display,
    servings_per_container,
    hasIngredients: !!ingredients,
    ingredientsLen: ingredients?.length ?? 0,
    nutritionKeys: nutrition ? Object.entries(nutrition).filter(([, v]) => v !== undefined).map(([k]) => k) : [],
  });

  return { product_name, brand, ingredients, serving_size_g, serving_size_display, servings_per_container, nutrition };
}

// ---------------------------------------------------------------------------
// Meal Detection: Quick classification and ingredient detection
// ---------------------------------------------------------------------------
  
/** Quick meal vs product detection with confidence scoring */
async function quickMealDetection(
  imageBase64: string,
  mimeType: string,
  learnedPriors?: AnalyzeScanRequest["learnedPortionPriors"],
  visualPriors?: AnalyzeScanRequest["visualPortionPriors"],
  cameraMetadata?: CameraCaptureMetadata,
  onStageUpdate?: (update: PhotoAnalysisStageUpdate) => void,
): Promise<MealDetectionResult> {
  const learnedPriorMap = buildLearnedPriorMap(learnedPriors);
  const visualPriorMap = buildVisualPriorMap(visualPriors);
  const imageUrl = `data:${mimeType};base64,${imageBase64}`;
  onStageUpdate?.({ stage: "detect", progress: 16, message: "Detecting ingredients" });
  const raw = await callGroqRaw(
    [
      {
        role: "system",
        content: `You are a food detection expert. Quickly analyze this image and determine if it's a meal (multiple ingredients) or a packaged product. Be precise and confident. Reply with ONLY a JSON object, no other text.

Keys (all required):
isMeal (boolean: true if this contains multiple ingredients or is a prepared dish, false if it's a single packaged product),
confidence (number: 0.0-1.0 your confidence in the classification),
ingredients (array of objects: name string, state "raw"|"cooked"|"processed", cookingMethod "grilled"|"fried"|"boiled"|"roasted"|"steamed"|"baked"|"sautéed"|"raw" or null, confidence 0.0-1.0, boundingBox {x,y,width,height}, itemCount number, estimatedGrams number),
cookingMethods (array of detected cooking methods),
portionEstimates (array of objects: ingredientName string, estimatedGrams number, confidence 0.0-1.0, visualReference string describing your portion analysis like "8 cherry tomatoes, small-medium size, ~5g each" or "chicken breast, palm-sized portion, ~120g"),
totalEstimatedCalories (number|null).

Rules:
- For meals, capture all visible components including toppings, dressings, and sauces.
- Count individual items when possible (e.g., "8 cherry tomatoes" not just "tomatoes").
- Estimate grams for each ingredient based on your visual analysis of size, quantity, and typical density.
- Avoid generic ingredient names like "greens"; prefer specific labels (e.g., "arugula", "spinach", "lettuce").
- Every ingredient must include estimatedGrams based on visual analysis.
- Provide detailed visual references that explain your reasoning (size, quantity, comparison).
- Include small components like red onion, tomatoes, cucumber, balsamic vinegar, and yogurt-based sauces if visible.
- Use boundingBox to accurately trace each ingredient's visible area.
- itemCount should reflect how many separate pieces you can count.

Focus on visual accuracy for portion estimation. Set confidence below 0.75 if uncertain about any detection or portion estimate.`,
      },
      {
        role: "user",
        content: [
          { 
            type: "text", 
            text: "Analyze this food image: Is it a meal with multiple ingredients or a packaged product? Identify all visible ingredients, their cooking state, methods, and estimate portions. Do not collapse ingredients into vague groups; list each visible ingredient separately. Reply with only the JSON object." 
          },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    GROQ_VISION_MODEL,
    QUICK_MEAL_DETECTION_TIMEOUT_MS,
  );

  const parsed = safeParse<MealDetectionResult>(raw);
  if (!parsed || typeof parsed.isMeal !== "boolean") {
    console.warn("[meal-detection] Invalid response, using editable fallback meal detection");
    return createFallbackMealDetection(learnedPriorMap);
  }

  let sanitized = sanitizeMealDetection(parsed, learnedPriorMap);
  if (sanitized.isMeal) {
    try {
      onStageUpdate?.({ stage: "analyze", progress: 32, message: "Analyzing ingredient detail" });
      const stageResults = await Promise.allSettled([
        refineMealDetection(imageBase64, mimeType, sanitized, learnedPriorMap, "macro"),
        refineMealDetection(imageBase64, mimeType, sanitized, learnedPriorMap, "micro"),
        refineMealDetection(imageBase64, mimeType, sanitized, learnedPriorMap, "trace"),
      ]);

      let merged = sanitized;
      for (const stage of stageResults) {
        if (stage.status !== "fulfilled" || !stage.value) continue;
        merged = mergeMealDetectionResults(merged, stage.value, learnedPriorMap);
      }

      if (scoreMealDetectionCoverage(merged) >= scoreMealDetectionCoverage(sanitized)) {
        sanitized = merged;
      }

      onStageUpdate?.({ stage: "portion", progress: 58, message: "Calibrating portions" });
      sanitized = applyMetadataAwarePortionCalibration(
        sanitized,
        learnedPriorMap,
        visualPriorMap,
        cameraMetadata,
      );

      onStageUpdate?.({ stage: "validate", progress: 70, message: "Validating meal components" });
      sanitized = validateMealDetectionResult(sanitized, learnedPriorMap);
    } catch (refineErr) {
      const msg = refineErr instanceof Error ? refineErr.message : String(refineErr);
      if (!isQuotaError(msg)) {
        console.warn("[meal-detection] Refinement pass failed, using quick result:", msg);
      }
    }
  }

  console.log("[meal-detection] Quick result:", {
    isMeal: sanitized.isMeal,
    confidence: sanitized.confidence,
    ingredientCount: sanitized.ingredients?.length ?? 0,
    cookingMethods: sanitized.cookingMethods?.length ?? 0,
  });

  return sanitized;
}

/** Determine if scan should be treated as meal vs product */
function classifyScanType(
  mealDetection: MealDetectionResult,
  barcode?: string
): "meal" | "product" {
  // Priority 1: Barcode exists → Product (but still analyze for combination foods)
  if (barcode) {
    return "product";
  }

  // Priority 2: Meal detection with lower confidence gate for smoother UX
  if (mealDetection.isMeal && 
      mealDetection.confidence >= CONFIDENCE_THRESHOLD &&
      mealDetection.ingredients.length >= 1) {
    return "meal";
  }

  // Priority 3: Low confidence or single ingredient → Product
  return "product";
}

/** Generate cooking analysis from detected methods */
function generateCookingAnalysis(
  cookingMethods: CookingMethod[]
): CookingAnalysis {
  const healthyMethods: CookingMethod[] = ["steamed", "boiled", "roasted", "baked", "raw"];
  const lessHealthyMethods: CookingMethod[] = ["fried", "sautéed"];
  
  const healthyCount = cookingMethods.filter(m => healthyMethods.includes(m)).length;
  const unhealthyCount = cookingMethods.filter(m => lessHealthyMethods.includes(m)).length;

  let overallHealthImpact: "positive" | "neutral" | "negative" = "neutral";
  let recommendations: string[] = [];

  if (healthyCount > unhealthyCount) {
    overallHealthImpact = "positive";
    recommendations = ["Great choice of cooking methods! These preserve nutrients and are gentler on digestion."];
  } else if (unhealthyCount > healthyCount) {
    overallHealthImpact = "negative";
    recommendations = ["Consider healthier cooking methods like steaming or roasting to reduce gut inflammation."];
  } else {
    overallHealthImpact = "neutral";
    recommendations = ["Mix of cooking methods. Balance with plenty of vegetables and fiber."];
  }

  return {
    methods: cookingMethods,
    overallHealthImpact,
    recommendations,
    temperatureImpact: cookingMethods.includes("fried") || cookingMethods.includes("grilled") 
      ? "High-heat cooking can create compounds that may irritate the gut for sensitive individuals."
      : "Gentle cooking temperatures preserve nutrients and are easier to digest."
  };
}

/** Create portion adjustment options for user confirmation */
function createPortionAdjustments(
  mealDetection: MealDetectionResult
): PortionAdjustment[] {
  return mealDetection.portionEstimates.map((estimate: PortionEstimate) => ({
    ingredientName: estimate.ingredientName,
    currentGrams: estimate.estimatedGrams,
    minGrams: Math.max(MIN_INGREDIENT_GRAMS, Math.round(estimate.estimatedGrams * 0.5)),
    maxGrams: Math.round(estimate.estimatedGrams * 2),
    suggestedGrams: estimate.estimatedGrams,
    visualReference: estimate.visualReference || "standard serving",
  }));
}

function isLikelyCommercialIngredient(
  name: string,
  state?: DetectedIngredient["state"],
  cookingMethod?: DetectedIngredient["cookingMethod"],
): boolean {
  const n = name.toLowerCase().trim();

  const strongCommercial = [
    "burger", "pizza", "fries", "nugget", "hot dog", "hotdog", "ramen", "instant noodle",
    "noodle cup", "mac and cheese", "milkshake", "soda", "soft drink", "energy drink",
    "chips", "cookie", "cracker", "pastry", "cake", "brownie", "donut", "muffin",
    "ketchup", "mayo", "mayonnaise", "ranch", "dressing", "bbq sauce", "hot sauce",
    "processed cheese", "cheese sauce",
  ];

  const strongWholeFood = [
    "apple", "banana", "orange", "mango", "berry", "grape", "broccoli", "spinach",
    "kale", "lettuce", "cucumber", "tomato", "onion", "carrot", "pepper", "potato",
    "rice", "quinoa", "lentil", "beans", "chicken breast", "salmon", "egg", "avocado",
  ];

  let score = 0;

  if (state === "processed") score += 3;
  if (state === "raw") score -= 2;
  if (cookingMethod === "fried") score += 1;

  if (/\b(brand|signature|combo|meal deal|flavor|flavoured|pack|packet|instant|ready|frozen)\b/.test(n)) {
    score += 2;
  }

  if (/\b(fresh|homemade|home-made|plain|raw)\b/.test(n)) {
    score -= 1;
  }

  if (strongCommercial.some((token) => n.includes(token))) score += 3;
  if (strongWholeFood.some((token) => n.includes(token))) score -= 2;

  if (/\b\d+\s*(mg|g|oz|ml)\b/.test(n)) score += 1;

  return score >= 2;
}

function estimateIngredientNutritionFallback(ingredient: DetectedIngredient, grams: number): ScanNutrition {
  const factor = Math.max(10, grams) / 100;
  const n = ingredient.name.toLowerCase();
  const base = {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: 0,
    sugar_g: 0,
    sodium_mg: 0,
    saturated_fat_g: 0,
  };

  if (/(chicken|beef|pork|lamb|turkey|fish|salmon|tuna|egg)/.test(n)) {
    base.calories = 220 * factor;
    base.protein_g = 24 * factor;
    base.fat_g = 10 * factor;
    base.sodium_mg = 80 * factor;
  } else if (/(beans|lentil|chickpea|black bean|kidney bean|garbanzo)/.test(n)) {
    base.calories = 145 * factor;
    base.carbs_g = 25 * factor;
    base.protein_g = 9 * factor;
    base.fiber_g = 8 * factor;
    base.sugar_g = 2 * factor;
    base.sodium_mg = 15 * factor;
  } else if (/(wrap|tortilla|flatbread)/.test(n)) {
    base.calories = 310 * factor;
    base.carbs_g = 52 * factor;
    base.protein_g = 8 * factor;
    base.fat_g = 8 * factor;
    base.fiber_g = 6 * factor;
    base.sugar_g = 2 * factor;
    base.sodium_mg = 520 * factor;
  } else if (/(hummus|tahini|dressing|sauce|mayo|mayonnaise)/.test(n)) {
    base.calories = 260 * factor;
    base.carbs_g = 11 * factor;
    base.protein_g = 6 * factor;
    base.fat_g = 20 * factor;
    base.fiber_g = 3 * factor;
    base.sugar_g = 2.5 * factor;
    base.sodium_mg = 420 * factor;
  } else if (/(rice|bread|pasta|noodle|potato|tortilla)/.test(n)) {
    base.calories = 150 * factor;
    base.carbs_g = 30 * factor;
    base.protein_g = 3 * factor;
    base.fiber_g = 1.5 * factor;
    base.sugar_g = 1 * factor;
    base.sodium_mg = 120 * factor;
  } else if (/(avocado|olive|oil|butter|cheese|cream)/.test(n)) {
    base.calories = 300 * factor;
    base.fat_g = 28 * factor;
    base.saturated_fat_g = 8 * factor;
    base.sodium_mg = 180 * factor;
    base.carbs_g = 3 * factor;
  } else if (/(broccoli|spinach|kale|lettuce|cucumber|tomato|pepper|onion|carrot|vegetable)/.test(n)) {
    base.calories = 35 * factor;
    base.carbs_g = 6 * factor;
    base.fiber_g = 2.5 * factor;
    base.protein_g = 2 * factor;
    base.sodium_mg = 30 * factor;
    base.sugar_g = 3 * factor;
  } else if (/(apple|banana|berry|fruit|orange|grape|mango|pineapple)/.test(n)) {
    base.calories = 65 * factor;
    base.carbs_g = 16 * factor;
    base.fiber_g = 2 * factor;
    base.sugar_g = 12 * factor;
    base.sodium_mg = 5 * factor;
  } else {
    base.calories = 120 * factor;
    base.carbs_g = 12 * factor;
    base.protein_g = 4 * factor;
    base.fat_g = 4 * factor;
    base.fiber_g = 1.5 * factor;
    base.sugar_g = 3 * factor;
    base.sodium_mg = 90 * factor;
  }

  if (ingredient.cookingMethod === "fried") {
    base.calories += 40 * factor;
    base.fat_g += 4 * factor;
    base.saturated_fat_g += 1 * factor;
    base.sodium_mg += 60 * factor;
  }

  return base;
}

async function getOffIngredientNutrition(name: string): Promise<ScanNutrition | null> {
  const candidates = await withTimeout(
    searchOFFByTerm(name, 3).catch(() => []),
    OFF_INGREDIENT_LOOKUP_TIMEOUT_MS,
  );
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const hit = candidates.find((candidate) => !!candidate.nutrition) ?? candidates[0];
  if (!hit?.nutrition) return null;
  return {
    calories: hit.nutrition.calories,
    protein_g: hit.nutrition.protein_g,
    carbs_g: hit.nutrition.carbs_g,
    fat_g: hit.nutrition.fat_g,
    fiber_g: hit.nutrition.fiber_g,
    sugar_g: hit.nutrition.sugar_g,
    sodium_mg: hit.nutrition.sodium_mg,
    saturated_fat_g: hit.nutrition.saturated_fat_g,
  };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  try {
    return await Promise.race<T | null>([
      promise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ]);
  } catch {
    return null;
  }
}

/** Calculate meal nutrition using USDA/Nutritionix with resilient fallbacks. */
async function calculateMealNutrition(
  ingredients: DetectedIngredient[],
  portions: PortionEstimate[]
): Promise<ScanNutrition> {
  const total = {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: 0,
    sugar_g: 0,
    sodium_mg: 0,
    saturated_fat_g: 0,
  };

  const normalizedPortions = portions.map((p) => ({
    ...p,
    _key: p.ingredientName.toLowerCase().trim(),
  }));

  const perIngredientNutrition = await Promise.all(
    ingredients.map(async (ingredient): Promise<ScanNutrition> => {
      const portion = normalizedPortions.find((p) => p._key === ingredient.name.toLowerCase().trim());
      const grams = Math.max(MIN_INGREDIENT_GRAMS, portion?.estimatedGrams ?? ingredient.estimatedGrams ?? 100);
      const factor = grams / 100;
      const preferCommercial = isLikelyCommercialIngredient(
        ingredient.name,
        ingredient.state,
        ingredient.cookingMethod,
      );

      let usda: USDANutrition | null = null;
      let nutritionix: NutritionixNutrition | null = null;
      const lookupName = ingredient.cookingMethod
        ? `${ingredient.cookingMethod} ${ingredient.name}`
        : ingredient.name;

      if (preferCommercial) {
        nutritionix = await withTimeout(
          getCommercialFoodNutrition(lookupName),
          INGREDIENT_LOOKUP_TIMEOUT_MS
        );
        if (!nutritionix) {
          usda = await withTimeout(
            getIngredientNutrition(ingredient.name, ingredient.state),
            INGREDIENT_LOOKUP_TIMEOUT_MS
          );
        }
      } else {
        usda = await withTimeout(
          getIngredientNutrition(ingredient.name, ingredient.state),
          INGREDIENT_LOOKUP_TIMEOUT_MS
        );
        if (!usda) {
          nutritionix = await withTimeout(
            getCommercialFoodNutrition(lookupName),
            INGREDIENT_LOOKUP_TIMEOUT_MS
          );
        }
      }

      const offNutrition = !usda && !nutritionix
        ? await getOffIngredientNutrition(ingredient.name)
        : null;
      const sourceNutrition = usda ?? nutritionix ?? offNutrition;
      if (!sourceNutrition) {
        return estimateIngredientNutritionFallback(ingredient, grams);
      }

      const scaled: ScanNutrition = {
        calories: (sourceNutrition.calories || 0) * factor,
        protein_g: (sourceNutrition.protein_g || 0) * factor,
        carbs_g: (sourceNutrition.carbs_g || 0) * factor,
        fat_g: (sourceNutrition.fat_g || 0) * factor,
        fiber_g: (sourceNutrition.fiber_g || 0) * factor,
        sugar_g: (sourceNutrition.sugar_g || 0) * factor,
        sodium_mg: (sourceNutrition.sodium_mg || 0) * factor,
        saturated_fat_g: (sourceNutrition.saturated_fat_g || 0) * factor,
      };

      if (ingredient.cookingMethod === "fried") {
        scaled.calories = (scaled.calories || 0) + 40 * factor;
        scaled.fat_g = (scaled.fat_g || 0) + 4 * factor;
        scaled.saturated_fat_g = (scaled.saturated_fat_g || 0) + 1 * factor;
        scaled.sodium_mg = (scaled.sodium_mg || 0) + 60 * factor;
      }

      return scaled;
    })
  );

  for (const n of perIngredientNutrition) {
    total.calories += n.calories || 0;
    total.protein_g += n.protein_g || 0;
    total.carbs_g += n.carbs_g || 0;
    total.fat_g += n.fat_g || 0;
    total.fiber_g += n.fiber_g || 0;
    total.sugar_g += n.sugar_g || 0;
    total.sodium_mg += n.sodium_mg || 0;
    total.saturated_fat_g += n.saturated_fat_g || 0;
  }

  return {
    calories: Math.round(total.calories),
    protein_g: +total.protein_g.toFixed(1),
    carbs_g: +total.carbs_g.toFixed(1),
    fat_g: +total.fat_g.toFixed(1),
    fiber_g: +total.fiber_g.toFixed(1),
    sugar_g: +total.sugar_g.toFixed(1),
    sodium_mg: Math.round(total.sodium_mg),
    saturated_fat_g: +total.saturated_fat_g.toFixed(1),
  };
}

// ---------------------------------------------------------------------------
// Meal and Product Processing Functions
// ---------------------------------------------------------------------------

/** Process meal scan with full ingredient analysis */
async function processMealScan(
  imageBase64: string,
  mimeType: string,
  mealDetection: MealDetectionResult,
  profile?: OnboardingProfile | null,
  onQuickResult?: (result: ScanResult) => void
): Promise<ScanResult> {
  console.log("[meal-scan] Processing meal with", mealDetection.ingredients.length, "ingredients");
  const heuristicMealTitle = buildMealName(mealDetection);
  const aiMealTitle =
    heuristicMealTitle.startsWith("Custom Meal") || heuristicMealTitle === "Mixed Salad"
      ? await generateMealNameWithAI(mealDetection)
      : null;
  const mealTitle = aiMealTitle ?? heuristicMealTitle;

  // Calculate combined nutrition for all ingredients (now async)
  const mealNutrition = await calculateMealNutrition(mealDetection.ingredients, mealDetection.portionEstimates);
  
  // Generate cooking analysis
  const cookingAnalysis = generateCookingAnalysis(mealDetection.cookingMethods);
  
  // Create portion adjustments for user confirmation
  const portionAdjustments = createPortionAdjustments(mealDetection);
  const ingredientAnalysis = buildMealIngredientAnalysis(mealDetection);

  // Create meal components for detailed analysis
  const mealComponents: MealComponent[] = mealDetection.ingredients.map((ingredient, index) => {
    const portion = mealDetection.portionEstimates.find(p => p.ingredientName === ingredient.name);
    return {
      ingredient,
      portion: portion || {
        ingredientName: ingredient.name,
        estimatedGrams: ingredient.estimatedGrams || 100,
        confidence: ingredient.confidence,
      },
      nutrition: {}, // TODO: Calculate individual ingredient nutrition
      gutImpact: {
        bloatRisk: 50, // TODO: Calculate based on ingredient properties
        skinImpact: 5,
        energyImpact: 5,
        digestionImpact: 5,
      },
    };
  });

  // Create a synthetic product for scoring
  const syntheticProduct: ProductInfo = {
    name: mealTitle,
    brand: "Homemade",
    barcode: "",
    imageUrl: undefined,
    ingredients: mealDetection.ingredients.map(i => i.name).join(", "),
    categories: "meal",
    nutrition: mealNutrition,
    source: "openfoodfacts", // Use existing source type for custom meals
  };

  // Calculate scores for the entire meal
  const scores = computeScores(syntheticProduct, profile);

  // Build quick result for immediate UI feedback
  const quickResult: ScanResult = {
    scan_type: "photo",
    food_name: mealTitle,
    product_name: mealTitle,
    manufacturer: "Homemade",
    identified_foods: mealDetection.ingredients.map(i => i.name),
    gut_score: scores.gut_score,
    bloat_score: scores.bloat_score,
    skin_score: scores.skin_score,
    energy_score: scores.energy_score,
    digestion_score: scores.digestion_score,
    confidence: scores.confidence,
    analysis: {
      summary: `${mealTitle} with ${mealDetection.ingredients.length} detected ingredients. ${cookingAnalysis.recommendations[0]}`,
      tips: cookingAnalysis.recommendations,
      ingredientAnalysis,
    },
    nutrition: mealNutrition,
    isMeal: true,
    mealComponents,
    cookingAnalysis,
    portionAdjustments,
    ingredientConfirmations: {},
  };

  // Show quick result immediately
  if (onQuickResult) onQuickResult(quickResult);

  // Generate detailed LLM analysis for the meal
  let analysis: AnalysisText = {
    summary: quickResult.analysis.summary,
    tips: quickResult.analysis.tips || [],
  };

  try {
    analysis = await generateMealAnalysisText(mealDetection, scores, profile);
  } catch (llmErr) {
    const msg = llmErr instanceof Error ? llmErr.message : String(llmErr);
    if (!isQuotaError(msg)) {
      console.warn("[meal-scan] LLM analysis failed, using defaults:", msg);
    }
  }

  // Return enhanced result with detailed analysis
  return {
    ...quickResult,
    analysis: {
      summary: analysis.summary ?? quickResult.analysis.summary,
      tips: analysis.tips ?? [],
      skin: analysis.skin,
      digestion: analysis.digestion,
      mood: analysis.mood,
      bloatDetails: analysis.bloatDetails,
      impactDetails: analysis.impactDetails,
      goalPrediction: analysis.goalPrediction,
      personalizedInsights: analysis.personalizedInsights,
      ingredientAnalysis: analysis.ingredientAnalysis ?? quickResult.analysis.ingredientAnalysis,
    },
  };
}

/** Process product photo scan (existing flow enhanced with meal detection context) */
async function processProductPhotoScan(
  imageBase64: string,
  mimeType: string,
  _mealDetection: MealDetectionResult,
  profile?: OnboardingProfile | null,
  onQuickResult?: (result: ScanResult) => void
): Promise<ScanResult> {
  const visionResult = await getProductInfoFromImage(imageBase64, mimeType);
  if (!visionResult.product_name) throw new ProductNotFoundError("photo");

  const visionNut = visionResult.nutrition;
  const servingG = visionResult.serving_size_g;
  
  // Convert per-serving nutrition to per-100g
  const toPer100g = (perServing: number | undefined): number | undefined => {
    if (perServing == null) return undefined;
    if (servingG && servingG > 0) {
      const per100g = (perServing * 100) / servingG;
      if (per100g > 10000) {
        console.warn("[vision] Unusually high nutrition value after conversion:", per100g);
        return undefined;
      }
      return +per100g.toFixed(2);
    }
    if (perServing > 10000) {
      console.warn("[vision] Unusually high nutrition value (no serving size):", perServing);
      return undefined;
    }
    return perServing;
  };

  const visionNutPer100g = visionNut
    ? {
        calories: toPer100g(visionNut.calories),
        protein_g: toPer100g(visionNut.protein_g),
        carbs_g: toPer100g(visionNut.carbs_g),
        fat_g: toPer100g(visionNut.fat_g),
        fiber_g: toPer100g(visionNut.fiber_g),
        sugar_g: toPer100g(visionNut.sugar_g),
        sodium_mg: toPer100g(visionNut.sodium_mg),
        saturated_fat_g: toPer100g(visionNut.saturated_fat_g),
      }
    : undefined;

  if (visionNutPer100g?.calories && visionNutPer100g.calories > 2000) {
    console.warn("[vision] Capping unusually high calories:", visionNutPer100g.calories);
    visionNutPer100g.calories = 2000;
  }

  const parsedVision = (() => {
    const raw = visionResult.ingredients?.trim();
    if (!raw) return undefined;
    const split = splitIngredientsRespectingParens(raw);
    return split.length > 0 ? split : [raw];
  })();

  const bestMatchProduct = await searchProductByName(
    visionResult.product_name,
    visionResult.brand ?? null,
  );

  const visionOnlyProduct: ProductInfo = {
    name: visionResult.product_name,
    brand: visionResult.brand ?? "",
    barcode: "",
    imageUrl: undefined,
    ingredients: visionResult.ingredients ?? undefined,
    categories: undefined,
    nutrition: visionNutPer100g ?? {},
    source: "openfoodfacts",
  };

  const scoringProduct: ProductInfo = bestMatchProduct
    ? {
        ...bestMatchProduct,
        ingredients: bestMatchProduct.ingredients || visionResult.ingredients || undefined,
        nutrition:
          Object.values(bestMatchProduct.nutrition ?? {}).some((v) => typeof v === "number")
            ? bestMatchProduct.nutrition
            : visionNutPer100g ?? bestMatchProduct.nutrition,
      }
    : visionOnlyProduct;

  const scores = computeScores(scoringProduct, profile);

  const parsedIngredients = (() => {
    if (!scoringProduct.ingredients?.trim()) return parsedVision;
    const raw = scoringProduct.ingredients.trim();
    const split = splitIngredientsRespectingParens(raw);
    return split.length > 0 ? split : [raw];
  })();

  const baseResult: ScanResult = {
    scan_type: "photo",
    food_name: scoringProduct.name,
    product_name: scoringProduct.name,
    manufacturer: scoringProduct.brand || undefined,
    identified_foods: [scoringProduct.name],
    gut_score: scores.gut_score,
    bloat_score: scores.bloat_score,
    skin_score: scores.skin_score,
    energy_score: scores.energy_score,
    digestion_score: scores.digestion_score,
    confidence: scores.confidence,
    analysis: {
      summary: `${scoringProduct.name}${scoringProduct.brand ? ` by ${scoringProduct.brand}` : ""}.`,
      tips: [],
      serving_size_display:
        scoringProduct.serving_size_display ?? visionResult.serving_size_display,
      servings_per_container:
        scoringProduct.servings_per_container ?? visionResult.servings_per_container,
    },
    nutrition: scoringProduct.nutrition ?? {},
    image_url: scoringProduct.imageUrl,
    barcode: scoringProduct.barcode || undefined,
    ingredients: parsedIngredients ?? [],
    isMeal: false,
  };

  if (onQuickResult) onQuickResult(baseResult);

  let analysis: AnalysisText = {
    summary: baseResult.analysis.summary,
    tips: [],
  };
  let productInsight: Awaited<ReturnType<typeof buildProductInsight>> | undefined;
  try {
    const [analysisResult, insightResult] = await Promise.all([
      generateAnalysisText(scoringProduct, scores, profile),
      buildProductInsight(scoringProduct, scores, profile, parsedIngredients),
    ]);
    analysis = analysisResult;
    productInsight = insightResult;
  } catch (llmErr) {
    const msg = llmErr instanceof Error ? llmErr.message : String(llmErr);
    if (!isQuotaError(msg)) {
      console.warn("[analyze-scan] Photo product LLM explanation failed, using defaults:", msg);
    }
    try {
      analysis = await generateAnalysisText(scoringProduct, scores, profile);
    } catch {
      /* keep defaults */
    }
    productInsight = await buildProductInsight(scoringProduct, scores, profile, parsedIngredients).catch(
      () => undefined,
    );
  }

  return {
    ...baseResult,
    analysis: {
      summary: analysis.summary ?? baseResult.analysis.summary,
      tips: analysis.tips ?? [],
      skin: analysis.skin,
      digestion: analysis.digestion,
      mood: analysis.mood,
      bloatDetails: analysis.bloatDetails,
      impactDetails: analysis.impactDetails,
      goalPrediction: analysis.goalPrediction,
      personalizedInsights: analysis.personalizedInsights,
      ingredientAnalysis: analysis.ingredientAnalysis,
      productInsight,
      serving_size_display: baseResult.analysis.serving_size_display,
      servings_per_container: baseResult.analysis.servings_per_container,
    },
  };
}

/** Generate LLM analysis specifically for meals */
async function generateMealAnalysisText(
  mealDetection: MealDetectionResult,
  scores: ComputedScores,
  profile?: OnboardingProfile | null
): Promise<AnalysisText> {
  const ctx = buildProfileContext(profile);
  
  const mealDescription = [
    `Meal with ${mealDetection.ingredients.length} ingredients: ${mealDetection.ingredients.map(i => i.name).join(", ")}`,
    `Cooking methods: ${mealDetection.cookingMethods.join(", ") || "none detected"}`,
    `Total estimated calories: ${mealDetection.totalEstimatedCalories || "unknown"}`,
  ].join("\n");

  const scoresDesc = `Bloat score: ${scores.bloat_score}/100, Skin: ${scores.skin_score}/10, Energy: ${scores.energy_score}/10, Digestion: ${scores.digestion_score}/10, Overall gut: ${scores.gut_score}/100`;

  const system = `You are a gut-health and wellness assistant specializing in meal analysis. The meal and scores are already determined — do NOT change them. Your job is to explain WHY this meal received these scores and give personalized, actionable advice. ${ctx}${ANALYSIS_JSON_SCHEMA}`;

  const userText = `${mealDescription}\nComputed scores: ${scoresDesc}\n\nExplain why this meal got these scores. Be specific about which ingredients or cooking methods drive each score. All tips and insights must be specific to this combination of ingredients, not generic.`;

  const raw = await callGroqRaw(
    [
      { role: "system", content: system },
      { role: "user", content: userText },
    ],
    GROQ_TEXT_MODEL
  );

  return safeParse<AnalysisText>(raw) ?? { 
    summary: `Meal analysis completed with ${mealDetection.ingredients.length} ingredients.`, 
    tips: mealDetection.cookingMethods.length > 0 
      ? [`Cooking methods detected: ${mealDetection.cookingMethods.join(", ")}`]
      : ["Consider adding more vegetables for better gut health."]
  };
}

// ---------------------------------------------------------------------------
// Normalize into ScanResult
// ---------------------------------------------------------------------------

function normalizeResult(
  partial: Partial<ScanResult>,
  scanType: "photo" | "barcode",
  extras: Partial<ScanResult>
): ScanResult {
  // LLM/photo often returns bloat 0-100 (lower = less bloating). We use 0-10 (higher = less bloating).
  const bloatRaw = typeof partial.bloat_score === "number" ? Math.min(100, Math.max(0, partial.bloat_score)) : 5;
  const bloat = bloatRaw > 10 ? Math.round(10 - bloatRaw / 10) : bloatRaw; // 0-100 → 0-10
  const bloat10 = Math.min(10, Math.max(0, bloat));
  const skin = typeof partial.skin_score === "number" ? Math.min(10, Math.max(0, partial.skin_score)) : 5;
  const energy = typeof partial.energy_score === "number" ? Math.min(10, Math.max(0, partial.energy_score)) : 5;
  const digestion = typeof partial.digestion_score === "number" ? Math.min(10, Math.max(0, partial.digestion_score)) : 5;
  const derivedGut = Math.round((digestion * 0.30 + bloat10 * 0.25 + energy * 0.20 + skin * 0.15) * 10);
  const gut_score = typeof partial.gut_score === "number" ? Math.min(100, Math.max(0, partial.gut_score)) : Math.min(100, Math.max(0, derivedGut));
  const productName = partial.product_name?.trim() || undefined;
  const foodName = productName ?? partial.food_name ?? "Unknown";

  return {
    scan_type: scanType,
    food_name: foodName,
    product_name: productName ?? foodName,
    manufacturer: partial.manufacturer?.trim() || undefined,
    identified_foods: Array.isArray(partial.identified_foods) ? partial.identified_foods : [foodName],
    gut_score,
    bloat_score: bloat10,
    skin_score: skin,
    energy_score: energy,
    digestion_score: digestion,
    analysis: {
      summary: partial.analysis?.summary ?? "",
      tips: Array.isArray(partial.analysis?.tips) ? partial.analysis.tips : [],
      skin: partial.analysis?.skin,
      digestion: partial.analysis?.digestion,
      mood: partial.analysis?.mood,
      bloatDetails: partial.analysis?.bloatDetails as { expectedTime?: string; tip?: string } | undefined,
      impactDetails: partial.analysis?.impactDetails as ScanResult["analysis"]["impactDetails"],
      goalPrediction: partial.analysis?.goalPrediction as ScanResult["analysis"]["goalPrediction"],
      personalizedInsights: Array.isArray(partial.analysis?.personalizedInsights)
        ? (partial.analysis.personalizedInsights as ScanResult["analysis"]["personalizedInsights"])
        : undefined,
      ingredientAnalysis: partial.analysis?.ingredientAnalysis as ScanResult["analysis"]["ingredientAnalysis"],
      improvementOptions: partial.analysis?.improvementOptions as ScanResult["analysis"]["improvementOptions"],
      timingInsights: partial.analysis?.timingInsights as ScanResult["analysis"]["timingInsights"],
      nutritionContext: partial.analysis?.nutritionContext as ScanResult["analysis"]["nutritionContext"],
    },
    nutrition: typeof partial.nutrition === "object" && partial.nutrition ? partial.nutrition : {},
    image_url: extras.image_url || partial.image_url || undefined,
    ...extras,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRetryableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /network request failed|timed out|timeout|failed to fetch|aborted/i.test(msg);
}

function isQuotaError(msg: string): boolean {
  return /429|quota|resource_exhausted|rate.?limit/i.test(msg);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pre-warm the Groq LLM connection (DNS + TLS handshake).
 * Fire-and-forget — errors are silently ignored.
 */
export function warmUpLlm(): void {
  if (!GROQ_API_KEY) return;
  // Light GET to establish DNS + TLS + HTTP connection for Groq
  fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
  }).catch(() => {});
}

export class ProductNotFoundError extends Error {
  constructor(barcode: string) {
    super(`Product not found for barcode ${barcode}. Try scanning a different product or use the Photo mode instead.`);
    this.name = "ProductNotFoundError";
  }
}

/**
 * Analyse a scan.
 *
 * @param onQuickResult – For barcode scans, called as soon as product data +
 *   scores are ready (before LLM finishes), so the UI can show results
 *   instantly.  The final return value will include the enriched LLM analysis.
 */
export async function analyzeScan(
  request: AnalyzeScanRequest,
  profile?: OnboardingProfile | null,
  onQuickResult?: (result: ScanResult) => void,
  onPhotoStageUpdate?: (update: PhotoAnalysisStageUpdate) => void,
): Promise<ScanResult> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) await delay(RETRY_DELAY_MS * attempt);

      // ── BARCODE FLOW ────────────────────────────────────────────
      if (request.scan_type === "barcode") {
        if (!request.barcode) throw new Error("Barcode is required");

        console.log("[analyze-scan] Looking up barcode:", request.barcode);
        // 1. Look up product in databases (all sources in parallel)
        const product = await lookupProduct(request.barcode);
        console.log("[analyze-scan] Lookup result:", product ? `Found: ${product.name}` : "Not found");
        if (!product) throw new ProductNotFoundError(request.barcode);

        // 2. Compute scores deterministically (instant, with user profile)
        const scores = computeScores(product, profile);

        // 3. Build result with basic analysis (no LLM yet)
        const parsedIngredients = (() => {
          if (!product.ingredients?.trim()) return undefined;
          const raw = product.ingredients.trim();
          const split = splitIngredientsRespectingParens(raw);
          return split.length > 0 ? split : [raw];
        })();

        const baseResult: ScanResult = {
          scan_type: "barcode",
          food_name: product.name,
          product_name: product.name,
          manufacturer: product.brand || undefined,
          identified_foods: [product.name],
          gut_score: scores.gut_score,
          bloat_score: scores.bloat_score,
          skin_score: scores.skin_score,
          energy_score: scores.energy_score,
          digestion_score: scores.digestion_score,
          confidence: scores.confidence,
          analysis: {
            summary: `${product.name} by ${product.brand || "unknown brand"}.`,
            tips: [],
          },
          nutrition: {
            calories: product.nutrition.calories,
            protein_g: product.nutrition.protein_g,
            carbs_g: product.nutrition.carbs_g,
            fat_g: product.nutrition.fat_g,
            fiber_g: product.nutrition.fiber_g,
            sugar_g: product.nutrition.sugar_g,
            sodium_mg: product.nutrition.sodium_mg,
            saturated_fat_g: product.nutrition.saturated_fat_g,
          },
          barcode: request.barcode,
          image_url: product.imageUrl,
          ingredients: parsedIngredients,
        };

        // 4. Show result immediately (before LLM)
        if (onQuickResult) onQuickResult(baseResult);

        // 5. Get LLM explanations + product insight (non-critical — fallback if they fail)
        let analysis: AnalysisText = {
          summary: baseResult.analysis.summary,
          tips: [],
        };
        let productInsight: Awaited<ReturnType<typeof buildProductInsight>> | undefined;
        try {
          const [analysisResult, insightResult] = await Promise.all([
            generateAnalysisText(product, scores, profile),
            buildProductInsight(product, scores, profile, parsedIngredients),
          ]);
          analysis = analysisResult;
          productInsight = insightResult;
        } catch (llmErr) {
          const msg = llmErr instanceof Error ? llmErr.message : String(llmErr);
          if (!isQuotaError(msg)) {
            console.warn("[analyze-scan] LLM explanation failed, using defaults:", msg);
          }
          try {
            analysis = await generateAnalysisText(product, scores, profile);
          } catch {
            /* keep defaults */
          }
          productInsight = await buildProductInsight(product, scores, profile, parsedIngredients).catch(
            () => undefined,
          );
        }

        // 6. Return enriched result with LLM analysis
        return {
          ...baseResult,
          analysis: {
            summary: analysis.summary ?? baseResult.analysis.summary,
            tips: analysis.tips ?? [],
            skin: analysis.skin,
            digestion: analysis.digestion,
            mood: analysis.mood,
            bloatDetails: analysis.bloatDetails,
            impactDetails: analysis.impactDetails,
            goalPrediction: analysis.goalPrediction,
            personalizedInsights: analysis.personalizedInsights,
            ingredientAnalysis: analysis.ingredientAnalysis,
            productInsight,
            serving_size_display: product.serving_size_display,
            servings_per_container: product.servings_per_container,
          },
        };
      }

      // ── PHOTO FLOW: Quick meal detection → detailed analysis ──
      if (!request.image_base64 && !request.image_url) {
        throw new Error("image_url or image_base64 required for photo scan");
      }

      let imageBase64: string;
      let mimeType = "image/jpeg";

      if (request.image_base64) {
        imageBase64 = request.image_base64;
      } else {
        const imgRes = await fetch(request.image_url!);
        if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
        const buf = await imgRes.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let j = 0; j < bytes.length; j++) binary += String.fromCharCode(bytes[j]);
        imageBase64 = btoa(binary);
        const ct = imgRes.headers.get("content-type") || "image/jpeg";
        mimeType = ct.split(";")[0].trim();
      }

      // ── Stage 1: Quick meal detection ──
      onPhotoStageUpdate?.({ stage: "detect", progress: 10, message: "Scanning photo" });
      let mealDetection: MealDetectionResult;
      try {
        mealDetection = await quickMealDetection(
          imageBase64,
          mimeType,
          request.learnedPortionPriors,
          request.visualPortionPriors,
          request.cameraMetadata,
          onPhotoStageUpdate,
        );
      } catch (quickDetectionErr) {
        const msg = quickDetectionErr instanceof Error ? quickDetectionErr.message : String(quickDetectionErr);
        if (!isQuotaError(msg)) {
          console.warn("[photo-flow] Quick meal detection failed, using fallback meal result:", msg);
        }
        onPhotoStageUpdate?.({ stage: "analyze", progress: 38, message: "Continuing with fallback analysis" });
        mealDetection = createFallbackMealDetection(buildLearnedPriorMap(request.learnedPortionPriors));
      }
      const scanClassification = classifyScanType(mealDetection);
      onPhotoStageUpdate?.({ stage: "validate", progress: 74, message: "Finalizing scan type" });
      
      console.log("[photo-flow] Classification:", {
        isMeal: mealDetection.isMeal,
        classification: scanClassification,
        confidence: mealDetection.confidence,
        ingredientCount: mealDetection.ingredients.length,
      });

      // ── Stage 2: Process based on classification ──
      if (scanClassification === "meal") {
        onPhotoStageUpdate?.({ stage: "portion", progress: 82, message: "Computing meal portions" });
        const result = await processMealScan(imageBase64, mimeType, mealDetection, profile, onQuickResult);
        onPhotoStageUpdate?.({ stage: "validate", progress: 96, message: "Preparing confirmation" });
        return result;
      } else {
        onPhotoStageUpdate?.({ stage: "analyze", progress: 84, message: "Analyzing product details" });
        const result = await processProductPhotoScan(imageBase64, mimeType, mealDetection, profile, onQuickResult);
        onPhotoStageUpdate?.({ stage: "validate", progress: 96, message: "Finishing analysis" });
        return result;
      }
    } catch (e) {
      lastError = e;

      // ProductNotFoundError: don't retry, surface immediately
      if (e instanceof ProductNotFoundError) throw e;

      const msg = e instanceof Error ? e.message : String(e);

      // Quota/rate-limit: surface immediately (no retry)
      if (isQuotaError(msg)) throw e;

      // Retry only on transient network errors
      if (!isRetryableError(e) || attempt >= MAX_RETRIES) throw e;
    }
  }
  throw lastError;
}
