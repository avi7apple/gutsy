/**
 * Robust product alternatives system: category-locked discovery from OFF,
 * prioritizing higher gut scores within the same product category.
 * 
 * Key features:
 * - 50+ food categories with pattern matching
 * - Category-locked alternatives (cereal→cereals, chips→chips)
 * - Supports barcode and photo product scans
 * - Aggressive fallback searches to guarantee results
 */

import type { OnboardingProfile } from "@/lib/onboarding-storage";
import {
    lookupProduct,
    searchOFFByCategory,
    searchOFFByTerm,
    searchUsdaByQuery,
    type ProductInfo,
} from "@/lib/product-lookup";
import { computeScores, type ComputedScores } from "@/lib/scoring-engine";
import type { ScanResult } from "@/types/scan";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const MIN_CANDIDATES_BEFORE_FALLBACK = 10;
const PRIMARY_PAGE_SIZE = 24;
const SECONDARY_PAGE_SIZE = 24;
const IMAGE_RECOVERY_TIMEOUT_MS = 3_000;
const IMAGE_RECOVERY_SEARCH_PAGE_SIZE = 8;
const OFF_IMAGE_LOOKUP_TIMEOUT_MS = 5_000;
const ALTERNATIVE_IMAGE_RECOVERY_BUDGET_MS = 1_200;

const ALT_DEBUG = process.env.NODE_ENV !== "production";

