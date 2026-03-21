/**
 * Ingredient density database for visual-to-weight conversion
 * Densities are in g/cm³ and represent typical values for prepared/cooked ingredients
 */

export interface IngredientDensity {
  density: number; // g/cm³
  unit: string;
  packingFactor: number; // How tightly the ingredient packs (0.1-1.0)
  visualNotes: string; // Quick reference for visual estimation
}

export const INGREDIENT_DENSITIES: Record<string, IngredientDensity> = {
  // Proteins (cooked)
  "chicken": { density: 1.2, unit: "g/cm³", packingFactor: 0.8, visualNotes: "palm-sized portion ~120g" },
  "turkey": { density: 1.2, unit: "g/cm³", packingFactor: 0.8, visualNotes: "palm-sized portion ~120g" },
  "beef": { density: 1.3, unit: "g/cm³", packingFactor: 0.8, visualNotes: "deck of cards ~100g" },
  "salmon": { density: 1.1, unit: "g/cm³", packingFactor: 0.8, visualNotes: "deck of cards ~120g" },
  "fish": { density: 1.1, unit: "g/cm³", packingFactor: 0.8, visualNotes: "deck of cards ~100g" },
  "tofu": { density: 0.9, unit: "g/cm³", packingFactor: 0.7, visualNotes: "cube ~80g" },
  "eggs": { density: 1.0, unit: "g/cm³", packingFactor: 0.9, visualNotes: "1 large egg ~50g" },

  // Vegetables (raw/cooked)
  "sweet potato": { density: 0.8, unit: "g/cm³", packingFactor: 0.6, visualNotes: "1/3 cup ~50g" },
  "potato": { density: 0.8, unit: "g/cm³", packingFactor: 0.6, visualNotes: "1/3 cup ~50g" },
  "cherry tomatoes": { density: 0.95, unit: "g/cm³", packingFactor: 0.5, visualNotes: "small handful ~50g" },
  "tomatoes": { density: 0.95, unit: "g/cm³", packingFactor: 0.5, visualNotes: "1 medium ~120g" },
  "cucumber": { density: 0.96, unit: "g/cm³", packingFactor: 0.4, visualNotes: "1/2 cup sliced ~75g" },
  "red onion": { density: 0.9, unit: "g/cm³", packingFactor: 0.3, visualNotes: "small sprinkle ~20g" },
  "onion": { density: 0.9, unit: "g/cm³", packingFactor: 0.3, visualNotes: "small sprinkle ~20g" },
  "bell peppers": { density: 0.9, unit: "g/cm³", packingFactor: 0.4, visualNotes: "1/4 pepper ~30g" },
  "broccoli": { density: 0.7, unit: "g/cm³", packingFactor: 0.3, visualNotes: "small florets ~40g" },
  "carrots": { density: 0.9, unit: "g/cm³", packingFactor: 0.5, visualNotes: "1/4 cup ~45g" },
  "corn": { density: 1.3, unit: "g/cm³", packingFactor: 0.6, visualNotes: "2 tablespoons ~30g" },

  // Leafy greens (very low density)
  "arugula": { density: 0.3, unit: "g/cm³", packingFactor: 0.1, visualNotes: "2 loose cups ~50g" },
  "spinach": { density: 0.3, unit: "g/cm³", packingFactor: 0.1, visualNotes: "2 loose cups ~50g" },
  "kale": { density: 0.3, unit: "g/cm³", packingFactor: 0.1, visualNotes: "2 loose cups ~50g" },
  "lettuce": { density: 0.3, unit: "g/cm³", packingFactor: 0.1, visualNotes: "2 loose cups ~50g" },
  "mixed greens": { density: 0.3, unit: "g/cm³", packingFactor: 0.1, visualNotes: "2 loose cups ~50g" },
  "greens": { density: 0.3, unit: "g/cm³", packingFactor: 0.1, visualNotes: "2 loose cups ~50g" },

  // Grains (cooked)
  "brown rice": { density: 1.3, unit: "g/cm³", packingFactor: 0.8, visualNotes: "1/3 cup cooked ~50g" },
  "rice": { density: 1.3, unit: "g/cm³", packingFactor: 0.8, visualNotes: "1/3 cup cooked ~50g" },
  "quinoa": { density: 1.3, unit: "g/cm³", packingFactor: 0.8, visualNotes: "1/3 cup cooked ~50g" },
  "pasta": { density: 1.5, unit: "g/cm³", packingFactor: 0.8, visualNotes: "1/2 cup cooked ~80g" },

  // Fats and spreads
  "avocado": { density: 1.0, unit: "g/cm³", packingFactor: 0.7, visualNotes: "1/4 avocado ~30g" },
  "cheese": { density: 1.1, unit: "g/cm³", packingFactor: 0.9, visualNotes: "1 slice ~20g" },

  // Dressings and sauces (liquid)
  "balsamic vinegar": { density: 1.2, unit: "g/cm³", packingFactor: 1.0, visualNotes: "1 tablespoon ~15g" },
  "vinegar": { density: 1.2, unit: "g/cm³", packingFactor: 1.0, visualNotes: "1 tablespoon ~15g" },
  "dressing": { density: 1.1, unit: "g/cm³", packingFactor: 1.0, visualNotes: "1 tablespoon ~15g" },
  "sauce": { density: 1.1, unit: "g/cm³", packingFactor: 1.0, visualNotes: "1 tablespoon ~15g" },
  "tzatziki": { density: 1.0, unit: "g/cm³", packingFactor: 0.9, visualNotes: "1 tablespoon ~15g" },
  "yogurt sauce": { density: 1.0, unit: "g/cm³", packingFactor: 0.9, visualNotes: "1 tablespoon ~15g" },

  // Legumes
  "chickpeas": { density: 1.4, unit: "g/cm³", packingFactor: 0.6, visualNotes: "2 tablespoons ~30g" },
  "beans": { density: 1.4, unit: "g/cm³", packingFactor: 0.6, visualNotes: "2 tablespoons ~30g" },
  "lentils": { density: 1.4, unit: "g/cm³", packingFactor: 0.6, visualNotes: "2 tablespoons ~30g" },

  // Nuts and seeds
  "nuts": { density: 0.6, unit: "g/cm³", packingFactor: 0.3, visualNotes: "small handful ~15g" },
  "seeds": { density: 0.7, unit: "g/cm³", packingFactor: 0.2, visualNotes: "sprinkle ~5g" },
};

