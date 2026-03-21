/**
 * Vision-based portion estimation system
 * Replaces hardcoded priors with calculations from visual data
 */

import {
    estimateWeightFromBoundingBox,
    generateVisualReference
} from "@/lib/ingredient-densities";
import type { DetectedIngredient, PortionEstimate } from "@/types/scan";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisualPortionData {
  ingredientName: string;
  itemCount: number;
  relativeSize: number; // 0-1 normalized size in image
  boundingBox: BoundingBox;
  estimatedGrams: number;
  confidence: number;
  visualReference: string;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Count instances of each ingredient from detection results
 */
export function countIngredientInstances(ingredients: DetectedIngredient[]): Map<string, number> {
  const counts = new Map<string, number>();
  
  ingredients.forEach(ingredient => {
    const key = normalizeIngredientName(ingredient.name);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  
  return counts;
}

/**
 * Calculate relative size of ingredient in image
 */
export function calculateRelativeSize(boundingBox: BoundingBox): number {
  return boundingBox.width * boundingBox.height; // 0-1 normalized area
}

/**
 * Group ingredients by proximity to detect multiple items of same type
 */
export function groupIngredientsByProximity(
  ingredients: DetectedIngredient[],
  proximityThreshold: number = 0.1
): Map<string, DetectedIngredient[]> {
  const groups = new Map<string, DetectedIngredient[]>();
  
  ingredients.forEach(ingredient => {
    const key = normalizeIngredientName(ingredient.name);
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    
    groups.get(key)!.push(ingredient);
  });
  
  return groups;
}

/**
 * Calculate visual-based portion estimate for a single ingredient
 */
export function calculateVisualPortion(
  ingredient: DetectedIngredient,
  imageDimensions: ImageDimensions,
  allIngredients: DetectedIngredient[] = []
): VisualPortionData {
  const ingredientName = ingredient.name;
  const boundingBox = ingredient.boundingBox;
  
  // Count how many instances of this ingredient exist
  const ingredientGroups = groupIngredientsByProximity(allIngredients);
  const similarIngredients = ingredientGroups.get(normalizeIngredientName(ingredientName)) || [];
  const itemCount = similarIngredients.length;
  
  // Calculate relative size
  const relativeSize = calculateRelativeSize(boundingBox);
  
  // Estimate weight from visual data
  const estimatedGrams = estimateWeightFromBoundingBox(
    ingredientName,
    boundingBox,
    imageDimensions,
    itemCount
  );
  
  // Calculate confidence based on detection confidence and size clarity
  const baseConfidence = ingredient.confidence || 0.6;
  const sizeConfidence = Math.min(1.0, relativeSize * 2); // Larger items are easier to estimate
  const confidence = (baseConfidence * 0.7) + (sizeConfidence * 0.3);
  
  // Generate visual reference
  const visualReference = generateVisualReference(ingredientName, estimatedGrams, itemCount);
  
  return {
    ingredientName,
    itemCount,
    relativeSize,
    boundingBox,
    estimatedGrams,
    confidence: Math.max(0.1, Math.min(1.0, confidence)),
    visualReference,
  };
}

/**
 * Calculate visual-based portions for all detected ingredients
 */
export function calculateVisualPortions(
  ingredients: DetectedIngredient[],
  imageDimensions: ImageDimensions
): VisualPortionData[] {
  return ingredients.map(ingredient => 
    calculateVisualPortion(ingredient, imageDimensions, ingredients)
  );
}

/**
 * Convert visual portion data to PortionEstimate format
 */
export function visualPortionToEstimate(visualPortion: VisualPortionData): PortionEstimate {
  return {
    ingredientName: visualPortion.ingredientName,
    estimatedGrams: visualPortion.estimatedGrams,
    confidence: visualPortion.confidence,
    visualReference: visualPortion.visualReference,
  };
}

/**
 * Merge visual estimates with any existing AI estimates
 * Prefers visual calculation but keeps AI confidence if higher
 */
export function mergeVisualAndAiEstimates(
  visualPortions: VisualPortionData[],
  aiEstimates: PortionEstimate[]
): PortionEstimate[] {
  const mergedPortions = new Map<string, PortionEstimate>();
  
  // Add visual estimates first
  visualPortions.forEach(visual => {
    mergedPortions.set(visual.ingredientName.toLowerCase(), visualPortionToEstimate(visual));
  });
  
  // Merge with AI estimates, keeping the higher confidence
  aiEstimates.forEach(ai => {
    const key = ai.ingredientName.toLowerCase();
    const existing = mergedPortions.get(key);
    
    if (!existing || ai.confidence > existing.confidence) {
      // Keep AI estimate if it has higher confidence, but merge visual reference
      mergedPortions.set(key, {
        ...ai,
        visualReference: existing?.visualReference || ai.visualReference,
      });
    } else {
      // Keep visual estimate but potentially update confidence
      mergedPortions.set(key, {
        ...existing,
        confidence: Math.max(existing.confidence, ai.confidence * 0.8),
      });
    }
  });
  
  return Array.from(mergedPortions.values());
}

/**
 * Validate that total meal weight makes sense
 */
export function validateTotalMealWeight(portions: PortionEstimate[]): {
  isValid: boolean;
  totalGrams: number;
  reason?: string;
} {
  const totalGrams = portions.reduce((sum, portion) => sum + portion.estimatedGrams, 0);
  
  // Reasonable meal weight ranges
  if (totalGrams < 100) {
    return {
      isValid: false,
      totalGrams,
      reason: "Meal appears too light for a complete serving",
    };
  }
  
  if (totalGrams > 1500) {
    return {
      isValid: false,
      totalGrams,
      reason: "Meal appears unusually heavy for a single serving",
    };
  }
  
  return {
    isValid: true,
    totalGrams,
  };
}

/**
 * Adjust portions if total weight seems unreasonable
 */
export function adjustPortionsForTotalWeight(
  portions: PortionEstimate[],
  targetGrams: number = 400 // Default target meal size
): PortionEstimate[] {
  const currentTotal = portions.reduce((sum, portion) => sum + portion.estimatedGrams, 0);
  
  if (currentTotal === 0) return portions;
  
  const adjustmentFactor = targetGrams / currentTotal;
  
  // Only adjust if the difference is significant (>25%)
  if (Math.abs(adjustmentFactor - 1) > 0.25) {
    return portions.map(portion => ({
      ...portion,
      estimatedGrams: Math.round(portion.estimatedGrams * adjustmentFactor),
      visualReference: `${Math.round(portion.estimatedGrams * adjustmentFactor)}g (adjusted)`,
    }));
  }
  
  return portions;
}

/**
 * Normalize ingredient name for grouping and lookup
 */
function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generate detailed visual analysis summary
 */
export function generateVisualAnalysisSummary(visualPortions: VisualPortionData[]): string {
  const totalItems = visualPortions.reduce((sum, vp) => sum + vp.itemCount, 0);
  const totalGrams = visualPortions.reduce((sum, vp) => sum + vp.estimatedGrams, 0);
  const avgConfidence = visualPortions.reduce((sum, vp) => sum + vp.confidence, 0) / visualPortions.length;
  
  const details = visualPortions
    .map(vp => `${vp.ingredientName}: ${vp.itemCount} item(s), ${vp.estimatedGrams}g`)
    .join(", ");
  
  return `Detected ${totalItems} items totaling ~${totalGrams}g (${Math.round(avgConfidence * 100)}% confidence). ${details}`;
}
