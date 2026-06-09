import { buildAtAGlance, gutsyScoreToHealthGrade } from "@/lib/product-at-a-glance";
import type { AlternativeProduct } from "@/lib/product-alternatives";
import { isKnownAdditiveName } from "@/lib/scan-result/additive-detection";
import { mapAlternativeProducts } from "@/lib/scan-result/map-alternatives";
import { getIngredientLevelStyles } from "@/lib/scan-result/risk-colors";
import type { ProductInfo } from "@/lib/product-lookup";
import type { ScanResult } from "@/types/scan";
import type {
  HealthFlag,
  IngredientLevel,
  ProductIngredient,
  ProductInsight,
} from "@/types/product-scan";

function impactToLevel(impact: string): IngredientLevel {
  if (impact === "negative") return "hi";
  if (impact === "moderate") return "med";
  if (impact === "positive") return "ben";
  return "neutral";
}

function mapIngredientsFromAnalysis(result: ScanResult): ProductIngredient[] {
  const items = result.analysis.ingredientAnalysis?.items ?? [];
  if (items.length > 0) {
    return items.map((item) => {
      const level = impactToLevel(item.impact);
      const styles = getIngredientLevelStyles(level);
      const isAdditive =
        item.tier === "micro" || isKnownAdditiveName(item.displayName);
      const role =
        item.tier === "main"
          ? "Primary ingredient"
          : isAdditive
            ? "Additive"
            : "Supporting";
      return {
        name: item.displayName,
        role,
        level,
        badge: styles.badgeLabel,
        whatItIs: item.whyMatters,
        gutImpact: item.whyMatters,
        positives: item.impact === "positive" ? ["Generally supportive for gut diversity when consumed in moderation."] : [],
        concerns: item.impact === "negative" ? ["May contribute to gut irritation in sensitive individuals."] : [],
        riskContext: item.whyMatters,
        regulatoryStatus: [{ body: "FDA", flag: "🇺🇸", status: "Generally recognized" }],
      };
    });
  }

  const raw = result.ingredients;
  if (!Array.isArray(raw)) return [];

  return raw.slice(0, 12).map((name) => ({
    name,
    role: "Ingredient",
    level: "neutral" as IngredientLevel,
    badge: "Neutral",
    whatItIs: `Component of ${result.product_name ?? result.food_name}.`,
    gutImpact: "Impact varies based on portion and individual sensitivity.",
    positives: [],
    concerns: [],
    riskContext: "Limited analysis data for this ingredient.",
    regulatoryStatus: [{ body: "FDA", flag: "🇺🇸", status: "Varies" }],
  }));
}

function deriveHealthFlags(result: ScanResult, atAGlance: ProductInsight["atAGlance"]): HealthFlag[] {
  const ing = (result.ingredients ?? []).join(" ").toLowerCase();
  const allText = `${ing} ${result.analysis.summary ?? ""}`.toLowerCase();

  const flags: HealthFlag[] = [
    {
      name: "Gut lining risk",
      severity: "High",
      dotColor: "red",
      detail:
        "Emulsifiers and highly processed additives in this product may increase intestinal permeability in sensitive individuals.",
      isRelevant:
        atAGlance.additivesCount >= 2 ||
        /emulsif|carrageenan|polysorbate|gum/.test(allText),
    },
    {
      name: "Microplastic risk",
      severity: "Medium",
      dotColor: "amber",
      detail:
        "Plastic packaging may leach microplastics into fatty or acidic foods, especially with heat exposure.",
      isRelevant: atAGlance.packaging.toLowerCase().includes("plastic"),
    },
    {
      name: "Pesticide risk",
      severity: "Medium",
      dotColor: "amber",
      detail:
        "Conventional farming of key ingredients may leave pesticide residues that affect gut and hormone balance.",
      isRelevant: /corn|soy|wheat|potato|apple|berry|leafy/.test(allText),
    },
    {
      name: "Heavy metal risk",
      severity: "Low–Med",
      dotColor: "amber",
      detail:
        "Certain sourcing patterns for rice, chocolate, and root vegetables can concentrate heavy metals.",
      isRelevant: /rice|cocoa|chocolate|root|seafood|fish/.test(allText),
    },
    {
      name: "Endocrine disruptor risk",
      severity: "Medium",
      dotColor: "amber",
      detail:
        "Some packaging and additive compounds may interfere with hormone signaling when consumed regularly.",
      isRelevant:
        atAGlance.additivesCount >= 1 ||
        /bpa|phthalate|artificial color|preservative/.test(allText),
    },
  ];

  return flags;
}

export function getProductInsightFromScan(
  result: ScanResult,
  savedAlternatives?: AlternativeProduct[] | null,
): ProductInsight {
  const gutsyScore = typeof result.gut_score === "number" ? Math.round(result.gut_score) : 50;
  const productName = result.product_name ?? result.food_name ?? "Scanned Product";
  const brandName = result.manufacturer ?? "Unknown brand";

  const syntheticProduct: ProductInfo = {
    name: productName,
    brand: brandName,
    barcode: result.barcode ?? "",
    imageUrl: result.image_url,
    ingredients: result.ingredients?.join(", "),
    nutrition: result.nutrition ?? {},
    source: "openfoodfacts",
  };

  const atAGlance = buildAtAGlance(syntheticProduct, result.ingredients);

  if (result.analysis.productInsight) {
    const pi = result.analysis.productInsight;
    const merged: ProductInsight = {
      ...pi,
      atAGlance: {
        ...pi.atAGlance,
        ...atAGlance,
      },
    };
    if (savedAlternatives?.length && (!merged.alternatives || merged.alternatives.length === 0)) {
      return { ...merged, alternatives: mapAlternativeProducts(savedAlternatives) };
    }
    return merged;
  }

  const ingredients = mapIngredientsFromAnalysis(result);
  const healthFlags = deriveHealthFlags(result, atAGlance);

  return {
    productName,
    brandName,
    parentCompany: undefined,
    productImageUrl: result.image_url,
    gutsyScore,
    healthGrade: gutsyScoreToHealthGrade(gutsyScore),
    gutReaction: result.analysis.summary || "This product has mixed effects on your overall health profile.",
    hasActiveRecall: false,
    atAGlance,
    ingredients,
    healthFlags,
    alternatives: savedAlternatives ? mapAlternativeProducts(savedAlternatives) : [],
  };
}
