// Record a demo GIF of nba.xpy.me by driving Puppeteer through the most
// visually striking flows. Outputs a frame sequence; an ffmpeg call
// downstream concatenates them into the final GIF.
//
// Run: node scripts/record-demo.mjs
//
// Required: puppeteer (already pulled in by @mermaid-js/mermaid-cli).
// If puppeteer isn't installed at the top level, npx will fetch a fresh
// one — first run takes ~30s.

import puppeteer from "puppeteer-core";
import { mkdir, rm } from "fs/promises";
import { existsSync } from "fs";

const URL_BASE = process.env.URL_BASE || "https://nba.xpy.me";
const FRAMES_DIR = "article-images/frames";
const FPS = 10;
const VIEWPORT = { width: 1280, height: 800, deviceScaleFactor: 1 };
// Reuse the Chrome already installed by @mermaid-js/mermaid-cli — avoids
// downloading a 150MB Chromium just for this script.
const CHROME_PATH = process.env.CHROME_PATH ||
  "C:/Users/FXY/.cache/puppeteer/chrome/win64-147.0.7727.57/chrome-win64/chrome.exe";

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Force ALL images on the current page to load before we start recording.
// Next/Image uses loading="lazy" + IntersectionObserver, which means logos
// below the fold (esp. the bracket team logos and the all-time-leaders
// headshots) never start loading until scrolled into view. We pre-trigger
// them by flipping loading to eager + doing a full page scroll cycle, then
// wait for every <img> to be .complete.
async function preloadAllImages(page) {
  // 1. Promote lazy → eager
  await page.evaluate(() => {
    for (const img of document.querySelectorAll("img")) {
      if (img.loading === "lazy") img.loading = "eager";
    }
  });
  // 2. Scroll bottom-to-top-to-bottom to trip every IntersectionObserver
  await page.evaluate(() => new Promise((resolve) => {
    const originalY = window.scrollY;
    const max = document.body.scrollHeight;
    let y = 0;
    const id = setInterval(() => {
      window.scrollTo(0, y);
      y += 600;
      if (y >= max) {
        clearInterval(id);
        window.scrollTo(0, originalY);
        resolve(null);
      }
    }, 40);
  }));
  // 3. Wait for every <img> to settle (success or error — fallback handles 404s)
  await page.evaluate(() => Promise.all(
    Array.from(document.images).map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          })
    )
  ));
  // 4. Settle for any post-load layout shift / state update
  await wait(800);
}

async function main() {
  // Clean / recreate frames dir
  if (existsSync(FRAMES_DIR)) await rm(FRAMES_DIR, { recursive: true, force: true });
  await mkdir(FRAMES_DIR, { recursive: true });

  console.log(`[demo] Launching browser, target = ${URL_BASE}`);
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: CHROME_PATH,
    defaultViewport: VIEWPORT,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  // Spoof a real Chrome UA — cdn.nba.com's Akamai layer rejects HTTP/2
  // connections whose User-Agent contains "HeadlessChrome" with
  // ERR_HTTP2_PROTOCOL_ERROR, breaking all team logos and player
  // headshots. The site renders text/initials fallback instead.
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  );

  // Force light theme:
  //   1. emulate OS prefers-color-scheme so ThemeScript falls back correctly
  //   2. inject localStorage on every navigation so the saved preference wins
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem("theme", "light"); } catch {}
  });

  // Emulate Beijing timezone so /api/games?tz= grouping returns the same
  // game roster a CN user would see — otherwise headless Puppeteer runs in
  // UTC and dates with finished ET evening games appear empty.
  await page.emulateTimezone("Asia/Shanghai");

  let frame = 0;
  async function snap() {
    await page.screenshot({
      path: `${FRAMES_DIR}/${String(frame).padStart(4, "0")}.png`,
      type: "png",
    });
    frame++;
  }

  // Helper: take N frames spaced by `interval` ms (default 1000/FPS = 100ms)
  async function record(durationMs) {
    const interval = 1000 / FPS;
    const startFrame = frame;
    const startTime = Date.now();
    while (Date.now() - startTime < durationMs) {
      await snap();
      const elapsed = Date.now() - startTime;
      const expected = (frame - startFrame) * interval;
      const sleep = Math.max(0, expected - elapsed);
      await wait(sleep);
    }
  }

  // ─── Scene 1: Homepage entry on a date with finished games (3s) ───
  // Pin to 2026-05-14 (1 finished game CLE@DET 117-113 in Shanghai TZ) so
  // the demo always shows real scorecards instead of "no games today".
  console.log("[demo] Scene 1: Homepage entry (5/14)");
  await page.goto(`${URL_BASE}/?date=2026-05-14`, { waitUntil: "networkidle2", timeout: 30000 });
  await preloadAllImages(page);
  await record(3000);

  // ─── Scene 2: Smooth scroll down to playoff bracket (4s) ───
  console.log("[demo] Scene 2: Scroll to bracket");
  await page.evaluate(() => {
    let scrolled = 0;
    const target = document.body.scrollHeight - window.innerHeight;
    const step = target / 30; // ~30 frames to bottom
    const interval = setInterval(() => {
      window.scrollBy(0, step);
      scrolled += step;
      if (scrolled >= target) clearInterval(interval);
    }, 100);
  });
  await record(4000);

  // ─── Scene 3: Navigate to /all-time-leaders (4s) ───
  console.log("[demo] Scene 3: All-time leaders");
  await page.goto(`${URL_BASE}/all-time-leaders`, { waitUntil: "networkidle2", timeout: 30000 });
  await preloadAllImages(page);
  await record(2000);
  // Click the "Career Total Points" tab if present
  try {
    const tabs = await page.$$("button");
    for (const btn of tabs) {
      const text = await page.evaluate((el) => el.textContent || "", btn);
      if (text.includes("生涯总得分") || text.includes("Career Total Points")) {
        await btn.click();
        break;
      }
    }
  } catch { /* OK, fall through */ }
  await record(2000);

  // ─── Scene 4: Navigate to /search and bring focus (4s) ───
  console.log("[demo] Scene 4: Search aliases");
  await page.goto(`${URL_BASE}/search`, { waitUntil: "networkidle2", timeout: 30000 });
  await preloadAllImages(page);
  await record(1000);
  // Type "字母哥" character by character for visible effect
  const input = await page.$("input[type='search'], input[type='text']");
  if (input) {
    await input.click();
    await record(500);
    const text = "字母哥";
    for (const ch of text) {
      await input.type(ch);
      await wait(200);
    }
  }
  await record(2500);

  console.log(`[demo] Done. Total frames: ${frame}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
