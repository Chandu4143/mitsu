import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const BASE_URL = process.env.MITSU_SCREENSHOT_URL || "http://127.0.0.1:3000";
const CHROME_PATH =
  process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_ROOT = path.resolve("public/screenshots");

async function firstGalleryId() {
  const response = await fetch(`${BASE_URL}/api/v1/galleries?page_size=1`);
  if (!response.ok) throw new Error(`API returned ${response.status}`);
  const body = await response.json();
  if (!body.items?.length) throw new Error("No galleries found. Import a gallery first.");
  return body.items[0].id;
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await new Promise((resolve) => setTimeout(resolve, 800));
}

async function prepareForScreenshot(page) {
  await page.addStyleTag({
    content: `
      nextjs-portal { display: none !important; }

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

async function buildHero(browser, files) {
  const images = await Promise.all(
    files.map(async (file) => {
      const data = await readFile(file);
      return `data:image/png;base64,${data.toString("base64")}`;
    })
  );

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 1600px; height: 700px; overflow: hidden; }
  body {
    background:
      radial-gradient(760px 520px at 14% 4%, rgba(179, 95, 134, 0.34), transparent 64%),
      radial-gradient(700px 520px at 88% 96%, rgba(223, 164, 189, 0.2), transparent 66%),
      linear-gradient(135deg, #2c2229 0%, #201a1e 58%, #171316 100%);
    font-family: Inter, "Segoe UI", sans-serif;
  }
  .stage { position: relative; width: 1600px; height: 700px; overflow: hidden; }
  .stage::after {
    content: "";
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(255,255,255,0.08) 0.6px, transparent 0.6px);
    background-size: 4px 4px;
    opacity: 0.18;
    pointer-events: none;
  }
  .watermark {
    position: absolute;
    left: 40px;
    bottom: -86px;
    font-size: 268px;
    font-weight: 800;
    letter-spacing: -0.075em;
    color: rgba(255, 255, 255, 0.032);
    line-height: 1;
  }
  .glow {
    position: absolute;
    left: 380px;
    top: -80px;
    width: 820px;
    height: 820px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 194, 216, 0.16), transparent 62%);
  }
  .phone {
    position: absolute;
    width: 250px;
    height: 541px;
    padding: 7px;
    border-radius: 36px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: linear-gradient(160deg, #292329, #0c0a0c 55%);
    box-shadow:
      0 2px 0 rgba(255, 255, 255, 0.1) inset,
      0 44px 90px -24px rgba(0, 0, 0, 0.9),
      0 0 0 1px rgba(0, 0, 0, 0.6);
  }
  .phone::before {
    content: "";
    position: absolute;
    z-index: 3;
    top: 14px;
    left: 50%;
    width: 66px;
    height: 18px;
    transform: translateX(-50%);
    border-radius: 999px;
    background: #090809;
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.08);
  }
  .screen {
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: 29px;
    background: #fbf7f4;
  }
  .screen img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    object-position: top center;
  }
  .left { left: 340px; top: 122px; transform: rotate(-7deg); }
  .center { left: 675px; top: 48px; z-index: 2; }
  .right { left: 1010px; top: 122px; transform: rotate(7deg); }
</style>
</head>
<body>
  <div class="stage">
    <div class="watermark">mitsu.</div>
    <div class="glow"></div>
    <div class="phone left"><div class="screen"><img src="${images[1]}" alt="" /></div></div>
    <div class="phone center"><div class="screen"><img src="${images[0]}" alt="" /></div></div>
    <div class="phone right"><div class="screen"><img src="${images[2]}" alt="" /></div></div>
  </div>
</body>
</html>`;

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 700, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "networkidle0" });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const target = path.join(OUTPUT_ROOT, "hero.png");
  await page.screenshot({ path: target });
  await page.close();
  return target;
}

const galleryId = await firstGalleryId();

const mobileRoutes = [
  ["01-home", "/"],
  ["02-library", "/library"],
  ["03-gallery", `/gallery?id=${galleryId}`],
  ["04-collections", "/collections"],
  ["05-imports", "/imports"],
  ["06-reader", `/reader?id=${galleryId}`],
];

const desktopRoutes = [
  ["01-home", "/"],
  ["02-library", "/library"],
  ["03-gallery", `/gallery?id=${galleryId}`],
  ["04-collections", "/collections"],
  ["05-imports", "/imports"],
  ["06-discover", "/discover"],
];

await mkdir(path.join(OUTPUT_ROOT, "mobile"), { recursive: true });
await mkdir(path.join(OUTPUT_ROOT, "desktop"), { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"],
});

const settingsResponse = await fetch(`${BASE_URL}/api/v1/settings`);
const originalSettings = settingsResponse.ok ? await settingsResponse.json() : null;
const originalReaderMode = originalSettings?.preferences?.reader_mode ?? "continuous";

async function setReaderMode(mode) {
  await fetch(`${BASE_URL}/api/v1/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reader_mode: mode }),
  });
}

await setReaderMode("single");

try {
  for (const [name, route] of mobileRoutes) {
    const page = await browser.newPage();
    await page.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle0", timeout: 60_000 });
    await prepareForScreenshot(page);
    await page.screenshot({
      path: path.join(OUTPUT_ROOT, "mobile", `${name}.png`),
      fullPage: false,
    });
    await page.close();
    console.log(`captured mobile/${name}.png`);
  }

  for (const [name, route] of desktopRoutes) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle0", timeout: 60_000 });
    await prepareForScreenshot(page);
    await page.screenshot({
      path: path.join(OUTPUT_ROOT, "desktop", `${name}.png`),
      fullPage: false,
    });
    await page.close();
    console.log(`captured desktop/${name}.png`);
  }

  const hero = await buildHero(browser, [
    path.join(OUTPUT_ROOT, "mobile", "01-home.png"),
    path.join(OUTPUT_ROOT, "mobile", "02-library.png"),
    path.join(OUTPUT_ROOT, "mobile", "03-gallery.png"),
  ]);
  console.log(`captured ${path.relative(process.cwd(), hero)}`);
} finally {
  if (originalReaderMode !== "single") {
    await setReaderMode(originalReaderMode).catch(() => {});
  }
  await browser.close();
}

console.log(`\nScreenshots are in ${path.relative(process.cwd(), OUTPUT_ROOT)}`);
