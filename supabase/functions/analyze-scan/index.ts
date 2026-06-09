// Supabase Edge Function: analyze-scan
// This is the only place that calls the Groq LLM. The app sends requests here; we call Groq and return
// the full result (food_name, scores, analysis.personalizedInsights, bloatDetails, etc.). No Groq usage
// in the dashboard means this function is not being reached (e.g. 404 = not deployed).
// Set GROQ_API_KEY in Supabase Dashboard → Edge Functions → Secrets.

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_TEXT_MODEL = "llama-3.1-8b-instant";

interface OnboardingProfile {
  goal?: string | null;
  skinConcern?: string | null;
  skinType?: string | null;
  water?: string | null;
  trigger?: string | null;
}

interface AnalyzeRequestBody {
  scan_type: "photo" | "barcode";
  image_url?: string;
  image_base64?: string;
  barcode?: string;
  profile?: OnboardingProfile;
}

interface ScanResult {
  scan_type: "photo" | "barcode";
  food_name: string;
  /** Full product name (e.g. "Lay's Classic Potato Chips") for barcode scans */
  product_name?: string;
  /** Brand/manufacturer (e.g. "Frito-Lay") for barcode scans */
  manufacturer?: string;
  identified_foods: string[];
  gut_score?: number;
  bloat_score: number;
  skin_score: number;
  energy_score: number;
  digestion_score: number;
  analysis: { 
    summary: string; 
    tips: string[]; 
    skin?: string; 
    digestion?: string; 
    mood?: string;
    bloatDetails?: { expectedTime?: string; tip?: string };
    impactDetails?: {
      skin?: { description: string; learnMore?: { title: string; content: string; sensitivity?: string } };
      bloating?: { description: string; learnMore?: { title: string; content: string; timing?: string } };
      digestion?: { description: string; learnMore?: { title: string; content: string } };
      energy?: { description: string; learnMore?: { title: string; content: string } };
    };
    goalPrediction?: {
      forecast?: Array<{ time: string; risk: string; description: string }>;
      improvements?: Array<{ action: string; newScore: string; impact: string }>;
    };
    personalizedInsights?: Array<{
      type: "trigger" | "quick_win" | "pattern" | "great_choice" | "warning";
      title: string;
      detail: string;
      tip?: string;
      stat?: string;
      swap?: { from: string; to: string; scoreChange: string };
      progress?: { current: number; total: number; unlock?: string };
    }>;
    improvementOptions?: {
      urgency?: string;
      option1?: { title: string; time: string; skips: string[]; keeps: string[]; results: { bloat: string; skin?: string; energy?: string } };
      option2?: { title: string; mealName: string; mealImage?: string; scores: { bloat: string; skin: string; energy: string }; testimonial?: string };
    };
    timingInsights?: {
      currentTime?: string;
      idealTimes?: Array<{ meal: string; time: string; note: string }>;
      currentStatus?: string;
      whyMatters?: string;
      premiumNote?: string;
    };
    nutritionContext?: {
      goalContext?: Array<{ nutrient: string; value: string; status: "high" | "moderate" | "good"; reason: string }>;
      optimalRanges?: Array<{ nutrient: string; range: string }>;
    };
  };
  nutrition: Record<string, number | undefined>;
  ai_confidence?: number;
  barcode?: string;
  image_url?: string;
  image_storage_path?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function gutsyScoreToHealthGrade(score: number): "Excellent" | "Good" | "Okay" | "Poor" | "Avoid" {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 50) return "Okay";
  if (score >= 35) return "Poor";
  return "Avoid";
}

