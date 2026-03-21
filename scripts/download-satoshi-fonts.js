/**
 * Downloads Satoshi Bold and Black TTF fonts into assets/fonts.
 * Run: node scripts/download-satoshi-fonts.js
 * Required for the app to load Satoshi headings (see app/_layout.tsx).
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const ASSETS_FONTS = path.join(__dirname, "..", "assets", "fonts");
const CDN_BASE = "https://cdn.jsdelivr.net/npm/ab-tests@1.1.2/assets/fonts/satoshi";

const FONTS = ["Satoshi-Bold.ttf", "Satoshi-Black.ttf"];

function download(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`${url} returned ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

async function main() {
  if (!fs.existsSync(ASSETS_FONTS)) {
    fs.mkdirSync(ASSETS_FONTS, { recursive: true });
  }

  for (const name of FONTS) {
    const url = `${CDN_BASE}/${name}`;
    const dest = path.join(ASSETS_FONTS, name);
    try {
      console.log(`Downloading ${name}...`);
      const buf = await download(url);
      fs.writeFileSync(dest, buf);
      console.log(`  -> ${dest}`);
    } catch (e) {
      console.error(`Failed to download ${name}:`, e.message);
      console.error(
        "Download Satoshi from https://www.fontshare.com/fonts/satoshi and add Satoshi-Bold.ttf and Satoshi-Black.ttf to assets/fonts/"
      );
      process.exit(1);
    }
  }

  console.log("Satoshi fonts ready.");
}

main();
