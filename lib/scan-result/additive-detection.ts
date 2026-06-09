/**
 * Shared chemical additive detection for at-a-glance and ingredient role mapping.
 */

export type AdditiveCategory =
  | "preservative"
  | "emulsifier"
  | "color"
  | "sweetener"
  | "flavor_enhancer"
  | "stabilizer"
  | "other";

export interface DetectedAdditive {
  name: string;
  category: AdditiveCategory;
  matchedFrom?: string;
}

export interface AdditiveDetectionResult {
  count: number;
  items: DetectedAdditive[];
  topFlags: string[];
}

interface AdditivePattern {
  pattern: RegExp;
  name: string;
  category: AdditiveCategory;
  priority?: number;
}

const CATEGORY_PRIORITY: Record<AdditiveCategory, number> = {
  color: 1,
  preservative: 2,
  flavor_enhancer: 3,
  sweetener: 4,
  emulsifier: 5,
  stabilizer: 6,
  other: 7,
};

const ADDITIVE_PATTERNS: AdditivePattern[] = [
  // E-codes / INS codes (generic — resolved to category via name when possible)
  { pattern: /\b(?:e|ins)[\s-]?(\d{3,4}[a-z]?)\b/i, name: "Food additive (E-code)", category: "other", priority: 3 },

  // Preservatives
  { pattern: /\bbha\b|butylated hydroxyanisole/i, name: "BHA", category: "preservative", priority: 1 },
  { pattern: /\bbht\b|butylated hydroxytoluene/i, name: "BHT", category: "preservative", priority: 1 },
  { pattern: /\btbhq\b|tert-butylhydroquinone/i, name: "TBHQ", category: "preservative", priority: 1 },
  { pattern: /sodium nitrite|sodium nitrate|potassium nitrite|potassium nitrate/i, name: "Nitrites / Nitrates", category: "preservative", priority: 1 },
  { pattern: /sodium benzoate|potassium benzoate|benzoic acid/i, name: "Benzoate preservatives", category: "preservative", priority: 2 },
  { pattern: /potassium sorbate|sorbic acid/i, name: "Sorbate preservatives", category: "preservative", priority: 2 },
  { pattern: /propyl gallate/i, name: "Propyl gallate", category: "preservative", priority: 2 },
  { pattern: /calcium propionate|sodium propionate/i, name: "Propionate preservatives", category: "preservative", priority: 2 },
  { pattern: /sodium sulfite|potassium sulfite|sodium bisulfite|potassium bisulfite|sodium metabisulfite/i, name: "Sulfites", category: "preservative", priority: 1 },
  { pattern: /calcium disodium edta|disodium edta|edta/i, name: "EDTA", category: "preservative", priority: 2 },

  // Colors
  { pattern: /\bred\s*(?:40|3|dye)\b|allura red/i, name: "Red 40", category: "color", priority: 1 },
  { pattern: /yellow\s*(?:5|6|dye)|tartrazine|sunset yellow/i, name: "Yellow 5/6", category: "color", priority: 1 },
  { pattern: /blue\s*(?:1|2|dye)|brilliant blue/i, name: "Blue 1/2", category: "color", priority: 1 },
  { pattern: /fd&c|artificial colou?r/i, name: "Artificial colors", category: "color", priority: 1 },
  { pattern: /caramel colou?r/i, name: "Caramel color", category: "color", priority: 2 },
  { pattern: /\be1(?:0[0-9]|1[0-9]|2[0-9]|3[0-3])\b/i, name: "Artificial color (E100–133)", category: "color", priority: 1 },
  { pattern: /\be1(?:5[0-9]|6[0-9])\b/i, name: "Caramel color (E150–160)", category: "color", priority: 2 },

  // Sweeteners
  { pattern: /sucralose|splenda/i, name: "Sucralose", category: "sweetener", priority: 2 },
  { pattern: /aspartame|nutrasweet/i, name: "Aspartame", category: "sweetener", priority: 2 },
  { pattern: /acesulfame(?:[\s-]*k| potassium)?|ace-k/i, name: "Acesulfame potassium", category: "sweetener", priority: 2 },
  { pattern: /saccharin/i, name: "Saccharin", category: "sweetener", priority: 2 },
  { pattern: /\bxylitol\b|\bsorbitol\b|\bmannitol\b|\bmaltitol\b|\bisomalt\b|\blactitol\b|\berythritol\b/i, name: "Sugar alcohols", category: "sweetener", priority: 3 },
  { pattern: /high fructose corn syrup|\bhfcs\b/i, name: "High fructose corn syrup", category: "sweetener", priority: 1 },
  { pattern: /maltodextrin/i, name: "Maltodextrin", category: "sweetener", priority: 2 },

  // Flavor enhancers
  { pattern: /\bmsg\b|monosodium glutamate/i, name: "MSG", category: "flavor_enhancer", priority: 2 },
  { pattern: /disodium inosinate|disodium guanylate|\bi\+g\b/i, name: "Flavor enhancers (I+G)", category: "flavor_enhancer", priority: 3 },
  { pattern: /autolyzed yeast(?: extract)?|yeast extract|hydrolyzed (?:vegetable|soy|corn|wheat|plant) protein/i, name: "Hydrolyzed protein / yeast extract", category: "flavor_enhancer", priority: 2 },
  { pattern: /artificial flavou?r/i, name: "Artificial flavors", category: "flavor_enhancer", priority: 3 },
  { pattern: /natural flavou?r/i, name: "Natural flavors", category: "flavor_enhancer", priority: 4 },

  // Emulsifiers
  { pattern: /carrageenan/i, name: "Carrageenan", category: "emulsifier", priority: 1 },
  { pattern: /polysorbate (?:80|60|20)/i, name: "Polysorbates", category: "emulsifier", priority: 1 },
  { pattern: /carboxymethyl\s*cellulose|\bcmc\b|cellulose gum/i, name: "Carboxymethyl cellulose", category: "emulsifier", priority: 2 },
  { pattern: /mono[\s-]*and[\s-]*diglycerides|mono-?diglycerides/i, name: "Mono- and diglycerides", category: "emulsifier", priority: 2 },
  { pattern: /sodium stearoyl lactylate|\bssl\b/i, name: "Sodium stearoyl lactylate", category: "emulsifier", priority: 3 },
  { pattern: /\bdatem\b|diacetyl tartaric/i, name: "DATEM", category: "emulsifier", priority: 3 },
  { pattern: /soy lecithin|sunflower lecithin|\blecithin\b/i, name: "Lecithin", category: "emulsifier", priority: 4 },
  { pattern: /partially hydrogenated/i, name: "Partially hydrogenated oils", category: "emulsifier", priority: 1 },

  // Stabilizers / gums / starches
  { pattern: /xanthan gum/i, name: "Xanthan gum", category: "stabilizer", priority: 3 },
  { pattern: /guar gum/i, name: "Guar gum", category: "stabilizer", priority: 3 },
  { pattern: /locust bean gum|carob bean gum|gellan gum|\bagar\b/i, name: "Plant gums", category: "stabilizer", priority: 3 },
  { pattern: /modified (?:corn |food |wheat |potato )?starch/i, name: "Modified starch", category: "stabilizer", priority: 2 },
  { pattern: /propylene glycol/i, name: "Propylene glycol", category: "stabilizer", priority: 2 },
  { pattern: /sodium phosphate|phosphoric acid|tripolyphosphate|disodium phosphate|potassium phosphate|pyrophosphate/i, name: "Added phosphates", category: "stabilizer", priority: 2 },
  { pattern: /sodium citrate|potassium citrate|calcium citrate|citric acid/i, name: "Citrates", category: "stabilizer", priority: 4 },
];