function buildDefaultProductInsight(result: Partial<ScanResult>): any {
  const productName = (typeof result.product_name === "string" && result.product_name.trim()) || result.food_name || "Scanned Product";
  const brandName = result.manufacturer || "Unknown brand";
  const gutsyScore = typeof result.gut_score === "number" ? Math.round(result.gut_score) : 50;
  const healthGrade = gutsyScoreToHealthGrade(gutsyScore);

  return {
    productName,
    brandName,
    parentCompany: undefined,
    productImageUrl: result.image_url || undefined,
    gutsyScore,
    healthGrade,
    gutReaction:
      gutsyScore >= 70
        ? "This product looks solid for your overall health profile."
        : gutsyScore >= 40
          ? "This product may have mixed effects depending on your overall diet and timing."
          : "This product may be a less ideal choice for your overall health profile.",
    hasActiveRecall: false,
    recallUrl: undefined,
    atAGlance: {
      additivesCount: 0,
      seedOils: null,
      processingLevel: "NOVA 1–2 (Minimally processed)",
      sugarAliasCount: 0,
      allergens: [],
      packaging: "Paper/cardboard",
      realFoodRatio: 80,
    },
    ingredients: [],
    healthFlags: [],
    alternatives: [],
  };
}

function attachProductInsight(result: ScanResult): ScanResult {
  if (!result?.analysis) return result;
  const existing = (result.analysis as any).productInsight;
  if (existing) return result;
  (result.analysis as any).productInsight = buildDefaultProductInsight(result);
  return result;
}

const SCAN_RESULT_JSON_SCHEMA = `Respond with exactly one JSON object, no markdown or extra text, with these keys (all required): food_name (string), product_name (string, full product name e.g. "Lay's Classic Potato Chips" not generic "potato chips"), manufacturer (string, brand/company e.g. "Frito-Lay"), identified_foods (array of strings), gut_score (0-100 number), bloat_score (0-100 number, lower = less bloating), skin_score (0-10 number), energy_score (0-10 number), digestion_score (0-10 number), analysis (object with: summary string, tips array of strings, skin string, digestion string, mood string, bloatDetails object {expectedTime string estimating when bloating will occur based on THIS specific product e.g. "2-3 hours" or "4-6 hours" or "6-8 hours" - be specific to the product content, tip string personalized tip for THIS product}, impactDetails object {skin object {description string specific to THIS product, learnMore object {title string, content string, sensitivity string}}, bloating object {description string specific to THIS product, learnMore object {title string, content string, timing string}}, digestion object {description string specific to THIS product, learnMore object {title string, content string}}, energy object {description string specific to THIS product, learnMore object {title string, content string}}}, goalPrediction object {forecast array of {time string, risk string, description string}, improvements array of {action string, newScore string, impact string}}, personalizedInsights array of 3 objects personalized to THIS specific product with: type "trigger"|"quick_win"|"pattern"|"great_choice"|"warning", title string, detail string specific to THIS product content, tip string optional, stat string optional, swap object optional {from string, to string, scoreChange string}, progress object optional {current number, total number, unlock string}), nutrition (object with optional keys: calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg), image_url (string, optional - if you can provide a publicly accessible image URL for this product/meal, include it; otherwise use empty string ""). Output valid JSON only: no trailing commas, no unescaped newlines inside string values.`;

function extractJsonFromText(text: string): string {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return trimmed;
  return trimmed.slice(start, end + 1);
}

/** Fix common LLM JSON mistakes so JSON.parse can succeed */
function repairJson(jsonStr: string): string {
  let out = jsonStr;
  // Remove trailing commas before ] or } (e.g. "item1",] or "key": value,})
  out = out.replace(/,(\s*[}\]])/g, "$1");
  // Remove double (or more) commas - leaves empty element which is invalid
  out = out.replace(/,(\s*),/g, ",");
  // Escape raw newlines inside double-quoted strings (invalid in JSON)
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

