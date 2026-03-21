/**
 * Open Food Facts API integration for fetching product images
 * API: https://world.openfoodfacts.org/
 */

export interface OpenFoodFactsProduct {
  product_name?: string;
  image_url?: string;
  image_front_url?: string;
  image_front_small_url?: string;
  image_small_url?: string;
  brands?: string;
  code?: string;
  nutriments?: {
    "energy-kcal_100g"?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
    fiber_100g?: number;
    sugars_100g?: number;
    sodium_100g?: number;
    [key: string]: number | undefined;
  };
  ingredients_text?: string;
  categories?: string;
  quantity?: string;
}

export interface OpenFoodFactsResponse {
  status: number;
  product?: OpenFoodFactsProduct;
  status_verbose?: string;
}

/**
 * Fetch product image from Open Food Facts by barcode
 */
export async function fetchProductImage(barcode: string): Promise<string | null> {
  try {
    const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return null;
    }
    
    const data = (await response.json()) as OpenFoodFactsResponse;
    
    if (data.status !== 1 || !data.product) {
      return null;
    }
    
    // Try different image fields in order of preference
    const imageUrl =
      data.product.image_front_url ||
      data.product.image_front_small_url ||
      data.product.image_url ||
      data.product.image_small_url ||
      null;
    
    return imageUrl;
  } catch (error) {
    console.error("Error fetching product image from Open Food Facts:", error);
    return null;
  }
}

/**
 * Fetch product data from Open Food Facts
 */
export async function fetchProductData(barcode: string): Promise<OpenFoodFactsProduct | null> {
  try {
    const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return null;
    }
    
    const data = (await response.json()) as OpenFoodFactsResponse;
    
    if (data.status !== 1 || !data.product) {
      return null;
    }
    
    return data.product;
  } catch (error) {
    console.error("Error fetching product data from Open Food Facts:", error);
    return null;
  }
}
