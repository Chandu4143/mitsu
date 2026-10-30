import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

// The shell must be running with WebView2 remote debugging enabled, for example:
//   $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9333"
//   .\src-tauri\target\debug\mitsu.exe
const CDP_URL = process.env.MITSU_CDP_URL || "http://127.0.0.1:9333";
const OUTPUT_ROOT = path.resolve("public/screenshots/desktop-app");

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await new Promise((resolve) => setTimeout(resolve, 800));
}

async function prepareForScreenshot(page) {
  await page.addStyleTag({
    content: `
      /* README-safe capture: blur cover art and page scans only. */
      img[src*="/cover"],
      img[src*="/content"],
      img[src*="nhentai"],
      img[src*="nhentai.net"] {
        filter: blur(18px) saturate(0.78) !important;
        transform: scale(1.06);
      }
    `,
  });

  await page.evaluate(() => {
    const pathPattern = /^[A-Za-z]:[\\/]/;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let index = 0;
    for (const node of nodes) {
      if (node.nodeValue && pathPattern.test(node.nodeValue.trim())) {
        index += 1;
        node.nodeValue = `~/library/${index}`;
      }
    }
  });

  await settle(page);
}

await mkdir(OUTPUT_ROOT, { recursive: true });

let browser;
try {
  browser = await puppeteer.connect({ browserURL: CDP_URL, defaultViewport: null });
} catch (error) {
  console.error(
    `Could not reach the desktop app at ${CDP_URL}.\n` +
      "Start it with WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333.\n" +
      String(error)
  );
  process.exit(1);
}

const [page] = await browser.pages();

const galleryId = await page.evaluate(async () => {
  const base = window.__MITSU_API_BASE__;
  if (!base) return null;
  const response = await fetch(`${base}/galleries?page_size=1`);
  const body = await response.json();
  return body.items?.[0]?.id ?? null;
});

if (!galleryId) {
  console.error("No galleries found. Import at least one gallery first.");
  await browser.disconnect();
  process.exit(1);
}

const routes = [
  ["01-home", "/"],
  ["02-library", "/library"],
  ["03-gallery", `/gallery?id=${galleryId}`],
  ["04-reader", `/reader?id=${galleryId}`],
  ["05-settings", "/settings"],
];

try {
  for (const [name, route] of routes) {
    await page.goto(`http://tauri.localhost${route}`, {
      waitUntil: "networkidle0",
      timeout: 60_000,
    });
    await prepareForScreenshot(page);
    await page.screenshot({ path: path.join(OUTPUT_ROOT, `${name}.png`) });
    console.log(`captured desktop-app/${name}.png`);
  }
} finally {
  await browser.disconnect();
}

console.log(`\nScreenshots are in ${path.relative(process.cwd(), OUTPUT_ROOT)}`);
