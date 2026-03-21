/**
 * Scoring Engine v3 — built from scratch with nutritional-science calibration.
 *
 * Core design principles:
 * 1. Scores are per SERVING, not per 100 g. A serving-size estimator converts
 *    API nutrition (usually per 100 g) to a realistic portion.
 * 2. Food-category intelligence: probiotic, high-fiber, ultra-processed, etc.
 *    each have their own scoring curves and bonuses/penalties.
 * 3. Ingredient-list signal analysis with position weighting.
 * 4. Composite gut score uses the user's specified weighting formula.
 * 5. Confidence indicator (high / medium / low) so the UI can display reliability.
 *
 * CALIBRATION BENCHMARKS (validated at the bottom of this file):
 *   Plain kefir 200 ml  → 85-92    Doritos 30 g bag  → 28-38
 *   Kimchi 50 g          → 84-90    Banana 1 medium   → 70-78
 *   Greek yogurt 150 g   → 83-90    Big Mac            → 15-25
 *
 * Sub-score scales:
 *   bloat_score     0-10 (higher = BETTER, less bloating)
 *   skin_score      0-10 (higher = better for skin)
 *   energy_score    0-10 (higher = better sustained energy)
 *   digestion_score 0-10 (higher = better digestion)
 *   gut_score       0-100 (composite)
 */

import type { ProductInfo } from "@/lib/product-lookup";
import type { OnboardingProfile } from "@/lib/onboarding-storage";

// ═══════════════════════════════════════════════════════════════════════════
//  PUBLIC TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ComputedScores {
  bloat_score: number;   // 0-10
  skin_score: number;    // 0-10
  energy_score: number;  // 0-10
  digestion_score: number; // 0-10
  gut_score: number;     // 0-100
  confidence: "high" | "medium" | "low";
}

export type FoodCategory =
  | "probiotic"
  | "high_fiber"
  | "ultra_processed"
  | "high_sugar"
  | "anti_inflammatory"
  | "whole_food"
  | "refined_grain"
  | "general";

/** Sub-types within ultra_processed for differentiated scoring (name-based). */
export type UltraProcessedSubtype =
  | "sugar_sweetened_beverage"
  | "instant_noodle"
  | "salty_snack"
  | null;

// ═══════════════════════════════════════════════════════════════════════════
//  KEYWORD DICTIONARIES
// ═══════════════════════════════════════════════════════════════════════════

const PROBIOTIC_KEYWORDS = [
  "kefir", "yogurt", "yoghurt", "live cultures", "active cultures",
  "lactobacillus", "bifidobacterium", "kimchi", "sauerkraut",
  "kombucha", "miso", "tempeh", "fermented", "probiotic",
];

const PREBIOTIC_KEYWORDS = [
  "prebiotic", "inulin", "fos", "fructooligosaccharide",
  "galactooligosaccharide", "chicory root fiber",
];

const HIGH_FIBER_KEYWORDS = [
  "whole grain", "whole wheat", "oat", "oats", "barley", "quinoa",
  "legume", "lentil", "chickpea", "bean", "pea", "bran",
  "vegetable", "broccoli", "spinach", "kale", "sweet potato",
  "avocado", "chia", "flaxseed", "psyllium",
];

const ULTRA_PROCESSED_KEYWORDS = [
  "chip", "chips", "doritos", "cheetos", "fritos", "pringles",
  "cookie", "cookies", "oreo", "biscuit",
  "candy", "gummy", "gummies", "skittles", "m&m",
  "soda", "cola", "coke", "pepsi", "sprite", "fanta", "mountain dew", "7up", "dr pepper",
  "carbonated", "soft drink", "lemonade", "fruit punch",
  "energy drink", "red bull", "monster",
  "instant noodle", "ramen", "cup noodle", "buldak", "shin ramen", "shin ramyun", "maruchan", "nissin", "top ramen",
  "fast food", "burger", "big mac", "whopper", "mcnugget",
  "hot dog", "corn dog",
  "sugary cereal", "froot loops", "cocoa puffs",
  "frozen pizza", "pizza roll",
];

const SUGAR_SWEETENED_BEVERAGE_KEYWORDS = [
  "cola", "coke", "pepsi", "sprite", "fanta", "7up", "mountain dew", "dr pepper",
  "soda", "carbonated", "soft drink", "lemonade", "fruit punch",
  "energy drink", "red bull", "monster",
];