/** Extract minimal fields from malformed LLM JSON text so we can return a valid result instead of 500 */
function extractPartialFromRawText(rawText: string): Partial<ScanResult> {
  const str = rawText.replace(/\s+/g, " ");
  const foodNameMatch = str.match(/"food_name"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const productNameMatch = str.match(/"product_name"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const manufacturerMatch = str.match(/"manufacturer"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const bloatMatch = str.match(/"bloat_score"\s*:\s*(\d+)/);
  const skinMatch = str.match(/"skin_score"\s*:\s*(\d+)/);
  const energyMatch = str.match(/"energy_score"\s*:\s*(\d+)/);
  const digestionMatch = str.match(/"digestion_score"\s*:\s*(\d+)/);
  const gutMatch = str.match(/"gut_score"\s*:\s*(\d+)/);
  const summaryMatch = str.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const food_name = (foodNameMatch?.[1] ?? productNameMatch?.[1] ?? "Unknown").replace(/\\"/g, '"');
  const product_name = productNameMatch?.[1]?.replace(/\\"/g, '"') ?? food_name;
  const manufacturer = manufacturerMatch?.[1]?.replace(/\\"/g, '"') ?? undefined;
  const bloat_score = bloatMatch ? Math.min(100, Math.max(0, parseInt(bloatMatch[1], 10))) : 50;
  const skin_score = skinMatch ? Math.min(10, Math.max(0, parseInt(skinMatch[1], 10))) : 5;
  const energy_score = energyMatch ? Math.min(10, Math.max(0, parseInt(energyMatch[1], 10))) : 5;
  const digestion_score = digestionMatch ? Math.min(10, Math.max(0, parseInt(digestionMatch[1], 10))) : 5;
  const gut_score = gutMatch ? Math.min(100, Math.max(0, parseInt(gutMatch[1], 10))) : undefined;
  const summary = summaryMatch?.[1]?.replace(/\\"/g, '"') ?? "Analysis completed with minor formatting issues.";
  return {
    food_name,
    product_name,
    manufacturer,
    identified_foods: [food_name],
    bloat_score,
    skin_score,
    energy_score,
    digestion_score,
    gut_score,
    analysis: { summary, tips: [] },
    nutrition: {},
  };
}

type GroqMessage =
  | { role: "system"; content: string }
  | {
      role: "user";
      content: string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
    };

async function callGroq(messages: GroqMessage[], model: string): Promise<Partial<ScanResult>> {
  if (!GROQ_API_KEY) {
    console.error("[DEBUG] callGroq - GROQ_API_KEY not set!");
    throw new Error("GROQ_API_KEY not set - please set it in Supabase Dashboard → Edge Functions → Secrets");
  }
  console.log("[DEBUG] callGroq - Calling Groq API, model:", model);
  console.log("[DEBUG] callGroq - Messages count:", messages.length);
  console.log("[DEBUG] callGroq - First message preview:", JSON.stringify(messages[0]).substring(0, 200));
  const res = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 2048,
      temperature: 0.2,
    }),
  });
  let data: Record<string, unknown>;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch (_) {
    throw new Error(`Groq returned invalid JSON (status ${res.status}). Check your API key and model name.`);
  }
  console.log("[DEBUG] callGroq - Response status:", res.status, res.ok);
  if (!res.ok) {
    console.error("[DEBUG] callGroq - Groq API error:", JSON.stringify(data));
    const errMsg = (data?.error as any)?.message || (data?.error as any)?.code || JSON.stringify(data);
    throw new Error(`Groq error: ${res.status} ${errMsg}`);
  }
  const text = (data?.choices as { message?: { content?: string } }[] | undefined)?.[0]?.message?.content;
  console.log("[DEBUG] callGroq - Response text length:", text?.length || 0);
  if (!text) throw new Error("Empty Groq response");
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/025d8125-b3f8-4cbb-a462-51b42cebb67c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyze-scan/index.ts:138',message:'LLM raw response text',data:{textLength:text.length,textPreview:text.substring(0,200)},timestamp:Date.now(),runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  const jsonStr = extractJsonFromText(text);
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/025d8125-b3f8-4cbb-a462-51b42cebb67c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyze-scan/index.ts:151',message:'Extracted JSON string',data:{jsonStrLength:jsonStr.length,jsonStrPreview:jsonStr.substring(0,200)},timestamp:Date.now(),runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  let parsed: Partial<ScanResult>;
  try {
    parsed = JSON.parse(jsonStr) as Partial<ScanResult>;
    console.log("[DEBUG] callGroq - JSON parsed successfully, food_name:", parsed.food_name);
  } catch (firstErr) {
    const repaired = repairJson(jsonStr);
    try {
      parsed = JSON.parse(repaired) as Partial<ScanResult>;
      console.log("[DEBUG] callGroq - JSON parsed after repair, food_name:", parsed.food_name);
    } catch (_secondErr) {
      console.error("[DEBUG] callGroq - JSON parse failed, using fallback extraction:", firstErr instanceof Error ? firstErr.message : String(firstErr));
      const pos = typeof (firstErr as SyntaxError).message === "string" && (firstErr as SyntaxError).message.includes("position ")
        ? parseInt((firstErr as SyntaxError).message.replace(/.*position (\d+).*/, "$1"), 10) || 0
        : 0;
      if (pos > 0) console.error("[DEBUG] callGroq - Snippet around error:", jsonStr.substring(Math.max(0, pos - 40), pos + 40));
      parsed = extractPartialFromRawText(jsonStr);
      console.log("[DEBUG] callGroq - Fallback partial result, food_name:", parsed.food_name);
    }
  }
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/025d8125-b3f8-4cbb-a462-51b42cebb67c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyze-scan/index.ts:160',message:'Parsed LLM response',data:{hasError:!!(parsed as any).error,errorField:(parsed as any).error,foodName:parsed.food_name,hasImageUrl:!!parsed.image_url},timestamp:Date.now(),runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  return parsed;
}

async function callGroqForBarcode(barcode: string, profile?: OnboardingProfile): Promise<Partial<ScanResult>> {
  const profileContext = profile
    ? `User profile: Goal="${profile.goal || "none"}", Trigger="${profile.trigger || "none"}", Skin concern="${profile.skinConcern || "none"}", Skin type="${profile.skinType || "none"}", Water intake="${profile.water || "none"}". `
    : "";
  const system = `You are a gut-health and wellness assistant. Given a product barcode (EAN/UPC), identify the exact product: use product_name as the full commercial name (e.g. "Lay's Classic Potato Chips", not "potato chips") and manufacturer as the brand or parent company (e.g. "Frito-Lay"). Estimate nutrition and gut-impact scores if unknown. ${profileContext}Generate ALL personalized content based on THIS specific product - do NOT use generic/dummy values. For image_url: if you know a publicly accessible image URL for this product, provide it; otherwise use empty string "". Do NOT rely on external APIs - provide everything yourself. ${SCAN_RESULT_JSON_SCHEMA}`;
  const userText = `Barcode: ${barcode}\n\nIdentify this product and generate personalized insights. Output the JSON object only (include product_name, manufacturer, and all other required keys including analysis.bloatDetails.expectedTime, analysis.personalizedInsights, image_url if available, etc.). Make all content specific to THIS product, not generic.`;
  return callGroq([{ role: "system", content: system }, { role: "user", content: userText }], GROQ_TEXT_MODEL);
}

async function callGroqVision(imageBase64: string, mimeType: string, profile?: OnboardingProfile): Promise<Partial<ScanResult>> {
  const profileContext = profile
    ? `User profile: Goal="${profile.goal || "none"}", Trigger="${profile.trigger || "none"}", Skin concern="${profile.skinConcern || "none"}", Skin type="${profile.skinType || "none"}", Water intake="${profile.water || "none"}". `
    : "";
  const system = `You are a gut-health and wellness assistant. The image is a photo of a food product (package, label, or product). Identify the product name, brand, and if visible use nutrition/ingredients from the label. Estimate how it may affect bloat (0-100, lower=less bloating), skin (0-10), energy (0-10), and digestion (0-10). Use food_name and product_name for the product name. ${profileContext}Generate ALL personalized content based on THIS specific product - do NOT use generic/dummy values. For image_url use empty string "". ${SCAN_RESULT_JSON_SCHEMA}`;
  const imageUrl = `data:${mimeType};base64,${imageBase64}`;
  const messages: GroqMessage[] = [
    { role: "system", content: system },
    {
      role: "user",
      content: [
        { type: "text", text: "Analyze this product image (package or label) and generate personalized insights. Output the JSON object only. Make all content specific to THIS product, including analysis.bloatDetails.expectedTime (estimate when bloating will occur based on product content), analysis.personalizedInsights (3 insights specific to this product), etc. Do NOT use generic values. For image_url field, use empty string." },
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    },
  ];
  return callGroq(messages, GROQ_VISION_MODEL);
}

async function imageUrlToBase64(imageUrl: string): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const data = btoa(binary);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const mimeType = contentType.split(";")[0].trim();
  return { data, mimeType };
}

function normalizeResult(partial: Partial<ScanResult>, scanType: "photo" | "barcode", extras: Partial<ScanResult>): ScanResult {
  const bloat = typeof partial.bloat_score === "number" ? Math.min(100, Math.max(0, partial.bloat_score)) : 50;
  const skin = typeof partial.skin_score === "number" ? Math.min(10, Math.max(0, partial.skin_score)) : 5;
  const energy = typeof partial.energy_score === "number" ? Math.min(10, Math.max(0, partial.energy_score)) : 5;
  const digestion = typeof partial.digestion_score === "number" ? Math.min(10, Math.max(0, partial.digestion_score)) : 5;
  const derivedGut = Math.round(100 - bloat * 0.4 + (skin / 10) * 20 + (energy / 10) * 20 + (digestion / 10) * 20);
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
    bloat_score: bloat,
    skin_score: skin,
    energy_score: energy,
    digestion_score: digestion,
    analysis: {
      summary: partial.analysis?.summary ?? "",
      tips: Array.isArray(partial.analysis?.tips) ? partial.analysis.tips : [],
      skin: partial.analysis?.skin,
      digestion: partial.analysis?.digestion,
      mood: partial.analysis?.mood,
      // Preserve LLM-generated personalized content
      bloatDetails: partial.analysis?.bloatDetails as { expectedTime?: string; tip?: string } | undefined,
      impactDetails: partial.analysis?.impactDetails as ScanResult["analysis"]["impactDetails"],
      goalPrediction: partial.analysis?.goalPrediction as ScanResult["analysis"]["goalPrediction"],
      personalizedInsights: Array.isArray(partial.analysis?.personalizedInsights) ? partial.analysis.personalizedInsights as ScanResult["analysis"]["personalizedInsights"] : undefined,
      improvementOptions: partial.analysis?.improvementOptions as ScanResult["analysis"]["improvementOptions"],
      timingInsights: partial.analysis?.timingInsights as ScanResult["analysis"]["timingInsights"],
      nutritionContext: partial.analysis?.nutritionContext as ScanResult["analysis"]["nutritionContext"],
    },
    nutrition: typeof partial.nutrition === "object" && partial.nutrition ? partial.nutrition : {},
    // Preserve image_url from LLM or extras (for photo scans, extras.image_url is set)
    image_url: extras.image_url || partial.image_url || undefined,
    ...extras,
  };
}

function mockScanResult(scanType: "photo" | "barcode", extras: Partial<ScanResult> = {}): ScanResult {
  return normalizeResult(
    {
      food_name: extras.food_name ?? "Demo result",
      identified_foods: extras.identified_foods ?? ["Sample food"],
      gut_score: 55,
      bloat_score: 45,
      skin_score: 5,
      energy_score: 6,
      digestion_score: 5,
      analysis: {
        summary: "This is a demo result because the AI free-tier quota was exceeded. You can continue testing the app.",
        tips: ["Groq free tier may have rate limits; you can still save this scan to test the app."],
        skin: "Real skin impact analysis will appear when quota is available.",
        digestion: "Real digestion notes will appear when quota is available.",
        mood: "Real mood/energy notes will appear when quota is available.",
      },
      nutrition: extras.nutrition ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    },
    scanType,
    extras
  );
}

function isQuotaError(msg: string): boolean {
  return /429|quota|resource_exhausted|RESOURCE_EXHAUSTED/i.test(msg);
}

Deno.serve(async (req) => {
  try {
    console.log("[DEBUG] Edge Function START - Method:", req.method);
    console.log("[DEBUG] Edge Function START - URL:", req.url);
    console.log("[DEBUG] Edge Function START - Headers:", JSON.stringify(Object.fromEntries(req.headers.entries())));
    
    if (req.method === "OPTIONS") {
      console.log("[DEBUG] Edge Function - OPTIONS request, returning CORS headers");
      return new Response(null, { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      console.log("[DEBUG] Edge Function - Method not POST, returning 405");
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    console.log("[DEBUG] Edge Function - Reading request body...");
    let body: AnalyzeRequestBody;
    try {
      const bodyText = await req.text();
      console.log("[DEBUG] Edge Function - Request body length:", bodyText.length);
      console.log("[DEBUG] Edge Function - Request body preview:", bodyText.substring(0, 500));
      body = JSON.parse(bodyText) as AnalyzeRequestBody;
      console.log("[DEBUG] Edge Function - Body parsed successfully");
    } catch (e) {
      console.error("[DEBUG] Edge Function - JSON parse error:", e);
      return jsonResponse({ error: "Invalid JSON body", details: e instanceof Error ? e.message : String(e) }, 400);
    }

    const { scan_type, image_url, image_base64, barcode, profile } = body;
    console.log("[DEBUG] Edge Function - scan_type:", scan_type);
    console.log("[DEBUG] Edge Function - has barcode:", !!barcode);
    console.log("[DEBUG] Edge Function - has image_url:", !!image_url);
    console.log("[DEBUG] Edge Function - has image_base64:", !!image_base64);
    console.log("[DEBUG] Edge Function - GROQ_API_KEY set:", !!GROQ_API_KEY);
    if (!scan_type || (scan_type !== "photo" && scan_type !== "barcode")) {
      return jsonResponse({ error: "scan_type must be 'photo' or 'barcode'" }, 400);
    }

    if (!GROQ_API_KEY) {
      console.error("[DEBUG] Edge Function - GROQ_API_KEY not set");
      return jsonResponse(
        { error: "GROQ_API_KEY is not set. Add it in Supabase Dashboard → Edge Functions → Secrets." },
        500
      );
    }

    try {
      if (scan_type === "photo") {
        let imageBase64: string;
        let mimeType = "image/jpeg";
        if (image_base64) {
          imageBase64 = image_base64;
        } else if (image_url) {
          try {
            const fetched = await imageUrlToBase64(image_url);
            imageBase64 = fetched.data;
            mimeType = fetched.mimeType;
          } catch (imgErr) {
            const msg = imgErr instanceof Error ? imgErr.message : String(imgErr);
            console.error("[DEBUG] Edge Function - Image fetch failed:", msg);
            return jsonResponse(
              { error: "Could not load image. If using a signed URL, it may have expired or be inaccessible from the server." },
              500
            );
          }
        } else {
          return jsonResponse({ error: "image_url or image_base64 required for photo scan" }, 400);
        }
        try {
          const llm = await callGroqVision(imageBase64, mimeType, profile);
          const result = normalizeResult(llm, "photo", image_url ? { image_url } : {});
          attachProductInsight(result);
          return jsonResponse(result);
        } catch (photoErr) {
          const msg = photoErr instanceof Error ? photoErr.message : String(photoErr);
          if (isQuotaError(msg)) {
            const mock = mockScanResult("photo", image_url ? { image_url } : {});
            attachProductInsight(mock);
            return jsonResponse(mock);
          }
          throw photoErr;
        }
      }
      if (scan_type === "barcode") {
        if (!barcode || typeof barcode !== "string") return jsonResponse({ error: "barcode required" }, 400);
        console.log("[DEBUG] Edge Function - Calling Groq for barcode:", barcode);
        console.log("[DEBUG] Edge Function - GROQ_API_KEY set:", !!GROQ_API_KEY);
        try {
          const llm = await callGroqForBarcode(barcode, profile);
          console.log("[DEBUG] Edge Function - Groq response received, food_name:", llm.food_name);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/025d8125-b3f8-4cbb-a462-51b42cebb67c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyze-scan/index.ts:328',message:'LLM response before normalize',data:{hasError:!!(llm as any).error,errorField:(llm as any).error,foodName:llm.food_name,barcode},timestamp:Date.now(),runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          const result = normalizeResult(llm, "barcode", {
            barcode,
            nutrition: (llm.nutrition as Record<string, number | undefined>) ?? {},
          });
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/025d8125-b3f8-4cbb-a462-51b42cebb67c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analyze-scan/index.ts:336',message:'Final result before sending',data:{foodName:result.food_name,hasError:!!(result as any).error,errorField:(result as any).error},timestamp:Date.now(),runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          attachProductInsight(result);
          return jsonResponse(result);
        } catch (barcodeErr) {
          console.error("[DEBUG] Edge Function - Barcode scan error:", barcodeErr);
          console.error("[DEBUG] Edge Function - Error message:", barcodeErr instanceof Error ? barcodeErr.message : String(barcodeErr));
          console.error("[DEBUG] Edge Function - Error stack:", barcodeErr instanceof Error ? barcodeErr.stack : undefined);
          const msg = barcodeErr instanceof Error ? barcodeErr.message : String(barcodeErr);
          if (isQuotaError(msg)) {
            console.log("[DEBUG] Edge Function - Quota error detected, returning mock result");
            const mock = mockScanResult("barcode", { barcode });
            attachProductInsight(mock);
            return jsonResponse(mock);
          }
          // Return error as JSON response instead of throwing
          return jsonResponse({ error: msg }, 500);
        }
      }
      return jsonResponse({ error: "Invalid request" }, 400);
    } catch (e) {
      console.error("[DEBUG] Edge Function - Error in inner try block:", e);
      console.error("[DEBUG] Edge Function - Error message:", e instanceof Error ? e.message : String(e));
      console.error("[DEBUG] Edge Function - Error stack:", e instanceof Error ? e.stack : undefined);
      const message = e instanceof Error ? e.message : String(e);
      if (isQuotaError(message)) {
        console.log("[DEBUG] Edge Function - Quota error in inner catch, returning mock");
        const mock = mockScanResult(scan_type, barcode ? { barcode } : {});
        attachProductInsight(mock);
        return jsonResponse(mock);
      }
      return jsonResponse({ error: message, details: e instanceof Error ? e.stack : String(e) }, 500);
    }
  } catch (topLevelError) {
    console.error("[DEBUG] Edge Function - TOP LEVEL ERROR:", topLevelError);
    console.error("[DEBUG] Edge Function - Error message:", topLevelError instanceof Error ? topLevelError.message : String(topLevelError));
    console.error("[DEBUG] Edge Function - Error stack:", topLevelError instanceof Error ? topLevelError.stack : undefined);
    return jsonResponse({ 
      error: "Internal server error", 
      message: topLevelError instanceof Error ? topLevelError.message : String(topLevelError),
      stack: topLevelError instanceof Error ? topLevelError.stack : undefined
    }, 500);
  }
});
