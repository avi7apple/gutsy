/**
 * Builds ProductInsight for packaged product scans (Groq + deterministic at-a-glance).
 */

import { buildAtAGlance, gutsyScoreToHealthGrade } from "@/lib/product-at-a-glance";
import type { ProductInfo } from "@/lib/product-lookup";
import type { ComputedScores } from "@/lib/scoring-engine";
import type { OnboardingProfile } from "@/lib/onboarding-storage";
import type {
  HealthFlag,
  IngredientLevel,
  ProductIngredient,
  ProductInsight,
} from "@/types/product-scan";

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? "";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_TEXT_MODEL = "llama-3.1-8b-instant";
const REQUEST_TIMEOUT_MS = 14_000;

const PRODUCT_INSIGHT_SCHEMA = `Respond with exactly one JSON object, no markdown. Keys:
gutReaction (string, one opinionated sentence about overall health impact),
healthGrade (string: "Excellent"|"Good"|"Okay"|"Poor"|"Avoid"),
parentCompany (string, parent corp if different from brand, else same as brand),
hasActiveRecall (boolean),
recallUrl (string, empty if none),
ingredients (array up to 12 objects: name, role, level as "hi"|"med"|"lo"|"ben"|"neutral", badge, whatItIs, gutImpact, positives string array, concerns string array, riskContext, regulatoryStatus array of {body, flag emoji, status}),
healthFlags (array of 5 objects: name, severity as "High"|"Medium"|"Low"|"Low–Med", dotColor as "red"|"amber"|"green", detail string, isRelevant boolean).
Flag names must include: "Gut lining risk", "Microplastic risk", "Pesticide risk", "Heavy metal risk", "Endocrine disruptor risk".
Be specific to THIS product. Valid JSON only.`;

interface LlmProductInsight {
  gutReaction?: string;
  healthGrade?: ProductInsight["healthGrade"];
  parentCompany?: string;
  hasActiveRecall?: boolean;
  recallUrl?: string;
  ingredients?: ProductIngredient[];
  healthFlags?: HealthFlag[];
}

function extractJsonFromText(text: string): string {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) return trimmed;
  return trimmed.slice(start, end + 1);
}

function safeParse<T>(text: string): T | null {
  try {
    return JSON.parse(extractJsonFromText(text)) as T;
  } catch {
    return null;
  }
}

async function callGroq(messages: { role: string; content: string }[]): Promise<string> {
  if (!GROQ_API_KEY) throw new Error("Groq API key not configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({ model: GROQ_TEXT_MODEL, messages, max_tokens: 3000, temperature: 0.15 }),
      signal: controller.signal,
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(`Groq ${res.status}`);
    }
    const content = (data?.choices as { message?: { content?: string } }[])?.[0]?.message?.content;
    if (!content) throw new Error("Empty Groq response");
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeLevel(raw: string): IngredientLevel {
  if (raw === "hi" || raw === "med" || raw === "lo" || raw === "ben" || raw === "neutral") return raw;
  return "neutral";
}

function normalizeIngredients(raw: ProductIngredient[] | undefined): ProductIngredient[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 12).map((item) => ({
    name: item.name ?? "Unknown",
    role: item.role ?? "Ingredient",
    level: normalizeLevel(item.level as string),
    badge: item.badge ?? "Neutral",
    whatItIs: item.whatItIs ?? "",
    gutImpact: item.gutImpact ?? item.whatItIs ?? "",
    positives: Array.isArray(item.positives) ? item.positives : [],
    concerns: Array.isArray(item.concerns) ? item.concerns : [],
    riskContext: item.riskContext ?? "",
    regulatoryStatus: Array.isArray(item.regulatoryStatus) ? item.regulatoryStatus : [],
  }));
}