function altDiag(event: string, payload?: Record<string, unknown>): void {
  if (!ALT_DEBUG) return;
  console.log("[alternatives]", event, payload ?? "");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

async function fetchOffImageByBarcode(barcode: string): Promise<string | undefined> {
  const digits = String(barcode || "").replace(/\D/g, "");
  if (digits.length < 8) return undefined;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OFF_IMAGE_LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${digits}.json`,
      {
        headers: {
          "User-Agent": "Gutsy/1.0 (https://github.com/gutsy-app)",
          Accept: "application/json",
        },
        signal: controller.signal,
      },
    );
    if (!res.ok) {
      altDiag("OFF image lookup failed", { barcode: digits, status: res.status });
      return undefined;
    }
    const json = (await res.json().catch(() => null)) as
      | { product?: Record<string, unknown> }
      | null;
    const p = json?.product;
    if (!p) {
      altDiag("OFF image lookup no product", { barcode: digits });
      return undefined;
    }
    const imageUrl = (
      (typeof p.image_front_small_url === "string" && p.image_front_small_url) ||
      (typeof p.image_front_url === "string" && p.image_front_url) ||
      (typeof p.image_front_thumb_url === "string" && p.image_front_thumb_url) ||
      (typeof p.image_url === "string" && p.image_url) ||
      undefined
    );
    if (imageUrl) {
      altDiag("OFF image recovered", { barcode: digits, imageUrl: imageUrl.substring(0, 50) });
    } else {
      altDiag("OFF image lookup no image field", { barcode: digits });
    }
    return imageUrl;
  } catch (e) {
    altDiag("OFF image lookup error", { 
      barcode: digits, 
      error: e instanceof Error ? e.message : String(e) 
    });
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

async function recoverImageUrlForProduct(
  product: ProductInfo,
  excludeBarcode?: string,
): Promise<string | undefined> {
  if (product.imageUrl) return product.imageUrl;

  const barcodeDigits = String(product.barcode || "").replace(/\D/g, "");
  if (barcodeDigits.length >= 8) {
    const offDirectImage = await fetchOffImageByBarcode(barcodeDigits);
    if (offDirectImage) return offDirectImage;

    const lookedUp = await withTimeout(
      lookupProduct(barcodeDigits).catch(() => null),
      IMAGE_RECOVERY_TIMEOUT_MS,
      null,
    );
    if (lookedUp?.imageUrl) return lookedUp.imageUrl;
  }

  const query = [product.name, product.brand].filter(Boolean).join(" ").trim();
  if (!query) return undefined;

  const hits = await withTimeout(
    searchOFFByTerm(query, IMAGE_RECOVERY_SEARCH_PAGE_SIZE, excludeBarcode).catch(() => []),
    IMAGE_RECOVERY_TIMEOUT_MS,
    [] as ProductInfo[],
  );
  if (!Array.isArray(hits) || hits.length === 0) return undefined;

  const sourceTokens = toTokens(product.name);
  const sourceBrandTokens = toTokens(product.brand ?? "");
  const bestHit = hits
    .filter((h) => !!h.imageUrl)
    .sort((a, b) => {
      const aName = tokenJaccard(sourceTokens, toTokens(a.name));
      const bName = tokenJaccard(sourceTokens, toTokens(b.name));
      const aBrand = tokenJaccard(sourceBrandTokens, toTokens(a.brand ?? ""));
      const bBrand = tokenJaccard(sourceBrandTokens, toTokens(b.brand ?? ""));
      return bName + bBrand * 0.25 - (aName + aBrand * 0.25);
    })[0];

  return bestHit?.imageUrl;
}

// ---------------------------------------------------------------------------
// Food Categories Database (50+ categories)
// ---------------------------------------------------------------------------
interface FoodCategory {
  patterns: RegExp[];
  // High-specificity patterns (brand names, unambiguous product identifiers)
  // — matching any of these locks the category with very high confidence.
  brandPatterns?: RegExp[];
  // Patterns that DISQUALIFY this category when matched in the scanned product
  // name. Used to disambiguate overlapping categories (e.g., "peanut butter
  // cup" → chocolate, not peanutButter).
  disqualifyPatterns?: RegExp[];
  // Relative priority when multiple categories match with equal pattern count.
  // Higher wins. Default 0. Use for resolving inherent overlaps.
  priority?: number;
  searchTerms: string[];
  fallbackTerms: string[];
  offCategoryTags: string[]; // For OFF category API
}

const FOOD_CATEGORIES: Record<string, FoodCategory> = {
  // === CEREALS & BREAKFAST ===
  cereals: {
    patterns: [/\bcereal/i, /\bgranola/i, /\bmuesli/i, /\bcorn\s*flakes/i, /\bcheerios/i, /\bfrosted\s*flakes/i, /\bfruit\s*loops/i, /\bspecial\s*k/i, /\bchex/i, /\blife\s*cereal/i, /\bkix/i, /\bhoney\s*bunches/i, /\braisin\s*bran/i, /\brice\s*krispies/i, /\bcocoa\s*puffs/i, /\blucky\s*charms/i, /\bcinnamon\s*toast/i, /\bfroot\s*loops/i],
    searchTerms: ["breakfast cereals", "cereals", "whole grain cereals"],
    fallbackTerms: ["breakfast", "oats", "granola"],
    offCategoryTags: ["breakfast-cereals", "cereals", "whole-grain-cereals"],
  },
  oatmeal: {
    patterns: [/\boatmeal/i, /\boats/i, /\bporridge/i, /\bquaker/i, /\binstant\s*oats/i, /\bsteel\s*cut/i, /\brolled\s*oats/i],
    searchTerms: ["oatmeal", "instant oats", "porridge"],
    fallbackTerms: ["breakfast cereals", "oats"],
    offCategoryTags: ["oatmeals", "porridges"],
  },
  pancakeMix: {
    patterns: [/\bpancake/i, /\bwaffle/i, /\bflapjack/i, /\bbisquick/i],
    searchTerms: ["pancake mix", "waffle mix", "pancakes"],
    fallbackTerms: ["breakfast", "baking mixes"],
    offCategoryTags: ["pancakes", "waffles"],
  },

  // === SNACKS - CHIPS & CRISPS ===
  chips: {
    patterns: [/\bchips?\b/i, /\bcrisps?\b/i, /\bpringles/i, /\bdoritos/i, /\blays/i, /\bruffles/i, /\btostitos/i, /\bfritos/i, /\bcheetos/i, /\bkettle/i, /\bpotato\s*chips/i, /\btortilla\s*chips/i, /\bcorn\s*chips/i, /\bsun\s*chips/i],
    searchTerms: ["potato chips", "chips", "crisps", "tortilla chips"],
    fallbackTerms: ["snacks", "savory snacks"],
    offCategoryTags: ["chips", "crisps", "potato-chips", "tortilla-chips"],
  },
  popcorn: {
    patterns: [/\bpopcorn/i, /\bpop\s*corn/i, /\bskinny\s*pop/i, /\bsmartfood/i, /\borville/i],
    searchTerms: ["popcorn", "microwave popcorn", "kettle corn"],
    fallbackTerms: ["snacks", "corn snacks"],
    offCategoryTags: ["popcorn", "popcorns"],
  },
  pretzels: {
    patterns: [/\bpretzel/i, /\bsnyder/i, /\brold\s*gold/i],
    searchTerms: ["pretzels", "pretzel snacks"],
    fallbackTerms: ["snacks", "savory snacks"],
    offCategoryTags: ["pretzels"],
  },
  nuts: {
    patterns: [/\bnuts?\b/i, /\balmonds?\b/i, /\bcashews?\b/i, /\bpeanuts?\b/i, /\bpistachios?\b/i, /\bwalnuts?\b/i, /\bmacadamia/i, /\btrail\s*mix/i, /\bmixed\s*nuts/i, /\bplanters/i, /\bblue\s*diamond/i],
    searchTerms: ["nuts", "mixed nuts", "roasted nuts", "almonds"],
    fallbackTerms: ["snacks", "healthy snacks"],
    offCategoryTags: ["nuts", "almonds", "cashews", "peanuts"],
  },
  crackers: {
    patterns: [/\bcrackers?\b/i, /\britz/i, /\btriscuit/i, /\bwheat\s*thins/i, /\bcheez-?it/i, /\bgoldfish/i, /\bgraham/i, /\bsaltine/i, /\bclub\s*crackers/i],
    searchTerms: ["crackers", "wheat crackers", "cheese crackers"],
    fallbackTerms: ["snacks", "savory snacks"],
    offCategoryTags: ["crackers", "biscuits"],
  },

  // === SNACKS - SWEET ===
  cookies: {
    patterns: [/\bcookies?\b/i, /\boreo/i, /\bchips\s*ahoy/i, /\bnutter\s*butter/i, /\bnewtons/i, /\bshortbread/i, /\bbiscotti/i, /\bmacarons?/i, /\bgirl\s*scout/i],
    searchTerms: ["cookies", "chocolate cookies", "sandwich cookies"],
    fallbackTerms: ["sweet snacks", "biscuits"],
    offCategoryTags: ["cookies", "biscuits", "chocolate-cookies"],
  },
  candy: {
    patterns: [/\bcandy/i, /\bcandies/i, /\bgummy/i, /\bgummies/i, /\bharibo/i, /\bskittles/i, /\bstarburst/i, /\bjolly\s*rancher/i, /\bsour\s*patch/i, /\btwizzlers/i, /\blicorice/i, /\bjelly\s*beans/i, /\blollipop/i],
    searchTerms: ["candy", "gummy candy", "fruit candy"],
    fallbackTerms: ["sweets", "confectionery"],
    offCategoryTags: ["candies", "gummy-candies", "confectioneries"],
  },
  chocolate: {
    patterns: [/\bchocolate/i, /\bcocoa\b/i, /\bcacao\b/i, /\bchoc\s*chip/i, /\bpraline/i, /\btruffle/i, /\bbrownie/i],
    // Brand matches immediately lock to chocolate — these are iconic chocolate
    // products regardless of whether their name contains "peanut butter",
    // "caramel", etc.
    brandPatterns: [
      /\bhershey/i, /\bsnickers/i, /\bmilky\s*way/i, /\btwix/i, /\bkit\s*kat/i,
      /\breese/i, /\bm\s*&\s*m/i, /\blindt/i, /\bgodiva/i, /\bghirardelli/i,
      /\bdove\s*(chocolate|bar|promises)/i, /\bferrero/i, /\bnutella/i,
      /\bcadbury/i, /\btoblerone/i, /\bmars\s*bar/i, /\bbounty\s*bar/i,
      /\bmilka\b/i, /\bkinder\b/i, /\brolo\b/i, /\baero\s*bar/i,
      /\bcrunch\s*bar/i, /\b100\s*grand/i, /\bbutterfinger/i, /\bheath\s*bar/i,
      /\bbaby\s*ruth/i, /\bwhatchamacallit/i, /\bskor\b/i, /\btakeout\b/i,
      /\btwin\s*bing/i, /\bnestle\s*crunch/i, /\bmr\.\s*goodbar/i,
      /\balmond\s*joy/i, /\bmounds\s*bar/i, /\bpayday\s*bar/i,
    ],
    priority: 10, // Chocolate wins over peanutButter/candy/cookies on ties.
    searchTerms: ["chocolate", "chocolate bars", "dark chocolate", "milk chocolate", "chocolate candy"],
    fallbackTerms: ["sweets", "confectionery"],
    offCategoryTags: ["chocolates", "chocolate-bars", "dark-chocolates", "milk-chocolates", "chocolate-candies"],
  },
  iceCream: {
    patterns: [/\bice\s*cream/i, /\bgelato/i, /\bsorbet/i, /\bfrozen\s*yogurt/i, /\bfroyo/i, /\bben\s*&?\s*jerry/i, /\bhaagen/i, /\bbreyers/i, /\btalenti/i, /\bmagnum/i, /\bpopsicle/i, /\bfudgsicle/i],
    searchTerms: ["ice cream", "frozen desserts", "gelato"],
    fallbackTerms: ["desserts", "frozen treats"],
    offCategoryTags: ["ice-creams", "frozen-desserts", "gelatos"],
  },

  // === BEVERAGES - SOFT DRINKS ===
  soda: {
    patterns: [/\bsoda/i, /\bcola/i, /\bcoke/i, /\bpepsi/i, /\bsprite/i, /\bfanta/i, /\b7\s*up/i, /\bmountain\s*dew/i, /\bdr\.?\s*pepper/i, /\broot\s*beer/i, /\bginger\s*ale/i, /\bschweppes/i, /\bsierra\s*mist/i, /\bsunkist/i, /\bcrush/i, /\bjarritos/i],
    searchTerms: ["soft drinks", "soda", "cola", "carbonated drinks"],
    fallbackTerms: ["beverages", "drinks"],
    offCategoryTags: ["soft-drinks", "sodas", "carbonated-drinks"],
  },
  energyDrinks: {
    patterns: [/\benergy\s*drink/i, /\bred\s*bull/i, /\bmonster/i, /\brockstar/i, /\bbang/i, /\bcelsius/i, /\b5\s*hour/i, /\bprime/i, /\bgfuel/i, /\bzipfizz/i, /\bxs\s*energy/i],
    searchTerms: ["energy drinks", "energy beverages"],
    fallbackTerms: ["beverages", "caffeinated drinks"],
    offCategoryTags: ["energy-drinks"],
  },
  sportsDrinks: {
    patterns: [/\bsports?\s*drink/i, /\bgatorade/i, /\bpowerade/i, /\bbodyarmor/i, /\belectrolyte/i, /\bpropel/i, /\bvitamin\s*water/i],
    searchTerms: ["sports drinks", "electrolyte drinks", "isotonic drinks"],
    fallbackTerms: ["beverages", "fitness drinks"],
    offCategoryTags: ["sports-drinks", "isotonic-drinks"],
  },
  juice: {
    patterns: [/\bjuice/i, /\btropicana/i, /\bminute\s*maid/i, /\bsimply\s*orange/i, /\bocean\s*spray/i, /\bwelch/i, /\bv8/i, /\bnaked\s*juice/i, /\bodwalla/i, /\bsuja/i, /\bpressed/i],
    searchTerms: ["fruit juice", "orange juice", "apple juice", "juice"],
    fallbackTerms: ["beverages", "fruit drinks"],
    offCategoryTags: ["fruit-juices", "juices", "orange-juices"],
  },
  tea: {
    patterns: [/\btea\b/i, /\biced\s*tea/i, /\bgreen\s*tea/i, /\bblack\s*tea/i, /\bherbal\s*tea/i, /\blipton/i, /\barizona/i, /\bsnapple/i, /\bhonest\s*tea/i, /\bpure\s*leaf/i, /\bbrisk/i, /\btwinings/i, /\bcelestial/i, /\btazo/i, /\byogi\s*tea/i],
    searchTerms: ["tea", "iced tea", "green tea", "herbal tea"],
    fallbackTerms: ["beverages", "hot drinks"],
    offCategoryTags: ["teas", "iced-teas", "green-teas"],
  },
  coffee: {
    patterns: [/\bcoffee/i, /\bespresso/i, /\blatte/i, /\bcappuccino/i, /\bcold\s*brew/i, /\bstarbucks/i, /\bdunkin/i, /\bnescafe/i, /\bfolgers/i, /\bmaxwell/i, /\bkeurig/i, /\bk-?cup/i],
    searchTerms: ["coffee", "iced coffee", "cold brew coffee"],
    fallbackTerms: ["beverages", "caffeinated drinks"],
    offCategoryTags: ["coffees", "iced-coffees", "cold-brew"],
  },
  water: {
    patterns: [/\bwater\b/i, /\bsparkling\s*water/i, /\bmineral\s*water/i, /\bseltzer/i, /\bla\s*croix/i, /\bperrier/i, /\bsan\s*pellegrino/i, /\bdasani/i, /\baquafina/i, /\bevian/i, /\bfiji/i, /\bsmartwater/i, /\bvoss/i, /\btopo\s*chico/i, /\bbubly/i, /\baha\s*water/i],
    searchTerms: ["sparkling water", "mineral water", "flavored water"],
    fallbackTerms: ["beverages", "water"],
    offCategoryTags: ["waters", "sparkling-waters", "mineral-waters"],
  },

  // === DAIRY ===
  milk: {
    patterns: [/\bmilk\b/i, /\bwhole\s*milk/i, /\bskim\s*milk/i, /\b2%\s*milk/i, /\blactose/i, /\bfairlife/i, /\bhorizon/i, /\borganic\s*valley/i],
    searchTerms: ["milk", "whole milk", "low fat milk"],
    fallbackTerms: ["dairy", "dairy drinks"],
    offCategoryTags: ["milks", "whole-milks", "semi-skimmed-milks"],
  },
  plantMilk: {
    patterns: [/\balmond\s*milk/i, /\boat\s*milk/i, /\bsoy\s*milk/i, /\bcoconut\s*milk/i, /\bcashew\s*milk/i, /\brice\s*milk/i, /\bsilk\b/i, /\boatly/i, /\bcalifia/i, /\bripple/i, /\bplanet\s*oat/i, /\bchobani\s*oat/i],
    searchTerms: ["plant milk", "almond milk", "oat milk", "soy milk"],
    fallbackTerms: ["dairy alternatives", "non-dairy milk"],
    offCategoryTags: ["plant-milks", "almond-milks", "oat-milks", "soy-milks"],
  },
  yogurt: {
    patterns: [/\byogurt/i, /\byoghurt/i, /\bgreek\s*yogurt/i, /\bchobani/i, /\bfage/i, /\bdannon/i, /\byoplait/i, /\bsiggi/i, /\boikos/i, /\bactivia/i, /\bskyr/i, /\bnoosa/i],
    searchTerms: ["yogurt", "greek yogurt", "low fat yogurt"],
    fallbackTerms: ["dairy", "fermented dairy"],
    offCategoryTags: ["yogurts", "greek-yogurts"],
  },
  cheese: {
    patterns: [/\bcheese/i, /\bcheddar/i, /\bmozzarella/i, /\bparmesan/i, /\bswiss/i, /\bgouda/i, /\bbrie/i, /\bfeta/i, /\bcream\s*cheese/i, /\bcottage\s*cheese/i, /\bstring\s*cheese/i, /\bkraft/i, /\bsargento/i, /\bbabybel/i, /\blaughing\s*cow/i],
    searchTerms: ["cheese", "cheddar cheese", "mozzarella"],
    fallbackTerms: ["dairy", "cheese products"],
    offCategoryTags: ["cheeses", "cheddar", "mozzarella"],
  },
  butter: {
    patterns: [/\bbutter\b/i, /\bmargarine/i, /\bspread\b/i, /\bkerrygold/i, /\bland\s*o\s*lakes/i, /\bi\s*can't\s*believe/i, /\bcountry\s*crock/i],
    searchTerms: ["butter", "margarine", "butter spread"],
    fallbackTerms: ["dairy", "spreads"],
    offCategoryTags: ["butters", "margarines"],
  },

  // === NOODLES & PASTA ===
  instantNoodles: {
    patterns: [/\bramen/i, /\binstant\s*noodle/i, /\bcup\s*noodle/i, /\bmaruchan/i, /\bnissin/i, /\btop\s*ramen/i, /\bshin\s*ramyun/i, /\bshin\b/i, /\bbuldak/i, /\bsamyang/i, /\bindomie/i, /\bmama\s*noodle/i, /\bnongshim/i, /\bpho\s*noodle/i],
    searchTerms: ["instant noodles", "ramen", "cup noodles"],
    fallbackTerms: ["noodles", "asian noodles"],
    offCategoryTags: ["instant-noodles", "ramen", "cup-noodles"],
  },
  pasta: {
    patterns: [/\bpasta\b/i, /\bspaghetti/i, /\bpenne/i, /\bfettuccine/i, /\blinguine/i, /\bmacaroni/i, /\blasagna/i, /\bravioli/i, /\btortellini/i, /\bbarilla/i, /\bde\s*cecco/i, /\bronzoni/i, /\bmueller/i],
    searchTerms: ["pasta", "spaghetti", "penne pasta"],
    fallbackTerms: ["grains", "italian food"],
    offCategoryTags: ["pastas", "spaghetti", "penne"],
  },
  macAndCheese: {
    patterns: [/\bmac\s*(and|&|n)?\s*cheese/i, /\bkraft\s*dinner/i, /\bvelveeta/i, /\banni/i, /\bmacaroni\s*and\s*cheese/i],
    searchTerms: ["mac and cheese", "macaroni and cheese"],
    fallbackTerms: ["pasta", "cheese dishes"],
    offCategoryTags: ["macaroni-and-cheese"],
  },

  // === BREAD & BAKERY ===
  bread: {
    patterns: [/\bbread\b/i, /\bwhite\s*bread/i, /\bwheat\s*bread/i, /\bwhole\s*grain/i, /\bsourdough/i, /\brye\s*bread/i, /\bbaguette/i, /\bciabatta/i, /\bfocaccia/i, /\bwonder\s*bread/i, /\bsara\s*lee/i, /\bdave's\s*killer/i, /\bnature's\s*own/i, /\bpepperidge/i],
    searchTerms: ["bread", "whole wheat bread", "white bread"],
    fallbackTerms: ["bakery", "baked goods"],
    offCategoryTags: ["breads", "white-breads", "whole-wheat-breads"],
  },
  bagels: {
    patterns: [/\bbagel/i, /\bthomas/i, /\blender's/i],
    searchTerms: ["bagels", "plain bagels", "whole wheat bagels"],
    fallbackTerms: ["bread", "bakery"],
    offCategoryTags: ["bagels"],
  },
  tortillas: {
    patterns: [/\btortilla/i, /\bwrap/i, /\bflatbread/i, /\bpita/i, /\bnaan/i, /\bmission\s*tortilla/i, /\bla\s*banderita/i],
    searchTerms: ["tortillas", "flour tortillas", "wraps"],
    fallbackTerms: ["bread", "flatbreads"],
    offCategoryTags: ["tortillas", "wraps", "flatbreads"],
  },
  muffins: {
    patterns: [/\bmuffin/i, /\bcupcake/i, /\benglish\s*muffin/i, /\bthomas\s*muffin/i],
    searchTerms: ["muffins", "english muffins", "blueberry muffins"],
    fallbackTerms: ["bakery", "baked goods"],
    offCategoryTags: ["muffins", "english-muffins"],
  },
  pastries: {
    patterns: [/\bpastry/i, /\bcroissant/i, /\bdanish/i, /\bdonut/i, /\bdoughnut/i, /\bpop\s*tart/i, /\btoaster\s*strudel/i, /\bcinnamon\s*roll/i, /\bsweet\s*roll/i],
    searchTerms: ["pastries", "croissants", "donuts"],
    fallbackTerms: ["bakery", "sweet baked goods"],
    offCategoryTags: ["pastries", "croissants", "donuts"],
  },

  // === CONDIMENTS & SAUCES ===
  ketchup: {
    patterns: [/\bketchup/i, /\bcatsup/i, /\bheinz/i, /\bhunt's/i],
    searchTerms: ["ketchup", "tomato ketchup"],
    fallbackTerms: ["condiments", "sauces"],
    offCategoryTags: ["ketchups"],
  },
  mustard: {
    patterns: [/\bmustard/i, /\bfrench's/i, /\bgulden/i, /\bdijon/i],
    searchTerms: ["mustard", "yellow mustard", "dijon mustard"],
    fallbackTerms: ["condiments", "sauces"],
    offCategoryTags: ["mustards"],
  },
  mayonnaise: {
    patterns: [/\bmayo/i, /\bmayonnaise/i, /\bhellmann/i, /\bbest\s*foods/i, /\bduke/i, /\bmiracle\s*whip/i],
    searchTerms: ["mayonnaise", "mayo", "light mayonnaise"],
    fallbackTerms: ["condiments", "spreads"],
    offCategoryTags: ["mayonnaises"],
  },
  salsa: {
    patterns: [/\bsalsa/i, /\bpico/i, /\btostitos\s*salsa/i, /\bpace/i, /\bchi-chi/i],
    searchTerms: ["salsa", "tomato salsa", "mild salsa"],
    fallbackTerms: ["condiments", "dips"],
    offCategoryTags: ["salsas"],
  },
  hotSauce: {
    patterns: [/\bhot\s*sauce/i, /\btabasco/i, /\bsriracha/i, /\bfrank's/i, /\bcholula/i, /\btapatio/i, /\bvalentina/i, /\blouisiana/i],
    searchTerms: ["hot sauce", "chili sauce", "sriracha"],
    fallbackTerms: ["condiments", "sauces"],
    offCategoryTags: ["hot-sauces", "chili-sauces"],
  },
  bbqSauce: {
    patterns: [/\bbbq/i, /\bbarbecue/i, /\bsweet\s*baby\s*ray/i, /\bkc\s*masterpiece/i, /\bstubb/i],
    searchTerms: ["bbq sauce", "barbecue sauce"],
    fallbackTerms: ["condiments", "sauces"],
    offCategoryTags: ["barbecue-sauces"],
  },
  soySauce: {
    patterns: [/\bsoy\s*sauce/i, /\bteriyaki/i, /\bkikkoman/i, /\bla\s*choy/i, /\btamari/i, /\bcoconut\s*aminos/i],
    searchTerms: ["soy sauce", "teriyaki sauce"],
    fallbackTerms: ["asian sauces", "condiments"],
    offCategoryTags: ["soy-sauces", "teriyaki-sauces"],
  },
  pastaSauce: {
    patterns: [/\bpasta\s*sauce/i, /\bmarinara/i, /\balfredo/i, /\bprego/i, /\bragu/i, /\bbertolli/i, /\brao/i, /\bnewman/i, /\bclassico/i],
    searchTerms: ["pasta sauce", "marinara sauce", "tomato sauce"],
    fallbackTerms: ["sauces", "italian sauces"],
    offCategoryTags: ["pasta-sauces", "tomato-sauces"],
  },
  saladDressing: {
    patterns: [/\bdressing/i, /\branch/i, /\bcaesar/i, /\bvinaigrette/i, /\bitalian\s*dressing/i, /\bhidden\s*valley/i, /\bken's/i, /\bwishbone/i, /\bnewman's\s*own/i, /\bkraft\s*dressing/i],
    searchTerms: ["salad dressing", "ranch dressing", "vinaigrette"],
    fallbackTerms: ["condiments", "dressings"],
    offCategoryTags: ["salad-dressings", "dressings"],
  },

  // === SPREADS ===
  peanutButter: {
    patterns: [/\bpeanut\s*butter/i, /\balmond\s*butter/i, /\bcashew\s*butter/i, /\bnut\s*butter/i, /\bjif\b/i, /\bskippy\b/i, /\bpeter\s*pan\b/i, /\bjustin's/i, /\bsmucker's\s*natural/i, /\bmaranatha/i],
    // If the product is clearly a peanut butter CUP (candy) or chocolate
    // treat, it is NOT in the peanut butter spread category. This prevents
    // Reese's Peanut Butter Cups from being classified here.
    disqualifyPatterns: [/\bcup\b/i, /\bcandy\b/i, /\bchocolate\b/i, /\breese/i, /\bminiatures?\b/i, /\bbites?\b/i, /\btreats?\b/i],
    priority: 1,
    searchTerms: ["peanut butter", "nut butter", "almond butter"],
    fallbackTerms: ["spreads", "nut spreads"],
    offCategoryTags: ["peanut-butters", "nut-butters"],
  },
  jam: {
    patterns: [/\bjam\b/i, /\bjelly\b/i, /\bpreserves/i, /\bmarmalade/i, /\bsmucker/i, /\bwelch's\s*jelly/i, /\bbonne\s*maman/i],
    searchTerms: ["jam", "jelly", "fruit preserves"],
    fallbackTerms: ["spreads", "fruit spreads"],
    offCategoryTags: ["jams", "jellies", "fruit-preserves"],
  },
  hummus: {
    patterns: [/\bhummus/i, /\bsabra/i, /\bcedars/i, /\btribe/i],
    searchTerms: ["hummus", "chickpea hummus"],
    fallbackTerms: ["dips", "spreads"],
    offCategoryTags: ["hummus"],
  },

  // === FROZEN FOODS ===
  frozenPizza: {
    patterns: [/\bfrozen\s*pizza/i, /\bdigiorno/i, /\btotino/i, /\bred\s*baron/i, /\bfreschetta/i, /\bjack's\s*pizza/i, /\btombstone/i, /\bcalifornia\s*pizza/i, /\bamy's\s*pizza/i],
    searchTerms: ["frozen pizza", "pizza"],
    fallbackTerms: ["frozen meals", "pizza"],
    offCategoryTags: ["frozen-pizzas", "pizzas"],
  },
  frozenMeals: {
    patterns: [/\bfrozen\s*meal/i, /\bfrozen\s*dinner/i, /\btv\s*dinner/i, /\blean\s*cuisine/i, /\bhealthy\s*choice/i, /\bstouffer/i, /\bmarie\s*callender/i, /\bbanquet/i, /\bhungry\s*man/i, /\bamy's/i, /\bevol/i],
    searchTerms: ["frozen meals", "frozen dinners", "microwave meals"],
    fallbackTerms: ["frozen foods", "ready meals"],
    offCategoryTags: ["frozen-meals", "ready-meals"],
  },
  frozenVegetables: {
    patterns: [/\bfrozen\s*vegetable/i, /\bfrozen\s*veggie/i, /\bfrozen\s*peas/i, /\bfrozen\s*corn/i, /\bfrozen\s*broccoli/i, /\bbirds\s*eye/i, /\bgreen\s*giant/i],
    searchTerms: ["frozen vegetables", "frozen veggies"],
    fallbackTerms: ["frozen foods", "vegetables"],
    offCategoryTags: ["frozen-vegetables"],
  },
  frozenFries: {
    patterns: [/\bfrozen\s*fries/i, /\bfrench\s*fries/i, /\btater\s*tots/i, /\bhash\s*browns/i, /\bore-?ida/i, /\bmccain/i],
    searchTerms: ["frozen fries", "french fries", "tater tots"],
    fallbackTerms: ["frozen foods", "potato products"],
    offCategoryTags: ["frozen-fries", "french-fries"],
  },

  // === CANNED FOODS ===
  cannedSoup: {
    patterns: [/\bcanned\s*soup/i, /\bsoup\b/i, /\bcampbell/i, /\bprogresso/i, /\bchunky\s*soup/i, /\bamy's\s*soup/i, /\bpacific\s*foods/i],
    searchTerms: ["canned soup", "soup", "chicken soup"],
    fallbackTerms: ["canned foods", "soups"],
    offCategoryTags: ["soups", "canned-soups"],
  },
  cannedBeans: {
    patterns: [/\bcanned\s*beans/i, /\bblack\s*beans/i, /\bkidney\s*beans/i, /\bpinto\s*beans/i, /\bchickpeas/i, /\bgarbanzos/i, /\bbush's/i, /\bgoya/i],
    searchTerms: ["canned beans", "black beans", "kidney beans"],
    fallbackTerms: ["canned foods", "legumes"],
    offCategoryTags: ["canned-beans", "beans"],
  },
  cannedTuna: {
    patterns: [/\btuna/i, /\bcanned\s*fish/i, /\bsardines/i, /\bsalmon/i, /\bstarkist/i, /\bbumble\s*bee/i, /\bchicken\s*of\s*the\s*sea/i],
    searchTerms: ["canned tuna", "tuna", "canned fish"],
    fallbackTerms: ["canned foods", "seafood"],
    offCategoryTags: ["canned-tuna", "canned-fish"],
  },
  cannedVegetables: {
    patterns: [/\bcanned\s*vegetable/i, /\bcanned\s*corn/i, /\bcanned\s*peas/i, /\bcanned\s*tomato/i, /\bdel\s*monte/i, /\blibby/i, /\bgreen\s*giant\s*canned/i],
    searchTerms: ["canned vegetables", "canned corn", "canned tomatoes"],
    fallbackTerms: ["canned foods", "vegetables"],
    offCategoryTags: ["canned-vegetables"],
  },

  // === MEAT & PROTEIN ===
  bacon: {
    patterns: [/\bbacon/i, /\bturkey\s*bacon/i, /\boscar\s*mayer/i, /\bhormel/i, /\bwright/i],
    searchTerms: ["bacon", "turkey bacon"],
    fallbackTerms: ["meat", "breakfast meat"],
    offCategoryTags: ["bacons"],
  },
  sausage: {
    patterns: [/\bsausage/i, /\bbratwurst/i, /\bkielbasa/i, /\bitalian\s*sausage/i, /\bjohnsonville/i, /\bhillshire/i, /\beckrich/i],
    searchTerms: ["sausage", "breakfast sausage"],
    fallbackTerms: ["meat", "processed meat"],
    offCategoryTags: ["sausages"],
  },
  hotDogs: {
    patterns: [/\bhot\s*dog/i, /\bfrankfurter/i, /\bwiener/i, /\bhebrew\s*national/i, /\bball\s*park/i, /\bnathaniel/i, /\bapplegate/i],
    searchTerms: ["hot dogs", "frankfurters"],
    fallbackTerms: ["meat", "processed meat"],
    offCategoryTags: ["hot-dogs", "frankfurters"],
  },
  deli: {
    patterns: [/\bdeli\s*meat/i, /\blunch\s*meat/i, /\bham\b/i, /\bturkey\s*breast/i, /\broast\s*beef/i, /\bsalami/i, /\bpepperoni/i, /\bprosciutto/i, /\bbologna/i, /\bboar's\s*head/i, /\bhillshire\s*farm/i],
    searchTerms: ["deli meat", "lunch meat", "sliced turkey"],
    fallbackTerms: ["meat", "cold cuts"],
    offCategoryTags: ["deli-meats", "cold-cuts"],
  },

  // === PROTEIN BARS & SUPPLEMENTS ===
  proteinBars: {
    patterns: [/\bprotein\s*bar/i, /\benergy\s*bar/i, /\bnutrition\s*bar/i, /\bclif\s*bar/i, /\bkind\s*bar/i, /\brxbar/i, /\bquest\s*bar/i, /\blarabar/i, /\bbuilder/i, /\bpowerbar/i, /\bthink\s*thin/i, /\bone\s*bar/i, /\bperfect\s*bar/i],
    searchTerms: ["protein bars", "energy bars", "nutrition bars"],
    fallbackTerms: ["snack bars", "health bars"],
    offCategoryTags: ["protein-bars", "energy-bars", "cereal-bars"],
  },
  proteinPowder: {
    patterns: [/\bprotein\s*powder/i, /\bwhey/i, /\bcasein/i, /\bplant\s*protein/i, /\boptimum\s*nutrition/i, /\bmuscle\s*milk/i, /\borgain/i, /\bvega/i, /\bgarden\s*of\s*life/i],
    searchTerms: ["protein powder", "whey protein"],
    fallbackTerms: ["supplements", "protein"],
    offCategoryTags: ["protein-powders", "whey-proteins"],
  },

  // === BABY FOOD ===
  babyFood: {
    patterns: [/\bbaby\s*food/i, /\bgerber/i, /\bbeech-?nut/i, /\bearth's\s*best/i, /\bplum\s*organics/i, /\bhappy\s*baby/i],
    searchTerms: ["baby food", "infant food"],
    fallbackTerms: ["baby products", "pureed food"],
    offCategoryTags: ["baby-foods"],
  },

  // === PET FOOD (for completeness) ===
  petFood: {
    patterns: [/\bdog\s*food/i, /\bcat\s*food/i, /\bpet\s*food/i, /\bpurina/i, /\biams/i, /\bpedigree/i, /\bblue\s*buffalo/i, /\bfancy\s*feast/i, /\bfriskies/i],
    searchTerms: ["pet food", "dog food", "cat food"],
    fallbackTerms: ["pet products"],
    offCategoryTags: ["pet-foods", "dog-foods", "cat-foods"],
  },

  // === MISC ===
  pickles: {
    patterns: [/\bpickle/i, /\brelish/i, /\bvlasic/i, /\bclaussen/i, /\bmt\.\s*olive/i],
    searchTerms: ["pickles", "dill pickles"],
    fallbackTerms: ["condiments", "preserved vegetables"],
    offCategoryTags: ["pickles"],
  },
  olives: {
    patterns: [/\bolive/i, /\bkalamata/i, /\bblack\s*olives/i, /\bgreen\s*olives/i, /\blindsay/i],
    searchTerms: ["olives", "black olives", "green olives"],
    fallbackTerms: ["preserved vegetables", "mediterranean"],
    offCategoryTags: ["olives"],
  },
  rice: {
    patterns: [/\brice\b/i, /\bwhite\s*rice/i, /\bbrown\s*rice/i, /\bjasmine/i, /\bbasmati/i, /\buncle\s*ben/i, /\bminute\s*rice/i, /\bmahatma/i],
    searchTerms: ["rice", "white rice", "brown rice"],
    fallbackTerms: ["grains", "staples"],
    offCategoryTags: ["rices", "white-rices", "brown-rices"],
  },
  quinoa: {
    patterns: [/\bquinoa/i, /\bcouscous/i, /\bbulgur/i, /\bfarro/i],
    searchTerms: ["quinoa", "ancient grains"],
    fallbackTerms: ["grains", "healthy grains"],
    offCategoryTags: ["quinoa", "ancient-grains"],
  },
  kombucha: {
    patterns: [/\bkombucha/i, /\bgt's/i, /\bhealth-?ade/i, /\bkevita/i, /\bbrew\s*dr/i],
    searchTerms: ["kombucha", "fermented tea"],
    fallbackTerms: ["beverages", "fermented drinks"],
    offCategoryTags: ["kombuchas"],
  },
  kefir: {
    patterns: [/\bkefir/i, /\blifeway/i],
    searchTerms: ["kefir", "milk kefir"],
    fallbackTerms: ["dairy", "fermented dairy"],
    offCategoryTags: ["kefirs"],
  },

  // === ADDITIONAL CATEGORIES (industry parity) ===
  plantMeat: {
    patterns: [/\bbeyond\s*(meat|burger|sausage)/i, /\bimpossible\s*(meat|burger|sausage)/i, /\bplant[-\s]*based\s*(meat|burger|sausage|chicken|nugget)/i, /\bvegan\s*(burger|sausage|chicken|nugget)/i, /\btofurky/i, /\bquorn/i, /\bgardein/i, /\bmorningstar/i, /\bboca\s*burger/i, /\bfield\s*roast/i],
    searchTerms: ["plant based meat", "vegan meat", "meat alternative"],
    fallbackTerms: ["plant based", "meat alternatives"],
    offCategoryTags: ["plant-based-meat-alternatives", "meat-substitutes", "vegan-meats"],
  },
  tofu: {
    patterns: [/\btofu\b/i, /\btempeh\b/i, /\bseitan\b/i, /\bhouse\s*foods\s*tofu/i, /\bnasoya/i],
    searchTerms: ["tofu", "tempeh", "plant protein"],
    fallbackTerms: ["plant based", "vegan protein"],
    offCategoryTags: ["tofus", "tempehs", "seitans"],
  },
  eggs: {
    patterns: [/\beggs?\b/i, /\begg\s*(whites|beaters|substitute)/i, /\bjust\s*egg/i, /\bliquid\s*eggs/i],
    disqualifyPatterns: [/\beggplant/i, /\beggnog/i, /\begg\s*roll/i],
    searchTerms: ["eggs", "egg whites", "liquid eggs"],
    fallbackTerms: ["dairy", "breakfast"],
    offCategoryTags: ["eggs", "chicken-eggs"],
  },
  granolaBars: {
    patterns: [/\bgranola\s*bar/i, /\bnature\s*valley/i, /\bkashi\s*bar/i, /\bfiber\s*one\s*bar/i, /\bspecial\s*k\s*bar/i],
    searchTerms: ["granola bars", "cereal bars", "breakfast bars"],
    fallbackTerms: ["snack bars", "cereal bars"],
    offCategoryTags: ["granola-bars", "cereal-bars"],
  },
  driedFruit: {
    patterns: [/\bdried\s*(fruit|fruits|mango|pineapple|apricot|cranberr|blueberr|banana|apple)/i, /\braisins?\b/i, /\bprunes?\b/i, /\bdates?\b/i, /\bfigs?\b/i, /\bsun[-\s]*maid/i, /\bcraisins?\b/i],
    searchTerms: ["dried fruit", "raisins", "dried mango"],
    fallbackTerms: ["snacks", "fruit snacks"],
    offCategoryTags: ["dried-fruits", "raisins"],
  },
  fruitSnacks: {
    patterns: [/\bfruit\s*snacks?\b/i, /\bfruit\s*roll\s*ups?/i, /\bfruit\s*by\s*the\s*foot/i, /\bfruit\s*gushers/i, /\bwelch's\s*fruit\s*snacks/i, /\bannie's\s*fruit/i, /\bfruit\s*leather/i],
    searchTerms: ["fruit snacks", "fruit gummies"],
    fallbackTerms: ["sweets", "snacks"],
    offCategoryTags: ["fruit-snacks", "fruit-confectioneries"],
  },
  meltDrinks: {
    patterns: [/\bmilk\s*shake/i, /\bmilkshake/i, /\bprotein\s*shake/i, /\bensure\b/i, /\bboost\s*drink/i, /\bmuscle\s*milk\s*shake/i, /\borgain\s*shake/i],
    searchTerms: ["protein shake", "meal replacement shake"],
    fallbackTerms: ["beverages", "shakes"],
    offCategoryTags: ["protein-shakes", "meal-replacement-shakes"],
  },
  bakingMix: {
    patterns: [/\bcake\s*mix/i, /\bcookie\s*mix/i, /\bmuffin\s*mix/i, /\bbrownie\s*mix/i, /\bbetty\s*crocker/i, /\bduncan\s*hines/i, /\bpillsbury\s*mix/i, /\bking\s*arthur\s*flour/i],
    searchTerms: ["baking mix", "cake mix", "cookie mix"],
    fallbackTerms: ["baking", "dry mixes"],
    offCategoryTags: ["baking-mixes", "cake-mixes"],
  },
  flour: {
    patterns: [/\bflour\b/i, /\balmond\s*flour/i, /\bcoconut\s*flour/i, /\bwhole\s*wheat\s*flour/i, /\bbobs\s*red\s*mill/i, /\bgold\s*medal\s*flour/i],
    disqualifyPatterns: [/\btortilla\s*flour/i],
    searchTerms: ["flour", "all purpose flour", "whole wheat flour"],
    fallbackTerms: ["baking", "staples"],
    offCategoryTags: ["flours", "wheat-flours"],
  },
  oils: {
    patterns: [/\bolive\s*oil/i, /\bavocado\s*oil/i, /\bcoconut\s*oil/i, /\bvegetable\s*oil/i, /\bcanola\s*oil/i, /\bsunflower\s*oil/i, /\bsesame\s*oil/i, /\bcooking\s*oil/i, /\bcrisco/i, /\bbertolli\s*oil/i],
    searchTerms: ["olive oil", "cooking oil", "vegetable oil"],
    fallbackTerms: ["oils", "cooking essentials"],
    offCategoryTags: ["olive-oils", "cooking-oils", "vegetable-oils"],
  },
  honey: {
    patterns: [/\bhoney\b/i, /\bmaple\s*syrup/i, /\bagave/i, /\bmolasses/i, /\bstevia\s*syrup/i],
    disqualifyPatterns: [/\bhoneydew/i, /\bhoney\s*bunches\s*of\s*oats/i, /\bhoney\s*nut\s*cheerio/i],
    searchTerms: ["honey", "maple syrup", "natural sweetener"],
    fallbackTerms: ["sweeteners", "spreads"],
    offCategoryTags: ["honeys", "maple-syrups"],
  },
  sweeteners: {
    patterns: [/\bsugar\b/i, /\bsplenda/i, /\bsweet\s*n\s*low/i, /\bequal\b/i, /\btruvia/i, /\bstevia/i, /\bmonk\s*fruit/i, /\berythritol/i, /\bxylitol/i],
    disqualifyPatterns: [/\bsugar\s*cookie/i, /\bsugar\s*free\s*(gum|candy)/i],
    searchTerms: ["sugar", "sweetener", "sugar substitute"],
    fallbackTerms: ["sweeteners", "baking"],
    offCategoryTags: ["sugars", "sweeteners"],
  },
  seasoning: {
    patterns: [/\bseasoning\b/i, /\bspice\b/i, /\bspices\b/i, /\bherb\s*blend/i, /\bmccormick/i, /\btajín/i, /\btajin/i, /\btony\s*chachere/i, /\blawry's/i, /\bold\s*bay/i, /\bgarlic\s*powder/i, /\bonion\s*powder/i],
    searchTerms: ["seasoning", "spices", "spice blend"],
    fallbackTerms: ["cooking", "pantry"],
    offCategoryTags: ["seasonings", "spices"],
  },
  bars: {
    // Dedicated fallback for cookie/brownie/snack BARS that aren't protein bars.
    patterns: [/\bcookie\s*bar/i, /\bbrownie\s*bar/i, /\bfig\s*bar/i, /\bnewtons?\s*bar/i, /\bfruit\s*bar/i, /\bchewy\s*bar/i, /\bfiber\s*bar/i],
    searchTerms: ["snack bars", "fruit bars", "cereal bars"],
    fallbackTerms: ["bars", "snacks"],
    offCategoryTags: ["cereal-bars", "fruit-bars"],
  },
  wine: {
    patterns: [/\bwine\b/i, /\bchardonnay/i, /\bcabernet/i, /\bmerlot/i, /\bpinot\s*(noir|grigio)/i, /\bsauvignon/i, /\bprosecco/i, /\bchampagne/i, /\brose\s*wine/i],
    searchTerms: ["wine", "red wine", "white wine"],
    fallbackTerms: ["alcohol", "beverages"],
    offCategoryTags: ["wines", "red-wines", "white-wines"],
  },
  beer: {
    patterns: [/\bbeer\b/i, /\blager\b/i, /\bale\b/i, /\bipa\b/i, /\bstout\b/i, /\bpilsner/i, /\bbudweiser/i, /\bcoors/i, /\bmiller\s*light/i, /\bheineken/i, /\bcorona\s*extra/i, /\bmodelo/i, /\bguinness/i, /\bblue\s*moon/i],
    searchTerms: ["beer", "craft beer"],
    fallbackTerms: ["alcohol", "beverages"],
    offCategoryTags: ["beers", "craft-beers"],
  },
  seltzer: {
    patterns: [/\bhard\s*seltzer/i, /\bwhite\s*claw/i, /\btruly\s*hard/i, /\bhigh\s*noon/i, /\bbon\s*&\s*viv/i, /\bbud\s*light\s*seltzer/i],
    searchTerms: ["hard seltzer", "spiked seltzer"],
    fallbackTerms: ["alcohol", "beverages"],
    offCategoryTags: ["hard-seltzers"],
  },
  spirits: {
    patterns: [/\bvodka/i, /\bwhiskey/i, /\bwhisky/i, /\bbourbon/i, /\brum\b/i, /\btequila/i, /\bgin\b/i, /\bcognac/i, /\bscotch/i, /\bjack\s*daniel/i, /\bjim\s*beam/i, /\babsolut/i, /\bbacardi/i, /\bjose\s*cuervo/i],
    searchTerms: ["spirits", "liquor"],
    fallbackTerms: ["alcohol", "beverages"],
    offCategoryTags: ["spirits", "alcoholic-beverages"],
  },
  cereal: {
    // Alias for cereals — ensures more patterns captured.
    patterns: [/\bcorn\s*pops/i, /\bapple\s*jacks/i, /\bhoney\s*nut\s*cheerios/i, /\bcap'?n\s*crunch/i, /\btrix\b/i, /\breese's\s*puffs/i, /\bcookie\s*crisp/i, /\bgolden\s*grahams/i, /\bcrispix/i, /\btotal\s*cereal/i],
    searchTerms: ["breakfast cereals", "cereals"],
    fallbackTerms: ["breakfast", "cereals"],
    offCategoryTags: ["breakfast-cereals", "cereals"],
  },
};

export interface AlternativeProduct {
  product: ProductInfo;
  scores: ComputedScores;
  whyBetter?: string;
}

function hasUsefulCandidateData(p: ProductInfo): boolean {
  const hasName = !!p.name?.trim();
  if (!hasName) return false;
  const nut = p.nutrition ?? {};
  const hasNutrition =
    nut.calories != null ||
    nut.protein_g != null ||
    nut.carbs_g != null ||
    nut.fat_g != null ||
    nut.fiber_g != null ||
    nut.sugar_g != null ||
    nut.sodium_mg != null;
  const hasContext = !!p.ingredients?.trim() || !!p.categories?.trim();
  return hasNutrition || hasContext;
}

function normalizeForMatch(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTokens(text: string): string[] {
  const stop = new Set(["the", "and", "with", "for", "from", "pack", "cup", "oz", "ml", "g"]);
  return normalizeForMatch(text)
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !stop.has(t));
}

function tokenJaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = new Set([...sa, ...sb]).size;
  return union > 0 ? inter / union : 0;
}

function detectFormat(text: string): "drink" | "noodle" | "snack" | "dairy" | "cereal" | "other" {
  const t = normalizeForMatch(text);
  if (/\b(cola|soda|soft drink|juice|tea|coffee|drink|beverage|kefir|kombucha|water)\b/.test(t)) return "drink";
  if (/\b(ramen|noodle|instant noodle|cup noodle|pasta)\b/.test(t)) return "noodle";
  if (/\b(chip|chips|crisps|cracker|cookie|snack|pretzel|candy|chocolate)\b/.test(t)) return "snack";
  if (/\b(yogurt|yoghurt|milk|cheese|dairy)\b/.test(t)) return "dairy";
  if (/\b(cereal|granola|muesli|oatmeal|oats)\b/.test(t)) return "cereal";
  return "other";
}

function buildExtraQueryTerms(productName: string, productFromBarcode: ProductInfo | null): string[] {
  const terms: string[] = [];
  const cleanName = normalizeForMatch(productName);
  const nameTokens = toTokens(cleanName);
  if (nameTokens.length > 1) {
    terms.push(nameTokens.slice(0, 2).join(" "));
    terms.push(nameTokens[0]);
  } else if (nameTokens.length === 1) {
    terms.push(nameTokens[0]);
  }

  const brandTokens = toTokens(productFromBarcode?.brand ?? "");
  if (brandTokens.length > 0 && nameTokens.length > 0) {
    const deBranded = nameTokens.filter((t) => !brandTokens.includes(t));
    if (deBranded.length > 0) {
      terms.push(deBranded.slice(0, 3).join(" "));
      terms.push(deBranded[0]);
    }
  }

  return [...new Set(terms.filter(Boolean))];
}

function similarityScore(
  candidate: ProductInfo,
  current: { name: string; categories?: string; brand?: string },
  categoryKeywords: string[],
): number {
  const relevance = categoryRelevanceScore(candidate, categoryKeywords);
  const currentTokens = toTokens(`${current.name} ${current.categories ?? ""}`);
  const candidateTokens = toTokens(`${candidate.name} ${candidate.categories ?? ""}`);
  const nameSim = tokenJaccard(currentTokens, candidateTokens);

  const currentFormat = detectFormat(`${current.name} ${current.categories ?? ""}`);
  const candidateFormat = detectFormat(`${candidate.name} ${candidate.categories ?? ""}`);
  const formatSim = currentFormat === candidateFormat ? 1 : 0;

  const currentBrandTokens = toTokens(current.brand ?? "");
  const candidateBrandTokens = toTokens(candidate.brand ?? "");
  const sameBrand = currentBrandTokens.length > 0 && tokenJaccard(currentBrandTokens, candidateBrandTokens) > 0.6;

  const base = relevance * 0.55 + nameSim * 0.30 + formatSim * 0.15;
  return Math.max(0, Math.min(1, base - (sameBrand ? 0.05 : 0)));
}

// ---------------------------------------------------------------------------
// Category Detection using FOOD_CATEGORIES database
// ---------------------------------------------------------------------------

interface DetectedCategory {
  categoryKey: string;
  category: FoodCategory;
  searchTerms: string[];
  fallbackTerms: string[];
  offCategoryTags: string[];
}

/**
 * Detect product category from name, ingredients, and OFF categories.
 *
 * Ranking rules (industry-grade):
 * 1. Brand patterns take precedence — matching a brand (e.g. "Reese's",
 *    "Snickers") locks the category with the highest confidence.
 * 2. Categories that are disqualified by their `disqualifyPatterns` against
 *    the product name are dropped entirely.
 * 3. Pattern match count is the primary tie-breaker; the `priority` field
 *    breaks ties for overlapping categories (e.g., chocolate > peanutButter
 *    for "Reese's Peanut Butter Cups").
 * 4. Product NAME matches are weighted more heavily than ingredient/category
 *    string matches (name is the strongest signal of what the product is).
 */
function detectCategory(
  productName: string,
  ingredients?: string,
  offCategories?: string,
): DetectedCategory | null {
  const nameText = String(productName || "").toLowerCase();
  const contextText = `${ingredients ?? ""} ${offCategories ?? ""}`.toLowerCase();
  const fullText = `${nameText} ${contextText}`;

  type Match = { key: string; score: number; brandHit: boolean; priority: number };
  const matches: Match[] = [];

  for (const [key, cat] of Object.entries(FOOD_CATEGORIES)) {
    // Disqualification: if the product NAME hits any disqualify pattern,
    // this category is excluded regardless of other matches.
    if (cat.disqualifyPatterns && cat.disqualifyPatterns.some((p) => p.test(nameText))) {
      continue;
    }

    let score = 0;
    let brandHit = false;

    // Brand patterns on NAME only (brand names in ingredient lists would be
    // misleading). Each brand hit contributes heavily.
    if (cat.brandPatterns) {
      for (const bp of cat.brandPatterns) {
        if (bp.test(nameText)) {
          score += 5;
          brandHit = true;
        }
      }
    }

    // Regular patterns on name (2x weight) and full text (1x weight).
    for (const pattern of cat.patterns) {
      if (pattern.test(nameText)) score += 2;
      else if (pattern.test(fullText)) score += 1;
    }

    if (score > 0) {
      matches.push({ key, score, brandHit, priority: cat.priority ?? 0 });
    }
  }

  if (matches.length === 0) return null;

  // Sort: brand-hit first, then by score, then by priority.
  matches.sort((a, b) => {
    if (a.brandHit !== b.brandHit) return a.brandHit ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return b.priority - a.priority;
  });

  const best = matches[0];
  const category = FOOD_CATEGORIES[best.key];
  return {
    categoryKey: best.key,
    category,
    searchTerms: category.searchTerms,
    fallbackTerms: category.fallbackTerms,
    offCategoryTags: category.offCategoryTags,
  };
}

/**
 * Check if a candidate product belongs to the same category as the detected category.
 * Uses multiple matching strategies:
 * 1. Pattern matching against product name and categories
 * 2. OFF category tag matching
 * 3. Fuzzy category name matching
 */
function isSameCategory(candidate: ProductInfo, detectedCategory: DetectedCategory): boolean {
  const candidateName = String(candidate.name || "").toLowerCase();
  const candidateCategories = (candidate.categories ?? "").toLowerCase();
  const candidateText = `${candidateName} ${candidateCategories}`;

  // Disqualify: if candidate name matches a disqualify pattern, reject.
  if (detectedCategory.category.disqualifyPatterns) {
    for (const dp of detectedCategory.category.disqualifyPatterns) {
      if (dp.test(candidateName)) return false;
    }
  }

  // Strategy 1a: Brand patterns — strongest signal. A matching brand name
  // means the candidate is definitely in-category (e.g., "Hershey's" = chocolate).
  if (detectedCategory.category.brandPatterns) {
    for (const bp of detectedCategory.category.brandPatterns) {
      if (bp.test(candidateName)) return true;
    }
  }

  // Strategy 1b: Regular patterns on name or categories.
  for (const pattern of detectedCategory.category.patterns) {
    if (pattern.test(candidateText)) {
      return true;
    }
  }

  // Strategy 2: Check if candidate's OFF categories contain any of our
  // category tags. This is the authoritative OFF taxonomy match.
  for (const tag of detectedCategory.offCategoryTags) {
    const tagVariants = [
      tag,
      tag.replace(/-/g, " "),
      tag.replace(/-/g, ""),
    ];
    for (const variant of tagVariants) {
      if (candidateCategories.includes(variant)) {
        return true;
      }
    }
  }

  // Strategy 3 REMOVED: the old substring match on search terms against the
  // categories string was too loose (e.g. "chocolate" substring could leak
  // "chocolate-desserts" cheesecakes). Brand + pattern + OFF-tag matching is
  // sufficient and more precise.
  return false;
}

/** Stored shape for meal_scans.alternatives (JSONB): plain objects, no undefined, safe for Supabase. */
export type StoredAlternative = {
  product: ProductInfo;
  scores: ComputedScores;
  whyBetter: string | null;
};

/** Serialize alternatives for DB storage so the same list can be shown when reopening a scan. */
export function serializeAlternativesForStorage(
  alternatives: AlternativeProduct[],
): StoredAlternative[] {
  return alternatives.map((alt) => ({
    product: alt.product,
    scores: alt.scores,
    whyBetter: alt.whyBetter ?? null,
  }));
}

/** Score 0–1: how well candidate matches the scanned product category (name + categories). */
function categoryRelevanceScore(
  candidate: ProductInfo,
  keywords: string[],
): number {
  if (keywords.length === 0) return 1;
  const name = ((candidate.name || "") + " " + (candidate.categories || "")).toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    if (kw.length < 2) continue;
    if (name.includes(kw)) hits++;
  }
  return hits / keywords.length;
}

/** Dedupe by barcode (and by name+brand for items without barcode). */
function dedupeCandidates(products: ProductInfo[]): ProductInfo[] {
  const seenBarcode = new Set<string>();
  const seenKey = new Set<string>();
  const out: ProductInfo[] = [];
  for (const p of products) {
    const barcode = String(p.barcode || "").replace(/\D/g, "");
    if (barcode && seenBarcode.has(barcode)) continue;
    if (barcode) seenBarcode.add(barcode);
    const key = `${(p.name || "").toLowerCase()}|${(p.brand || "").toLowerCase()}`;
    if (seenKey.has(key)) continue;
    seenKey.add(key);
    out.push(p);
  }
  return out;
}

/** Build "why better" by comparing current (scan result) to alternative product. */
function buildWhyBetter(
  current: { nutrition?: ScanResult["nutrition"]; gut_score?: number },
  alternative: { product: ProductInfo; scores: ComputedScores },
): string {
  const curNut = current.nutrition ?? {};
  const altNut = alternative.product.nutrition ?? {};
  const reasons: string[] = [];

  const curSodium = curNut.sodium_mg ?? 0;
  const altSodium = altNut.sodium_mg ?? 0;
  if (altSodium > 0 && curSodium > altSodium && curSodium - altSodium >= 50) {
    reasons.push("Lower sodium");
  }

  const curSugar = curNut.sugar_g ?? 0;
  const altSugar = altNut.sugar_g ?? 0;
  if (altSugar >= 0 && curSugar > altSugar && curSugar - altSugar >= 2) {
    reasons.push("Less sugar");
  }

  const curFiber = curNut.fiber_g ?? 0;
  const altFiber = altNut.fiber_g ?? 0;
  if (altFiber > curFiber && altFiber - curFiber >= 0.5) {
    reasons.push("More fiber");
  }

  const curGut = current.gut_score ?? 0;
  const altGut = alternative.scores.gut_score ?? 0;
  if (altGut >= curGut - 5 && altGut <= curGut + 10 && reasons.length === 0) {
    return "Similar gut-friendly choice";
  }
  if (reasons.length === 0 && altGut > curGut) {
    return "Better gut score";
  }
  return reasons.slice(0, 2).join(" · ") || "Better gut score";
}

/** Prefer products with more complete data when sorting (then by gut_score). */
function scoreCompleteness(p: ProductInfo): number {
  let n = 0;
  const nut = p.nutrition ?? {};
  if (nut.calories != null) n++;
  if (nut.sodium_mg != null) n++;
  if (nut.sugar_g != null) n++;
  if (nut.fiber_g != null) n++;
  if (p.ingredients?.trim()) n += 2;
  if (p.imageUrl) n++; // Prefer products with images
  return n;
}

/** Max time to wait for barcode lookup before building alternatives (avoid blocking on slow OFF). */
const BARCODE_LOOKUP_TIMEOUT_MS = 4_000;

function buildMealAlternatives(
  scanResult: ScanResult,
  profile: OnboardingProfile | null,
  maxCount: number,
): AlternativeProduct[] {
  const nutrition = scanResult.nutrition ?? {};
  const currentGut = scanResult.gut_score ?? 0;
  const mealName = (scanResult.product_name || scanResult.food_name || "Your meal").trim();

  const calories = nutrition.calories ?? 0;
  const sodium = nutrition.sodium_mg ?? 0;
  const sugar = nutrition.sugar_g ?? 0;
  const fiber = nutrition.fiber_g ?? 0;
  const fat = nutrition.fat_g ?? 0;
  const saturatedFat = nutrition.saturated_fat_g ?? 0;

  const proposals: Array<{ product: ProductInfo; whyBetter: string }> = [
    {
      product: {
        name: `${mealName} (whole-food ingredient swap)`,
        brand: "Meal Upgrade",
        barcode: "",
        imageUrl: undefined,
        ingredients: "Whole grains, legumes, vegetables, herbs",
        categories: "meal",
        source: "openfoodfacts",
        nutrition: {
          calories: calories > 0 ? Math.max(0, Math.round(calories * 0.92)) : undefined,
          sodium_mg: sodium > 0 ? Math.max(0, Math.round(sodium * 0.78)) : undefined,
          sugar_g: sugar > 0 ? +(sugar * 0.82).toFixed(1) : undefined,
          fiber_g: +(Math.max(fiber + 3, fiber * 1.4)).toFixed(1),
          fat_g: fat > 0 ? +(fat * 0.9).toFixed(1) : undefined,
          saturated_fat_g: saturatedFat > 0 ? +(saturatedFat * 0.75).toFixed(1) : undefined,
        },
      },
      whyBetter: "Ingredient swap: more fiber-dense whole foods with fewer refined triggers.",
    },
    {
      product: {
        name: `${mealName} (grilled/steamed prep)`,
        brand: "Meal Upgrade",
        barcode: "",
        imageUrl: undefined,
        ingredients: "Same ingredients, lower-oil cooking method",
        categories: "meal",
        source: "openfoodfacts",
        nutrition: {
          calories: calories > 0 ? Math.max(0, Math.round(calories * 0.88)) : undefined,
          sodium_mg: sodium > 0 ? Math.max(0, Math.round(sodium * 0.85)) : undefined,
          sugar_g: sugar > 0 ? +sugar.toFixed(1) : undefined,
          fiber_g: +(fiber + 1).toFixed(1),
          fat_g: fat > 0 ? +(fat * 0.75).toFixed(1) : undefined,
          saturated_fat_g: saturatedFat > 0 ? +(saturatedFat * 0.65).toFixed(1) : undefined,
        },
      },
      whyBetter: "Cooking method: less inflammatory fat load and lower post-meal heaviness.",
    },
    {
      product: {
        name: `${mealName} (balanced plate version)`,
        brand: "Meal Upgrade",
        barcode: "",
        imageUrl: undefined,
        ingredients: "Balanced protein, fiber side, fermented element",
        categories: "meal",
        source: "openfoodfacts",
        nutrition: {
          calories: calories > 0 ? Math.max(0, Math.round(calories * 0.95)) : undefined,
          sodium_mg: sodium > 0 ? Math.max(0, Math.round(sodium * 0.82)) : undefined,
          sugar_g: sugar > 0 ? +(sugar * 0.85).toFixed(1) : undefined,
          fiber_g: +(Math.max(fiber + 4, fiber * 1.5)).toFixed(1),
          fat_g: fat > 0 ? +(fat * 0.88).toFixed(1) : undefined,
          saturated_fat_g: saturatedFat > 0 ? +(saturatedFat * 0.72).toFixed(1) : undefined,
          protein_g: nutrition.protein_g != null ? +(nutrition.protein_g * 1.1).toFixed(1) : undefined,
        },
      },
      whyBetter: "Nutritional balance: improved protein-fiber ratio and gentler glycemic impact.",
    },
  ];

  const scored = proposals
    .map((proposal) => ({
      product: proposal.product,
      scores: computeScores(proposal.product, profile),
      whyBetter: proposal.whyBetter,
    }))
    .filter((item) => (item.scores.gut_score ?? 0) > currentGut)
    .sort((a, b) => (b.scores.gut_score ?? 0) - (a.scores.gut_score ?? 0));

  return scored.slice(0, maxCount);
}

/**
 * Get up to 3 alternative products from the same category with higher gut scores.
 * 
 * Key behaviors:
 * - Supports barcode + photo product scans
 * - Meal scans return meal-specific upgrade suggestions
 * - Category-locked: cereals→cereals, chips→chips
 * - Prioritize higher gut scores within same category
 * - Aggressive fallback searches to guarantee results
 * - Never throws; returns [] on any error
 */
export async function getAlternatives(
  scanResult: ScanResult,
  profile: OnboardingProfile | null,
  options?: { maxCount?: number },
): Promise<AlternativeProduct[]> {
  const startTime = Date.now();
  try {
    const maxCount = options?.maxCount ?? 3;
    const currentGut = scanResult.gut_score ?? 0;
    const productName = (scanResult.product_name || scanResult.food_name || "").trim();
    const barcode = scanResult.barcode?.trim();
    const excludeBarcode = barcode || undefined;
    const manufacturer = scanResult.manufacturer || "";
    const ingredients = scanResult.ingredients?.join(", ") || "";

    altDiag("start", { productName, barcode: barcode ?? "none", scan_type: scanResult.scan_type });

    if (scanResult.isMeal) {
      const mealAlternatives = buildMealAlternatives(scanResult, profile, maxCount);
      altDiag("meal alternatives", { count: mealAlternatives.length, ms: Date.now() - startTime });
      return mealAlternatives;
    }

    // STEP 1: Detect category IMMEDIATELY from scan result data (no waiting for barcode lookup)
    // This allows searches to start right away
    let detectedCategory = detectCategory(productName, ingredients, "");
    
    // Build initial search terms from detected category or product name
    let searchTerms: string[] = [];
    let fallbackTerms: string[] = [];
    let offCategoryTags: string[] = [];
    
    if (detectedCategory) {
      searchTerms.push(...detectedCategory.searchTerms);
      fallbackTerms.push(...detectedCategory.fallbackTerms);
      offCategoryTags.push(...detectedCategory.offCategoryTags);
    } else {
      // No category detected - use product name tokens
      const nameTokens = toTokens(productName);
      if (nameTokens.length > 0) {
        searchTerms.push(nameTokens.slice(0, 3).join(" "));
        if (nameTokens.length > 1) searchTerms.push(nameTokens[0]);
      }
      // Add manufacturer as search term if available
      if (manufacturer) {
        const mfgTokens = toTokens(manufacturer);
        if (mfgTokens.length > 0 && nameTokens.length > 0) {
          searchTerms.push(`${nameTokens[0]} ${mfgTokens[0]}`);
        }
      }
      // Add generic fallbacks based on format detection
      const format = detectFormat(productName);
      if (format === "drink") fallbackTerms.push("beverages", "drinks");
      else if (format === "snack") fallbackTerms.push("snacks", "savory snacks");
      else if (format === "dairy") fallbackTerms.push("dairy", "dairy products");
      else if (format === "cereal") fallbackTerms.push("breakfast cereals", "cereals");
      else if (format === "noodle") fallbackTerms.push("instant noodles", "noodles");
      else fallbackTerms.push("food", "snacks");
    }

    altDiag("detected category", { 
      categoryKey: detectedCategory?.categoryKey ?? "none",
      productName,
      searchTerms,
      ms: Date.now() - startTime,
    });

    // STEP 2: Run barcode lookup IN PARALLEL with primary searches (non-blocking)
    // This way we don't wait 4 seconds before starting searches
    const barcodePromise = barcode
      ? Promise.race([
          lookupProduct(barcode).catch(() => null),
          new Promise<null>((r) => setTimeout(() => r(null), 2000)), // Reduced to 2s
        ])
      : Promise.resolve(null);

    // PHASE 1: Primary search - run ALL searches in parallel for speed
    // Term searches are more reliable than category tag searches on OFF API
    const phase1Searches: Promise<ProductInfo[]>[] = [];
    
    // PRIORITY 1: Search terms (most reliable - "instant noodles", "ramen", etc.)
    if (searchTerms.length > 0) {
      phase1Searches.push(
        ...searchTerms.map((term) => 
          searchOFFByTerm(term, PRIMARY_PAGE_SIZE, excludeBarcode)
        )
      );
    }
    
    // PRIORITY 2: Fallback terms (run in parallel, not after)
    if (fallbackTerms.length > 0) {
      phase1Searches.push(
        ...fallbackTerms.slice(0, 2).map((term) => 
          searchOFFByTerm(term, SECONDARY_PAGE_SIZE, excludeBarcode)
        )
      );
    }
    
    // PRIORITY 3: Category tag searches (backup - may not always work)
    if (offCategoryTags.length > 0) {
      phase1Searches.push(
        ...offCategoryTags.slice(0, 2).map((tag) => 
          searchOFFByCategory(tag, SECONDARY_PAGE_SIZE, excludeBarcode)
        )
      );
    }

    // Wait for all phase 1 searches + barcode lookup together
    const [phase1Results, productFromBarcode] = await Promise.all([
      Promise.all(phase1Searches),
      barcodePromise,
    ]);

    let candidates = dedupeCandidates(phase1Results.flat());
    altDiag("after phase 1", { count: candidates.length, ms: Date.now() - startTime });

    // If barcode lookup returned more category info, refine our category detection
    if (productFromBarcode && !detectedCategory) {
      detectedCategory = detectCategory(
        productName || productFromBarcode.name,
        productFromBarcode.ingredients || ingredients,
        productFromBarcode.categories || "",
      );
      if (detectedCategory) {
        altDiag("refined category from barcode", { categoryKey: detectedCategory.categoryKey });
        // Update search terms for phase 2
        searchTerms = detectedCategory.searchTerms;
        fallbackTerms = detectedCategory.fallbackTerms;
        offCategoryTags = detectedCategory.offCategoryTags;
      }
    }

    // PHASE 2: Only run if phase 1 returned very few candidates
    // Since we now run all main searches in phase 1, phase 2 is just for edge cases
    if (candidates.length < MIN_CANDIDATES_BEFORE_FALLBACK) {
      const phase2Searches: Promise<ProductInfo[]>[] = [];
      
      // Extra query terms from product name (different variations)
      const extraTerms = buildExtraQueryTerms(productName, productFromBarcode);
      if (extraTerms.length > 0) {
        phase2Searches.push(
          ...extraTerms.slice(0, 2).map((term) => 
            searchOFFByTerm(term, SECONDARY_PAGE_SIZE, excludeBarcode)
          )
        );
      }
      
      // USDA search as backup
      const usdaTerms = [...searchTerms, ...fallbackTerms].filter(Boolean).slice(0, 1);
      if (usdaTerms.length > 0) {
        phase2Searches.push(searchUsdaByQuery(usdaTerms[0], 12));
      }

      if (phase2Searches.length > 0) {
        const phase2Results = await Promise.all(phase2Searches);
        candidates = dedupeCandidates([...candidates, ...phase2Results.flat()]);
        altDiag("after phase 2", { count: candidates.length, ms: Date.now() - startTime });
      }
    }

    // PHASE 3: Last resort if still no candidates
    if (candidates.length === 0) {
      const firstWord = productName.split(/\s+/)[0];
      if (firstWord && firstWord.length >= 3) {
        const lastResort = await searchOFFByTerm(firstWord, SECONDARY_PAGE_SIZE, excludeBarcode);
        candidates = dedupeCandidates(lastResort);
        altDiag("after last resort", { count: candidates.length, term: firstWord, ms: Date.now() - startTime });
      }
    }

    // Filter to quality candidates (have useful data)
    const qualityCandidates = candidates.filter(hasUsefulCandidateData);
    candidates = qualityCandidates.length >= maxCount ? qualityCandidates : candidates;
    altDiag("after quality filter", { count: candidates.length, ms: Date.now() - startTime });

    if (candidates.length === 0) {
      altDiag("no candidates found", { ms: Date.now() - startTime });
      return [];
    }

    // Category-lock filter: STRICTLY keep only candidates from same category
    // Never fall back to off-category products - better to show fewer relevant alternatives
    let sameCategoryCandidates = candidates;
    if (detectedCategory) {
      sameCategoryCandidates = candidates.filter((c) => isSameCategory(c, detectedCategory));
      
      // Debug: Log sample of rejected candidates to understand why they didn't match
      const rejectedSample = candidates
        .filter((c) => !isSameCategory(c, detectedCategory))
        .slice(0, 3)
        .map((c) => ({ name: c.name, categories: c.categories?.slice(0, 100) }));
      
      altDiag("after category lock", { 
        before: candidates.length, 
        after: sameCategoryCandidates.length,
        categoryKey: detectedCategory.categoryKey,
        categoryTags: detectedCategory.offCategoryTags,
        rejectedSample,
      });
      
      if (sameCategoryCandidates.length === 0) {
        altDiag("no same-category candidates found, returning none", {
          searchTerms: detectedCategory.searchTerms,
          offCategoryTags: detectedCategory.offCategoryTags,
        });
        return [];
      }
    }

    // Score all candidates
    const scored: Array<{
      product: ProductInfo;
      scores: ComputedScores;
      hasImage: boolean;
      completeness: number;
    }> = sameCategoryCandidates.map((product) => ({
      product,
      scores: computeScores(product, profile),
      hasImage: !!product.imageUrl,
      completeness: scoreCompleteness(product),
    }));

    // STRICT FILTER: Only alternatives with HIGHER gut scores than current product
    // No exceptions - we never recommend worse products
    const betterOnly = scored.filter((s) => {
      const altGut = s.scores.gut_score ?? 0;
      return altGut > currentGut;
    });

    // REQUIRE IMAGES: Filter to only products with images for better UX
    const withImages = betterOnly.filter((s) => s.hasImage);
    
    // Debug: Log image availability
    altDiag("image filter", { 
      betterOnly: betterOnly.length,
      withImages: withImages.length,
      sampleWithoutImages: betterOnly.filter(s => !s.hasImage).slice(0, 3).map(s => ({ name: s.product.name, hasImage: s.hasImage, imageUrl: s.product.imageUrl }))
    });
    
    // Use products with images if we have enough, otherwise use all better products
    const pool = withImages.length >= maxCount ? withImages : betterOnly;
    
    // If no better alternatives exist, return empty array - never recommend worse products
    if (pool.length === 0) {
      altDiag("no better alternatives found, returning empty", {
        currentGut, 
        totalScored: scored.length,
        betterOnly: betterOnly.length,
        withImages: withImages.length,
        ms: Date.now() - startTime,
      });
      return [];
    }

    // Sort by: gut score improvement > has image > data completeness
    const sortByQuality = (a: typeof scored[0], b: typeof scored[0]) => {
      const aGut = a.scores.gut_score ?? 0;
      const bGut = b.scores.gut_score ?? 0;
      
      // Primary: gut score (higher is better)
      if (bGut !== aGut) return bGut - aGut;
      
      // Secondary: has image (strongly prefer products with images)
      if (a.hasImage !== b.hasImage) return a.hasImage ? -1 : 1;
      
      // Tertiary: data completeness
      return b.completeness - a.completeness;
    };

    const sorted = [...pool].sort(sortByQuality);
    const top = sorted.slice(0, maxCount);

    const topWithRecoveredImages = await withTimeout(
      Promise.all(
        top.map(async (candidate) => {
          if (candidate.product.imageUrl) return candidate;
          const recoveredImageUrl = await recoverImageUrlForProduct(
            candidate.product,
            excludeBarcode,
          );
          if (!recoveredImageUrl) return candidate;
          return {
            ...candidate,
            product: {
              ...candidate.product,
              imageUrl: recoveredImageUrl,
            },
            hasImage: true,
            completeness: candidate.completeness + 1,
          };
        }),
      ),
      ALTERNATIVE_IMAGE_RECOVERY_BUDGET_MS,
      top,
    );
    const recoveredImages = topWithRecoveredImages.filter((c) => !!c.product.imageUrl).length;

    altDiag("selection", { 
      totalScored: scored.length,
      betterOnly: betterOnly.length,
      withImages: withImages.length,
      selected: topWithRecoveredImages.length,
      selectedWithImages: recoveredImages,
      ms: Date.now() - startTime,
    });

    const current = {
      nutrition: scanResult.nutrition,
      gut_score: currentGut,
    };

    const result = topWithRecoveredImages.map(({ product, scores }) => ({
      product,
      scores,
      whyBetter: buildWhyBetter(current, { product, scores }),
    }));

    altDiag("complete", { count: result.length, ms: Date.now() - startTime });
    return result;
  } catch (e) {
    altDiag("error", { error: e instanceof Error ? e.message : String(e), ms: Date.now() - startTime });
    return [];
  }
}
