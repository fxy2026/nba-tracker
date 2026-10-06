import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import manifest from "@/data/player-box-coverage.json";
import currentEspn from "@/data/espn-player-boxes/manifest.json";
import historical from "@/data/sixers-2024-25/catalog.json";
import { TEAM_META } from "./teams";
import { getLatestCompletedTeamArchiveCoverage, getTeamArchiveCoverage, validatePlayerBoxCoverageManifest } from "./player-box-coverage";
import type { PlayerBoxCoverageManifest } from "./player-box-coverage-contract";
import { buildPlayerBoxCoverageManifest, generatePlayerBoxCoverageManifest, selectCoverageGames } from "../../scripts/recovery/player-box-coverage";
import TeamArchiveCoverage from "@/app/team/[tricode]/_components/TeamArchiveCoverage";

const roots: string[] = [];
const sources = ["provider-player-boxes", "observed-final-games", "recovered-player-boxes", "quarantined-player-boxes", "resolved-player-box-originals", "supplemented-player-box-originals", "player-box-quarantine.json", "schedule-2025-26.json", "resolved-player-box-quarantine.json", "supplemented-player-box-history.json", "archive-game-aliases.json", "season-2025-26-final.json", "recovered-player-box-provenance.json", "recovered-player-boxes.README.md", "espn-player-boxes", "sixers-2024-25"];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "nba-coverage-test-")); roots.push(root);
  for (const name of sources) cpSync(join("src/data", name), join(root, name), { recursive: true });
  return root;
}
function fileHashes(root: string, prefix = ""): Record<string, string> {
  return Object.fromEntries(readdirSync(join(root, prefix), { withFileTypes: true }).flatMap(entry => {
    const path = join(prefix, entry.name);
    return entry.isDirectory() ? Object.entries(fileHashes(root, path)) : [[path, createHash("sha256").update(readFileSync(join(root, path))).digest("hex")]];
  }));
}
afterEach(() => { roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })); vi.unstubAllGlobals(); });

