/**
 * Ingredient analysis for scan result Ingredients tab.
 * Calls Groq to normalize raw ingredient strings and return display names + gut-health impact + whyMatters.
 */

import type { OnboardingProfile } from "@/lib/onboarding-storage";

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? "";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_TEXT_MODEL = "llama-3.1-8b-instant";
const REQUEST_TIMEOUT_MS = 12_000;

export type IngredientImpact = "negative" | "moderate" | "positive";
export type IngredientTier = "main" | "supporting" | "micro";

export interface AnalyzedIngredient {
  displayName: string;
  impact: IngredientImpact;
  whyMatters: string;
  tier?: IngredientTier;
  estimatedGrams?: number;
}

export interface IngredientAnalysisResult {
  items: AnalyzedIngredient[];
  redCount: number;
  yellowCount: number;
  greenCount: number;
  tierCounts?: {
    main: number;
    supporting: number;
    micro: number;
  };
}

const JSON_SCHEMA = `You are a gut-health expert. Given a list of raw ingredients from a food product label, return a JSON object with a single key "items" (array of objects). For each RELEVANT ingredient (skip trivial ones like "salt" as sole entry if duplicated; merge sub-ingredients into parent when they're just variants like "[2% zinc]" — show "Vegetable Oil" not "Vegetable Oil [2% zinc]").
Each item must have:
- displayName (string): simple, clean name for the ingredient (e.g. "Vegetable Oil", "High Fructose Corn Syrup"). Strip percentages, bracketed additives, and redundant text. Use title case.
- impact (string): one of "negative" (bad for gut), "moderate" (caution), "positive" (good for gut).
- whyMatters (string): 1-2 concise sentences on why this ingredient matters. Always include gut-health impact (microbiome, bloating, inflammation, digestion). ALSO include skin and/or energy/mood effects when relevant for that ingredient.
- tier (string, optional): one of "main"|"supporting"|"micro" where possible. Use "main" for primary ingredients, "supporting" for medium contributors, and "micro" for trace additives/spices.
Include only ingredients that have a meaningful gut-health impact; you may omit water or very minor items. Output valid JSON only: no markdown, no trailing commas. Example: {"items":[{"displayName":"Vegetable Oil","impact":"negative","whyMatters":"Processed seed oils can disrupt gut microbiome balance and increase inflammation. In some people, this can worsen skin breakouts and energy dips."}]}`;

export function enrichWhyMatters(displayName: string, impact: IngredientImpact, rawWhy: string): string {
  const text = rawWhy.trim();
  const name = displayName.toLowerCase();
  const lower = text.toLowerCase();

  // Check if skin/energy effects are already mentioned
  const mentionsSkin = /\bskin|acne|breakout|eczema|complexion|pores?\b/.test(lower);
  const mentionsEnergyMood = /\benergy|mood|focus|fatigue|crash|irritab|brain fog|tired|alert\b/.test(lower);

  // Ingredients that commonly affect skin
  const skinRelevantIngredients = /sugar|syrup|sweetener|color|dye|oil|hydrogenated|fried|additive|preservative|msg|sodium|dairy|milk|whey|casein|gluten|wheat/i;
  const skinRelevant = skinRelevantIngredients.test(name) && impact !== "positive";

  // Ingredients that commonly affect energy/mood
  const energyMoodIngredients = /sugar|syrup|caffeine|sweetener|refined|maltodextrin|artificial|aspartame|sucralose|fructose|glucose|dextrose|corn|starch|carrageenan/i;
  const energyMoodRelevant = energyMoodIngredients.test(name) || impact === "negative";

  const additions: string[] = [];
  if (skinRelevant && !mentionsSkin) {
    additions.push("May also affect skin clarity in sensitive individuals.");
  }
  if (energyMoodRelevant && !mentionsEnergyMood) {
    additions.push("Can impact energy levels or mood stability.");
  }

  const enriched = [text || "Relevant to gut health.", ...additions].join(" ").trim();
  return enriched.length > 300 ? enriched.slice(0, 297).trimEnd() + "..." : enriched;
}

function extractJsonFromText(text: string): string {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return trimmed;
  return trimmed.slice(start, end + 1);
}

function repairJson(jsonStr: string): string {
  let out = jsonStr.replace(/,(\s*[}\]])/g, "$1").replace(/,(\s*),/g, ",");
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
        if (out[i] === '"') {
          result += '"';
          i++;
          break;
        }
        if (out[i] === "\n") {
          result += "\\n";
          i++;
          continue;
        }
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

