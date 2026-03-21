/**
 * Multi-database product lookup with barcode normalization.
 * Tries Open Food Facts → USDA FoodData Central → UPC ItemDB → Barcode Lookup (optional).
 * Uses EAN-13 first for OFF (US products often scanned as 12-digit UPC-A).
 *
 * Uses a phased lookup strategy to avoid overwhelming mobile networks:
 *   Phase 1: Primary sources (OFF + USDA) with primary variant — just 2 requests
 *   Phase 2: Secondary variants + fallback sources — only if Phase 1 fails
 */

// Per-request timeout — long enough for slow mobile networks and OFF server latency
const LOOKUP_TIMEOUT_MS = 18_000; // 18 seconds (was 9) — OFF often responds after 9s on slow connections

// ---------------------------------------------------------------------------
// In-memory product cache — avoids redundant API calls for the same barcode
// Longer TTL and larger size reduce repeated hits to OFF and 429 rate limits.
// ---------------------------------------------------------------------------
const _productCache = new Map<string, { product: ProductInfo; ts: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes (was 5) — fewer lookups after "some time"
const MAX_CACHE_SIZE = 100; // was 50 — keep more products cached during a session

function getCached(barcode: string): ProductInfo | undefined {
  const entry = _productCache.get(barcode);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    _productCache.delete(barcode);
    return undefined;
  }
  return entry.product;
}

function setCache(barcode: string, product: ProductInfo): void {
  if (_productCache.size >= MAX_CACHE_SIZE) {
    // Evict oldest entry
    const oldest = _productCache.keys().next().value;
    if (oldest) _productCache.delete(oldest);
  }
  _productCache.set(barcode, { product, ts: Date.now() });
}

// ---------------------------------------------------------------------------
// Lookup diagnostics — set DIAG_LOG false to disable
// ---------------------------------------------------------------------------
const DIAG_LOG = true;
function diag(msg: string, data?: Record<string, unknown>) {
  if (!DIAG_LOG) return;
  console.log("[lookup-diag]", msg, data ?? "");
}

// ---------------------------------------------------------------------------
// Rate-limit tracking — skip sources that returned 429 recently
// Shorter cooldown so scanning works again sooner after OFF throttles us.
// ---------------------------------------------------------------------------
const _rateLimitedUntil: Record<string, number> = {};
const RATE_LIMIT_COOLDOWN_MS = 25_000; // 25 seconds (was 60) — recover sooner so lookups don’t “stop” for long

function isRateLimited(source: string): boolean {
  const until = _rateLimitedUntil[source];
  if (!until) return false;
  if (Date.now() > until) {
    delete _rateLimitedUntil[source];
    return false;
  }
  return true;
}

function markRateLimited(source: string): void {
  _rateLimitedUntil[source] = Date.now() + RATE_LIMIT_COOLDOWN_MS;
}

/** fetch() with an AbortController timeout so no single request blocks >10s */
async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = LOOKUP_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      console.warn("[fetchWithTimeout] Request timed out after", timeoutMs, "ms for", url);
      throw new Error(`Request timeout: ${url}`);
    }
    console.warn("[fetchWithTimeout] Fetch error for", url, ":", e instanceof Error ? e.message : String(e));
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Unified product interface
// ---------------------------------------------------------------------------

export interface ProductInfo {
  name: string;
  brand: string;
  barcode: string;
  imageUrl?: string;
  ingredients?: string;
  categories?: string;
  /** Serving size as displayed on label (e.g. "1 pack (85g)", "1 cup (240ml)") */
  serving_size_display?: string;
  /** Servings per container if shown on label */
  servings_per_container?: number;
  /** Nutrition per 100g (or per serving if per100g not available) */
  nutrition: {
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
    sugar_g?: number;
    sodium_mg?: number;
    saturated_fat_g?: number;
  };
  /** Which database the product was found in */
  source: "openfoodfacts" | "usda" | "upcitemdb" | "barcodelookup";
}

// ---------------------------------------------------------------------------
// Barcode normalization — EAN-13 first for Open Food Facts
// ---------------------------------------------------------------------------

/**
 * Returns barcode variants. For 12-digit UPC-A we put EAN-13 (0+digits) first
 * so Open Food Facts gets the form it usually has.
 */
function getBarcodeVariants(barcode: string): string[] {
  const digits = barcode.replace(/\D/g, "");
  if (!digits.length) return [barcode];

  let variants: string[] = [digits];

  if (digits.length === 12) {
    variants = ["0" + digits, digits]; // EAN-13 first for OFF
  } else if (digits.length === 13 && digits.startsWith("0")) {
    variants = [digits, digits.slice(1)];
  } else if (digits.length > 13) {
    variants = [digits.slice(0, 13), digits.slice(0, 12), digits];
    if (digits.slice(0, 13).startsWith("0")) variants.push(digits.slice(1, 13));
  }

  return [...new Set(variants)];
}