it("rebuilds the same small metadata from active stores without network or source writes", () => {
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No network permitted"); }));
  const root = fixture(), before = fileHashes(root);
  const generated = generatePlayerBoxCoverageManifest(root);
  expect(generated).toEqual(manifest);
  const first = readFileSync(join(root, "player-box-coverage.json"), "utf8"), mtime = statSync(join(root, "player-box-coverage.json")).mtimeMs;
  generatePlayerBoxCoverageManifest(root);
  expect(readFileSync(join(root, "player-box-coverage.json"), "utf8")).toBe(first);
  expect(statSync(join(root, "player-box-coverage.json")).mtimeMs).toBe(mtime);
  const after = fileHashes(root); delete after["player-box-coverage.json"];
  expect(after).toEqual(before);
  expect(Buffer.byteLength(first)).toBeLessThan(100_000);
  expect(fetch).not.toHaveBeenCalled();
});
it("counts each active canonical game once, with exact preserved evidence tiers", () => {
  const current = currentEspn.map(entry => entry.gameId), legacy = historical.games.flatMap(g => g.nbaGameId ? [g.nbaGameId] : []);
  const recovered = readdirSync("src/data/recovered-player-boxes").filter(file => file.endsWith(".json")).map(file => file.slice(0, -5));
  const provider = readdirSync("src/data/provider-player-boxes").filter(file => file.endsWith(".json")).map(file => file.slice(0, -5));
  const unique = new Set([...current, ...legacy, ...recovered, ...provider]);
  expect(manifest.coverage.reduce((sum, row) => sum + row.archivedGames, 0)).toBe(unique.size * 2);
  expect(manifest.coverage.reduce((sum, row) => sum + row.evidence.legacyManualReview, 0)).toBe(4);
  for (const id of ["0022501131", "0022501146"]) { expect(provider).toContain(id); expect(current).toContain(id); }
  const unassigned = provider.filter(id => !current.includes(id) && !recovered.includes(id));
  expect(manifest.coverage.reduce((sum, row) => sum + row.evidence.unassignedProvider, 0)).toBe(unassigned.length * 2);
  expect(manifest.coverage.reduce((sum, row) => sum + row.evidence.espnAssigned, 0)).toBe((current.length + legacy.length) * 2);
});
it("uses canonical-ID priority and rejects identity conflicts", () => {
  const game = { gameId: "0022501131", season: "2025-26", phase: "regular" as const, date: "2026-04-03", home: "PHI", away: "MIN", homeScore: 115, awayScore: 103, partial: false };
  const rows = [{ ...game, tier: "unassignedProvider" as const }, { ...game, tier: "espnAssigned" as const }, { ...game, tier: "recordedReportReview" as const }];
  expect(selectCoverageGames(rows)).toEqual([rows[2]]);
  expect(selectCoverageGames([...rows].reverse())).toEqual([rows[2]]);
  expect(() => selectCoverageGames([rows[0], { ...rows[1], away: "BOS" }])).toThrow("conflicting duplicate");
});
it("selects the same completed season for all 30 teams, independently of the current clock", () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-06T00:00:00Z"));
  try {
    for (const team of Object.keys(TEAM_META)) {
      const result = getLatestCompletedTeamArchiveCoverage(team)!;
      expect(result.season).toBe("2025-26"); expect(result.regular.expectedGames).toBe(82);
      expect(result.playoffs.expectedGames).not.toBeNull();
      for (const row of [result.regular, result.playoffs]) expect(row.teamAssignedGames + row.evidence.unassignedProvider).toBe(row.archivedGames);
    }
  } finally { vi.useRealTimers(); }
});
it("keeps unknown season/phase data distinct from proved zero participation", () => {
  expect(getTeamArchiveCoverage("BKN", "2025-26", "playoffs")?.expectedGames).toBe(0);
  expect(getTeamArchiveCoverage("BOS", "2024-25", "regular")?.expectedGames).toBeNull();
  expect(getTeamArchiveCoverage("PHI", "2024-25", "regular")?.expectedGames).toBe(82);
  expect(getTeamArchiveCoverage("PHI", "2025-26", "play-in")?.expectedGames).toBeNull();
  expect(getTeamArchiveCoverage("PHI", "2026-27", "regular")).toBeNull();
  expect(getTeamArchiveCoverage("PHI", "2024-25", "playoffs")).toBeNull();
  expect(getLatestCompletedTeamArchiveCoverage("BOS", null)).toBeNull();
});
it.each(["__proto__", "UNKNOWN", "../PHI", "phi"])("rejects invalid team lookup %s", team => expect(getTeamArchiveCoverage(team, "2025-26", "regular")).toBeNull());
it.each(["2025-25", "25-26", "2026-27", "2025-26/../../"])("does not fabricate season %s", season => expect(getTeamArchiveCoverage("BOS", season, "regular")).toBeNull());
it.each(["sum", "unassigned", "duplicate", "zero-date", "negative", "unknown-tier", "completion-count", "completion-hash"])("metadata validator fails closed on %s", kind => {
  const raw = structuredClone(manifest), row = raw.coverage.find(r => r.archivedGames > 0)!;
  if (kind === "sum") row.archivedGames++;
  if (kind === "unassigned") row.teamAssignedGames++;
  if (kind === "duplicate") raw.coverage.push(row);
  if (kind === "zero-date") raw.coverage.find(r => r.archivedGames === 0)!.firstGameDate = "2025-11-01";
  if (kind === "negative") row.evidence.espnAssigned = -1;
  if (kind === "unknown-tier") Reflect.set(row.evidence, "official", 1);
  if (kind === "completion-count") raw.completedSeasons[0].playoffGames--;
  if (kind === "completion-hash") raw.completedSeasons[0].scheduleSha256 = "unverified";
  expect(validatePlayerBoxCoverageManifest(raw)).toBeNull();
});
it.each(["nonfinal", "missing-regular-final", "missing-playoff-final"])("will not label an unproven schedule completed: %s", kind => {
  const root = fixture();
  if (kind === "nonfinal") {
    const path = join(root, "schedule-2025-26.json"), schedule = JSON.parse(readFileSync(path, "utf8"));
    const excluded = new Set([...currentEspn.map(e => e.gameId), ...readdirSync(join(root, "recovered-player-boxes")).map(f => f.slice(0, -5)), ...readdirSync(join(root, "provider-player-boxes")).map(f => f.slice(0, -5))]);
    const game = schedule.dates.flatMap((d: { games: { gameId: string; gameStatus: number }[] }) => d.games).find((g: { gameId: string }) => g.gameId.startsWith("002") && !excluded.has(g.gameId));
    game.gameStatus = 1; writeFileSync(path, JSON.stringify(schedule));
  } else {
    const path = join(root, "season-2025-26-final.json"), finals = JSON.parse(readFileSync(path, "utf8"));
    const index = finals.finishedGames.findIndex((g: { gameId: string }) => g.gameId.startsWith(kind === "missing-regular-final" ? "002" : "004"));
    finals.finishedGames.splice(index, 1); writeFileSync(path, JSON.stringify(finals));
  }
  const result = buildPlayerBoxCoverageManifest(root);
  expect(result.completedSeasons).toEqual([]);
  expect(getLatestCompletedTeamArchiveCoverage("BOS", result)).toBeNull();
  expect(result.coverage.find(r => r.team === "BOS" && r.season === "2025-26" && r.phase === "regular")?.expectedGames).toBeNull();
});
it("rejects corrupted compressed manifest evidence without replacing prior output", () => {
  const root = fixture(); generatePlayerBoxCoverageManifest(root);
  const path = join(root, "player-box-coverage.json"), before = readFileSync(path, "utf8");
  const entry = currentEspn[0]; writeFileSync(join(root, "espn-player-boxes", entry.file), "invalid");
  expect(() => generatePlayerBoxCoverageManifest(root)).toThrow("changed ESPN compressed source");
  expect(readFileSync(path, "utf8")).toBe(before);
});
it.each([false, true])("renders a compact, explicit-season, no-percentage panel in each locale (%s)", isZh => {
  const html = renderToStaticMarkup(createElement(TeamArchiveCoverage, { coverage: getLatestCompletedTeamArchiveCoverage("ATL"), isZh }));
  expect(html).toContain("2025–26"); expect(html).not.toContain("2026–27");
  expect(html).toContain("<details"); expect(html).toContain("min-h-11"); expect(html).not.toContain(" open=");
  expect(html).not.toMatch(/100%|PPG|82–0/);
  expect(html.match(/<dt /g)).toHaveLength(2);
  expect(html).toContain(isZh ? "早期人工复核记录" : "Legacy manual reviews");
  expect(html).toContain(isZh ? "没有后续复核使用的逐场报告哈希" : "lack the per-game report hashes");
  expect(html).toContain(isZh ? "球员球队未分配" : "Player teams unassigned");
});
it("renders no-participation and unavailable states without misleading 0/0 or 100%", () => {
  const zero = renderToStaticMarkup(createElement(TeamArchiveCoverage, { coverage: getLatestCompletedTeamArchiveCoverage("BKN"), isZh: false }));
  expect(zero).toContain("No games in the saved schedule"); expect(zero).not.toMatch(/0 of 0|100%/);
  const unavailable = renderToStaticMarkup(createElement(TeamArchiveCoverage, { coverage: null, isZh: false }));
  expect(unavailable).toContain("Completed-season schedule coverage is unavailable"); expect(unavailable).not.toContain("0 games");
  const data = structuredClone(manifest) as PlayerBoxCoverageManifest; data.completedSeasons = [];
  expect(getLatestCompletedTeamArchiveCoverage("LAL", data)).toBeNull();
});
