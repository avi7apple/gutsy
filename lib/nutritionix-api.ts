/**
 * Nutritionix API integration for restaurant and chain foods
 * Provides comprehensive nutrition data for commercial meals and packaged foods
 */

// Nutritionix API configuration
const NUTRITIONIX_APP_ID = process.env.EXPO_PUBLIC_NUTRITIONIX_APP_ID ?? "";
const NUTRITIONIX_APP_KEY = process.env.EXPO_PUBLIC_NUTRITIONIX_APP_KEY ?? "";
const NUTRITIONIX_BASE_URL = "https://trackapi.nutritionix.com/v2";

// Nutritionix data types
export interface NutritionixNutrition {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  saturated_fat_g: number;
  cholesterol_mg?: number;
  trans_fat_g?: number;
  vitamin_a?: number;
  vitamin_c?: number;
  calcium?: number;
  iron?: number;
  potassium?: number;
}

export interface NutritionixFood {
  food_name: string;
  brand_name?: string;
  serving_qty: number;
  serving_unit: string;
  serving_weight_grams: number;
  nf_calories: number;
  nf_protein: number;
  nf_total_carbohydrate: number;
  nf_total_fat: number;
  nf_dietary_fiber: number;
  nf_sugars: number;
  nf_sodium: number;
  nf_saturated_fat: number;
  nf_cholesterol?: number;
  nf_trans_fatty_acid?: number;
  nf_vitamin_a_dv?: number;
  nf_vitamin_c_dv?: number;
  nf_calcium_dv?: number;
  nf_iron_dv?: number;
  nf_potassium?: number;
  full_nutrients?: Array<{
    attr_id: number;
    attr_name: string;
    value: number;
    unit: string;
  }>;
}

export interface NutritionixSearchResult {
  branded?: NutritionixFood[];
  common?: NutritionixFood[];
  total_hits?: number;
  max_pages?: number;
  page_number?: number;
}

export interface NutritionixResult {
  food_name: string;
  brand_name?: string;
  nutrition: NutritionixNutrition;
  serving_size_grams: number;
  confidence: number;
}

/**
 * Search for foods in Nutritionix database
 */
export async function searchNutritionixFoods(
  query: string,
  brand?: string
): Promise<NutritionixResult[]> {
  if (!NUTRITIONIX_APP_ID || !NUTRITIONIX_APP_KEY) {
    console.warn("[nutritionix] Nutritionix credentials not set, skipping lookup");
    return [];
  }

  try {
    const requestBody: any = {
      query: query,
      timezone: "US/Eastern",
      include_full_nutrients: true,
    };

    if (brand) {
      requestBody.brand = brand;
    }

    const response = await fetch(`${NUTRITIONIX_BASE_URL}/search/instant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-id": NUTRITIONIX_APP_ID,
        "x-app-key": NUTRITIONIX_APP_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.warn("[nutritionix] Nutritionix search failed:", response.status, response.statusText);
      return [];
    }

    const data: NutritionixSearchResult = await response.json();
    const foods = data.branded?.slice(0, 10) || [];

    console.log(`[nutritionix] Found ${foods.length} branded results for "${query}"`);

    return foods
      .map((food: NutritionixFood) => convertNutritionixFoodToResult(food))
      .filter(Boolean) as NutritionixResult[];
  } catch (error) {
    console.error("[nutritionix] Error searching Nutritionix:", error);
    return [];
  }
}

/**
 * Get natural food data from Nutritionix (for whole foods)
 */
export async function searchNaturalNutritionixFoods(query: string): Promise<NutritionixResult[]> {
  if (!NUTRITIONIX_APP_ID || !NUTRITIONIX_APP_KEY) {
    console.warn("[nutritionix] Nutritionix credentials not set, skipping lookup");
    return [];
  }

  try {
    const requestBody = {
      query: query,
      timezone: "US/Eastern",
      include_full_nutrients: true,
    };

    const response = await fetch(`${NUTRITIONIX_BASE_URL}/search/instant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-id": NUTRITIONIX_APP_ID,
        "x-app-key": NUTRITIONIX_APP_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.warn("[nutritionix] Nutritionix natural search failed:", response.status, response.statusText);
      return [];
    }

    const data: NutritionixSearchResult = await response.json();
    const foods = data.common?.slice(0, 5) || [];

    console.log(`[nutritionix] Found ${foods.length} natural results for "${query}"`);

    return foods
      .map((food: NutritionixFood) => convertNutritionixFoodToResult(food))
      .filter(Boolean) as NutritionixResult[];
  } catch (error) {
    console.error("[nutritionix] Error searching Nutritionix natural:", error);
    return [];
  }
}

/**
 * Convert Nutritionix food data to our standardized format
 */