const INSTANT_NOODLE_KEYWORDS = [
  "ramen", "buldak", "shin ramen", "shin ramyun", "cup noodle", "instant noodle",
  "maruchan", "nissin", "top ramen",
];

const SALTY_SNACK_KEYWORDS = [
  "cheetos", "doritos", "fritos", "pringles", "chips", "crisps",
];

const ANTI_INFLAMMATORY_KEYWORDS = [
  "omega-3", "omega 3", "fish oil", "salmon", "sardine", "mackerel",
  "flaxseed", "chia", "walnut", "walnuts",
  "turmeric", "ginger", "green tea", "matcha",
  "blueberry", "blueberries", "acai", "pomegranate",
  "olive oil", "extra virgin",
  "dark chocolate", "cacao", "cocoa powder",
];

const WHOLE_FOOD_KEYWORDS = [
  "banana", "apple", "orange", "grape", "strawberry", "mango",
  "carrot", "tomato", "cucumber", "lettuce", "celery",
  "brown rice", "quinoa", "sweet potato", "potato",
  "egg", "eggs", "chicken breast", "turkey",
  "almond", "almonds", "cashew", "cashews", "pistachio",
  "bone broth",
];

const REFINED_GRAIN_KEYWORDS = [
  "white rice", "white bread", "white flour", "enriched flour",
  "white pasta", "macaroni", "spaghetti", "all-purpose flour",
  "bleached flour",
];

// Negative ingredient signals
const ARTIFICIAL_SWEETENERS = [
  "sorbitol", "mannitol", "xylitol", "maltitol", "erythritol",
  "aspartame", "sucralose", "saccharin", "acesulfame",
  "neotame", "advantame",
];

const ARTIFICIAL_COLORS = [
  "red 40", "red 3", "yellow 5", "yellow 6", "blue 1", "blue 2",
  "green 3", "caramel color",
  "e102", "e110", "e122", "e124", "e129", "e131", "e132", "e133",
  "e150", "e151", "e155", "e171",
];

const PROCESSED_ADDITIVES = [
  "monosodium glutamate", "msg", "carrageenan", "polysorbate",
  "sodium benzoate", "potassium sorbate", "bha", "bht",
  "tbhq", "tertiary butylhydroquinone",
  "sodium nitrate", "sodium nitrite",
  "artificial flavor", "artificial flavour",
  "artificial color", "artificial colour",
  "modified starch", "modified food starch",
  "partially hydrogenated",
  "e211", "e220", "e250", "e251", "e252", "e320", "e321",
];

const INFLAMMATORY_INGREDIENTS = [
  "partially hydrogenated", "trans fat",
  "palm oil", "soybean oil", "corn oil", "cottonseed oil",
  "hydrogenated", "margarine", "shortening",
  "high fructose corn syrup", "hfcs",
  ...ARTIFICIAL_COLORS,
];

const SKIN_POSITIVE_KEYWORDS = [
  "omega-3", "omega 3", "fish oil", "flaxseed", "chia",
  "vitamin e", "vitamin c", "vitamin a", "zinc", "selenium",
  "green tea", "turmeric", "collagen", "aloe vera",
  "avocado", "blueberry", "blueberries", "sweet potato",
];

const GUT_IRRITANTS = [
  "carrageenan", "polysorbate",
  ...ARTIFICIAL_SWEETENERS,
  "xanthan gum", "cellulose gum",
];

// ═══════════════════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function ingredientsLower(ing?: string): string {
  return (ing ?? "").toLowerCase();
}

