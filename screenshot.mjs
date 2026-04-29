import puppeteer from "puppeteer";
import { mkdir } from "fs/promises";

const BASE = "https://nba.xpy.me";
const OUT = "./article-images";
await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: null,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

/** Wait until page is truly idle */
async function waitForFullLoad(page, extra = 4000) {
  // 1. Wait for all images
  await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img"));
    return Promise.all(imgs.map((img) =>
      img.complete ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r; setTimeout(r, 8000); })
    ));
  }).catch(() => {});

  // 2. Wait for loading skeletons to go away (poll, max 10s)
  for (let i = 0; i < 20; i++) {
    const hasSkeletons = await page.evaluate(() =>
      document.querySelectorAll("[class*='animate-pulse']").length > 0
    ).catch(() => false);
    if (!hasSkeletons) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  // 3. Extra settle time for lazy-loaded client components
  await new Promise((r) => setTimeout(r, extra));
}

async function shot(page, path, opts = {}) {
  const { scroll, fullPage } = opts;
  if (scroll != null) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), scroll);
    await page.evaluate(() => new Promise((r) => setTimeout(r, 800)));
  }
  await page.screenshot({ path, type: "png", fullPage: !!fullPage });
  console.log(`  -> ${path}`);
}

async function capture(label, fn) {
  console.log(label);
  try {
    await fn();
  } catch (e) {
    console.error(`  !! FAILED: ${e.message}`);
  }
}

// ===== Find a recent game with Final status =====
console.log("Finding a recent finished game...");
let gameId = null;
{
  const p = await browser.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  for (let i = 1; i <= 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    try {
      await p.goto(`${BASE}?date=${ds}`, { waitUntil: "networkidle2", timeout: 90000 });
      await waitForFullLoad(p, 1000);
      const id = await p.evaluate(() => {
        const cards = Array.from(document.querySelectorAll("a[href*='/game/']"));
        for (const c of cards) {
          if (c.textContent.includes("Final")) return c.getAttribute("href").replace("/game/", "");
        }
        return cards[0]?.getAttribute("href")?.replace("/game/", "") || null;
      });
      if (id) { gameId = id; console.log(`  Found game ${gameId} on ${ds}`); break; }
    } catch (e) {
      console.log(`  Skip ${ds}: ${e.message}`);
    }
  }
  await p.close();
}

// ===== 1. Desktop Homepage =====
await capture("1. Desktop Homepage", async () => {
  const dp = await browser.newPage();
  await dp.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await dp.goto(BASE, { waitUntil: "networkidle2", timeout: 90000 });
  await waitForFullLoad(dp, 4000);
  await shot(dp, `${OUT}/01-homepage-desktop.png`);
  await shot(dp, `${OUT}/01b-homepage-scroll.png`, { scroll: 650 });
  await dp.close();
});

// ===== 2. Mobile Homepage =====
await capture("2. Mobile Homepage", async () => {
  const mp = await browser.newPage();
  await mp.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 });
  await mp.goto(BASE, { waitUntil: "networkidle2", timeout: 90000 });
  await waitForFullLoad(mp, 4000);
  await shot(mp, `${OUT}/02-homepage-mobile.png`);
  await mp.close();
});

// ===== 3. Game Detail =====
if (gameId) {
  await capture("3. Game Detail — " + gameId, async () => {
    const gp = await browser.newPage();
    await gp.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await gp.goto(`${BASE}/game/${gameId}`, { waitUntil: "networkidle2", timeout: 90000 });
    await waitForFullLoad(gp, 5000);
    await shot(gp, `${OUT}/03-game-scoreboard.png`);
    await shot(gp, `${OUT}/03b-game-boxscore.png`, { scroll: 700 });
    await shot(gp, `${OUT}/03c-game-shotchart.png`, { scroll: 1400 });
    await shot(gp, `${OUT}/03d-game-playbybplay.png`, { scroll: 2800 });
    await shot(gp, `${OUT}/03e-game-full.png`, { scroll: 0, fullPage: true });
    await gp.close();
  });

  await capture("3b. Game Detail Mobile", async () => {
    const gm = await browser.newPage();
    await gm.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 });
    await gm.goto(`${BASE}/game/${gameId}`, { waitUntil: "networkidle2", timeout: 90000 });
    await waitForFullLoad(gm, 5000);
    await shot(gm, `${OUT}/10-game-mobile.png`);
    await gm.close();
  });
}