/**
 * Get ingredient density data by name (with fallback handling)
 */
export function getIngredientDensity(ingredientName: string): IngredientDensity {
  const normalizedName = ingredientName.toLowerCase().trim();
  
  // Direct match
  if (INGREDIENT_DENSITIES[normalizedName]) {
    return INGREDIENT_DENSITIES[normalizedName];
  }
  
  // Partial matches for common variations
  for (const [key, density] of Object.entries(INGREDIENT_DENSITIES)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return density;
    }
  }
  
  // Default fallback for unknown ingredients
  return {
    density: 1.0, // Assume water density
    unit: "g/cm³",
    packingFactor: 0.5, // Assume moderately packed
    visualNotes: "estimated portion",
  };
}

/**
 * Calculate estimated weight from visual bounding box
 */
export function estimateWeightFromBoundingBox(
  ingredientName: string,
  boundingBox: { x: number; y: number; width: number; height: number },
  imageDimensions: { width: number; height: number },
  itemCount: number = 1
): number {
  const density = getIngredientDensity(ingredientName);
  
  // Calculate relative size in image (0-1 normalized)
  const relativeArea = boundingBox.width * boundingBox.height;
  
  // Estimate actual dimensions (assuming typical food photo scale)
  // This is a rough approximation - could be improved with plate/object detection
  const imageArea = imageDimensions.width * imageDimensions.height;
  const scaleFactor = Math.sqrt(imageArea) * 0.01; // Rough scaling factor
  
  // Estimate volume in cm³
  const estimatedVolume = relativeArea * scaleFactor * density.packingFactor * 1000;
  
  // Calculate weight and multiply by item count
  const estimatedWeight = estimatedVolume * density.density * itemCount;
  
  // Clamp to reasonable ranges
  return Math.max(5, Math.min(500, Math.round(estimatedWeight)));
}

/**
 * Generate visual reference text based on calculated portion
 */
export function generateVisualReference(
  ingredientName: string,
  estimatedGrams: number,
  itemCount: number = 1
): string {
  const density = getIngredientDensity(ingredientName);
  
  if (itemCount > 1) {
    return `${itemCount} items, ~${Math.round(estimatedGrams / itemCount)}g each`;
  }
  
  // Use predefined visual notes for common portions
  const baseNotes = density.visualNotes;
  
  // Adjust based on actual estimated amount
  if (estimatedGrams < 20) {
    return `small amount, ~${estimatedGrams}g`;
  } else if (estimatedGrams > 200) {
    return `large portion, ~${estimatedGrams}g`;
  } else {
    return baseNotes.replace(/\d+/g, Math.round(estimatedGrams).toString());
  }
}
