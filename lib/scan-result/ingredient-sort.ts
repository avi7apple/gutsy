import type { IngredientLevel, ProductIngredient } from "@/types/product-scan";

export type IngredientFilter = "all" | "high" | "warning" | "beneficial";

const LEVEL_ORDER: Record<IngredientLevel, number> = {
  hi: 0,
  med: 1,
  lo: 2,
  ben: 3,
  neutral: 4,
};

export function filterAndSortIngredients(
  items: ProductIngredient[],
  filter: IngredientFilter,
): ProductIngredient[] {
  let filtered = items;
  if (filter === "high") {
    filtered = items.filter((i) => i.level === "hi");
  } else if (filter === "warning") {
    filtered = items.filter((i) => i.level === "med" || i.level === "lo");
  } else if (filter === "beneficial") {
    filtered = items.filter((i) => i.level === "ben");
  }

  return [...filtered].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}
