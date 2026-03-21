/**
 * Shared scan result shape for photo and barcode flows.
 * Matches meal_scans columns and UI display.
 */
export type ScanType = "photo" | "barcode" | "manual";

/** Cooking states for ingredient detection */
export type CookingState = "raw" | "cooked" | "processed";

/** Cooking methods detected in meals */
export type CookingMethod = "grilled" | "fried" | "boiled" | "roasted" | "steamed" | "baked" | "sautéed" | "raw";

/** Detected ingredient with meal analysis data */
export interface DetectedIngredient {
  name: string;
  state: CookingState;
  cookingMethod?: CookingMethod;
  boundingBox: { x: number; y: number; width: number; height: number };
  confidence: number;
  estimatedGrams?: number;
  itemCount?: number; // Number of visible items of this ingredient
}

/** Portion estimation for meal components */
export interface PortionEstimate {
  ingredientName: string;
  estimatedGrams: number;
  confidence: number;
  visualReference?: string; // "deck of cards", "palm size", etc.
}

/** Learned prior for ingredient-level portion estimation */
export interface PortionLearningPrior {
  ingredientName: string;
  meanGrams: number;
  confidence: number; // 0-1 derived from sample size and variance
  sampleCount: number;
}

/** Meal component analysis result */
export interface MealComponent {
  ingredient: DetectedIngredient;
  portion: PortionEstimate;
  nutrition: ScanNutrition;
  gutImpact: {
    bloatRisk: number; // 0-100
    skinImpact: number; // 0-10
    energyImpact: number; // 0-10
    digestionImpact: number; // 0-10
  };
}

/** Cooking analysis for meal preparation methods */
export interface CookingAnalysis {
  methods: CookingMethod[];
  overallHealthImpact: "positive" | "neutral" | "negative";
  recommendations: string[];
  temperatureImpact?: string; // how cooking temperature affects nutrition
}

/** Portion adjustment options for user confirmation */
export interface PortionAdjustment {
  ingredientName: string;
  currentGrams: number;
  minGrams: number;
  maxGrams: number;
  suggestedGrams: number;
  visualReference: string;
}

/** Meal detection result from vision AI */
export interface MealDetectionResult {
  isMeal: boolean;
  ingredients: DetectedIngredient[];
  cookingMethods: CookingMethod[];
  portionEstimates: PortionEstimate[];
  confidence: number;
  totalEstimatedCalories?: number;
}

export interface ScanAnalysis {
  summary: string;
  tips: string[];
  confidence?: number;
  /** How it may affect skin (short explanation) */
  skin?: string;
  /** How it may affect digestion/bloating */
  digestion?: string;
  /** How it may affect energy/mood */
  mood?: string;
  /** Detailed personalized descriptions for each impact */
  impactDetails?: {
    skin?: { description: string; learnMore?: { title: string; content: string; sensitivity?: string } };
    bloating?: { description: string; learnMore?: { title: string; content: string; timing?: string } };
    digestion?: { description: string; learnMore?: { title: string; content: string } };
    energy?: { description: string; learnMore?: { title: string; content: string } };
  };
  /** Bloat-specific AI content */
  bloatDetails?: {
    expectedTime?: string; // e.g., "4-6 hours from now"
    tip?: string; // e.g., "Drink 2 extra glasses of water today"
  };
  /** Goal-specific prediction card */
  goalPrediction?: {
    forecast?: Array<{ time: string; risk: string; description: string }>;
    improvements?: Array<{ action: string; newScore: string; impact: string }>;
  };
  /** Personalized insights */
  personalizedInsights?: Array<{
    type: "trigger" | "quick_win" | "pattern" | "great_choice";
    title: string;
    detail: string;
    tip?: string;
    stat?: string; // e.g., "78% bloat probability"
    swap?: { from: string; to: string; scoreChange: string };
    progress?: { current: number; total: number; unlock?: string };
  }>;
  /** Make it better options */
  improvementOptions?: {
    urgency?: string; // e.g., "You can still modify your order!"
    option1?: {
      title: string;
      time: string;
      skips: string[];
      keeps: string[];
      results: { bloat: string; skin?: string; energy?: string };
    };
    option2?: {
      title: string;
      mealName: string;
      mealImage?: string;
      scores: { bloat: string; skin: string; energy: string };
      testimonial?: string;
    };
  };
  /** Timing insights */
  timingInsights?: {
    currentTime?: string;
    idealTimes?: Array<{ meal: string; time: string; note: string }>;
    currentStatus?: string; // e.g., "1h 47min past ideal"
    whyMatters?: string;
    premiumNote?: string;
  };
  /** Nutrition context */
  nutritionContext?: {
    goalContext?: Array<{ nutrient: string; value: string; status: "high" | "moderate" | "good"; reason: string }>;
    optimalRanges?: Array<{ nutrient: string; range: string }>;
  };
  /** Serving size as displayed on label (e.g. "1 pack (85g)", "1 cup (240ml)") — from vision */
  serving_size_display?: string;
  /** Servings per container — from vision */
  servings_per_container?: number;
  /** Cached LLM ingredient analysis for Ingredients tab */
  ingredientAnalysis?: {
    items: Array<{ displayName: string; impact: "negative" | "moderate" | "positive"; whyMatters: string }>;
    redCount: number;
    yellowCount: number;
    greenCount: number;
  };
}