/** Standalone E-code patterns with known names */
const E_CODE_MAP: Array<{ pattern: RegExp; name: string; category: AdditiveCategory }> = [
  { pattern: /\be(?:100|101|102|104|110|122|124|129|131|132|133)\b/i, name: "Artificial colors", category: "color" },
  { pattern: /\be(?:200|201|202|203|210|211|212|220|221|222|223|224|228)\b/i, name: "Preservatives (E200–228)", category: "preservative" },
  { pattern: /\be(?:250|251|252)\b/i, name: "Nitrites / Nitrates", category: "preservative" },
  { pattern: /\be(?:320|321)\b/i, name: "BHA / BHT", category: "preservative" },
  { pattern: /\be(?:407|410|412|415|417|418|440|466)\b/i, name: "Gums / thickeners", category: "stabilizer" },
  { pattern: /\be(?:471|472[abcde]?|481|482)\b/i, name: "Emulsifiers (E471–482)", category: "emulsifier" },
  { pattern: /\be(?:621|627|631)\b/i, name: "Flavor enhancers (E621–631)", category: "flavor_enhancer" },
  { pattern: /\be(?:950|951|952|954|955|961|962)\b/i, name: "Artificial sweeteners", category: "sweetener" },
];

function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function splitIngredientList(raw?: string): string[] {
  if (!raw?.trim()) return [];
  return raw
    .replace(/\r\n?/g, "\n")
    .split(/[,;]|\s+and\s+|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function matchPatterns(text: string, seen: Map<string, DetectedAdditive>): void {
  const lower = normalizeForMatch(text);

  for (const entry of ADDITIVE_PATTERNS) {
    if (!entry.pattern.test(lower)) continue;
    const key = entry.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.set(key, {
      name: entry.name,
      category: entry.category,
      matchedFrom: text.slice(0, 80),
    });
  }

  for (const entry of E_CODE_MAP) {
    if (!entry.pattern.test(lower)) continue;
    const key = entry.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.set(key, {
      name: entry.name,
      category: entry.category,
      matchedFrom: text.slice(0, 80),
    });
  }

  // Resolve generic E-code hits to specific names when possible
  const eCodeMatch = lower.match(/\b(?:e|ins)[\s-]?(\d{3,4}[a-z]?)\b/i);
  if (eCodeMatch) {
    const code = eCodeMatch[1].toLowerCase();
    for (const entry of E_CODE_MAP) {
      if (entry.pattern.test(`e${code}`)) {
        const key = entry.name.toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, { name: entry.name, category: entry.category, matchedFrom: `E${code.toUpperCase()}` });
        }
        seen.delete("food additive (e-code)");
        break;
      }
    }
  }
}

