import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import nextConfig from "../../next.config";
import { historicalScoringFiles } from "./verified-historical-scoring-allowlist";
it("traces every byte-verified server asset into the actual GameImpact route", () => {
  expect(nextConfig.outputFileTracingIncludes?.["/lab/game-impact"]).toEqual(Object.values(historicalScoringFiles).map(file => `./${file.path}`));
  expect(nextConfig.outputFileTracingIncludes?.["/api/player-season-heatmap"]).toContain("./src/data/historical-shot-archive/**/*.gz");
  for (const {path} of Object.values(historicalScoringFiles)) expect(readFileSync(path).length).toBeGreaterThan(0);
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
