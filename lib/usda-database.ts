/**
 * USDA FoodData Central API integration for whole foods and ingredients
 * Provides comprehensive nutrition data for meal scanning accuracy
 */

// USDA FoodData Central API configuration
const USDA_API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY ?? "";
const USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1";
const USDA_SEARCH_URL = `${USDA_BASE_URL}/foods/search`;
const USDA_FOOD_DETAIL_URL = `${USDA_BASE_URL}/food`;

// USDA data types
export interface USDANutrition {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  saturated_fat_g: number;
  iron_mg?: number;
  calcium_mg?: number;
  potassium_mg?: number;
  vitamin_c_mg?: number;
  vitamin_a_iu?: number;
}

export interface USDAFood {
  fdcId: number;
  description: string;
  dataType: "Foundation" | "SR Legacy" | "Survey" | "Market Acquisition";
  foodCode?: string;
  nutrients?: {
    nutrientId: number;
    nutrientName: string;
    unitName: string;
    value: number;
  }[];
  foodNutrients?: {
    nutrientId: number;
    nutrientName: string;
    unitName: string;
    value: number;
  }[];
}

export interface USDFoodResult {
  fdcId: number;
  description: string;
  nutrition: USDANutrition;
  confidence: number;
}

// Nutrient ID mappings for USDA
const NUTRIENT_MAPPINGS: Record<string, number> = {
  calories: 1008,        // Energy
  protein_g: 1003,       // Protein
  carbs_g: 1005,         // Carbohydrate, by difference
  fat_g: 1004,           // Total lipid (fat)
  fiber_g: 1079,         // Fiber, total dietary
  sugar_g: 2000,         // Sugars, total including NLEA
  sodium_mg: 1093,      // Sodium
  saturated_fat_g: 1006, // Fatty acids, total saturated
  iron_mg: 1089,         // Iron
  calcium_mg: 1087,      // Calcium
  potassium_mg: 1092,    // Potassium, K
  vitamin_c_mg: 1162,    // Vitamin C, total ascorbic acid
  vitamin_a_iu: 1104,    // Vitamin A, RAE
};

/**
 * Search for foods in USDA database
 */
export async function searchUSDAFoods(query: string): Promise<USDFoodResult[]> {
  if (!USDA_API_KEY) {
    console.warn("[usda] USDA_API_KEY not set, skipping USDA lookup");
    return [];
  }

  try {
    const response = await fetch(
      `${USDA_SEARCH_URL}?query=${encodeURIComponent(query)}&dataType=Foundation,SR Legacy&pageSize=10&api_key=${USDA_API_KEY}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.warn("[usda] USDA search failed:", response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    const foods: USDAFood[] = data.foods || [];

    console.log(`[usda] Found ${foods.length} results for "${query}"`);

    return foods
      .map(food => convertUSDAFoodToResult(food))
      .filter(Boolean) as USDFoodResult[];
  } catch (error) {
    console.error("[usda] Error searching USDA:", error);
    return [];
  }
}

/**
 * Get detailed nutrition information for a specific food by FDC ID
 */
export async function getUSDAFoodDetails(fdcId: number): Promise<USDFoodResult | null> {
  if (!USDA_API_KEY) {
    console.warn("[usda] USDA_API_KEY not set, skipping USDA lookup");
    return null;
  }

  try {
    const response = await fetch(
      `${USDA_FOOD_DETAIL_URL}/${fdcId}?api_key=${USDA_API_KEY}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.warn("[usda] USDA food details failed:", response.status, response.statusText);
      return null;
    }

    const food: USDAFood = await response.json();
    return convertUSDAFoodToResult(food);
  } catch (error) {
    console.error("[usda] Error getting USDA food details:", error);
    return null;
  }
}

/**
 * Convert USDA food data to our standardized format
 */
function convertUSDAFoodToResult(food: USDAFood): USDFoodResult | null {
  try {
    const nutrition = extractNutritionFromUSDA(getFoodNutrients(food));
    
    return {
      fdcId: food.fdcId,
      description: food.description,
      nutrition,
      confidence: calculateFoodConfidence(food),
    };
  } catch (error) {
    console.error("[usda] Error converting USDA food:", error);
    return null;
  }
}

/**
 * Extract nutrition information from USDA nutrient data
 */
type USDAFoodNutrient = {
  nutrientId: number;
  nutrientName: string;
  unitName: string;
  value: number;
};

function getFoodNutrients(food: USDAFood): USDAFoodNutrient[] {
  if (Array.isArray(food.foodNutrients) && food.foodNutrients.length > 0) {
    return food.foodNutrients;
  }
  if (Array.isArray(food.nutrients) && food.nutrients.length > 0) {
    return food.nutrients;
  }
  return [];
}

