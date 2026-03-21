import { computeScores } from "./lib/scoring-engine";

const tests = [
  {
    label: "Plain kefir 200ml",
    expected: "85-92",
    product: {
      name: "Lifeway Plain Kefir",
      brand: "Lifeway",
      barcode: "0001",
      categories: "dairy drinks, fermented milk",
      ingredients:
        "Pasteurized Cultured Lowfat Milk, Vitamin A Palmitate, Vitamin D3, Live Active Cultures: Lactobacillus Rhamnosus, Bifidobacterium Longum, Lactobacillus Acidophilus",
      nutrition: {
        calories: 40, protein_g: 3.3, carbs_g: 4.5, fat_g: 1.0,
        fiber_g: 0, sugar_g: 4.2, sodium_mg: 50, saturated_fat_g: 0.6,
      },
      source: "openfoodfacts" as const,
    },
  },
  {
    label: "Doritos 30g",
    expected: "28-38",
    product: {
      name: "Doritos Nacho Cheese",
      brand: "Frito-Lay",
      barcode: "0002",
      categories: "chips, snacks",
      ingredients:
        "Corn, Vegetable Oil, Maltodextrin, Salt, Cheddar Cheese, Whey, Monosodium Glutamate, Buttermilk, Romano Cheese, Whey Protein, Onion Powder, Corn Flour, Natural and Artificial Flavors, Dextrose, Tomato Powder, Lactose, Spices, Artificial Color (Yellow 6, Yellow 5, Red 40), Lactic Acid, Citric Acid, Sugar, Garlic Powder, Skim Milk",
      nutrition: {
        calories: 520, protein_g: 7, carbs_g: 61, fat_g: 28,
        fiber_g: 3, sugar_g: 3, sodium_mg: 1100, saturated_fat_g: 4,
      },
      source: "openfoodfacts" as const,
    },
  },
  {
    label: "Banana 1 medium",
    expected: "70-78",
    product: {
      name: "Banana",
      brand: "",
      barcode: "0003",
      categories: "fruits",
      ingredients: "",
      nutrition: {
        calories: 89, protein_g: 1.1, carbs_g: 23, fat_g: 0.3,
        fiber_g: 2.6, sugar_g: 12, sodium_mg: 1, saturated_fat_g: 0.1,
      },
      source: "usda" as const,
    },
  },
  {
    label: "Big Mac",
    expected: "15-25",
    product: {
      name: "McDonalds Big Mac",
      brand: "McDonalds",
      barcode: "0004",
      categories: "fast food, burgers",
      ingredients:
        "Beef Patty, Enriched Flour Bleached Wheat Flour, Water, High Fructose Corn Syrup, Soybean Oil, Partially Hydrogenated Soybean Oil, Salt, Calcium Sulfate, Sodium Stearoyl Lactylate, Artificial Color, Artificial Flavor, Sodium Benzoate, Modified Food Starch, Monosodium Glutamate, Caramel Color",
      nutrition: {
        calories: 257, protein_g: 13, carbs_g: 22, fat_g: 14,
        fiber_g: 1, sugar_g: 5, sodium_mg: 480, saturated_fat_g: 5.5,
      },
      source: "usda" as const,
    },
  },
  {
    label: "Kimchi 50g",
    expected: "84-90",
    product: {
      name: "Traditional Korean Kimchi",
      brand: "",
      barcode: "0005",
      categories: "fermented vegetables",
      ingredients:
        "Napa Cabbage, Korean Radish, Salt, Garlic, Ginger, Korean Red Pepper Flakes, Fish Sauce, Green Onion, Fermented with Live Cultures",
      nutrition: {
        calories: 15, protein_g: 1.1, carbs_g: 2.4, fat_g: 0.5,
        fiber_g: 1.6, sugar_g: 1.1, sodium_mg: 498, saturated_fat_g: 0.1,
      },
      source: "openfoodfacts" as const,
    },
  },
  {
    label: "Greek Yogurt 150g",
    expected: "83-90",
    product: {
      name: "Fage Total Greek Yogurt with Live Cultures",
      brand: "Fage",
      barcode: "0006",
      categories: "dairy, yogurt",
      ingredients:
        "Pasteurized Skimmed Milk, Cream, Live Active Yogurt Cultures L. Bulgaricus S. Thermophilus L. Acidophilus Bifidus L. Casei",
      nutrition: {
        calories: 97, protein_g: 9, carbs_g: 3.8, fat_g: 5,
        fiber_g: 0, sugar_g: 3.8, sodium_mg: 47, saturated_fat_g: 3.5,
      },
      source: "openfoodfacts" as const,
    },
  },
  {
    label: "Oats 80g",
    expected: "75-82",
    product: {
      name: "Quaker Old Fashioned Oats",
      brand: "Quaker",
      barcode: "0007",
      categories: "cereals, oats",
      ingredients: "100% Whole Grain Rolled Oats",
      nutrition: {
        calories: 379, protein_g: 13, carbs_g: 68, fat_g: 7,
        fiber_g: 10, sugar_g: 1, sodium_mg: 2, saturated_fat_g: 1.2,
      },
      source: "usda" as const,
    },
  },
];

let allPass = true;
for (const t of tests) {
  const scores = computeScores(t.product, null);
  const [lo, hi] = t.expected.split("-").map(Number);
  const pass = scores.gut_score >= lo && scores.gut_score <= hi;
  if (!pass) allPass = false;
  console.log(
    `${pass ? "PASS" : "FAIL"} | ${t.label.padEnd(25)} gut=${String(scores.gut_score).padStart(3)} (expected ${t.expected}) | bloat=${scores.bloat_score} dig=${scores.digestion_score} skin=${scores.skin_score} energy=${scores.energy_score} conf=${scores.confidence}`
  );
}
console.log(allPass ? "\nAll tests passed!" : "\nSome tests FAILED — tuning needed.");
