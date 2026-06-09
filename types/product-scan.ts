/**
 * Product scan result model for the health-focused scan results screen.
 */

export type HealthGrade = "Excellent" | "Good" | "Okay" | "Poor" | "Avoid";

export type IngredientLevel = "hi" | "med" | "lo" | "ben" | "neutral";

export interface AtAGlanceAdditive {
  name: string;
  category: string;
}

export interface AtAGlance {
  additivesCount: number;
  additives: AtAGlanceAdditive[];
  topFlags: string[];
  seedOils: string | null;
  processingLevel: string;
  sugarAliasCount: number;
  allergens: string[];
  packaging: string;
  realFoodRatio: number;
}

export interface RegulatoryStatus {
  body: string;
  flag: string;
  status: string;
}

export interface ProductIngredient {
  name: string;
  role: string;
  level: IngredientLevel;
  badge: string;
  whatItIs: string;
  gutImpact: string;
  positives: string[];
  concerns: string[];
  riskContext: string;
  regulatoryStatus: RegulatoryStatus[];
}

export interface HealthFlag {
  name: string;
  severity: "High" | "Medium" | "Low" | "Low–Med";
  dotColor: "red" | "amber" | "green";
  detail: string;
  isRelevant: boolean;
}

export interface ProductAlternative {
  productName: string;
  brandName: string;
  imageUrl?: string;
  gutsyScore: number;
  reason: string;
  barcode?: string;
}

export interface ProductInsight {
  productName: string;
  brandName: string;
  parentCompany?: string;
  productImageUrl?: string;
  gutsyScore: number;
  healthGrade: HealthGrade;
  gutReaction: string;
  hasActiveRecall: boolean;
  recallUrl?: string;
  atAGlance: AtAGlance;
  ingredients: ProductIngredient[];
  healthFlags: HealthFlag[];
  alternatives: ProductAlternative[];
}
