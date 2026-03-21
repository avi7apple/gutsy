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

export interface AnalyzedIngredient {
  displayName: string;
  impact: IngredientImpact;
  whyMatters: string;
}

export interface IngredientAnalysisResult {
  items: AnalyzedIngredient[];
  redCount: number;
  yellowCount: number;
  greenCount: number;
}

const JSON_SCHEMA = `You are a gut-health expert. Given a list of raw ingredients from a food product label, return a JSON object with a single key "items" (array of objects). For each RELEVANT ingredient (skip trivial ones like "salt" as sole entry if duplicated; merge sub-ingredients into parent when they're just variants like "[2% zinc]" — show "Vegetable Oil" not "Vegetable Oil [2% zinc]").
Each item must have:
- displayName (string): simple, clean name for the ingredient (e.g. "Vegetable Oil", "High Fructose Corn Syrup"). Strip percentages, bracketed additives, and redundant text. Use title case.
- impact (string): one of "negative" (bad for gut), "moderate" (caution), "positive" (good for gut).
- whyMatters (string): 1-2 concise sentences on why this ingredient matters. Always include gut-health impact (microbiome, bloating, inflammation, digestion). ALSO include skin and/or energy/mood effects when relevant for that ingredient.
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
  if (str === "negative" || str === "bad" || str === "red") return "negative";
  if (str === "moderate" || str === "caution" || str === "yellow" || str === "warning") return "moderate";
  return "positive";
}

/**
 * Analyze raw ingredients with Groq; returns display names, impact, whyMatters, and counts.
 */
export async function analyzeIngredients(
  ingredients: string[],
  productName?: string,
  _profile?: OnboardingProfile | null
): Promise<IngredientAnalysisResult> {
  if (!GROQ_API_KEY) {
    throw new Error(
      "EXPO_PUBLIC_GROQ_API_KEY is not set. Add it to your .env file. Get a free key at https://console.groq.com"
    );
  }

  const listText =
    ingredients.length === 0
      ? "(no ingredients)"
      : ingredients.map((ing, i) => `${i + 1}. ${ing}`).join("\n");

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
    if (msg.includes("aborted")) throw new Error("Request timed out. Try again.");
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

  const parsed = safeParse<{ items?: Array<{ displayName?: string; impact?: string; whyMatters?: string }> }>(
    content
  );

  if (!parsed?.items || !Array.isArray(parsed.items)) {
    return { items: [], redCount: 0, yellowCount: 0, greenCount: 0 };
  }

  const items: AnalyzedIngredient[] = parsed.items
    .filter((x) => x && (x.displayName ?? x.whyMatters))
    .map((x) => {
      const displayName = typeof x.displayName === "string" ? x.displayName.trim() || "Unknown" : "Unknown";
      const impact = normalizeImpact(x.impact);
      const whyMattersBase =
        typeof x.whyMatters === "string" ? x.whyMatters.trim() || "Relevant to gut health." : "Relevant to gut health.";

      return {
        displayName,
        impact,
        whyMatters: enrichWhyMatters(displayName, impact, whyMattersBase),
      };
    });

  let redCount = 0;
  let yellowCount = 0;
  let greenCount = 0;
  for (const it of items) {
    if (it.impact === "negative") redCount++;
    else if (it.impact === "moderate") yellowCount++;
    else greenCount++;
  }

  return { items, redCount, yellowCount, greenCount };
}
