import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import catalog from "@/data/player-game-log-archives/manifest.json";
import { getPlayerGameLogArchive } from "./player-game-log-archive";
import { getPlayerGameLogProfile } from "./player-game-log-profile";
import type { PlayerLogStat } from "./player-game-log-data";

vi.mock("server-only", () => ({}));

// Keep the original five-season release byte-for-byte while later career
// captures receive their own independent review and regression coverage.
const seasons = [
  { season: "2018-19", regular: 55, playoffs: 0, preseason: 4, bytes: 18928, sha256: "79dc0df0815d211c5fa6fc543f6821e6937a14600897078513edafbaab02be54" },
  { season: "2019-20", regular: 67, playoffs: 21, preseason: 4, bytes: 26730, sha256: "9221a9d48064575d3e9a5943d0f4a55c9228298df7f4715ef6a3c306fb49d654" },
  { season: "2020-21", regular: 45, playoffs: 6, preseason: 2, bytes: 16841, sha256: "c8517995095cb0b77315d79f791d03c07995d05fed49a4465504045f2faa52f8" },
  { season: "2021-22", regular: 56, playoffs: 0, preseason: 3, bytes: 18872, sha256: "f07288306184a60cf67f98871552203e37ebc7c2cbd966ed3eecfbb5773a8178" },
  { season: "2022-23", regular: 55, playoffs: 16, preseason: 4, bytes: 22766, sha256: "8ad604bad8dbffcb11817213f3f413ade44b8e6c85b17ee9571e6a6f40654f2b" },
] as const;
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected live source request"); })));
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe.each(seasons)("LeBron's recorded $season archive", entry => {
  it("pins exact source bytes and the NBA-to-ESPN identity mapping", () => {
    const matches = catalog.filter(row => row.playerId === 2544 && row.season === entry.season);
    expect(matches).toHaveLength(1);
    const saved = matches[0];
    expect(saved).toMatchObject({
      playerId: 2544,
      espnId: "1966",
      file: `2544-${entry.season}.json.gz`,
      sha256: entry.sha256,
      retrievalPrecision: "exact",
      url: `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/1966/gamelog?season=${Number(entry.season.slice(0, 4)) + 1}`,
    });
    const compressed = readFileSync(`src/data/player-game-log-archives/${saved.file}`);
    const raw = gunzipSync(compressed);
    expect(compressed.byteLength).toBe(entry.bytes);
    // Manifest checksums cover the original decompressed response, not gzip.
    expect(hash(raw)).toBe(entry.sha256);
    expect(raw.byteLength).toBeLessThan(2 * 1024 * 1024);
  });

  it.each([
    ["Regular Season", "regular"],
    ["Playoffs", "playoffs"],
    ["Pre Season", "preseason"],
  ] as const)("keeps %s scoped and null-safe", async (seasonType, countKey) => {
    const data = await getPlayerGameLogArchive(2544, entry.season, seasonType);
    expect(data).not.toBeNull();
    expect(data).toMatchObject({ playerId: 2544, season: entry.season, seasonType, source: { provider: "ESPN", archived: true } });
    expect(data!.rows).toHaveLength(entry[countKey]);
    expect(new Set(data!.rows.map(row => row.id)).size).toBe(entry[countKey]);
    expect(data!.rows.every(row => row.team === "LAL" && row.id.startsWith("espn:")
      && row.nbaGameId === null && row.internalGameId === null
      && row.oreb === null && row.dreb === null && row.plusMinus === null)).toBe(true);
    if (seasonType === "Regular Season") expect(data!.expectedGames).toBe(entry.regular);
    // No independent preseason completeness reference is available.
    if (seasonType === "Pre Season") expect(data!.expectedGames).toBeUndefined();
  });

  it("matches all 13 available regular-season counting totals to the NBA capture", async () => {
    const evidence = readFileSync("docs/evidence/player-career/2544-2026-10-03.json");
    expect(hash(evidence)).toBe("680346925121f1c7b11aafe43b33ed73c9facf324cb02555455e2eee273fb6b8");
    const totals = JSON.parse(evidence.toString("utf8")).totals as { playerId: string; sourceUrl: string; columns: string[]; seasonRows: string[][] };
    expect(String(totals.playerId)).toBe("2544");
    expect(totals.sourceUrl).toBe("https://www.nba.com/stats/player/2544/career?PerMode=Totals");
    const official = totals.seasonRows.filter(row => row[0] === entry.season);
    expect(official).toHaveLength(1);
    const data = await getPlayerGameLogArchive(2544, entry.season, "Regular Season");
    expect(data!.rows).toHaveLength(Number(official[0][totals.columns.indexOf("GP")]));
    const fields: [PlayerLogStat, string][] = [
      ["pts", "PTS"], ["fgm", "FGM"], ["fga", "FGA"], ["fg3m", "3PM"], ["fg3a", "3PA"],
      ["ftm", "FTM"], ["fta", "FTA"], ["reb", "REB"], ["ast", "AST"], ["stl", "STL"],
      ["blk", "BLK"], ["tov", "TOV"], ["pf", "PF"],
    ];
    for (const [key, label] of fields) {
      expect(data!.rows.every(row => row[key] !== null), label).toBe(true);
      expect(data!.rows.reduce((sum, row) => sum + row[key]!, 0), label)
        .toBe(Number(official[0][totals.columns.indexOf(label)]));
    }
  });
});

it("adds 338 source records without reusing phase identities or changing the original batch", async () => {
  const records = (await Promise.all(seasons.flatMap(entry =>
    (["Regular Season", "Playoffs", "Pre Season"] as const).map(type => getPlayerGameLogArchive(2544, entry.season, type))))).flatMap(data => data!.rows);
  expect(records).toHaveLength(338);
  expect(new Set(records.map(row => row.id)).size).toBe(338);
  expect(seasons.reduce((sum, entry) => sum + entry.bytes, 0)).toBe(104137);
  expect((await getPlayerGameLogArchive(2544, "2023-24", "Regular Season"))?.rows).toHaveLength(71);
  const profile = await getPlayerGameLogProfile(2544, { from: 2003, to: 2026 }, "2026-27");
  expect(profile.defaultSeason).toBe("2025-26");
  expect(profile.initialData?.rows).toHaveLength(60);
  expect(profile.seasons).toEqual(expect.arrayContaining(seasons.map(entry => entry.season)));
});

it.each([
  ["2024-25", "b1368fe77602a0dbba92ff2f6920c835d59a2bd9ad8485d72f6fedffd5da97d0", 70, 5],
  ["2025-26", "804e3a587e947ddaf4d9c0f43ef756e2d047547d75a6cbdbdd6a97d9d9f52f3b", 60, 10],
] as const)("preserves the existing %s capture and phase counts", async (season, sha256, regular, playoffs) => {
  const entry = catalog.find(row => row.playerId === 2544 && row.season === season)!;
  expect(entry.sha256).toBe(sha256);
  expect(hash(gunzipSync(readFileSync(`src/data/player-game-log-archives/${entry.file}`)))).toBe(sha256);
  expect((await getPlayerGameLogArchive(2544, season, "Regular Season"))?.rows).toHaveLength(regular);
  expect((await getPlayerGameLogArchive(2544, season, "Playoffs"))?.rows).toHaveLength(playoffs);
});