// ===== 4. Standings =====
await capture("4. Standings", async () => {
  const sp = await browser.newPage();
  await sp.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await sp.goto(`${BASE}/standings`, { waitUntil: "networkidle2", timeout: 90000 });
  await waitForFullLoad(sp, 4000);
  await shot(sp, `${OUT}/04-standings.png`);
  await sp.close();
});

// ===== 5. Player =====
await capture("5. Player — LeBron", async () => {
  const pp = await browser.newPage();
  await pp.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await pp.goto(`${BASE}/player/2544`, { waitUntil: "networkidle2", timeout: 120000 });
  await waitForFullLoad(pp, 5000);
  await shot(pp, `${OUT}/05-player-header.png`);
  await shot(pp, `${OUT}/05b-player-stats.png`, { scroll: 600 });
  await pp.close();
});

// ===== 6. Stats =====
await capture("6. Stats", async () => {
  const stp = await browser.newPage();
  await stp.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await stp.goto(`${BASE}/stats`, { waitUntil: "networkidle2", timeout: 120000 });
  await waitForFullLoad(stp, 5000);
  await shot(stp, `${OUT}/06-stats.png`);
  await stp.close();
});

// ===== 7. Calendar =====
await capture("7. Calendar", async () => {
  const cp = await browser.newPage();
  await cp.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await cp.goto(`${BASE}/calendar`, { waitUntil: "networkidle2", timeout: 90000 });
  await waitForFullLoad(cp, 4000);
  await shot(cp, `${OUT}/07-calendar.png`);
  await cp.close();
});

// ===== 8. Injuries =====
await capture("8. Injuries", async () => {
  const ip = await browser.newPage();
  await ip.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await ip.goto(`${BASE}/injuries`, { waitUntil: "networkidle2", timeout: 90000 });
  await waitForFullLoad(ip, 4000);
  await shot(ip, `${OUT}/08-injuries.png`);
  await ip.close();
});

// ===== 9. Search =====
await capture("9. Search — Curry", async () => {
  const srp = await browser.newPage();
  await srp.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await srp.goto(`${BASE}/search`, { waitUntil: "networkidle2", timeout: 90000 });
  await waitForFullLoad(srp, 3000);
  const input = await srp.waitForSelector("input", { timeout: 8000 }).catch(() => null);
  if (input) {
    await input.type("Curry", { delay: 100 });
    await srp.evaluate(() => new Promise((r) => setTimeout(r, 3000)));
  }
  await shot(srp, `${OUT}/09-search.png`);
  await srp.close();
});

// ===== 11. Team =====
await capture("11. Team — Lakers", async () => {
  const tp = await browser.newPage();
  await tp.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await tp.goto(`${BASE}/team/LAL`, { waitUntil: "networkidle2", timeout: 90000 });
  await waitForFullLoad(tp, 4000);
  await shot(tp, `${OUT}/11-team.png`);
  await tp.close();
});

// ===== 12. History =====
await capture("12. History", async () => {
  const hp = await browser.newPage();
  await hp.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await hp.goto(`${BASE}/history`, { waitUntil: "networkidle2", timeout: 90000 });
  await waitForFullLoad(hp, 3000);
  await shot(hp, `${OUT}/12-history.png`);
  await hp.close();
});

await browser.close();
console.log("\nDone! All screenshots saved to ./article-images/");
