import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { expect, it } from "vitest";
import nextConfig from "../../next.config";
import { historicalScoringFiles } from "./verified-historical-scoring-allowlist";
it("traces every byte-verified server asset into the actual GameImpact route", () => {
  expect(nextConfig.outputFileTracingIncludes?.["/lab/game-impact"]).toEqual(Object.values(historicalScoringFiles).map(file => `./${file.path}`));
  expect(nextConfig.outputFileTracingIncludes?.["/api/player-season-heatmap"]).toContain("./src/data/historical-shot-archive/**/*.gz");
  for (const {path} of Object.values(historicalScoringFiles)) expect(readFileSync(path).length).toBeGreaterThan(0);
});
it("keeps literal filesystem paths aligned with the four reviewed assets", () => {
  const loader = readFileSync("src/lib/verified-historical-scoring.ts", "utf8");
  const literalPaths = [...loader.matchAll(/join\(process\.cwd\(\), "([^"]+)"\)/g)].map(match => match[1]);
  expect(literalPaths).toEqual(Object.values(historicalScoringFiles).map(file => file.path));
  expect(loader.match(/join\(process\.cwd\(\),/g)).toHaveLength(4);
});
// Run after `npm run build` with VERIFY_GAME_IMPACT_TRACE=1. A normal unit-test
// run must not inspect a stale or missing production artifact.
it.runIf(process.env.VERIFY_GAME_IMPACT_TRACE === "1")("ships the four reviewed assets without repository-wide output tracing", () => {
  const tracePath = resolve(".next/server/app/lab/game-impact/page.js.nft.json");
  const trace = JSON.parse(readFileSync(tracePath, "utf8")) as { files: string[] };
  // Automatic tracing and explicit includes may spell the same file differently.
  const files = [...new Set(trace.files.map(file => relative(process.cwd(), resolve(dirname(tracePath), file)).replaceAll("\\", "/")))];
  const assets: string[] = Object.values(historicalScoringFiles).map(file => file.path);
  expect(files.filter(file => file.startsWith("src/")).sort()).toEqual([...assets].sort());
  expect(files.filter(file => !file.startsWith(".next/") && !file.startsWith("node_modules/") &&
    !assets.includes(file) && file !== "package.json")).toEqual([]);
});
it("the client chart receives narrow series instead of imported archive modules or source rows", () => {
  const chart = readFileSync("src/app/lab/game-impact/TakeoverChart.tsx", "utf8");
  expect(chart).not.toMatch(/verified-historical-scoring|verified-play-by-play|node:fs|node:crypto/);
  const loader = readFileSync("src/lib/verified-historical-scoring.ts", "utf8");
  expect(loader).not.toMatch(/import.*\.json/); expect(loader).toContain('JSON.parse(bytes.toString("utf8"))');
  const page = readFileSync("src/app/lab/game-impact/page.tsx", "utf8");
  expect(page).toContain("<TakeoverChart series={series} quarterStarts={quarterStarts} steps={totalSteps} />");
  expect(page).not.toContain("historical.rows");
});