/** True if we have enough data to show a useful result (not dummy). */
function hasEnoughInfo(p: ProductInfo): boolean {
  const hasName = !!p.name?.trim();
  // Accept any result from known databases as long as it has a name
  if (hasName) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Open Food Facts (primary)
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

async function lookupOpenFoodFacts(barcode: string, isRetry = false): Promise<ProductInfo | null> {
  if (isRateLimited("openfoodfacts")) {
    console.warn("[OFF] rate-limited, skipping");
    return null;
  }
  const code = (barcode && String(barcode).replace(/\D/g, "")) || "";
  if (!code || code.length < 8) {
    console.warn("[OFF] invalid barcode:", barcode, "->", code);
    return null;
  }

  const url = `https://world.openfoodfacts.org/api/v0/product/${code}.json`;
  const doFetch = async (): Promise<Response> =>
    fetchWithTimeout(url, {
      headers: {
        "User-Agent": "Gutsy/1.0 (https://github.com/gutsy-app)",
        Accept: "application/json",
      },
    });

  const offStart = Date.now();
  try {
    if (!isRetry) console.log("[OFF] fetching:", url);
    const res = await doFetch();

    diag("OFF response", {
      barcode: code,
      status: res.status,
      ms: Date.now() - offStart,
      isRetry,
    });
    console.log("[OFF] response status:", res.status, "for barcode:", code);
    if (res.status === 429) {
      console.warn("[OFF] 429 rate-limited");
      markRateLimited("openfoodfacts");
      return null;
    }
    if (!res.ok) {
      console.warn("[OFF] HTTP", res.status, "for", code);
      return null;
    }

    const json: any = await res.json().catch((e: any) => {
      console.warn("[OFF] JSON parse error:", e?.message);
      return null;
    });
    if (!json) {
      console.warn("[OFF] no JSON response for", code);
      return null;
    }

    const p: any = json.product;
    if (!p || (typeof p === "object" && Object.keys(p).length === 0)) {
      console.warn("[OFF] empty/missing product for", code, "status:", json.status);
      return null;
    }

    // Extract name — try multiple fields
    const name =
      p.product_name ||
      p.product_name_en ||
      p.product_name_imported ||
      p.generic_name_en ||
      p.generic_name ||
      p.brands ||
      "";
    if (!String(name).trim()) {
      console.warn("[OFF] product found but no name for", code);
      return null;
    }

    const n: any = p.nutriments ?? {};
    const ingredientsText = (p.ingredients_text || p.ingredients_text_en || "").trim();
    const ingredientsFromArray = Array.isArray(p.ingredients)
      ? p.ingredients.map((i: any) => i?.text?.trim()).filter(Boolean).join(", ")
      : "";
    const ingredients = ingredientsText || ingredientsFromArray || undefined;

    // Extract serving size information
    const serving_size_display = (p.serving_size || "").trim() || undefined;
    const servings_per_container = typeof p.servings_per_container === "number" 
      ? p.servings_per_container 
      : (typeof p.servings_per_container === "string" ? parseFloat(p.servings_per_container) : undefined);
    const validServingsPerContainer = (typeof servings_per_container === "number" && isFinite(servings_per_container) && servings_per_container > 0)
      ? servings_per_container
      : undefined;

    // Extract energy with proper unit conversion
    const energyKcal = n["energy-kcal_100g"] ?? n["energy-kcal"];
    const energyKj = n["energy_100g"] ?? n.energy;
    let calories: number | undefined;
    
    if (typeof energyKcal === "number" && energyKcal > 0) {
      calories = energyKcal;
    } else if (typeof energyKj === "number" && energyKj > 0) {
      // Convert kJ to kcal (1 kcal ≈ 4.184 kJ)
      calories = Math.round(energyKj / 4.184);
    }
    
    // Validate calories is reasonable (max 2000 kcal per 100g)
    if (calories && calories > 2000) {
      console.warn("[OFF] Unusually high calories per 100g:", calories, "for product:", name);
      calories = Math.min(calories, 2000); // Cap at reasonable maximum
    }

    return {
      name: String(name).trim(),
      brand: (p.brands || "").trim(),
      barcode,
      // Prefer smallest image for faster load; order must stay small → large for performance
      imageUrl: p.image_front_small_url || p.image_front_url || p.image_front_thumb_url || p.image_url || undefined,
      ingredients: ingredients || undefined,
      categories: (p.categories || "").trim() || undefined,
      serving_size_display,
      servings_per_container: validServingsPerContainer,
      nutrition: {
        calories,
        protein_g: typeof n.proteins_100g === "number" ? Math.min(n.proteins_100g, 100) : n.proteins,
        carbs_g: typeof n.carbohydrates_100g === "number" ? Math.min(n.carbohydrates_100g, 100) : n.carbohydrates,
        fat_g: typeof n.fat_100g === "number" ? Math.min(n.fat_100g, 100) : n.fat,
        fiber_g: typeof n.fiber_100g === "number" ? Math.min(n.fiber_100g, 50) : n.fiber,
        sugar_g: typeof n.sugars_100g === "number" ? Math.min(n.sugars_100g, 100) : n.sugars,
        sodium_mg:
          n.sodium_100g != null
            ? Math.min(Math.round(n.sodium_100g * 1000), 4000)
            : n.sodium != null
              ? Math.min(Math.round(n.sodium * 1000), 4000)
              : undefined,
        saturated_fat_g: typeof n["saturated-fat_100g"] === "number" ? Math.min(n["saturated-fat_100g"], 100) : n["saturated-fat"],
      },
      source: "openfoodfacts",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    diag("OFF error", {
      barcode: code,
      error: msg,
      ms: Date.now() - offStart,
      isRetry,
    });
    const isTimeout = msg.includes("Request timeout");
    if (isTimeout && !isRetry) {
      console.log("[OFF] timeout, retrying once for", code);
      return lookupOpenFoodFacts(barcode, true);
    }
    console.warn("[OFF] lookup failed for barcode", code, ":", msg);
    return null;
  }
}

/** Normalize for name similarity: lowercase, collapse spaces, remove punctuation */
function normalizeForMatch(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Score 0–1: how well OFF product name matches the vision search name (for same-product consistency) */
function nameMatchScore(searchName: string, productName: string): number {
  const a = normalizeForMatch(searchName);
  const b = normalizeForMatch(productName);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aWords = new Set(a.split(/\s+/).filter(Boolean));
  const bWords = new Set(b.split(/\s+/).filter(Boolean));
  let match = 0;
  for (const w of aWords) {
    if (bWords.has(w) || (w.length > 2 && [...bWords].some(bw => bw.includes(w) || w.includes(bw)))) match++;
  }
  const union = new Set([...aWords, ...bWords]).size;
  return union > 0 ? match / union : 0;
}

/** Map one OFF search hit to ProductInfo; returns null if name missing. */
function offHitToProductInfo(p: any): ProductInfo | null {
  const name =
    p.product_name ||
    p.product_name_en ||
    p.generic_name_en ||
    p.generic_name ||
    p.brands ||
    "";
  if (!String(name).trim()) return null;

  const n: any = p.nutriments ?? {};
  const ingredientsText = (p.ingredients_text || p.ingredients_text_en || "").trim();
  const ingredientsFromArray = Array.isArray(p.ingredients)
    ? p.ingredients.map((i: any) => i?.text?.trim()).filter(Boolean).join(", ")
    : "";
  const ingredients = ingredientsText || ingredientsFromArray || undefined;

  // Extract serving size information
  const serving_size_display = (p.serving_size || "").trim() || undefined;
  const servings_per_container = typeof p.servings_per_container === "number" 
    ? p.servings_per_container 
    : (typeof p.servings_per_container === "string" ? parseFloat(p.servings_per_container) : undefined);
  const validServingsPerContainer = (typeof servings_per_container === "number" && isFinite(servings_per_container) && servings_per_container > 0)
    ? servings_per_container
    : undefined;

  // Extract energy with proper unit conversion
  const energyKcal = n["energy-kcal_100g"] ?? n["energy-kcal"];
  const energyKj = n["energy_100g"] ?? n.energy;
  let calories: number | undefined;
  
  if (typeof energyKcal === "number" && energyKcal > 0) {
    calories = energyKcal;
  } else if (typeof energyKj === "number" && energyKj > 0) {
    // Convert kJ to kcal (1 kcal ≈ 4.184 kJ)
    calories = Math.round(energyKj / 4.184);
  }
  
  // Validate calories is reasonable (max 2000 kcal per 100g)
  if (calories && calories > 2000) {
    console.warn("[OFF search] Unusually high calories per 100g:", calories, "for product:", name);
    calories = Math.min(calories, 2000); // Cap at reasonable maximum
  }

  return {
    name: String(name).trim(),
    brand: (p.brands || "").trim(),
    barcode: String(p.code || p._id || ""),
    imageUrl: p.image_front_small_url || p.image_front_url || p.image_front_thumb_url || p.image_url || undefined,
    ingredients: ingredients || undefined,
    categories: (p.categories || "").trim() || undefined,
    serving_size_display,
    servings_per_container: validServingsPerContainer,
    nutrition: {
      calories,
      protein_g: typeof n.proteins_100g === "number" ? Math.min(n.proteins_100g, 100) : n.proteins,
      carbs_g: typeof n.carbohydrates_100g === "number" ? Math.min(n.carbohydrates_100g, 100) : n.carbohydrates,
      fat_g: typeof n.fat_100g === "number" ? Math.min(n.fat_100g, 100) : n.fat,
      fiber_g: typeof n.fiber_100g === "number" ? Math.min(n.fiber_100g, 50) : n.fiber,
      sugar_g: typeof n.sugars_100g === "number" ? Math.min(n.sugars_100g, 100) : n.sugars,
      sodium_mg:
        n.sodium_100g != null
          ? Math.min(Math.round(n.sodium_100g * 1000), 4000)
          : n.sodium != null
            ? Math.min(Math.round(n.sodium * 1000), 4000)
            : undefined,
      saturated_fat_g: typeof n["saturated-fat_100g"] === "number" ? Math.min(n["saturated-fat_100g"], 100) : n["saturated-fat"],
    },
    source: "openfoodfacts",
  };
}

/**
 * Search Open Food Facts by term and return multiple products (for alternatives).
 * Excludes product with excludeBarcode when provided.
 */
export async function searchOFFByTerm(
  term: string,
  pageSize: number,
  excludeBarcode?: string | null,
): Promise<ProductInfo[]> {
  if (!term?.trim()) return [];
  if (isRateLimited("openfoodfacts")) return [];

  const searchTerms = encodeURIComponent(term.trim().slice(0, 80));
  const excludeDigits = excludeBarcode ? String(excludeBarcode).replace(/\D/g, "") : "";

  try {
    // Use OFF API v2 which properly supports fields parameter and returns image URLs
    const fields = "code,product_name,product_name_en,generic_name,generic_name_en,brands,categories,nutriments,ingredients_text,ingredients_text_en,ingredients,image_front_small_url,image_front_url,image_url,image_front_thumb_url";
    const res = await fetchWithTimeout(
      `https://world.openfoodfacts.org/api/v2/search?search_terms=${searchTerms}&page_size=${Math.min(Math.max(1, pageSize), 24)}&fields=${fields}`,
      { headers: { "User-Agent": "Gutsy/1.0 (https://github.com/gutsy-app)" } },
      8_000,
    );
    if (res.status === 429) {
      markRateLimited("openfoodfacts");
      return [];
    }
    if (!res.ok) return [];

    const data: any = await res.json().catch(() => null);
    if (!data) return [];
    
    // OFF v2 API response structure: data.products (not data.products)
    const products = data.products;
    if (!Array.isArray(products)) {
      console.warn("[OFF] No products array in v2 response:", Object.keys(data));
      return [];
    }

    const out: ProductInfo[] = [];
    for (const p of products) {
      const info = offHitToProductInfo(p);
      if (!info) continue;
      if (excludeDigits && String(info.barcode).replace(/\D/g, "") === excludeDigits) continue;
      
      // Debug: Log image URLs for first few products
      if (out.length < 3) {
        console.log("[OFF] Product:", info.name, "Image URL:", info.imageUrl);
      }
      
      out.push(info);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Search Open Food Facts by category tag (e.g. "soft-drinks", "instant-noodles").
 * Uses search.pl with tag filter; returns products for alternatives when search by term yields few.
 */
export async function searchOFFByCategory(
  categorySlug: string,
  pageSize: number,
  excludeBarcode?: string | null,
): Promise<ProductInfo[]> {
  if (!categorySlug?.trim()) return [];
  if (isRateLimited("openfoodfacts")) return [];
  const slug = categorySlug.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  if (!slug) return [];

  try {
    // Use OFF API v2 which properly supports fields parameter and returns image URLs
    const fields = "code,product_name,product_name_en,generic_name,generic_name_en,brands,categories,nutriments,ingredients_text,ingredients_text_en,ingredients,image_front_small_url,image_front_url,image_url,image_front_thumb_url";
    const res = await fetchWithTimeout(
      `https://world.openfoodfacts.org/api/v2/search?tagtype_0=categories&tag_contains_0=contains&tag_0=${encodeURIComponent(slug)}&page_size=${Math.min(Math.max(1, pageSize), 24)}&fields=${fields}`,
      { headers: { "User-Agent": "Gutsy/1.0 (https://github.com/gutsy-app)" } },
      8_000,
    );
    if (res.status === 429) {
      markRateLimited("openfoodfacts");
      return [];
    }
    if (!res.ok) return [];

    const data: any = await res.json().catch(() => null);
    if (!data) return [];
    
    // OFF v2 API response structure: data.products (not data.products)
    const products = data.products;
    if (!Array.isArray(products)) {
      console.warn("[OFF] No products array in v2 response:", Object.keys(data));
      return [];
    }

    const excludeDigits = excludeBarcode ? String(excludeBarcode).replace(/\D/g, "") : "";
    const out: ProductInfo[] = [];
    for (const p of products) {
      const info = offHitToProductInfo(p);
      if (!info) continue;
      if (excludeDigits && String(info.barcode).replace(/\D/g, "") === excludeDigits) continue;
      
      // Debug: Log image URLs for first few products
      if (out.length < 3) {
        console.log("[OFF] Product:", info.name, "Image URL:", info.imageUrl);
      }
      
      out.push(info);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Search Open Food Facts by product name (and optional brand).
 * Returns the single best-matching product by name so photo-scan scores match barcode-scan for the same product.
 */
export async function searchProductByName(
  productName: string,
  brand?: string | null,
): Promise<ProductInfo | null> {
  if (!productName?.trim()) return null;
  if (isRateLimited("openfoodfacts")) return null;

  const query = [productName.trim(), brand?.trim()].filter(Boolean).join(" ");
  const searchTerms = encodeURIComponent(query.slice(0, 80));

  try {
    const res = await fetchWithTimeout(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${searchTerms}&search_simple=1&action=process&json=1&page_size=10`,
      { headers: { "User-Agent": "Gutsy/1.0 (https://github.com/gutsy-app)" } },
      5_000,
    );
    if (res.status === 429) { markRateLimited("openfoodfacts"); return null; }
    if (!res.ok) return null;

    const data: any = await res.json().catch(() => null);
    if (!data) return null;
    const products = data.products;
    if (!Array.isArray(products) || products.length === 0) return null;

    let best: { result: ProductInfo; score: number; hasData: boolean } | null = null;

    for (const p of products) {
      const result = offHitToProductInfo(p);
      if (!result) continue;

      const n = (p as any).nutriments ?? {};
      const hasNutrition =
        n["energy-kcal_100g"] != null ||
        n.proteins_100g != null ||
        n.carbohydrates_100g != null ||
        n.fat_100g != null;
      const ingredients = result.ingredients;
      const hasData = !!(hasNutrition || ingredients);

      const score = nameMatchScore(productName, result.name);
      const candidate = { result, score, hasData };
      if (!best) {
        best = candidate;
      } else if (score > best.score) {
        best = candidate;
      } else if (score === best.score && hasData && !best.hasData) {
        best = candidate;
      }
    }
    return best?.result ?? null;
  } catch {
    return null;
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// USDA FoodData Central (requires free API key from data.gov)
// ---------------------------------------------------------------------------
// Read from process.env (inlined at build) or from app.config.js extra (runtime).
// If you add the key to .env, restart the dev server with: npx expo start -c
function getUsdaApiKey(): string {
  const fromEnv = process.env.EXPO_PUBLIC_USDA_FDC_API_KEY;
  if (fromEnv) return fromEnv;
  try {
    const Constants = require("expo-constants").default;
    const extra = Constants?.expoConfig?.extra as Record<string, string> | undefined;
    return extra?.EXPO_PUBLIC_USDA_FDC_API_KEY ?? "";
  } catch {
    return "";
  }
}
async function lookupUsdaFdc(barcode: string): Promise<ProductInfo | null> {
  const usdaKey = getUsdaApiKey();
  const usdaStart = Date.now();
  diag("USDA lookup start", { barcode, hasKey: !!usdaKey });
  if (!usdaKey) {
    diag("USDA skipped", { reason: "no API key" });
    return null;
  }
  if (isRateLimited("usda")) {
    diag("USDA skipped", { reason: "rate limited" });
    return null;
  }

  try {
    const res = await fetchWithTimeout(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(usdaKey)}&query=${encodeURIComponent(barcode)}&pageSize=20`,
      { headers: { "User-Agent": "Gutsy/1.0" } },
    );
    if (res.status === 429) { markRateLimited("usda"); return null; }
    if (!res.ok) return null;

    const data = await res.json();
    const foods = data.foods;
    if (!Array.isArray(foods)) return null;

    const variants = getBarcodeVariants(barcode);
    for (const food of foods) {
      const gtin = food.gtinUpc;
      if (gtin == null) continue;
      const gtinStr = String(gtin).replace(/\D/g, "");
      if (!gtinStr || !variants.includes(gtinStr)) continue;

      diag("USDA hit", { barcode, ms: Date.now() - usdaStart });
      const name = food.description ?? food.brandName ?? food.brandOwner ?? "Unknown";
      const brand = food.brandOwner ?? food.brandName ?? "";

      const nutrients = food.foodNutrients ?? [];
      const getNut = (id: number) =>
        nutrients.find((n: { nutrientId?: number }) => n.nutrientId === id);
      const calories = getNut(1008)?.value ?? getNut(2047)?.value;
      const protein = getNut(1003)?.value;
      const carbs = getNut(1005)?.value;
      const fat = getNut(1004)?.value;
      const fiber = getNut(1079)?.value;
      const sugar = getNut(2000)?.value;
      const sodium = getNut(1093)?.value;

      // Validate and cap extreme values
      let validatedCalories = calories;
      if (typeof calories === "number" && calories > 2000) {
        console.warn("[USDA] Unusually high calories per 100g:", calories, "for product:", name);
        validatedCalories = Math.min(calories, 2000);
      }

      return {
        name: String(name).trim(),
        brand: String(brand).trim(),
        barcode,
        imageUrl: undefined,
        ingredients: food.ingredients,
        categories: food.foodCategory,
        nutrition: {
          calories: validatedCalories,
          protein_g: typeof protein === "number" ? Math.min(protein, 100) : protein, // Max 100g protein per 100g
          carbs_g: typeof carbs === "number" ? Math.min(carbs, 100) : carbs, // Max 100g carbs per 100g
          fat_g: typeof fat === "number" ? Math.min(fat, 100) : fat, // Max 100g fat per 100g
          fiber_g: typeof fiber === "number" ? Math.min(fiber, 50) : fiber, // Max 50g fiber per 100g
          sugar_g: typeof sugar === "number" ? Math.min(sugar, 100) : sugar, // Max 100g sugar per 100g
          sodium_mg: typeof sodium === "number" ? Math.min(sodium, 4000) : sodium, // Max 4000mg sodium per 100g
        },
        source: "usda",
      };
    }
    return null;
  } catch (e) {
    diag("USDA error", { barcode, ms: Date.now() - usdaStart, err: String(e) });
    return null;
  }
}

/** Map one USDA FDC food hit to ProductInfo (for search results). */
function usdaFoodToProductInfo(food: any): ProductInfo | null {
  const name = food.description ?? food.brandName ?? food.brandOwner ?? "";
  if (!String(name).trim()) return null;
  const nutrients = food.foodNutrients ?? [];
  const getNut = (id: number) =>
    nutrients.find((n: { nutrientId?: number }) => n.nutrientId === id);
  const calories = getNut(1008)?.value ?? getNut(2047)?.value;
  const protein = getNut(1003)?.value;
  const carbs = getNut(1005)?.value;
  const fat = getNut(1004)?.value;
  const fiber = getNut(1079)?.value;
  const sugar = getNut(2000)?.value;
  const sodium = getNut(1093)?.value;

  // Validate and cap extreme values
  let validatedCalories = calories;
  if (typeof calories === "number" && calories > 2000) {
    console.warn("[USDA search] Unusually high calories per 100g:", calories, "for product:", name);
    validatedCalories = Math.min(calories, 2000);
  }

  return {
    name: String(name).trim(),
    brand: String(food.brandOwner ?? food.brandName ?? "").trim(),
    barcode: food.gtinUpc != null ? String(food.gtinUpc) : "",
    imageUrl: undefined,
    ingredients: food.ingredients,
    categories: food.foodCategory,
    nutrition: {
      calories: typeof validatedCalories === "number" ? Math.round(validatedCalories) : undefined,
      protein_g: typeof protein === "number" ? Math.min(protein, 100) : protein, // Max 100g protein per 100g
      carbs_g: typeof carbs === "number" ? Math.min(carbs, 100) : carbs, // Max 100g carbs per 100g
      fat_g: typeof fat === "number" ? Math.min(fat, 100) : fat, // Max 100g fat per 100g
      fiber_g: typeof fiber === "number" ? Math.min(fiber, 50) : fiber, // Max 50g fiber per 100g
      sugar_g: typeof sugar === "number" ? Math.min(sugar, 100) : sugar, // Max 100g sugar per 100g
      sodium_mg: typeof sodium === "number" ? Math.min(Math.round(sodium), 4000) : undefined, // Max 4000mg sodium per 100g
    },
    source: "usda",
  };
}

/**
 * Search USDA FDC by text query (for alternatives when OFF has few results).
 */
export async function searchUsdaByQuery(
  query: string,
  pageSize: number,
): Promise<ProductInfo[]> {
  const usdaKey = getUsdaApiKey();
  if (!usdaKey || !query?.trim()) return [];
  if (isRateLimited("usda")) return [];

  try {
    const res = await fetchWithTimeout(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(usdaKey)}&query=${encodeURIComponent(query.trim().slice(0, 60))}&pageSize=${Math.min(Math.max(1, pageSize), 20)}`,
      { headers: { "User-Agent": "Gutsy/1.0" } },
      8_000,
    );
    if (res.status === 429) {
      markRateLimited("usda");
      return [];
    }
    if (!res.ok) return [];

    const data = await res.json().catch(() => null);
    if (!data) return [];
    const foods = data.foods;
    if (!Array.isArray(foods)) return [];

    const out: ProductInfo[] = [];
    for (const food of foods) {
      const info = usdaFoodToProductInfo(food);
      if (info) out.push(info);
    }
    return out;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// UPC ItemDB (fallback)
// ---------------------------------------------------------------------------

async function lookupUpcItemDb(barcode: string): Promise<ProductInfo | null> {
  if (isRateLimited("upcitemdb")) return null;
  try {
    const res = await fetchWithTimeout(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`,
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Gutsy/1.0",
        },
      },
    );
    if (res.status === 429) { markRateLimited("upcitemdb"); return null; }
    if (!res.ok) return null;

    const data = await res.json();
    const items = data.items;
    if (!Array.isArray(items) || items.length === 0) return null;

    const item = items[0];
    if (!item.title) return null;

    return {
      name: (item.title || "").trim(),
      brand: (item.brand || "").trim(),
      barcode,
      imageUrl:
        Array.isArray(item.images) && item.images.length > 0
          ? item.images[0]
          : undefined,
      ingredients: undefined,
      categories: (item.category || "").trim() || undefined,
      nutrition: {},
      source: "upcitemdb",
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Barcode Lookup (optional)
// ---------------------------------------------------------------------------

const BARCODE_LOOKUP_KEY = process.env.EXPO_PUBLIC_BARCODE_LOOKUP_API_KEY ?? "";

async function lookupBarcodeLookup(barcode: string): Promise<ProductInfo | null> {
  if (!BARCODE_LOOKUP_KEY) return null;
  if (isRateLimited("barcodelookup")) return null;

  try {
    const res = await fetchWithTimeout(
      `https://api.barcodelookup.com/v3/products?barcode=${encodeURIComponent(barcode)}&key=${encodeURIComponent(BARCODE_LOOKUP_KEY)}`,
      { headers: { "User-Agent": "Gutsy/1.0" } },
    );
    if (res.status === 429) { markRateLimited("barcodelookup"); return null; }
    if (!res.ok) return null;

    const data = await res.json();
    const products = data.products;
    if (!Array.isArray(products) || products.length === 0) return null;

    const p = products[0];
    const title = p.product_name ?? p.title ?? p.product_title ?? "";
    if (!title) return null;

    const images = p.images;
    const imageUrl =
      Array.isArray(images) && images.length > 0
        ? typeof images[0] === "string"
          ? images[0]
          : images[0].link ?? images[0].url
        : undefined;

    const nutrition: ProductInfo["nutrition"] = {};
    const nf = p.nutrition_facts ?? p.nutrition_facts_string ?? "";
    if (typeof nf === "string") {
      const calMatch = nf.match(/(?:calories|cal)\s*:?\s*(\d+)/i);
      if (calMatch) nutrition.calories = parseInt(calMatch[1], 10);
      const proMatch = nf.match(/protein\s*:?\s*(\d+(?:\.\d+)?)\s*g/i);
      if (proMatch) nutrition.protein_g = parseFloat(proMatch[1]);
      const carbMatch = nf.match(/carb(?:ohydrate)?s?\s*:?\s*(\d+(?:\.\d+)?)\s*g/i);
      if (carbMatch) nutrition.carbs_g = parseFloat(carbMatch[1]);
      const fatMatch = nf.match(/fat\s*:?\s*(\d+(?:\.\d+)?)\s*g/i);
      if (fatMatch) nutrition.fat_g = parseFloat(fatMatch[1]);
      const sodiumMatch = nf.match(/sodium\s*:?\s*(\d+)\s*mg/i);
      if (sodiumMatch) nutrition.sodium_mg = parseInt(sodiumMatch[1], 10);
    }

    return {
      name: String(title).trim(),
      brand: (p.brand ?? p.manufacturer ?? "").trim(),
      barcode,
      imageUrl,
      ingredients: p.ingredients ? String(p.ingredients).trim() : undefined,
      categories: p.category ? String(p.category).trim() : undefined,
      nutrition,
      source: "barcodelookup",
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Pick the first valid result from an array (null-safe). */
function pickBest(results: (ProductInfo | null)[]): ProductInfo | null {
  for (const p of results) {
    if (p && hasEnoughInfo(p)) return p;
  }
  return null;
}

/**
 * Resolve with the first array that has a "good" result, or when all promises have settled.
 * Speeds up barcode lookup by returning as soon as OFF or USDA returns a valid product.
 */
function firstSuccessOrAll(
  promises: [Promise<ProductInfo | null>, Promise<ProductInfo | null>],
): Promise<(ProductInfo | null)[]> {
  return new Promise((resolve) => {
    const results: (ProductInfo | null)[] = [null, null];
    let settled = 0;
    let done = false;
    const maybeResolve = (index: number, value: ProductInfo | null) => {
      if (done) return;
      results[index] = value;
      if (value != null && hasEnoughInfo(value)) {
        done = true;
        resolve(results);
        return;
      }
      settled++;
      if (settled === 2) {
        done = true;
        resolve(results);
      }
    };
    promises[0].then((v) => maybeResolve(0, v)).catch(() => maybeResolve(0, null));
    promises[1].then((v) => maybeResolve(1, v)).catch(() => maybeResolve(1, null));
  });
}

/**
 * Look up a product by barcode.
 *
 * Uses a **phased** strategy to avoid overwhelming mobile networks:
 *   Phase 1 — Primary sources (OFF + USDA) with primary variant (2 requests).
 *             Most products (~90 %) are found here.
 *   Phase 2 — Secondary variant for primary sources + fallback sources with
 *             primary variant (up to 4 more requests). Only fires if Phase 1
 *             returned nothing.
 *
 * Results are cached in-memory (15 min TTL, 100 entries) so re-scanning the same
 * product is instant and we hit OFF less often, reducing 429 rate limits.
 */
export async function lookupProduct(barcode: string): Promise<ProductInfo | null> {
  const trimmed = String(barcode ?? "").trim();
  if (!trimmed) return null;
  const variants = getBarcodeVariants(trimmed);
  const canonicalBarcode = variants[0];
  if (!canonicalBarcode || canonicalBarcode.length < 8) return null;

  console.log("[lookup] looking up barcode:", canonicalBarcode, "variants:", variants);

  // ── Cache check ──────────────────────────────────────────────────────
  const cached = getCached(canonicalBarcode);
  if (cached) {
    console.log("[lookup] cache hit:", cached.name);
    return { ...cached };
  }

  // ── Phase 1: return as soon as first source has a result (don't wait for both) ─
  const offPromise = lookupOpenFoodFacts(variants[0]).catch((e) => {
    console.warn("[lookup] OFF error for", variants[0], ":", e instanceof Error ? e.message : String(e));
    return null;
  });
  const usdaPromise = lookupUsdaFdc(variants[0]).catch((e) => {
    console.warn("[lookup] USDA error for", variants[0], ":", e instanceof Error ? e.message : String(e));
    return null;
  });

  const phase1 = await firstSuccessOrAll([offPromise, usdaPromise]);
  console.log("[lookup] phase1 results:", phase1.map((r) => r ? `${r.source}:${r.name}` : "null"));
  diag("phase1 done", {
    barcode: canonicalBarcode,
    off: phase1[0] ? "ok" : "null",
    usda: phase1[1] ? "ok" : "null",
    found: !!pickBest(phase1),
  });

  let found = pickBest(phase1);
  if (found) {
    found.barcode = canonicalBarcode;
    setCache(canonicalBarcode, found);
    return found;
  }

  // ── Phase 2: secondary variants + fallback sources (≤ 4 requests) ────
  const phase2Tasks: Promise<ProductInfo | null>[] = [];

  // Try secondary variants with primary sources
  for (let v = 1; v < variants.length; v++) {
    phase2Tasks.push(lookupOpenFoodFacts(variants[v]).catch((e) => {
      console.warn("[lookup] OFF error for variant", variants[v], ":", e instanceof Error ? e.message : String(e));
      return null;
    }));
    phase2Tasks.push(lookupUsdaFdc(variants[v]).catch((e) => {
      console.warn("[lookup] USDA error for variant", variants[v], ":", e instanceof Error ? e.message : String(e));
      return null;
    }));
  }

  // Try fallback sources with primary variant only (conserve rate limits)
  phase2Tasks.push(lookupUpcItemDb(variants[0]).catch((e) => {
    console.warn("[lookup] UPCItemDB error:", e instanceof Error ? e.message : String(e));
    return null;
  }));
  phase2Tasks.push(lookupBarcodeLookup(variants[0]).catch((e) => {
    console.warn("[lookup] BarcodeLookup error:", e instanceof Error ? e.message : String(e));
    return null;
  }));

  if (phase2Tasks.length > 0) {
    const phase2 = await Promise.all(phase2Tasks);
    console.log("[lookup] phase2 results:", phase2.map((r) => r ? `${r.source}:${r.name}` : "null"));
    found = pickBest(phase2);
    diag("phase2 done", {
      barcode: canonicalBarcode,
      anyOk: phase2.some((r) => r != null),
      found: !!found,
    });
    if (found) {
      found.barcode = canonicalBarcode;
      setCache(canonicalBarcode, found);
      return found;
    }
  }

  diag("lookup failed", {
    barcode: canonicalBarcode,
    phase1BothNull: phase1.every((r) => r == null),
  });
  console.warn("[lookup] product not found for barcode:", canonicalBarcode);
  return null;
}

/**
 * Pre-warm API connections (DNS + TLS handshakes) so the first real
 * scan is as fast as subsequent ones.  Fire-and-forget — errors are ignored.
 */
export function warmUpConnections(): void {
  // Warm with lightweight GET to fully establish DNS + TLS + HTTP keep-alive
  fetch("https://world.openfoodfacts.org/api/v0/product/0.json", {
    headers: { "User-Agent": "Gutsy/1.0" },
  }).catch(() => {});

  const usdaKey = getUsdaApiKey();
  if (usdaKey) {
    fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(usdaKey)}&query=test&pageSize=1`,
      { headers: { "User-Agent": "Gutsy/1.0" } },
    ).catch(() => {});
  }
}