function normalizeImpact(s: unknown): IngredientImpact {
  if (s === "negative" || s === "moderate" || s === "positive") return s;
  const str = String(s).toLowerCase();
  if (
    str.includes("negative") ||
    str.includes("bad") ||
    str.includes("red") ||
    str.includes("harm") ||
    str.includes("avoid")
  ) {
    return "negative";
  }
  if (
    str.includes("moderate") ||
    str.includes("caution") ||
    str.includes("yellow") ||
    str.includes("warning") ||
    str.includes("neutral") ||
    str.includes("mixed")
  ) {
    return "moderate";
  }
  if (str.includes("positive") || str.includes("good") || str.includes("green") || str.includes("benefit")) {
    return "positive";
  }
  return "moderate";
}

function normalizeTier(s: unknown): IngredientTier | undefined {
  if (s === "main" || s === "supporting" || s === "micro") return s;
  const str = String(s ?? "").toLowerCase();
  if (str.includes("main") || str.includes("primary")) return "main";
  if (str.includes("support") || str.includes("secondary") || str.includes("medium")) return "supporting";
  if (str.includes("micro") || str.includes("trace") || str.includes("minor")) return "micro";
  return undefined;
}

function toTitleCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------
// Rule-based ingredient pattern database.
//
// Each entry maps a regex to a clean display name, impact level, default tier,
// and an evidence-based "why this matters" explanation that always mentions
// gut/digestion and — where relevant — skin, bloating, or energy. Used both as
// a fallback when the AI fails and as an augmentation layer to catch
// high-impact ingredients (e.g., seed oils, artificial sweeteners) that the AI
// might soft-pedal. Order matters: more specific patterns come first.
// ---------------------------------------------------------------------------

interface PatternEntry {
  pattern: RegExp;
  displayName: string;
  impact: IngredientImpact;
  tier: IngredientTier;
  why: string;
}