function buildTopFlags(
  items: DetectedAdditive[],
  seedOil: string | null,
  extraFlags: string[],
): string[] {
  const flags: string[] = [];

  if (seedOil) flags.push(seedOil);

  const sorted = [...items].sort((a, b) => {
    const pa = CATEGORY_PRIORITY[a.category] ?? 9;
    const pb = CATEGORY_PRIORITY[b.category] ?? 9;
    return pa - pb;
  });

  for (const item of sorted) {
    if (flags.length >= 3) break;
    if (!flags.some((f) => f.toLowerCase() === item.name.toLowerCase())) {
      flags.push(item.name);
    }
  }

  for (const extra of extraFlags) {
    if (flags.length >= 3) break;
    if (!flags.some((f) => f.toLowerCase() === extra.toLowerCase())) {
      flags.push(extra);
    }
  }

  return flags.slice(0, 3);
}

export function detectAdditives(
  rawText: string,
  ingredientTokens?: string[],
): AdditiveDetectionResult {
  const items = ingredientTokens?.length ? ingredientTokens : splitIngredientList(rawText);
  const seen = new Map<string, DetectedAdditive>();

  matchPatterns(rawText, seen);
  for (const token of items) {
    matchPatterns(token, seen);
  }

  const detected = [...seen.values()].sort((a, b) => {
    const pa = CATEGORY_PRIORITY[a.category] ?? 9;
    const pb = CATEGORY_PRIORITY[b.category] ?? 9;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });

  return {
    count: detected.length,
    items: detected,
    topFlags: buildTopFlags(detected, null, []),
  };
}

export function detectAdditivesWithSeedOil(
  rawText: string,
  ingredientTokens: string[],
  seedOil: string | null,
): AdditiveDetectionResult {
  const base = detectAdditives(rawText, ingredientTokens);
  return {
    ...base,
    topFlags: buildTopFlags(base.items, seedOil, []),
  };
}

export function categoryLabel(category: AdditiveCategory | string): string {
  switch (category) {
    case "preservative":
      return "Preservative";
    case "emulsifier":
      return "Emulsifier";
    case "color":
      return "Color";
    case "sweetener":
      return "Sweetener";
    case "flavor_enhancer":
      return "Flavor enhancer";
    case "stabilizer":
      return "Stabilizer";
    default:
      return "Additive";
  }
}

export function isKnownAdditiveName(name: string): boolean {
  const lower = normalizeForMatch(name);
  for (const entry of ADDITIVE_PATTERNS) {
    if (entry.pattern.test(lower)) return true;
  }
  for (const entry of E_CODE_MAP) {
    if (entry.pattern.test(lower)) return true;
  }
  return /\b(?:e|ins)[\s-]?\d{3,4}/i.test(lower);
}