function defaultHealthFlags(atAGlance: ProductInsight["atAGlance"], ingredientsText: string): HealthFlag[] {
  const text = ingredientsText.toLowerCase();
  return [
    {
      name: "Gut lining risk",
      severity: "High",
      dotColor: "red",
      detail:
        "Emulsifiers and highly processed additives may increase intestinal permeability in sensitive individuals.",
      isRelevant: atAGlance.additivesCount >= 2 || /emulsif|carrageenan|polysorbate/.test(text),
    },
    {
      name: "Microplastic risk",
      severity: "Medium",
      dotColor: "amber",
      detail: "Plastic packaging may leach microplastics, especially with heat or fat content.",
      isRelevant: atAGlance.packaging.toLowerCase().includes("plastic"),
    },
    {
      name: "Pesticide risk",
      severity: "Medium",
      dotColor: "amber",
      detail: "Conventional farming of key ingredients may leave pesticide residues.",
      isRelevant: /corn|soy|wheat|potato|berry|apple/.test(text),
    },
    {
      name: "Heavy metal risk",
      severity: "Low–Med",
      dotColor: "amber",
      detail: "Rice, cocoa, and root vegetables can concentrate heavy metals depending on sourcing.",
      isRelevant: /rice|cocoa|chocolate|seafood/.test(text),
    },
    {
      name: "Endocrine disruptor risk",
      severity: "Medium",
      dotColor: "amber",
      detail: "Some additives and packaging compounds may interfere with hormone signaling.",
      isRelevant: atAGlance.additivesCount >= 1,
    },
  ];
}

export async function buildProductInsight(
  product: ProductInfo,
  scores: ComputedScores,
  profile: OnboardingProfile | null | undefined,
  parsedIngredients?: string[],
): Promise<ProductInsight> {
  const productName = product.name;
  const brandName = product.brand || "Unknown brand";
  const gutsyScore = scores.gut_score;
  const atAGlance = buildAtAGlance(product, parsedIngredients);

  let llm: LlmProductInsight | null = null;
  try {
    const profileCtx = profile
      ? `User goal: ${profile.goal ?? "none"}. Trigger: ${profile.trigger ?? "none"}.`
      : "";
    const raw = await callGroq([
      {
        role: "system",
        content: `You are a holistic food health analyst for the Gutsy app. ${profileCtx} ${PRODUCT_INSIGHT_SCHEMA}`,
      },
      {
        role: "user",
        content: `Product: ${productName}\nBrand: ${brandName}\nGutsy score: ${gutsyScore}/100\nIngredients: ${product.ingredients ?? "unknown"}\nCategories: ${product.categories ?? ""}\nAt-a-glance: ${JSON.stringify(atAGlance)}`,
      },
    ]);
    llm = safeParse<LlmProductInsight>(raw);
  } catch {
    llm = null;
  }

  const healthGrade =
    llm?.healthGrade && ["Excellent", "Good", "Okay", "Poor", "Avoid"].includes(llm.healthGrade)
      ? llm.healthGrade
      : gutsyScoreToHealthGrade(gutsyScore);

  const parentCo = llm?.parentCompany?.trim();
  const showParent =
    parentCo && parentCo.toLowerCase() !== brandName.toLowerCase() ? parentCo : undefined;

  const ingredients = normalizeIngredients(llm?.ingredients);
  const healthFlags =
    Array.isArray(llm?.healthFlags) && llm.healthFlags.length > 0
      ? llm.healthFlags
      : defaultHealthFlags(atAGlance, product.ingredients ?? "");

  return {
    productName,
    brandName,
    parentCompany: showParent,
    productImageUrl: product.imageUrl,
    gutsyScore,
    healthGrade,
    gutReaction:
      llm?.gutReaction?.trim() ||
      `A Gutsy score of ${gutsyScore} suggests this product has ${gutsyScore >= 70 ? "solid" : gutsyScore >= 40 ? "mixed" : "concerning"} effects on your overall health profile.`,
    hasActiveRecall: llm?.hasActiveRecall === true,
    recallUrl: llm?.recallUrl || undefined,
    atAGlance,
    ingredients,
    healthFlags,
    alternatives: [],
  };
}