const INGREDIENT_PATTERNS: PatternEntry[] = [
  // --- Added sugars & syrups ---
  { pattern: /high[\s-]*fructose corn syrup|\bhfcs\b/, displayName: "High Fructose Corn Syrup", impact: "negative", tier: "main",
    why: "Concentrated fructose overwhelms gut processing, feeds inflammatory bacteria, drives bloating, and causes sharp blood-sugar spikes that crash energy and can trigger skin breakouts." },
  { pattern: /corn syrup(?! solids)|glucose syrup|invert syrup|rice syrup/, displayName: "Corn Syrup", impact: "negative", tier: "supporting",
    why: "Refined liquid sugar spikes blood glucose, encourages gut dysbiosis, and contributes to energy crashes and inflammatory skin flare-ups." },
  { pattern: /\bcane sugar\b|\bsugar\b(?! substitute| alcohol)|sucrose|brown sugar|beet sugar|invert sugar|turbinado/, displayName: "Sugar", impact: "negative", tier: "supporting",
    why: "Added sugar feeds opportunistic gut microbes, increases bloating and inflammation, and triggers energy and mood crashes; chronic intake is linked to acne." },
  { pattern: /\bdextrose\b|\bfructose\b|\bmaltose\b|\bglucose\b(?! syrup| oxidase)/, displayName: "Refined Sugar", impact: "negative", tier: "micro",
    why: "Refined simple sugars rapidly elevate blood glucose, disrupt the gut microbiome, and promote post-spike fatigue and skin inflammation." },
  { pattern: /maltodextrin/, displayName: "Maltodextrin", impact: "negative", tier: "supporting",
    why: "Has a higher glycemic index than table sugar and can suppress beneficial gut bacteria while promoting inflammation — impacting digestion and energy stability." },

  // --- Artificial & non-nutritive sweeteners ---
  { pattern: /sucralose|splenda/, displayName: "Sucralose", impact: "negative", tier: "supporting",
    why: "Artificial sweetener shown to alter gut microbiome balance and glucose tolerance; frequent intake can worsen bloating and blunt steady energy regulation." },
  { pattern: /aspartame|nutrasweet/, displayName: "Aspartame", impact: "negative", tier: "supporting",
    why: "Linked to microbiome disruption, headaches, and mood/energy dips in sensitive individuals, and may amplify sugar cravings rather than satisfy them." },
  { pattern: /acesulfame(?:[\s-]*k| potassium)?|ace-k/, displayName: "Acesulfame Potassium", impact: "negative", tier: "micro",
    why: "Non-nutritive sweetener associated with gut microbiota disruption and altered metabolic and insulin signaling in research." },
  { pattern: /saccharin/, displayName: "Saccharin", impact: "negative", tier: "micro",
    why: "Has been shown to shift gut microbial composition and impair glucose handling in some studies, which can affect digestion and energy." },
  { pattern: /\bstevia\b|steviol glycoside|rebaudioside/, displayName: "Stevia", impact: "moderate", tier: "micro",
    why: "Plant-based sweetener generally better tolerated than artificial options, though some people report mild bloating or a bitter aftertaste affecting digestion." },
  { pattern: /monk fruit|luo han guo/, displayName: "Monk Fruit Extract", impact: "moderate", tier: "micro",
    why: "Zero-calorie natural sweetener that's generally gut-friendly, but products often pair it with erythritol which can cause bloating in sensitive guts." },
  { pattern: /erythritol/, displayName: "Erythritol", impact: "moderate", tier: "supporting",
    why: "Sugar alcohol that's mostly absorbed before the colon, but larger amounts can cause bloating and digestive upset; recent research links high blood levels to cardiovascular concerns." },
  { pattern: /\bxylitol\b|\bsorbitol\b|\bmannitol\b|\bmaltitol\b|\bisomalt\b|\blactitol\b/, displayName: "Sugar Alcohols", impact: "negative", tier: "supporting",
    why: "Poorly absorbed sugar alcohols ferment in the colon, commonly triggering gas, bloating, and loose stools — especially for sensitive digestion or IBS." },

  // --- Processed seed & refined oils ---
  { pattern: /soybean oil|soya oil/, displayName: "Soybean Oil", impact: "negative", tier: "main",
    why: "Heavily refined seed oil rich in omega-6 linoleic acid that can tilt the body toward inflammation, worsening gut sensitivity and inflammatory skin conditions." },
  { pattern: /canola oil|rapeseed oil/, displayName: "Canola Oil", impact: "negative", tier: "supporting",
    why: "Industrially refined oil whose processing byproducts and omega-6 load can contribute to low-grade inflammation affecting gut and skin." },
  { pattern: /sunflower oil(?! \(high oleic\))/, displayName: "Sunflower Oil", impact: "negative", tier: "supporting",
    why: "High-linoleic-acid seed oil that can promote inflammatory signaling when consumed in excess, potentially worsening gut inflammation and skin reactivity." },
  { pattern: /safflower oil/, displayName: "Safflower Oil", impact: "negative", tier: "supporting",
    why: "Refined omega-6 dominant oil linked to pro-inflammatory effects at high intakes, which can aggravate gut and skin inflammation." },
  { pattern: /\bcorn oil\b/, displayName: "Corn Oil", impact: "negative", tier: "supporting",
    why: "Highly processed omega-6 seed oil associated with inflammatory signaling that can aggravate digestive and skin issues in sensitive individuals." },
  { pattern: /cottonseed oil/, displayName: "Cottonseed Oil", impact: "negative", tier: "supporting",
    why: "Industrial seed oil often carrying pesticide residues and high in omega-6 — linked to inflammation impacting gut and skin." },
  { pattern: /\bvegetable oil\b/, displayName: "Vegetable Oil", impact: "negative", tier: "supporting",
    why: "A blanket term for refined seed oils high in omega-6 fats that, consumed often, can promote inflammation — felt by the gut and on reactive skin." },
  { pattern: /palm oil(?! fruit)|palm kernel oil/, displayName: "Palm Oil", impact: "moderate", tier: "supporting",
    why: "High in saturated fat and often heavily processed; frequent intake may burden digestion and contribute to inflammation in some people." },
  { pattern: /hydrogenated|partially hydrogenated|\btrans fat/, displayName: "Hydrogenated Oils", impact: "negative", tier: "main",
    why: "A source of trans fats that drive systemic inflammation, damage the gut lining, and are tied to worse skin and cardiovascular markers." },

  // --- Emulsifiers & stabilizers ---
  { pattern: /carrageenan/, displayName: "Carrageenan", impact: "negative", tier: "supporting",
    why: "Seaweed-derived emulsifier shown in studies to irritate the gut lining, increase intestinal permeability, and worsen digestive inflammation." },
  { pattern: /polysorbate (?:80|60|20)/, displayName: "Polysorbates", impact: "negative", tier: "micro",
    why: "Synthetic emulsifiers linked in research to altered gut microbiota, thinning of the protective mucus layer, and low-grade gut inflammation." },
  { pattern: /carboxymethyl\s*cellulose|\bcmc\b|cellulose gum/, displayName: "Carboxymethyl Cellulose", impact: "negative", tier: "micro",
    why: "Industrial emulsifier shown to disrupt the gut mucus barrier and alter microbiome composition, which can aggravate bloating and digestive sensitivity." },
  { pattern: /mono[\s-]*and[\s-]*diglycerides|mono-?diglycerides/, displayName: "Mono- and Diglycerides", impact: "moderate", tier: "micro",
    why: "Processed emulsifiers that may contain small amounts of trans fats and have been associated with gut barrier disruption in emerging research." },
  { pattern: /sodium stearoyl lactylate|\bssl\b/, displayName: "Sodium Stearoyl Lactylate", impact: "moderate", tier: "micro",
    why: "Synthetic dough conditioner/emulsifier generally recognized as safe, but part of the ultra-processed additive load the gut has to handle." },
  { pattern: /\bdatem\b|diacetyl tartaric/, displayName: "DATEM", impact: "moderate", tier: "micro",
    why: "Industrial emulsifier used in baked goods; limited direct evidence of harm, but it signals a heavily processed formulation." },
  { pattern: /soy lecithin|sunflower lecithin|\blecithin\b/, displayName: "Lecithin", impact: "moderate", tier: "micro",
    why: "Common emulsifier that's generally well tolerated; soy-derived versions may bother people sensitive to soy, and any emulsifier adds to processed-food load." },
  { pattern: /xanthan gum/, displayName: "Xanthan Gum", impact: "moderate", tier: "micro",
    why: "Fermented thickener that's generally safe but can cause bloating or loose stools in larger amounts or for sensitive digestion." },
  { pattern: /guar gum/, displayName: "Guar Gum", impact: "moderate", tier: "micro",
    why: "Soluble fiber thickener that can feed beneficial bacteria in small amounts but may cause gas and bloating at higher doses." },
  { pattern: /locust bean gum|carob bean gum|gellan gum|\bagar\b/, displayName: "Plant Gums", impact: "moderate", tier: "micro",
    why: "Plant-derived thickeners generally tolerated in small amounts, but can contribute to bloating for sensitive or IBS-prone guts." },

  // --- Preservatives ---
  { pattern: /\bbha\b|butylated hydroxyanisole/, displayName: "BHA", impact: "negative", tier: "micro",
    why: "Synthetic preservative classified as a possible human carcinogen; offers no nutritional benefit and adds to the processed-additive burden on the gut." },
  { pattern: /\bbht\b|butylated hydroxytoluene/, displayName: "BHT", impact: "negative", tier: "micro",
    why: "Synthetic preservative with emerging concerns around hormonal and metabolic effects; a marker of ultra-processed formulation." },
  { pattern: /\btbhq\b|tert-butylhydroquinone/, displayName: "TBHQ", impact: "negative", tier: "micro",
    why: "Petroleum-derived preservative linked in studies to immune-system and gut changes; regulators cap it because of safety concerns at higher intakes." },
  { pattern: /sodium nitrite|sodium nitrate|potassium nitrite|potassium nitrate/, displayName: "Nitrites / Nitrates", impact: "negative", tier: "supporting",
    why: "Curing agents in processed meats that can form nitrosamines in the gut — a class of compounds linked to colon cancer risk and digestive inflammation." },
  { pattern: /sodium benzoate|potassium benzoate|benzoic acid/, displayName: "Benzoate Preservatives", impact: "moderate", tier: "micro",
    why: "Common preservative generally safe in small amounts, but can form trace benzene with vitamin C and may trigger reactions in sensitive individuals." },
  { pattern: /potassium sorbate|sorbic acid/, displayName: "Sorbate Preservatives", impact: "moderate", tier: "micro",
    why: "Antimicrobial preservative with low direct risk, but its presence marks a more processed product that may carry other gut-irritating ingredients." },
  { pattern: /propyl gallate/, displayName: "Propyl Gallate", impact: "moderate", tier: "micro",
    why: "Synthetic antioxidant preservative with early safety concerns; a signal of highly processed foods that may also burden the gut." },

  // --- Artificial colors & flavors ---
  { pattern: /\bred\s*(?:40|3|dye)\b|yellow\s*(?:5|6|dye)|blue\s*(?:1|2|dye)|fd&c|artificial color|allura red|tartrazine|sunset yellow|brilliant blue/, displayName: "Artificial Colors", impact: "negative", tier: "micro",
    why: "Synthetic dyes associated with behavioral reactivity in children and allergic-type responses, offering zero nutritional upside while adding to chemical load." },
  { pattern: /caramel color/, displayName: "Caramel Color", impact: "moderate", tier: "micro",
    why: "Industrial colorant (especially Class III/IV) that can contain 4-MEI, a compound flagged for health concerns at high intakes." },
  { pattern: /artificial flavor/, displayName: "Artificial Flavors", impact: "moderate", tier: "micro",
    why: "An umbrella term for dozens of synthetic compounds; doesn't inherently harm the gut but signals a highly engineered, ultra-processed product." },
  { pattern: /natural flavor/, displayName: "Natural Flavors", impact: "moderate", tier: "micro",
    why: "A vague term that can hide dozens of proprietary compounds — usually fine, but an occasional contributor to bloating or sensitivity reactions." },

  // --- Flavor enhancers ---
  { pattern: /\bmsg\b|monosodium glutamate/, displayName: "MSG", impact: "moderate", tier: "micro",
    why: "Generally recognized as safe, but sensitive individuals report headaches, bloating, or flushing after larger doses." },
  { pattern: /disodium inosinate|disodium guanylate|\bi\+g\b/, displayName: "Flavor Enhancers", impact: "moderate", tier: "micro",
    why: "Often used with MSG to intensify savory taste; harmless for most, but signals a heavily engineered flavor system rather than real ingredients." },
  { pattern: /autolyzed yeast(?: extract)?|yeast extract|hydrolyzed (?:vegetable|soy|corn|wheat|plant) protein|hydrolyzed protein/, displayName: "Hydrolyzed Protein / Yeast Extract", impact: "moderate", tier: "micro",
    why: "A hidden source of free glutamates (MSG-like effect) and a marker of ultra-processed formulation that can trigger reactions in sensitive people." },

  // --- Phosphate additives ---
  { pattern: /sodium phosphate|phosphoric acid|tripolyphosphate|disodium phosphate|potassium phosphate|pyrophosphate/, displayName: "Added Phosphates", impact: "moderate", tier: "micro",
    why: "Inorganic phosphate additives are absorbed far more readily than natural phosphorus, and high cumulative intake has been linked to cardiovascular and kidney strain." },

  // --- Refined starches & flours ---
  { pattern: /modified (?:corn |food |wheat |potato )?starch/, displayName: "Modified Starch", impact: "moderate", tier: "supporting",
    why: "Chemically or enzymatically altered starch used for texture; spikes blood sugar quickly and contributes to ultra-processed carbohydrate load." },
  { pattern: /enriched (?:wheat |bleached )?flour|bleached (?:wheat )?flour|white flour/, displayName: "Refined Flour", impact: "negative", tier: "main",
    why: "Stripped of fiber and nutrients, refined flour spikes blood sugar, can feed less helpful gut bacteria, and offers little for sustained energy." },

  // --- Dairy & animal proteins (context-dependent) ---
  { pattern: /whey protein (?:isolate|concentrate|blend)|milk protein (?:isolate|concentrate)|calcium caseinate|sodium caseinate|micellar casein|\bcasein\b|\bwhey\b/, displayName: "Dairy Protein", impact: "moderate", tier: "main",
    why: "High-quality protein, but dairy proteins commonly trigger bloating, digestive discomfort, and inflammatory breakouts in people with lactose or dairy sensitivity." },
  { pattern: /nonfat milk|skim milk|milk powder|milk solids|\bmilkfat\b|\bmilk\b(?! chocolate| allergen| thistle)/, displayName: "Milk", impact: "moderate", tier: "supporting",
    why: "Conventional dairy is a common trigger for bloating, digestive upset, and acne flare-ups in the significant share of adults with lactose sensitivity." },
  { pattern: /soy protein (?:isolate|concentrate)/, displayName: "Soy Protein Isolate", impact: "moderate", tier: "main",
    why: "Highly processed plant protein; nutritionally solid, but heavy solvent processing and residual phytates can cause digestive discomfort in sensitive eaters." },

  // --- Gluten & wheat ---
  { pattern: /\bwheat\b|\bgluten\b|semolina|\bdurum\b|\bspelt\b|barley malt/, displayName: "Wheat / Gluten", impact: "moderate", tier: "supporting",
    why: "Fine for most, but a well-known trigger for bloating, digestive distress, and inflammatory skin reactions in those with sensitivity, IBS, or celiac disease." },

  // --- Caffeine & stimulants ---
  { pattern: /\bcaffeine\b|guarana|green tea extract/, displayName: "Caffeine", impact: "moderate", tier: "supporting",
    why: "Provides an energy boost but can accelerate gut motility (cramping, urgency), worsen reflux, and disrupt sleep when consumed late or in excess." },

  // --- Sodium (high-salt context) ---
  { pattern: /\bsalt\b(?! substitute)|\bsea salt\b|sodium chloride/, displayName: "Salt", impact: "moderate", tier: "supporting",
    why: "Essential in small amounts, but processed foods often stack excess sodium that can drive water retention, puffiness, and digestive discomfort." },

  // --- Positive / whole-food ingredients ---
  { pattern: /rolled oats|whole (?:grain )?oats|steel[\s-]*cut oats|\boats?\b|oat flour|oat fiber/, displayName: "Oats", impact: "positive", tier: "main",
    why: "Rich in beta-glucan fiber that feeds beneficial gut bacteria, supports steady blood sugar and lasting energy, and nourishes digestion." },
  { pattern: /quinoa/, displayName: "Quinoa", impact: "positive", tier: "main",
    why: "Whole-grain seed providing complete protein and fiber that supports the microbiome and delivers steady energy without blood-sugar crashes." },
  { pattern: /brown rice(?! syrup| protein)/, displayName: "Brown Rice", impact: "positive", tier: "main",
    why: "Whole grain offering fiber and micronutrients that help steady blood sugar and support a healthy gut environment." },
  { pattern: /whole wheat|whole grain/, displayName: "Whole Grains", impact: "positive", tier: "supporting",
    why: "Unrefined grains retain fiber, B vitamins, and minerals that nourish beneficial gut bacteria and support sustained energy." },
  { pattern: /chia seed|flax ?seed|hemp seed|pumpkin seed|sesame seed/, displayName: "Seeds", impact: "positive", tier: "supporting",
    why: "Provide omega-3 fats, fiber, and minerals that calm inflammation, support the gut lining, and can benefit skin clarity." },
  { pattern: /\balmond(?:s)?\b(?! flavor| extract)|\bwalnut(?:s)?\b|\bcashew(?:s)?\b|\bpistachio|\bpecan(?:s)?\b|\bmacadamia/, displayName: "Nuts", impact: "positive", tier: "supporting",
    why: "Whole nuts deliver fiber, healthy fats, and polyphenols linked to better microbiome diversity and more stable energy." },
  { pattern: /olive oil|extra virgin/, displayName: "Olive Oil", impact: "positive", tier: "supporting",
    why: "Rich in monounsaturated fats and polyphenols that are anti-inflammatory and support both gut-lining integrity and heart health." },
  { pattern: /avocado oil|\bavocado\b/, displayName: "Avocado", impact: "positive", tier: "supporting",
    why: "Provides monounsaturated fats, fiber, and potassium that support healthy digestion, steady energy, and skin hydration." },
  { pattern: /\bberr(?:y|ies)\b|blueberr|strawberr|raspberr|blackberr|cranberr/, displayName: "Berries", impact: "positive", tier: "supporting",
    why: "Packed with polyphenols and fiber that feed beneficial microbes and combat oxidative stress — benefits the gut, skin, and energy." },
  { pattern: /\bapple(?!sauce concentrate| juice concentrate)\b/, displayName: "Apple", impact: "positive", tier: "supporting",
    why: "A source of pectin fiber and polyphenols that nurture the gut microbiome and help moderate blood-sugar response." },
  { pattern: /\bbanana\b/, displayName: "Banana", impact: "positive", tier: "supporting",
    why: "Provides resistant starch (especially when less ripe) that feeds beneficial gut bacteria plus potassium for steady energy." },
  { pattern: /spinach|\bkale\b|broccoli|cauliflower|brussels sprout|arugula/, displayName: "Leafy / Cruciferous Greens", impact: "positive", tier: "supporting",
    why: "Deliver fiber, antioxidants, and sulfur compounds that support detox pathways, gut health, and calmer skin." },
  { pattern: /\bchickpea\b|\blentil|\bblack bean|kidney bean|navy bean|pinto bean|garbanzo/, displayName: "Legumes", impact: "positive", tier: "main",
    why: "A powerhouse of fiber, plant protein, and prebiotics that diversify the microbiome and keep energy and digestion steady." },
  { pattern: /\binulin\b|chicory root/, displayName: "Chicory Root Fiber (Inulin)", impact: "moderate", tier: "supporting",
    why: "Prebiotic fiber that feeds beneficial bacteria at moderate doses, but large amounts can cause noticeable bloating and gas." },
  { pattern: /psyllium/, displayName: "Psyllium Husk", impact: "positive", tier: "supporting",
    why: "Soluble fiber that supports regular bowel movements, feeds the microbiome, and helps smooth out blood sugar and energy." },
  { pattern: /probiotic|live (?:active )?cultures|lactobacillus|bifidobacterium/, displayName: "Probiotics", impact: "positive", tier: "supporting",
    why: "Live beneficial microbes that can enhance microbiome diversity, support digestion, and, for some, improve mood and skin." },
  { pattern: /\bpea protein\b/, displayName: "Pea Protein", impact: "positive", tier: "main",
    why: "Plant-based protein that's easy on digestion for most people and provides amino acids for lean muscle and sustained energy." },
  { pattern: /hemp protein|brown rice protein|pumpkin seed protein/, displayName: "Plant Protein", impact: "positive", tier: "main",
    why: "Allergy-friendly plant proteins that deliver amino acids while being gentle on digestion for most people." },
  { pattern: /\beggs?\b|egg white/, displayName: "Egg", impact: "positive", tier: "main",
    why: "Complete protein with choline and B vitamins that support lean muscle, stable energy, and skin health." },
  { pattern: /turmeric/, displayName: "Turmeric", impact: "positive", tier: "micro",
    why: "Curcumin-rich spice with anti-inflammatory effects that can calm gut inflammation and support clearer skin." },
  { pattern: /\bginger\b/, displayName: "Ginger", impact: "positive", tier: "micro",
    why: "Traditional digestive aid — soothes nausea, supports gastric emptying, and calms gut inflammation." },
  { pattern: /cinnamon/, displayName: "Cinnamon", impact: "positive", tier: "micro",
    why: "Can help moderate blood-sugar responses and provides antioxidants that support steady energy." },
  { pattern: /cocoa processed with alkali|dutch(?:ed)? cocoa|alkalized cocoa/, displayName: "Dutch-Processed Cocoa", impact: "moderate", tier: "micro",
    why: "Alkalization strips much of the beneficial flavanol content from cocoa, leaving color and taste but far fewer gut and heart benefits." },
  { pattern: /\bcocoa\b|unsweetened cocoa|cacao/, displayName: "Cocoa", impact: "positive", tier: "supporting",
    why: "Rich in flavanol polyphenols that feed beneficial gut bacteria and support mood and vascular health." },
];