export interface ScanNutrition {
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
  [key: string]: number | undefined;
}

export interface ScanResult {
  scan_type: ScanType;
  food_name: string;
  /** Full product name (e.g. "Lay's Classic Potato Chips") for barcode scans */
  product_name?: string;
  /** Brand/manufacturer (e.g. "Frito-Lay") for barcode scans */
  manufacturer?: string;
  identified_foods: string[];
  /** Overall gut-health score 0–100 (for display as "Gut score") */
  gut_score?: number;
  bloat_score: number; // 0-10 (higher = less bloating)
  skin_score: number; // 0-10
  energy_score: number; // 0-10
  digestion_score: number; // 0-10
  analysis: ScanAnalysis;
  nutrition: ScanNutrition;
  ai_confidence?: number;
  /** Score reliability: high = full nutrition + ingredients; medium/low = limited data */
  confidence?: "high" | "medium" | "low";
  barcode?: string;
  image_url?: string;
  image_storage_path?: string;
  /** Parsed ingredients list (e.g. from barcode product data) */
  ingredients?: string[];
  /** Meal-specific data for multi-ingredient scans */
  mealComponents?: MealComponent[];
  /** Cooking analysis for meal preparation */
  cookingAnalysis?: CookingAnalysis;
  /** Portion adjustments available for user confirmation */
  portionAdjustments?: PortionAdjustment[];
  /** Whether this scan was detected as a meal vs product */
  isMeal?: boolean;
  /** Ingredient confirmations from user */
  ingredientConfirmations?: Record<string, boolean>;
}

/** Request body for analyze-scan Edge Function */
export interface AnalyzeScanRequest {
  scan_type: "photo" | "barcode";
  image_url?: string;
  /** Base64 image when not uploading to storage (e.g. no auth) */
  image_base64?: string;
  barcode?: string;
  /** Optional learned priors injected from user correction history */
  learnedPortionPriors?: PortionLearningPrior[];
  /** Meal-specific request data */
  mealDetection?: {
    enableMealDetection: boolean;
    confidenceThreshold?: number; // Default 0.75
  };
}

/** Enhanced meal scan request with meal-specific data */
export interface MealScanRequest extends AnalyzeScanRequest {
  detectedIngredients?: DetectedIngredient[];
  cookingMethods?: CookingMethod[];
  portionEstimates?: PortionEstimate[];
}

/** Enhanced scan result for meal analysis */
export interface MealScanResult extends ScanResult {
  mealComponents: MealComponent[];
  cookingAnalysis: CookingAnalysis;
  portionAdjustments: PortionAdjustment[];
  isMeal: boolean;
  ingredientConfirmations: Record<string, boolean>;
}
