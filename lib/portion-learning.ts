import { supabase } from "@/lib/supabase";
import type { PortionLearningPrior } from "@/types/scan";

interface PortionCorrectionInput {
  ingredientName: string;
  predictedGrams: number;
  correctedGrams: number;
  confirmed: boolean;
  // Visual data for improved learning
  boundingBox?: { x: number; y: number; width: number; height: number };
  itemCount?: number;
  imageDimensions?: { width: number; height: number };
}

interface PortionLearningRow {
  user_id: string;
  ingredient_key: string;
  ingredient_name: string;
  sample_count: number;
  mean_grams: number;
  m2: number;
}

const LEARNING_TABLE = "portion_learning_stats";

function normalizeIngredientKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeConfidence(sampleCount: number, mean: number, m2: number): number {
  if (sampleCount <= 0 || !isFinite(mean) || mean <= 0) return 0.2;
  if (sampleCount === 1) return 0.25;

  const variance = Math.max(0, m2 / Math.max(1, sampleCount - 1));
  const stdev = Math.sqrt(variance);
  const cv = stdev / Math.max(1, mean);

  const sampleFactor = clamp(sampleCount / 12, 0, 1);
  const varianceFactor = clamp(1 - cv / 0.65, 0, 1);
  return clamp(sampleFactor * 0.65 + varianceFactor * 0.35, 0.2, 0.98);
}

async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function getLearnedPortionPriorsForCurrentUser(): Promise<PortionLearningPrior[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from(LEARNING_TABLE)
      .select("ingredient_name, sample_count, mean_grams, m2")
      .eq("user_id", userId)
      .gte("sample_count", 2)
      .order("sample_count", { ascending: false })
      .limit(80);

    if (error) {
      if (typeof error.message === "string" && error.message.includes("relation")) {
        console.warn("[portion-learning] Learning table missing, skipping priors");
        return [];
      }
      throw error;
    }

    return (data ?? [])
      .map((row) => {
        const typed = row as {
          ingredient_name?: unknown;
          sample_count?: unknown;
          mean_grams?: unknown;
          m2?: unknown;
        };
        const ingredientName = String(typed.ingredient_name ?? "").trim();
        const sampleCount = Number(typed.sample_count ?? 0);
        const meanGrams = Number(typed.mean_grams ?? 0);
        const m2 = Number(typed.m2 ?? 0);
        if (!ingredientName || !isFinite(sampleCount) || sampleCount < 2 || !isFinite(meanGrams) || meanGrams <= 0) {
          return null;
        }

        return {
          ingredientName,
          meanGrams: Math.round(meanGrams),
          sampleCount,
          confidence: computeConfidence(sampleCount, meanGrams, m2),
        } satisfies PortionLearningPrior;
      })
      .filter((item): item is PortionLearningPrior => !!item);
  } catch (error) {
    console.warn("[portion-learning] Failed to fetch learned priors", error);
    return [];
  }
}

