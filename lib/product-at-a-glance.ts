import type { ProductInfo } from "@/lib/product-lookup";
import {
  categoryLabel,
  detectAdditivesWithSeedOil,
} from "@/lib/scan-result/additive-detection";
import type { AtAGlance } from "@/types/product-scan";

const SEED_OIL_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /soybean oil/i, name: "Soybean oil" },
  { pattern: /canola oil|rapeseed oil/i, name: "Canola oil" },
  { pattern: /corn oil/i, name: "Corn oil" },
  { pattern: /sunflower oil/i, name: "Sunflower oil" },
  { pattern: /safflower oil/i, name: "Safflower oil" },
  { pattern: /cottonseed oil/i, name: "Cottonseed oil" },
  { pattern: /vegetable oil/i, name: "Vegetable oil" },
  { pattern: /grapeseed oil/i, name: "Grapeseed oil" },
];

const SUGAR_ALIASES = [
  "sugar", "cane sugar", "brown sugar", "corn syrup", "high fructose corn syrup",
  "hfcs", "dextrose", "maltodextrin", "fructose", "glucose", "invert sugar",
  "rice syrup", "agave", "honey", "molasses", "sucrose", "barley malt",
];

const ALLERGEN_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bmilk\b|whey|casein|lactose/i, label: "Milk" },
  { pattern: /\beggs?\b/i, label: "Eggs" },
  { pattern: /\bpeanuts?\b/i, label: "Peanuts" },
  { pattern: /\btree nuts?\b|almonds?|walnuts?|cashews?|pecans?/i, label: "Tree nuts" },
  { pattern: /\bwheat\b|gluten/i, label: "Wheat/Gluten" },
  { pattern: /\bsoy\b|soya/i, label: "Soy" },
  { pattern: /\bfish\b/i, label: "Fish" },
  { pattern: /\bshellfish\b|crustacean/i, label: "Shellfish" },
  { pattern: /\bsesame\b/i, label: "Sesame" },
];

const ULTRA_PROCESSED_SIGNALS = [
  "artificial", "hydrogenated", "maltodextrin", "high fructose", "e1", "e2",
  "modified starch", "emulsifier", "flavor enhancer", "corn syrup",
];

function splitIngredientList(raw?: string): string[] {
  if (!raw?.trim()) return [];
  return raw
    .replace(/\r\n?/g, "\n")
    .split(/[,;]|\s+and\s+|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function detectSeedOil(text: string): string | null {
  for (const { pattern, name } of SEED_OIL_PATTERNS) {
    if (pattern.test(text)) return name;
  }
  return null;
}

function countSugarAliases(text: string, items: string[]): number {
  const lower = text.toLowerCase();
  let count = 0;
  for (const alias of SUGAR_ALIASES) {
    if (lower.includes(alias)) count++;
  }
  for (const item of items) {
    const il = item.toLowerCase();
    if (SUGAR_ALIASES.some((a) => il.includes(a))) count++;
  }
  return Math.min(count, 10);
}

function detectAllergens(text: string): string[] {
  const found = new Set<string>();
  for (const { pattern, label } of ALLERGEN_PATTERNS) {
    if (pattern.test(text)) found.add(label);
  }
  return Array.from(found);
}

function estimateNova(text: string, additiveCount: number): string {
  const lower = text.toLowerCase();
  const ultraHits = ULTRA_PROCESSED_SIGNALS.filter((s) => lower.includes(s)).length;
  if (ultraHits >= 4 || additiveCount >= 5) return "NOVA 4 (Ultra-processed)";
  if (ultraHits >= 2 || additiveCount >= 2) return "NOVA 3 (Processed)";
  if (additiveCount >= 1) return "NOVA 2 (Processed culinary)";
  return "NOVA 1–2 (Minimally processed)";
}

function inferPackaging(categories?: string, name?: string): string {
  const text = `${categories ?? ""} ${name ?? ""}`.toLowerCase();
  if (/beverage|drink|soda|water/.test(text)) return "Plastic bottle";
  if (/canned|can\b/.test(text)) return "Metal can";
  if (/glass|jar/.test(text)) return "Glass jar";
  if (/box|carton/.test(text)) return "Paper/cardboard";
  return "Plastic pouch or wrapper";
}

function estimateRealFoodRatio(items: string[], additiveCount: number): number {
  if (items.length === 0) return 50;
  const wholeSignals = items.filter((i) => {
    const il = i.toLowerCase();
    return !/e\d/i.test(il) && !/preservative|emulsif|artificial|modified starch/i.test(il) && il.length > 2;
  }).length;
  const base = Math.round((wholeSignals / Math.max(items.length, 1)) * 100);
  return Math.max(10, Math.min(95, base - additiveCount * 4));
}

export function buildAtAGlance(product: ProductInfo, ingredientList?: string[]): AtAGlance {
  const raw = product.ingredients ?? "";
  const items = ingredientList?.length ? ingredientList : splitIngredientList(raw);
  const text = `${raw} ${items.join(", ")}`;
  const seedOils = detectSeedOil(text);
  const additiveResult = detectAdditivesWithSeedOil(text, items, seedOils);
  const additivesCount = additiveResult.count;
  const sugarAliasCount = countSugarAliases(text, items);
  const allergens = detectAllergens(text);
  const processingLevel = estimateNova(text, additivesCount);
  const packaging = inferPackaging(product.categories, product.name);
  const realFoodRatio = estimateRealFoodRatio(items, additivesCount);

  return {
    additivesCount,
    additives: additiveResult.items.map((a) => ({
      name: a.name,
      category: categoryLabel(a.category),
    })),
    topFlags: additiveResult.topFlags,
    seedOils,
    processingLevel,
    sugarAliasCount,
    allergens,
    packaging,
    realFoodRatio,
  };
}

export function gutsyScoreToHealthGrade(score: number): import("@/types/product-scan").HealthGrade {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 50) return "Okay";
  if (score >= 35) return "Poor";
  return "Avoid";
}