const VITAMIN_MINERAL_RE =
  /\bvitamin\b|\bniacin|riboflavin|thiamin|folate|folic acid|biotin|pantothen|pyridoxine|cyanocobalamin|ascorbic acid|tocopherol|cholecalciferol|calcium (?:carbonate|citrate|phosphate|pantothenate)|ferrous|\biron\b|\bzinc\b|selenium|manganese|\bcopper\b|chromium|molybdenum|potassium iodide|potassium chloride|magnesium (?:oxide|citrate|phosphate)/i;

function cleanIngredientName(raw: string): string {
  return toTitleCase(
    raw
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/\([^)]{0,80}\)/g, " ")
      .replace(/\b\d+(?:\.\d+)?\s*%?\b/g, " ")
      .replace(/[*†‡]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Deterministic, offline ingredient classifier. Used as both a fallback when
 * the AI analysis fails and as an augmentation pass to catch high-impact
 * ingredients the AI may have missed or soft-pedalled. Never throws.
 */
export function ruleBasedAnalyzeIngredients(
  ingredients: string[],
  _productName?: string
): IngredientAnalysisResult {
  const cleaned = ingredients
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter((s) => s.length > 0 && !/^(?:contains|ingredients?)\s*:/i.test(s));

  const emptyResult: IngredientAnalysisResult = {
    items: [],
    redCount: 0,
    yellowCount: 0,
    greenCount: 0,
    tierCounts: { main: 0, supporting: 0, micro: 0 },
  };
  if (cleaned.length === 0) return emptyResult;

  const seen = new Map<string, AnalyzedIngredient>();

  cleaned.forEach((raw, index) => {
    const lower = raw.toLowerCase();
    const matchText = lower.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ");

    let matched: PatternEntry | null = null;
    for (const p of INGREDIENT_PATTERNS) {
      if (p.pattern.test(matchText)) {
        matched = p;
        break;
      }
    }

    if (matched) {
      const key = matched.displayName.toLowerCase();
      if (seen.has(key)) return;
      // Position-aware tier promotion/demotion so mains stay first.
      let tier: IngredientTier = matched.tier;
      if (index < 3 && tier === "supporting") tier = "main";
      else if (index > 10 && tier === "main") tier = "supporting";
      seen.set(key, {
        displayName: matched.displayName,
        impact: matched.impact,
        whyMatters: enrichWhyMatters(matched.displayName, matched.impact, matched.why),
        tier,
      });
      return;
    }

    // Unknown ingredient fallback.
    const name = cleanIngredientName(raw);
    if (!name || name.length < 2) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;

    if (VITAMIN_MINERAL_RE.test(lower)) {
      seen.set(key, {
        displayName: name,
        impact: "positive",
        whyMatters:
          "Added vitamin or mineral that supports general nutritional needs; impact depends on dose and your overall diet.",
        tier: "micro",
      });
      return;
    }

    seen.set(key, {
      displayName: name,
      impact: "positive",
      whyMatters: "Common food ingredient with no well-known gut-health concerns in typical amounts.",
      tier: index < 3 ? "main" : index < 8 ? "supporting" : "micro",
    });
  });

  const items = [...seen.values()];
  let redCount = 0;
  let yellowCount = 0;
  let greenCount = 0;
  const tierCounts = { main: 0, supporting: 0, micro: 0 };
  for (const it of items) {
    if (it.impact === "negative") redCount++;
    else if (it.impact === "moderate") yellowCount++;
    else greenCount++;
    if (it.tier) tierCounts[it.tier]++;
  }
  return { items, redCount, yellowCount, greenCount, tierCounts };
}

function buildCounts(items: AnalyzedIngredient[]): IngredientAnalysisResult {
  let redCount = 0;
  let yellowCount = 0;
  let greenCount = 0;
  const tierCounts = { main: 0, supporting: 0, micro: 0 };
  for (const it of items) {
    if (it.impact === "negative") redCount++;
    else if (it.impact === "moderate") yellowCount++;
    else greenCount++;
    if (it.tier) tierCounts[it.tier]++;
  }
  return { items, redCount, yellowCount, greenCount, tierCounts };
}

/**
 * Single Groq request. Throws on network/parse failure so the caller can
 * decide whether to retry or fall back.
 */
async function callGroqForIngredients(
  ingredients: string[],
  productName?: string
): Promise<AnalyzedIngredient[]> {
  const listText = ingredients.map((ing, i) => `${i + 1}. ${ing}`).join("\n");
  const userContent = productName
    ? `Product: ${productName}\n\nIngredients (raw from label):\n${listText}\n\nReturn the JSON object with "items" array as specified.`
    : `Ingredients (raw from label):\n${listText}\n\nReturn the JSON object with "items" array as specified.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_TEXT_MODEL,
        messages: [
          { role: "system", content: JSON_SCHEMA },
          { role: "user", content: userContent },
        ],
        max_tokens: 2048,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
  } catch (fetchErr) {
    clearTimeout(timeout);
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    if (msg.includes("aborted")) throw new Error("Request timed out.");
    throw fetchErr;
  }
  clearTimeout(timeout);

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

  const rawContent = (data?.choices as Array<{ message?: { content?: string } }>)?.[0]?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : "";

  const parsed = safeParse<{
    items?: Array<{
      displayName?: string;
      impact?: string;
      whyMatters?: string;
      tier?: string;
      estimatedGrams?: number;
    }>;
  }>(content);

  if (!parsed?.items || !Array.isArray(parsed.items)) return [];

  return parsed.items
    .filter((x) => x && (x.displayName ?? x.whyMatters))
    .map((x) => {
      const rawDisplayName = typeof x.displayName === "string" ? x.displayName.trim() || "Unknown" : "Unknown";
      const displayName = toTitleCase(rawDisplayName);
      const impact = normalizeImpact(x.impact);
      const whyMattersBase =
        typeof x.whyMatters === "string" ? x.whyMatters.trim() || "Relevant to gut health." : "Relevant to gut health.";
      return {
        displayName,
        impact,
        whyMatters: enrichWhyMatters(displayName, impact, whyMattersBase),
        tier: normalizeTier(x.tier),
        estimatedGrams:
          typeof x.estimatedGrams === "number" && Number.isFinite(x.estimatedGrams)
            ? Math.max(0, x.estimatedGrams)
            : undefined,
      };
    });
}

/**
 * Analyze raw ingredients and return a populated `IngredientAnalysisResult`.
 *
 * Resilience strategy:
 *   1. Try Groq with up to 2 attempts (short backoff).
 *   2. If AI fails or returns no items, fall back to the rule-based classifier.
 *   3. If AI succeeds, augment its output with any high-impact (negative or
 *      moderate) ingredients the rules caught but the AI missed.
 *
 * This guarantees the UI never shows "all ingredients safe" when the product
 * actually contains known gut-disruptive ingredients.
 */
export async function analyzeIngredients(
  ingredients: string[],
  productName?: string,
  _profile?: OnboardingProfile | null
): Promise<IngredientAnalysisResult> {
  const nonEmpty = ingredients.filter((s) => typeof s === "string" && s.trim().length > 0);
  if (nonEmpty.length === 0) {
    return { items: [], redCount: 0, yellowCount: 0, greenCount: 0, tierCounts: { main: 0, supporting: 0, micro: 0 } };
  }

  // No API key → deterministic rule-based analysis only.
  if (!GROQ_API_KEY) {
    console.warn("[ingredient-analysis] GROQ_API_KEY not set; using rule-based analysis.");
    return ruleBasedAnalyzeIngredients(nonEmpty, productName);
  }

  let aiItems: AnalyzedIngredient[] = [];
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      aiItems = await callGroqForIngredients(nonEmpty, productName);
      if (aiItems.length > 0) break;
    } catch (err) {
      lastError = err;
      console.warn(`[ingredient-analysis] AI attempt ${attempt + 1} failed:`, err);
      if (attempt === 0) await new Promise((r) => setTimeout(r, 600));
    }
  }

  if (aiItems.length === 0) {
    if (lastError) {
      console.warn("[ingredient-analysis] AI failed after retries; using rule-based fallback.");
    } else {
      console.warn("[ingredient-analysis] AI returned zero items; using rule-based fallback.");
    }
    return ruleBasedAnalyzeIngredients(nonEmpty, productName);
  }

  // Augment AI output with rule-based hits the AI missed (only non-positive
  // ones — we trust the AI for "positive" classifications so we don't double-
  // count harmless items).
  const ruleResult = ruleBasedAnalyzeIngredients(nonEmpty, productName);
  const aiNames = new Set(aiItems.map((i) => i.displayName.toLowerCase()));
  const additions = ruleResult.items.filter(
    (r) => r.impact !== "positive" && !aiNames.has(r.displayName.toLowerCase())
  );
  const merged = additions.length > 0 ? [...aiItems, ...additions] : aiItems;
  return buildCounts(merged);
}