export async function recordPortionCorrectionsForCurrentUser(
  corrections: PortionCorrectionInput[]
): Promise<void> {
  if (!Array.isArray(corrections) || corrections.length === 0) return;

  const userId = await getCurrentUserId();
  if (!userId) return;

  const normalized = corrections
    .filter((correction) => correction.confirmed)
    .map((correction) => {
      const ingredientKey = normalizeIngredientKey(correction.ingredientName);
      const corrected = Number(correction.correctedGrams);
      const predicted = Number(correction.predictedGrams);
      if (!ingredientKey || !isFinite(corrected) || corrected <= 0 || !isFinite(predicted) || predicted <= 0) {
        return null;
      }
      return {
        ingredientKey,
        ingredientName: correction.ingredientName.trim(),
        correctedGrams: clamp(corrected, 5, 1200),
      };
    })
    .filter((item): item is { ingredientKey: string; ingredientName: string; correctedGrams: number } => !!item);

  if (normalized.length === 0) return;

  const uniqueKeys = [...new Set(normalized.map((item) => item.ingredientKey))];

  try {
    const { data: existingRows, error: fetchError } = await supabase
      .from(LEARNING_TABLE)
      .select("user_id, ingredient_key, ingredient_name, sample_count, mean_grams, m2")
      .eq("user_id", userId)
      .in("ingredient_key", uniqueKeys);

    if (fetchError) {
      if (typeof fetchError.message === "string" && fetchError.message.includes("relation")) {
        console.warn("[portion-learning] Learning table missing, skipping update");
        return;
      }
      throw fetchError;
    }

    const existingByKey = new Map<string, PortionLearningRow>();
    for (const row of existingRows ?? []) {
      const typed = row as Partial<PortionLearningRow>;
      if (!typed.ingredient_key) continue;
      existingByKey.set(typed.ingredient_key, {
        user_id: typed.user_id ?? userId,
        ingredient_key: typed.ingredient_key,
        ingredient_name: typed.ingredient_name ?? typed.ingredient_key,
        sample_count: Number(typed.sample_count ?? 0),
        mean_grams: Number(typed.mean_grams ?? 0),
        m2: Number(typed.m2 ?? 0),
      });
    }

    for (const correction of normalized) {
      const prev = existingByKey.get(correction.ingredientKey);
      if (!prev) {
        existingByKey.set(correction.ingredientKey, {
          user_id: userId,
          ingredient_key: correction.ingredientKey,
          ingredient_name: correction.ingredientName,
          sample_count: 1,
          mean_grams: correction.correctedGrams,
          m2: 0,
        });
        continue;
      }

      const n = Math.max(0, prev.sample_count) + 1;
      const delta = correction.correctedGrams - prev.mean_grams;
      const mean = prev.mean_grams + delta / n;
      const delta2 = correction.correctedGrams - mean;
      const m2 = Math.max(0, prev.m2 + delta * delta2);

      existingByKey.set(correction.ingredientKey, {
        ...prev,
        ingredient_name: correction.ingredientName || prev.ingredient_name,
        sample_count: n,
        mean_grams: mean,
        m2,
      });
    }

    const upsertRows = [...existingByKey.values()].map((row) => ({
      user_id: row.user_id,
      ingredient_key: row.ingredient_key,
      ingredient_name: row.ingredient_name,
      sample_count: row.sample_count,
      mean_grams: Number(row.mean_grams.toFixed(2)),
      m2: Number(row.m2.toFixed(4)),
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabase
      .from(LEARNING_TABLE)
      .upsert(upsertRows, { onConflict: "user_id,ingredient_key" });

    if (upsertError) throw upsertError;
  } catch (error) {
    console.warn("[portion-learning] Failed to persist corrections", error);
  }
}

// ---------------------------------------------------------------------------
// Visual Portion Learning Functions
// ---------------------------------------------------------------------------

interface VisualLearningRow {
  user_id: string;
  ingredient_key: string;
  ingredient_name: string;
  bounding_box: any;
  item_count: number;
  image_dimensions: any;
  visual_area: number;
  corrected_grams: number;
  conversion_factor: number;
  sample_count: number;
  mean_conversion_factor: number;
  m2_conversion_factor: number;
}

const VISUAL_LEARNING_TABLE = "visual_portion_learning";

/**
 * Get visual conversion priors for the current user
 */
export async function getVisualPortionPriorsForCurrentUser(): Promise<Array<{
  ingredientName: string;
  conversionFactor: number;
  sampleCount: number;
  confidence: number;
}>> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from(VISUAL_LEARNING_TABLE)
      .select("ingredient_name, sample_count, mean_conversion_factor, m2_conversion_factor")
      .eq("user_id", userId)
      .gte("sample_count", 2)
      .order("sample_count", { ascending: false })
      .limit(50);

    if (error) {
      if (typeof error.message === "string" && error.message.includes("relation")) {
        console.warn("[visual-learning] Visual learning table missing, skipping priors");
        return [];
      }
      throw error;
    }

    return (data ?? [])
      .map((row) => {
        const typed = row as {
          ingredient_name?: unknown;
          sample_count?: unknown;
          mean_conversion_factor?: unknown;
          m2_conversion_factor?: unknown;
        };
        const ingredientName = String(typed.ingredient_name ?? "").trim();
        const sampleCount = Number(typed.sample_count ?? 0);
        const conversionFactor = Number(typed.mean_conversion_factor ?? 0);
        const m2 = Number(typed.m2_conversion_factor ?? 0);
        
        if (!ingredientName || !isFinite(sampleCount) || sampleCount < 2 || !isFinite(conversionFactor) || conversionFactor <= 0) {
          return null;
        }

        // Compute confidence based on sample size and variance
        const variance = Math.max(0, m2 / Math.max(1, sampleCount - 1));
        const stdev = Math.sqrt(variance);
        const cv = stdev / Math.max(1, conversionFactor);
        
        const sampleFactor = clamp(sampleCount / 8, 0, 1);
        const varianceFactor = clamp(1 - cv / 0.5, 0, 1);
        const confidence = clamp(sampleFactor * 0.7 + varianceFactor * 0.3, 0.2, 0.95);

        return {
          ingredientName,
          conversionFactor,
          sampleCount,
          confidence,
        };
      })
      .filter((item): item is NonNullable<typeof item> => !!item);
  } catch (error) {
    console.warn("[visual-learning] Failed to fetch visual priors", error);
    return [];
  }
}

/**
 * Record visual portion corrections for learning
 */
export async function recordVisualPortionCorrectionsForCurrentUser(
  corrections: PortionCorrectionInput[]
): Promise<void> {
  if (!Array.isArray(corrections) || corrections.length === 0) return;

  const userId = await getCurrentUserId();
  if (!userId) return;

  const visualCorrections = corrections.filter(correction => 
    correction.confirmed && 
    correction.boundingBox && 
    correction.imageDimensions
  );

  if (visualCorrections.length === 0) return;

  try {
    const { data: existingRows, error: fetchError } = await supabase
      .from(VISUAL_LEARNING_TABLE)
      .select("*")
      .eq("user_id", userId)
      .in("ingredient_key", visualCorrections.map(c => normalizeIngredientKey(c.ingredientName)));

    if (fetchError) {
      if (typeof fetchError.message === "string" && fetchError.message.includes("relation")) {
        console.warn("[visual-learning] Visual learning table missing, skipping update");
        return;
      }
      throw fetchError;
    }

    const existingByKey = new Map<string, VisualLearningRow>();
    for (const row of existingRows ?? []) {
      const typed = row as Partial<VisualLearningRow>;
      if (!typed.ingredient_key) continue;
      existingByKey.set(typed.ingredient_key, {
        user_id: typed.user_id ?? userId,
        ingredient_key: typed.ingredient_key,
        ingredient_name: typed.ingredient_name ?? typed.ingredient_key,
        bounding_box: typed.bounding_box ?? {},
        item_count: Number(typed.item_count ?? 1),
        image_dimensions: typed.image_dimensions ?? {},
        visual_area: Number(typed.visual_area ?? 0),
        corrected_grams: Number(typed.corrected_grams ?? 0),
        conversion_factor: Number(typed.conversion_factor ?? 0),
        sample_count: Number(typed.sample_count ?? 0),
        mean_conversion_factor: Number(typed.mean_conversion_factor ?? 0),
        m2_conversion_factor: Number(typed.m2_conversion_factor ?? 0),
      });
    }

    for (const correction of visualCorrections) {
      const ingredientKey = normalizeIngredientKey(correction.ingredientName);
      const visualArea = correction.boundingBox!.width * correction.boundingBox!.height;
      const conversionFactor = correction.correctedGrams / visualArea;

      const prev = existingByKey.get(ingredientKey);
      if (!prev) {
        existingByKey.set(ingredientKey, {
          user_id: userId,
          ingredient_key: ingredientKey,
          ingredient_name: correction.ingredientName.trim(),
          bounding_box: correction.boundingBox!,
          item_count: correction.itemCount || 1,
          image_dimensions: correction.imageDimensions!,
          visual_area: visualArea,
          corrected_grams: correction.correctedGrams,
          conversion_factor: conversionFactor,
          sample_count: 1,
          mean_conversion_factor: conversionFactor,
          m2_conversion_factor: 0,
        });
        continue;
      }

      // Update running statistics for conversion factor
      const n = Math.max(0, prev.sample_count) + 1;
      const delta = conversionFactor - prev.mean_conversion_factor;
      const mean = prev.mean_conversion_factor + delta / n;
      const delta2 = conversionFactor - mean;
      const m2 = Math.max(0, prev.m2_conversion_factor + delta * delta2);

      existingByKey.set(ingredientKey, {
        ...prev,
        ingredient_name: correction.ingredientName || prev.ingredient_name,
        bounding_box: correction.boundingBox!,
        item_count: correction.itemCount || prev.item_count,
        image_dimensions: correction.imageDimensions!,
        visual_area: visualArea,
        corrected_grams: correction.correctedGrams,
        conversion_factor: conversionFactor,
        sample_count: n,
        mean_conversion_factor: mean,
        m2_conversion_factor: m2,
      });
    }

    const upsertRows = [...existingByKey.values()].map((row) => ({
      user_id: row.user_id,
      ingredient_key: row.ingredient_key,
      ingredient_name: row.ingredient_name,
      bounding_box: row.bounding_box,
      item_count: row.item_count,
      image_dimensions: row.image_dimensions,
      visual_area: row.visual_area,
      corrected_grams: row.corrected_grams,
      conversion_factor: row.conversion_factor,
      sample_count: row.sample_count,
      mean_conversion_factor: Number(row.mean_conversion_factor.toFixed(6)),
      m2_conversion_factor: Number(row.m2_conversion_factor.toFixed(8)),
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabase
      .from(VISUAL_LEARNING_TABLE)
      .upsert(upsertRows, { onConflict: "user_id,ingredient_key" });

    if (upsertError) throw upsertError;
  } catch (error) {
    console.warn("[visual-learning] Failed to persist visual corrections", error);
  }
}