function convertNutritionixFoodToResult(food: NutritionixFood): NutritionixResult | null {
  try {
    const nutrition: NutritionixNutrition = {
      calories: food.nf_calories || 0,
      protein_g: food.nf_protein || 0,
      carbs_g: food.nf_total_carbohydrate || 0,
      fat_g: food.nf_total_fat || 0,
      fiber_g: food.nf_dietary_fiber || 0,
      sugar_g: food.nf_sugars || 0,
      sodium_mg: food.nf_sodium || 0,
      saturated_fat_g: food.nf_saturated_fat || 0,
      cholesterol_mg: food.nf_cholesterol,
      trans_fat_g: food.nf_trans_fatty_acid,
      vitamin_a: food.nf_vitamin_a_dv,
      vitamin_c: food.nf_vitamin_c_dv,
      calcium: food.nf_calcium_dv,
      iron: food.nf_iron_dv,
      potassium: food.nf_potassium,
    };

    return {
      food_name: food.food_name,
      brand_name: food.brand_name,
      nutrition,
      serving_size_grams: food.serving_weight_grams || 100,
      confidence: calculateNutritionixConfidence(food),
    };
  } catch (error) {
    console.error("[nutritionix] Error converting Nutritionix food:", error);
    return null;
  }
}

/**
 * Calculate confidence score for Nutritionix food match
 */
function calculateNutritionixConfidence(food: NutritionixFood): number {
  let confidence = 0.6; // Base confidence for branded foods

  // Higher confidence for branded foods (more reliable)
  if (food.brand_name) {
    confidence += 0.2;
  }

  // Boost confidence if we have comprehensive nutrient data
  const nutrientFields = [
    'nf_calories', 'nf_protein', 'nf_total_carbohydrate', 'nf_total_fat',
    'nf_dietary_fiber', 'nf_sugars', 'nf_sodium', 'nf_saturated_fat'
  ];
  
  const filledFields = nutrientFields.filter(field => (food as any)[field] !== undefined).length;
  const fieldConfidence = filledFields / nutrientFields.length;
  confidence += fieldConfidence * 0.2;

  return Math.min(1.0, confidence);
}

/**
 * Get nutrition data for commercial/restaurant foods
 * This is the main function used for restaurant meal scanning
 */
export async function getCommercialFoodNutrition(
  foodName: string,
  brand?: string
): Promise<NutritionixNutrition | null> {
  // Try branded search first if brand is specified
  if (brand) {
    const brandedResults = await searchNutritionixFoods(foodName, brand);
    if (brandedResults.length > 0) {
      console.log(`[nutritionix] Found branded nutrition for "${foodName}" (${brand})`);
      return brandedResults[0].nutrition;
    }
  }

  // Try general branded search
  const brandedResults = await searchNutritionixFoods(foodName);
  if (brandedResults.length > 0) {
    console.log(`[nutritionix] Found branded nutrition for "${foodName}"`);
    return brandedResults[0].nutrition;
  }

  // Fall back to natural foods search
  const naturalResults = await searchNaturalNutritionixFoods(foodName);
  if (naturalResults.length > 0) {
    console.log(`[nutritionix] Found natural nutrition for "${foodName}"`);
    return naturalResults[0].nutrition;
  }

  return null;
}

/**
 * Search for restaurant chain meals
 */
export async function searchRestaurantMeals(
  restaurantName: string,
  mealName?: string
): Promise<NutritionixResult[]> {
  const query = mealName ? `${restaurantName} ${mealName}` : restaurantName;
  return await searchNutritionixFoods(query, restaurantName);
}

/**
 * Get popular restaurant chains for meal suggestions
 */
export async function getPopularRestaurantChains(): Promise<string[]> {
  // Common US restaurant chains that are likely to be in Nutritionix
  return [
    "McDonald's",
    "Burger King",
    "Wendy's",
    "Subway",
    "Starbucks",
    "Dunkin'",
    "Chipotle",
    "Taco Bell",
    "KFC",
    "Pizza Hut",
    "Domino's Pizza",
    "Papa John's",
    "Panera Bread",
    "Chick-fil-A",
    "Applebee's",
    "Olive Garden",
    "Red Robin",
    "Outback Steakhouse",
    "Cheesecake Factory",
    "IHOP",
  ];
}

/**
 * Calculate combined nutrition for multiple commercial foods
 */
export function calculateCombinedCommercialNutrition(
  foods: Array<{ name: string; grams: number; nutrition?: NutritionixNutrition }>
): NutritionixNutrition {
  const combined: NutritionixNutrition = {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: 0,
    sugar_g: 0,
    sodium_mg: 0,
    saturated_fat_g: 0,
  };

  foods.forEach(food => {
    if (!food.nutrition) return;

    const factor = food.grams / 100; // Convert from per-100g to actual grams

    combined.calories += food.nutrition.calories * factor;
    combined.protein_g += food.nutrition.protein_g * factor;
    combined.carbs_g += food.nutrition.carbs_g * factor;
    combined.fat_g += food.nutrition.fat_g * factor;
    combined.fiber_g += food.nutrition.fiber_g * factor;
    combined.sugar_g += food.nutrition.sugar_g * factor;
    combined.sodium_mg += food.nutrition.sodium_mg * factor;
    combined.saturated_fat_g += food.nutrition.saturated_fat_g * factor;
  });

  return combined;
}