function extractNutritionFromUSDA(nutrients?: USDAFoodNutrient[]): USDANutrition {
  const nutrition: USDANutrition = {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: 0,
    sugar_g: 0,
    sodium_mg: 0,
    saturated_fat_g: 0,
  };

  if (!Array.isArray(nutrients) || nutrients.length === 0) {
    return nutrition;
  }

  nutrients.forEach(nutrient => {
    if (!nutrient || typeof nutrient.nutrientId !== "number") return;
    const mapping = Object.entries(NUTRIENT_MAPPINGS).find(([_, id]) => id === nutrient.nutrientId);
    if (mapping) {
      const [key] = mapping;
      const value = nutrient.value || 0;
      
      // Convert units if necessary
      let normalizedValue = value;
      if (key === "sodium_mg" && nutrient.unitName === "mg") {
        normalizedValue = value; // Already in mg
      } else if (key === "iron_mg" && nutrient.unitName === "mg") {
        normalizedValue = value; // Already in mg
      } else if (key === "calcium_mg" && nutrient.unitName === "mg") {
        normalizedValue = value; // Already in mg
      } else if (key === "potassium_mg" && nutrient.unitName === "mg") {
        normalizedValue = value; // Already in mg
      } else if (key === "vitamin_c_mg" && nutrient.unitName === "mg") {
        normalizedValue = value; // Already in mg
      } else if (key === "vitamin_a_iu" && nutrient.unitName === "IU") {
        normalizedValue = value; // Keep IU for vitamin A
      }

      (nutrition as any)[key] = normalizedValue;
    }
  });

  return nutrition;
}

/**
 * Calculate confidence score for USDA food match
 */
function calculateFoodConfidence(food: USDAFood): number {
  let confidence = 0.5; // Base confidence

  // Higher confidence for Foundation foods (most reliable)
  if (food.dataType === "Foundation") {
    confidence += 0.3;
  }
  // Medium confidence for SR Legacy
  else if (food.dataType === "SR Legacy") {
    confidence += 0.2;
  }
  // Lower confidence for Survey data
  else if (food.dataType === "Survey") {
    confidence += 0.1;
  }

  // Boost confidence if we have comprehensive nutrient data
  const nutrientCount = getFoodNutrients(food).length;
  if (nutrientCount >= 20) {
    confidence += 0.1;
  } else if (nutrientCount >= 10) {
    confidence += 0.05;
  }

  return Math.min(1.0, confidence);
}

/**
 * Get nutrition data for a specific ingredient name
 * This is the main function used by meal scanning
 */
export async function getIngredientNutrition(
  ingredientName: string,
  cookingState?: "raw" | "cooked" | "processed"
): Promise<USDANutrition | null> {
  // Search for the ingredient
  const searchQuery = cookingState ? `${ingredientName} ${cookingState}` : ingredientName;
  const results = await searchUSDAFoods(searchQuery);

  if (results.length === 0) {
    // Try alternative search terms
    const alternatives = getAlternativeSearchTerms(ingredientName);
    for (const altTerm of alternatives) {
      const altResults = await searchUSDAFoods(altTerm);
      if (altResults.length > 0) {
        return altResults[0].nutrition;
      }
    }
    return null;
  }

  // Return the best match (highest confidence)
  const bestMatch = results.reduce((best, current) => 
    current.confidence > best.confidence ? current : best
  );

  console.log(`[usda] Found nutrition for "${ingredientName}":`, bestMatch.description);
  return bestMatch.nutrition;
}

/**
 * Get alternative search terms for ingredients
 */
function getAlternativeSearchTerms(ingredientName: string): string[] {
  const alternatives: string[] = [];
  
  // Common variations
  const lowerName = ingredientName.toLowerCase();
  
  // Remove common qualifiers
  const cleanName = lowerName
    .replace(/\b(raw|cooked|fresh|frozen|canned|dried)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleanName !== lowerName) {
    alternatives.push(cleanName);
  }

  // Add plural/singular variations
  if (lowerName.endsWith('s')) {
    alternatives.push(lowerName.slice(0, -1)); // Remove 's'
  } else {
    alternatives.push(lowerName + 's'); // Add 's'
  }

  // Common food name mappings
  const commonMappings: Record<string, string[]> = {
    "chicken": ["chicken breast", "chicken thigh"],
    "beef": ["ground beef", "beef steak"],
    "rice": ["white rice", "brown rice"],
    "potato": ["white potato", "russet potato"],
    "tomato": ["raw tomato", "fresh tomato"],
  };

  if (commonMappings[lowerName]) {
    alternatives.push(...commonMappings[lowerName]);
  }

  return alternatives.filter(alt => alt !== ingredientName);
}

/**
 * Calculate combined nutrition for multiple ingredients
 */
export function calculateCombinedNutrition(
  ingredients: Array<{ name: string; grams: number; nutrition?: USDANutrition }>
): USDANutrition {
  const combined: USDANutrition = {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: 0,
    sugar_g: 0,
    sodium_mg: 0,
    saturated_fat_g: 0,
  };

  ingredients.forEach(ingredient => {
    if (!ingredient.nutrition) return;

    const factor = ingredient.grams / 100; // Convert from per-100g to actual grams

    combined.calories += ingredient.nutrition.calories * factor;
    combined.protein_g += ingredient.nutrition.protein_g * factor;
    combined.carbs_g += ingredient.nutrition.carbs_g * factor;
    combined.fat_g += ingredient.nutrition.fat_g * factor;
    combined.fiber_g += ingredient.nutrition.fiber_g * factor;
    combined.sugar_g += ingredient.nutrition.sugar_g * factor;
    combined.sodium_mg += ingredient.nutrition.sodium_mg * factor;
    combined.saturated_fat_g += ingredient.nutrition.saturated_fat_g * factor;
  });

  return combined;
}
