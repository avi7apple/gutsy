import type { AlternativeProduct } from "@/lib/product-alternatives";
import type { ProductAlternative } from "@/types/product-scan";

export function mapAlternativeProducts(alts: AlternativeProduct[]): ProductAlternative[] {
  return alts.map((alt) => ({
    productName: alt.product.name,
    brandName: alt.product.brand || "Unknown",
    imageUrl: alt.product.imageUrl,
    gutsyScore: alt.scores.gut_score,
    reason: alt.whyBetter ?? "Higher Gutsy score in the same category",
    barcode: alt.product.barcode,
  }));
}
