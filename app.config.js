/**
 * Expo config: loads .env so EXPO_PUBLIC_* vars are available at runtime via extra.
 * Restart dev server after changing .env (npx expo start -c to clear cache).
 */
require("dotenv").config();

const appJson = require("./app.json");
const { expo } = appJson;

module.exports = {
  ...expo,
  extra: {
    EXPO_PUBLIC_USDA_FDC_API_KEY: process.env.EXPO_PUBLIC_USDA_FDC_API_KEY || "",
    EXPO_PUBLIC_BARCODE_LOOKUP_API_KEY: process.env.EXPO_PUBLIC_BARCODE_LOOKUP_API_KEY || "",
  },
};