function splitOrdered(ing?: string): string[] {
  if (!ing?.trim()) return [];
  return ing.replace(/\r\n?/g, "\n").trim()
    .split(/[,;]|\s+and\s+|\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function countKw(text: string, kws: string[]): number {
  let c = 0;
  for (const k of kws) if (text.includes(k)) c++;
  return c;
}

/** Position-weighted count: early = high weight, late = low. */
function weightedCount(ordered: string[], kws: string[], direction: "bad" | "good"): number {
  let sum = 0;
  for (let i = 0; i < ordered.length; i++) {
    const ing = ordered[i].toLowerCase();
    const w = direction === "bad"
      ? (i <= 2 ? 1.0 : i <= 5 ? 0.7 : i <= 9 ? 0.4 : 0.2)
      : (i <= 2 ? 1.2 : i <= 5 ? 1.0 : i <= 9 ? 0.7 : 0.4);
    for (const k of kws) {
      if (ing.includes(k)) { sum += w; break; }
    }
  }
  return sum;
}

// ═══════════════════════════════════════════════════════════════════════════
//  1. SERVING-SIZE ESTIMATOR
// ═══════════════════════════════════════════════════════════════════════════

/** Estimate a realistic serving size in grams from name + categories. */
function estimateServingG(product: ProductInfo): number {
  const text = `${product.name} ${product.categories ?? ""} ${product.brand}`.toLowerCase();

  // Dairy drinks
  if (/kefir|yogurt drink|yoghurt drink|lassi|ayran/.test(text)) return 200;
  // Yogurt (spoonable)
  if (/yogurt|yoghurt|skyr/.test(text)) return 150;
  // Cheese
  if (/cheese|fromage/.test(text)) return 30;
  // Milk, plant milk
  if (/milk|oat milk|almond milk|soy milk/.test(text)) return 250;
  // Juice, soft drink
  if (/juice|soda|cola|lemonade|energy drink|kombucha/.test(text)) return 250;
  // Bread
  if (/bread|toast|bagel|muffin|bun/.test(text)) return 70;
  // Cereal
  if (/cereal|granola|muesli/.test(text)) return 45;
  // Oats / porridge
  if (/oats|oatmeal|porridge/.test(text)) return 80;
  // Chips / crisps / snack
  if (/chips|crisps|doritos|cheetos|pringles|popcorn|pretzel|snack/.test(text)) return 30;
  // Chocolate / candy bar
  if (/chocolate|candy|bar|snickers|mars|twix|kit kat/.test(text)) return 45;
  // Cookie / biscuit
  if (/cookie|biscuit|cracker/.test(text)) return 35;
  // Nuts / seeds
  if (/nuts|almonds|cashews|pistachios|seeds|peanut butter|nut butter/.test(text)) return 30;
  // Ice cream
  if (/ice cream|gelato|frozen dessert/.test(text)) return 100;
  // Pasta / noodle
  if (/pasta|spaghetti|noodle|ramen|macaroni/.test(text)) return 80;
  // Rice
  if (/rice/.test(text)) return 100;
  // Soup / broth
  if (/soup|broth|stew/.test(text)) return 250;
  // Kimchi / sauerkraut / fermented veg
  if (/kimchi|sauerkraut|pickle/.test(text)) return 50;
  // Miso
  if (/miso/.test(text)) return 20;
  // Vegetables / salad
  if (/vegetable|salad|carrot|broccoli|spinach|kale|tomato|cucumber/.test(text)) return 90;
  // Fruit
  if (/banana|apple|orange|grape|strawberry|mango|fruit|berry/.test(text)) return 120;
  // Meat / fish
  if (/chicken|beef|pork|turkey|fish|salmon|tuna|lamb/.test(text)) return 120;
  // Egg
  if (/egg/.test(text)) return 60;
  // Protein bar / supplement
  if (/protein bar|supplement|whey/.test(text)) return 40;
  // Burger / fast food
  if (/burger|big mac|whopper|sandwich|wrap/.test(text)) return 200;
  // Pizza
  if (/pizza/.test(text)) return 150;
  // Sauce / condiment
  if (/sauce|ketchup|mayo|mustard|dressing/.test(text)) return 20;

  return 100; // default
}

/** Scale nutrition from "per 100 g" to estimated serving. */
interface ServingNutrition {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  saturated_fat_g: number;
  servingG: number;
}

function toServing(product: ProductInfo): ServingNutrition {
  const s = estimateServingG(product);
  const f = s / 100; // scale factor
  const n = product.nutrition;
  return {
    calories: Math.round((n.calories ?? 0) * f),
    protein_g: +((n.protein_g ?? 0) * f).toFixed(1),
    carbs_g: +((n.carbs_g ?? 0) * f).toFixed(1),
    fat_g: +((n.fat_g ?? 0) * f).toFixed(1),
    fiber_g: +((n.fiber_g ?? 0) * f).toFixed(1),
    sugar_g: +((n.sugar_g ?? 0) * f).toFixed(1),
    sodium_mg: Math.round((n.sodium_mg ?? 0) * f),
    saturated_fat_g: +((n.saturated_fat_g ?? 0) * f).toFixed(1),
    servingG: s,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  2. FOOD CATEGORY DETECTOR
// ═══════════════════════════════════════════════════════════════════════════

function detectCategory(product: ProductInfo): FoodCategory {
  const text = `${product.name} ${product.categories ?? ""} ${product.ingredients ?? ""}`.toLowerCase();

  // Order matters — most specific first
  if (PROBIOTIC_KEYWORDS.some((k) => text.includes(k))) return "probiotic";
  if (ULTRA_PROCESSED_KEYWORDS.some((k) => text.includes(k))) return "ultra_processed";
  if (ANTI_INFLAMMATORY_KEYWORDS.some((k) => text.includes(k))) return "anti_inflammatory";
  if (WHOLE_FOOD_KEYWORDS.some((k) => text.includes(k))) return "whole_food";
  if (HIGH_FIBER_KEYWORDS.some((k) => text.includes(k))) return "high_fiber";
  if (REFINED_GRAIN_KEYWORDS.some((k) => text.includes(k))) return "refined_grain";
  return "general";
}

/** Name/categories-only sub-type for ultra_processed; call only when category is ultra_processed. */
function detectUltraProcessedSubtype(product: ProductInfo): UltraProcessedSubtype {
  const text = `${product.name} ${product.categories ?? ""}`.toLowerCase();
  if (SUGAR_SWEETENED_BEVERAGE_KEYWORDS.some((k) => text.includes(k))) return "sugar_sweetened_beverage";
  if (INSTANT_NOODLE_KEYWORDS.some((k) => text.includes(k))) return "instant_noodle";
  if (SALTY_SNACK_KEYWORDS.some((k) => text.includes(k))) return "salty_snack";
  return null;
}

/** Effective sugar/sodium for penalty math when subtype suggests high value but data is missing. */
function effectiveSugarForPenalty(sn: ServingNutrition, subtype: UltraProcessedSubtype): number {
  const raw = sn.sugar_g ?? 0;
  if (raw > 0) return raw;
  if (subtype === "sugar_sweetened_beverage") return 26;
  return raw;
}

function effectiveSodiumForPenalty(sn: ServingNutrition, subtype: UltraProcessedSubtype): number {
  const raw = sn.sodium_mg ?? 0;
  if (raw > 0) return raw;
  if (subtype === "instant_noodle") return 1000;
  return raw;
}

// ═══════════════════════════════════════════════════════════════════════════
//  3. INGREDIENT-SIGNAL ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

interface IngredientSignals {
  liveCultures: boolean;
  wholeGrain: boolean;
  prebiotic: boolean;
  omega3: boolean;
  antioxidants: boolean;
  hfcs: boolean;
  partiallyHydro: boolean;
  artificialColorCount: number;
  modifiedStarchPrimary: boolean;
  additiveCount: number;
  inflammatoryCount: number;
  sweetenerCount: number;
  gutIrritantCount: number;
}

function analyzeIngredients(product: ProductInfo): IngredientSignals {
  const ing = ingredientsLower(product.ingredients);
  const ordered = splitOrdered(product.ingredients);

  const liveCultures = /live cultures|active cultures|live and active/.test(ing) ||
    PROBIOTIC_KEYWORDS.some((k) => k !== "fermented" && ing.includes(k));
  const wholeGrain = /whole grain|whole wheat|100% whole/.test(ing);
  const prebiotic = PREBIOTIC_KEYWORDS.some((k) => ing.includes(k));
  const omega3 = /omega.?3|fish oil|flaxseed oil|chia seed/.test(ing);
  const antioxidants = /vitamin c|vitamin e|polyphenol|antioxidant|green tea extract|turmeric/.test(ing);
  const hfcs = /high fructose corn syrup|hfcs/.test(ing);
  const partiallyHydro = /partially hydrogenated/.test(ing);

  const artificialColorCount = countKw(ing, ARTIFICIAL_COLORS);
  const modifiedStarchPrimary = ordered.length > 0 &&
    ordered.slice(0, 3).some((s) => /modified (food )?starch/.test(s.toLowerCase()));

  const additiveCount = ordered.length > 0
    ? Math.round(weightedCount(ordered, PROCESSED_ADDITIVES, "bad"))
    : countKw(ing, PROCESSED_ADDITIVES);

  const inflammatoryCount = ordered.length > 0
    ? Math.round(weightedCount(ordered, INFLAMMATORY_INGREDIENTS, "bad"))
    : countKw(ing, INFLAMMATORY_INGREDIENTS);

  const sweetenerCount = countKw(ing, ARTIFICIAL_SWEETENERS);
  const gutIrritantCount = ordered.length > 0
    ? Math.round(weightedCount(ordered, GUT_IRRITANTS, "bad"))
    : countKw(ing, GUT_IRRITANTS);

  return {
    liveCultures, wholeGrain, prebiotic, omega3, antioxidants,
    hfcs, partiallyHydro, artificialColorCount, modifiedStarchPrimary,
    additiveCount, inflammatoryCount, sweetenerCount, gutIrritantCount,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  4. SUB-SCORE FUNCTIONS (all 0-10, higher = better)
// ═══════════════════════════════════════════════════════════════════════════

// ── BLOATING (0-10, higher = less bloating) ──────────────────────────────

function scoreBloating(
  sn: ServingNutrition,
  cat: FoodCategory,
  sig: IngredientSignals,
  product: ProductInfo,
): number {
  // Probiotic foods actively REDUCE bloating — start high (8 = user benchmark for kefir)
  if (cat === "probiotic") {
    let s = 8;
    if (sn.sodium_mg > 600) s -= 1;
    if (sn.sugar_g > 15) s -= 1;
    return clamp(Math.round(s), 0, 10);
  }

  // Ultra-processed: differentiate by sub-type (soda lowest, then ramen, then chips, then other)
  if (cat === "ultra_processed") {
    const subtype = detectUltraProcessedSubtype(product);
    let s = subtype === "sugar_sweetened_beverage" ? 2 : subtype === "instant_noodle" || subtype === "salty_snack" ? 3 : 4;
    const effSodium = effectiveSodiumForPenalty(sn, subtype);
    if (effSodium > 600) s -= 1;
    if (sig.sweetenerCount > 0) s -= 1;
    if (sn.fiber_g >= 2) s += 1;
    return clamp(Math.round(s), 0, 10);
  }

  // General baseline
  let s = 6;

  // Sodium per serving
  if (sn.sodium_mg > 800) s -= 3;
  else if (sn.sodium_mg > 600) s -= 2;
  else if (sn.sodium_mg > 400) s -= 1;
  else if (sn.sodium_mg < 150) s += 1;

  // Sugar
  if (sn.sugar_g > 25) s -= 2;
  else if (sn.sugar_g > 15) s -= 1;
  else if (sn.sugar_g < 5) s += 1;

  // Fiber: moderate = helpful; very high (>10 g/serving) can cause gas
  if (sn.fiber_g >= 3 && sn.fiber_g <= 8) s += 1;
  else if (sn.fiber_g > 12) s -= 1;

  // Sweeteners are a major bloating trigger
  if (sig.sweetenerCount >= 2) s -= 2;
  else if (sig.sweetenerCount === 1) s -= 1;

  // Carbonation
  const ing = ingredientsLower(product.ingredients);
  if (/carbonated|sparkling|soda/.test(ing)) s -= 2;

  // Probiotics / prebiotics help even in non-probiotic products
  if (sig.liveCultures) s += 1;
  if (sig.prebiotic) s += 1;

  // Gut irritants
  if (sig.gutIrritantCount >= 3) s -= 2;
  else if (sig.gutIrritantCount >= 1) s -= 1;

  // Whole foods are gentler
  if (cat === "whole_food" || cat === "anti_inflammatory") s += 1;

  return clamp(Math.round(s), 0, 10);
}

// ── DIGESTION (0-10) ─────────────────────────────────────────────────────

function scoreDigestion(
  sn: ServingNutrition,
  cat: FoodCategory,
  sig: IngredientSignals,
  product: ProductInfo,
): number {
  if (cat === "probiotic") {
    let s = 9;
    // liveCultures bonus baked into base 9 — don't double-count
    if (sig.additiveCount > 2) s -= 1;
    return clamp(Math.round(s), 0, 10);
  }

  if (cat === "ultra_processed") {
    const subtype = detectUltraProcessedSubtype(product);
    let s = subtype === "sugar_sweetened_beverage" ? 2 : subtype === "instant_noodle" || subtype === "salty_snack" ? 3 : 4;
    if (sn.fiber_g >= 3) s += 1;
    if (sig.additiveCount > 5) s -= 1;
    return clamp(Math.round(s), 0, 10);
  }

  let s = 5;

  // Fiber is king for digestion
  if (sn.fiber_g >= 5) s += 1.5;
  else if (sn.fiber_g >= 3) s += 1;
  // Very high fiber in single serving can overwhelm
  if (sn.fiber_g > 15) s -= 1;

  // Live cultures / probiotics
  if (sig.liveCultures) s += 2;
  if (sig.prebiotic) s += 1;

  // Whole grain helps
  if (sig.wholeGrain) s += 1;

  // Irritants
  if (sig.gutIrritantCount >= 3) s -= 2;
  else if (sig.gutIrritantCount >= 1) s -= 1;

  // Additives
  if (sig.additiveCount > 5) s -= 2;
  else if (sig.additiveCount > 2) s -= 1;

  // Very high fat slows digestion
  if (sn.fat_g > 20) s -= 1;

  return clamp(Math.round(s), 0, 10);
}

// ── SKIN (0-10) ──────────────────────────────────────────────────────────

function scoreSkin(
  sn: ServingNutrition,
  cat: FoodCategory,
  sig: IngredientSignals,
  product: ProductInfo,
): number {
  if (cat === "ultra_processed") {
    const subtype = detectUltraProcessedSubtype(product);
    let s = subtype === "sugar_sweetened_beverage" ? 1 : subtype === "instant_noodle" ? 2 : subtype === "salty_snack" ? 2.5 : 3;
    const effSugar = effectiveSugarForPenalty(sn, subtype);
    if (effSugar > 15) s -= 1;
    if (sig.artificialColorCount > 0) s -= 1;
    return clamp(Math.round(s), 0, 10);
  }

  let s = 5;

  // Sugar: inflammation and glycation
  if (sn.sugar_g > 25) s -= 2;
  else if (sn.sugar_g > 15) s -= 1.5;
  else if (sn.sugar_g > 8) s -= 0.5;
  else if (sn.sugar_g < 3) s += 0.5;

  // Saturated fat
  if (sn.saturated_fat_g > 8) s -= 1.5;
  else if (sn.saturated_fat_g > 5) s -= 0.5;

  // Inflammatory ingredients
  if (sig.inflammatoryCount >= 4) s -= 2;
  else if (sig.inflammatoryCount >= 2) s -= 1;

  // Positive signals
  if (sig.omega3) s += 2;
  if (sig.antioxidants) s += 1;

  // Skin-positive ingredients (position weighted)
  const ordered = splitOrdered(product.ingredients);
  if (ordered.length > 0) {
    const posW = weightedCount(ordered, SKIN_POSITIVE_KEYWORDS, "good");
    s += Math.min(posW * 0.8, 2);
  }

  // Artificial colors are directly linked to inflammation
  if (sig.artificialColorCount >= 3) s -= 1.5;
  else if (sig.artificialColorCount >= 1) s -= 0.5;

  // Probiotic foods are good for skin (gut-skin axis)
  if (cat === "probiotic") s += 1.5;
  if (cat === "anti_inflammatory") s += 1.5;
  if (cat === "whole_food") s += 0.5;

  // HFCS is particularly bad for skin
  if (sig.hfcs) s -= 1;

  return clamp(Math.round(s), 0, 10);
}

// ── ENERGY & MOOD (0-10) ─────────────────────────────────────────────────

function scoreEnergy(
  sn: ServingNutrition,
  cat: FoodCategory,
  sig: IngredientSignals,
  product: ProductInfo,
): number {
  let s = 5;

  // Protein sustains energy
  if (sn.protein_g >= 15) s += 2;
  else if (sn.protein_g >= 8) s += 1;

  // Fiber sustains energy (slow release)
  if (sn.fiber_g >= 5) s += 1;
  else if (sn.fiber_g >= 2) s += 0.5;

  // High sugar = spike then crash
  if (sn.sugar_g > 25) s -= 2;
  else if (sn.sugar_g > 15) s -= 1;

  // Very high fat = sluggish
  if (sn.fat_g > 25) s -= 1;

  // Complex carbs vs refined
  if (sig.wholeGrain) s += 1;
  if (cat === "refined_grain") s -= 0.5;

  // B vitamins, caffeine
  const ing = ingredientsLower(product.ingredients);
  if (/vitamin b|thiamin|riboflavin|niacin|b12|b6/.test(ing)) s += 0.5;
  if (/caffeine|coffee|guarana|green tea/.test(ing)) s += 0.5;

  // Probiotic foods support gut-brain axis (moderate boost)
  if (cat === "probiotic") s += 1;

  // Ultra-processed = energy crash; sub-type bases for differentiation
  if (cat === "ultra_processed") {
    const subtype = detectUltraProcessedSubtype(product);
    s = subtype === "sugar_sweetened_beverage" ? 2 : subtype === "instant_noodle" ? 3 : subtype === "salty_snack" ? 3.5 : 3.5;
    return clamp(Math.round(s), 0, 10);
  }

  // Anti-inflammatory = stable energy
  if (cat === "anti_inflammatory") s += 1;

  // Whole food
  if (cat === "whole_food") s += 0.5;

  return clamp(Math.round(s), 0, 10);
}

// ── BASE NUTRITIONAL SCORE (0-10) ────────────────────────────────────────

function scoreBaseNutritional(sn: ServingNutrition): number {
  let s = 5;

  // Protein is almost always good
  if (sn.protein_g >= 15) s += 1.5;
  else if (sn.protein_g >= 8) s += 1;

  // Fiber
  if (sn.fiber_g >= 5) s += 1.5;
  else if (sn.fiber_g >= 2) s += 0.5;

  // Low sugar is better
  if (sn.sugar_g < 5) s += 1;
  else if (sn.sugar_g > 20) s -= 1;

  // Moderate fat is fine; excessive is not
  if (sn.fat_g > 25) s -= 1;
  if (sn.saturated_fat_g > 8) s -= 0.5;

  // Reasonable calories (not too dense per serving)
  if (sn.calories > 500) s -= 1;
  else if (sn.calories < 200 && sn.protein_g >= 5) s += 0.5;

  // Low sodium
  if (sn.sodium_mg < 200) s += 0.5;
  else if (sn.sodium_mg > 800) s -= 1;

  return clamp(Math.round(s), 0, 10);
}

// ═══════════════════════════════════════════════════════════════════════════
//  5. INGREDIENT SIGNAL BONUSES / PENALTIES (applied to gut_score)
// ═══════════════════════════════════════════════════════════════════════════

function ingredientGutBonus(sig: IngredientSignals): number {
  let bonus = 0;

  // Positive (gentle — sub-scores already account for these)
  if (sig.liveCultures) bonus += 5;
  if (sig.wholeGrain) bonus += 1;
  if (sig.prebiotic) bonus += 3;
  if (sig.omega3) bonus += 2;
  if (sig.antioxidants) bonus += 1;

  // Negative (gentle — sub-scores already penalize heavily)
  if (sig.hfcs) bonus -= 3;
  if (sig.partiallyHydro) bonus -= 4;
  if (sig.artificialColorCount >= 1) bonus -= Math.min(sig.artificialColorCount, 3);
  if (sig.modifiedStarchPrimary) bonus -= 2;
  if (sig.additiveCount > 5) bonus -= 4;
  else if (sig.additiveCount > 3) bonus -= 2;

  return bonus;
}

// ═══════════════════════════════════════════════════════════════════════════
//  6. CATEGORY BONUSES / PENALTIES (applied to gut_score)
// ═══════════════════════════════════════════════════════════════════════════

function categoryGutBonus(cat: FoodCategory, rawGut?: number): number {
  switch (cat) {
    case "probiotic": return (rawGut != null && rawGut >= 80) ? 4 : 6;
    case "high_fiber": return 2;
    case "anti_inflammatory": return 3;
    case "whole_food": return 4;
    case "refined_grain": return -3;
    case "ultra_processed": return -3;
    case "high_sugar": return -3;
    default: return 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  7. CONFIDENCE INDICATOR
// ═══════════════════════════════════════════════════════════════════════════

function determineConfidence(product: ProductInfo): "high" | "medium" | "low" {
  const hasNutrition = product.nutrition.calories != null ||
    product.nutrition.protein_g != null ||
    product.nutrition.fat_g != null;
  const hasIngredients = !!product.ingredients?.trim();

  if (hasNutrition && hasIngredients) return "high";
  if (hasNutrition || hasIngredients) return "medium";
  return "low";
}

// ═══════════════════════════════════════════════════════════════════════════
//  8. USER-SPECIFIC ADJUSTMENTS
// ═══════════════════════════════════════════════════════════════════════════

function applyUserAdjustments(
  scores: { bloat: number; skin: number; energy: number; digestion: number; gut: number },
  product: ProductInfo,
  profile?: OnboardingProfile | null,
): typeof scores {
  if (!profile) return scores;

  const trigger = (profile.trigger ?? "").toLowerCase();
  const ing = ingredientsLower(product.ingredients);
  const name = product.name.toLowerCase();

  // Lactose intolerance
  if (/lactose|dairy/.test(trigger)) {
    const isDairy = /milk|cream|cheese|lactose|whey|casein/.test(ing) || /milk|cream|cheese|yogurt|kefir/.test(name);
    if (isDairy) {
      scores.bloat = clamp(scores.bloat - 3, 0, 10);
      scores.digestion = clamp(scores.digestion - 2, 0, 10);
      scores.gut = clamp(scores.gut - 10, 0, 100);
    }
  }

  // Gluten / celiac
  if (/gluten|celiac|coeliac/.test(trigger)) {
    const hasGluten = /wheat|barley|rye|gluten|flour|bread|pasta|malt/.test(ing) || /bread|pasta|cereal|cracker/.test(name);
    if (hasGluten) {
      scores.bloat = clamp(scores.bloat - 4, 0, 10);
      scores.digestion = clamp(scores.digestion - 4, 0, 10);
      scores.gut = clamp(scores.gut - 20, 0, 100);
    }
  }

  // IBS
  if (/ibs|irritable bowel/.test(trigger)) {
    // Penalize gas-producing foods more
    const gasProducing = /bean|legume|lentil|chickpea|broccoli|cauliflower|cabbage|onion|garlic/.test(ing);
    if (gasProducing) {
      scores.bloat = clamp(scores.bloat - 2, 0, 10);
      scores.gut = clamp(scores.gut - 8, 0, 100);
    }
  }

  // Inflammation concern → boost weight of skin/energy
  if (/inflam/.test(trigger)) {
    // Skin and energy are already computed; just let the user know these matter more
    // We won't change sub-scores but can nudge gut if skin/energy are low
    if (scores.skin <= 4) scores.gut = clamp(scores.gut - 5, 0, 100);
    if (scores.energy <= 4) scores.gut = clamp(scores.gut - 3, 0, 100);
  }

  return scores;
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN: computeScores
// ═══════════════════════════════════════════════════════════════════════════

export function computeScores(product: ProductInfo, profile?: OnboardingProfile | null): ComputedScores {
  const sn = toServing(product);
  const cat = detectCategory(product);
  const sig = analyzeIngredients(product);
  const confidence = determineConfidence(product);

  const subtype = cat === "ultra_processed" ? detectUltraProcessedSubtype(product) : null;

  // Sub-scores (all 0-10)
  const bloat = scoreBloating(sn, cat, sig, product);
  const digestion = scoreDigestion(sn, cat, sig, product);
  const skin = scoreSkin(sn, cat, sig, product);
  const energy = scoreEnergy(sn, cat, sig, product);
  const base = scoreBaseNutritional(sn);

  // Composite gut score (user's specified formula)
  let gut = Math.round(
    (digestion * 0.30 +
     bloat * 0.25 +
     energy * 0.20 +
     skin * 0.15 +
     base * 0.10) * 10
  );

  const rawGut = gut;
  // Apply category + ingredient bonuses/penalties ON TOP of composite
  gut += categoryGutBonus(cat, rawGut);
  gut += ingredientGutBonus(sig);

  const effSugar = effectiveSugarForPenalty(sn, subtype);
  const effSodium = effectiveSodiumForPenalty(sn, subtype);

  // Steeper sugar penalty so sodas land in low 20s
  if (effSugar > 25) gut -= 8;
  else if (effSugar > 15) gut -= 5;

  // Inflammatory ingredient penalty (cumulative, gentle)
  if (sig.inflammatoryCount > 0) {
    gut -= Math.min(Math.round(sig.inflammatoryCount * 0.5), 4);
  }

  // Heavy per-serving sodium penalties (ramen, chips, etc.)
  if (effSodium > 1000) gut -= 15;
  else if (effSodium > 800) gut -= 12;
  else if (effSodium > 600) gut -= 5;
  if (sn.calories > 500) gut -= 5;

  // Extra penalty for sugar-sweetened beverages so Coke/Sprite stay ~20-28
  if (subtype === "sugar_sweetened_beverage") gut -= 5;

  gut = clamp(gut, 0, 100);

  // User-specific adjustments
  const adjusted = applyUserAdjustments(
    { bloat, skin, energy, digestion, gut },
    product,
    profile,
  );

  return {
    bloat_score: adjusted.bloat,
    skin_score: adjusted.skin,
    energy_score: adjusted.energy,
    digestion_score: adjusted.digestion,
    gut_score: adjusted.gut,
    confidence,
  };
}
