import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import catalog from "@/data/player-game-log-archives/manifest.json";
import reviewManifest from "@/data/player-game-log-archives/lebron-review-manifest.json";
import { applyLeBronGameLogReview, reconcileReviewedEspnGameLog, withLeBronGameLogReview } from "./lebron-game-log-review";
import { getPlayerGameLogArchive, getPlayerLogArchiveSeasons } from "./player-game-log-archive";
import { parseEspnPlayerGameLog } from "./espn-player-game-log";
import { normalizePlayerGameLog, type PlayerLogStat } from "./player-game-log-data";
vi.mock("server-only", () => ({}));
vi.mock("node:fs/promises", async original => {
  const fs = await original<typeof import("node:fs/promises")>();
  return { ...fs, readFile: vi.fn(fs.readFile) };
});
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const bytes = (file: string) => gunzipSync(readFileSync(`src/data/player-game-log-archives/${file}`));
const review = () => JSON.parse(bytes(reviewManifest.file).toString());
const source = (season: string, seasonType: "Regular Season" | "Playoffs" | "Pre Season" = "Regular Season") => {
  const entry = catalog.find(row => row.playerId === 2544 && row.season === season)!;
  const raw = JSON.parse(bytes(entry.file).toString());
  return { entry, raw, data: parseEspnPlayerGameLog(raw, { playerId: 2544, season, seasonType }, "1966", entry.retrievedAt, true)! };
};
const counts = [
  ["2003-04",79,0,0],["2004-05",80,0,0],["2005-06",79,13,0],["2006-07",78,20,0],
  ["2007-08",75,13,0],["2008-09",81,14,0],["2009-10",76,11,0],["2010-11",79,21,0],
  ["2011-12",62,23,0],["2012-13",76,23,5],["2013-14",77,20,6],["2014-15",69,20,5],
  ["2015-16",76,21,2],["2016-17",74,18,3],["2017-18",82,22,1],["2018-19",55,0,4],
  ["2019-20",67,21,4],["2020-21",45,6,2],["2021-22",56,0,3],["2022-23",55,16,4],
  ["2023-24",71,5,3],["2024-25",70,5,3],["2025-26",60,10,0],
] as const;
const fields: [PlayerLogStat, string][] = [["pts","PTS"],["fgm","FGM"],["fga","FGA"],["fg3m","3PM"],["fg3a","3PA"],["ftm","FTM"],["fta","FTA"],["reb","REB"],["ast","AST"],["stl","STL"],["blk","BLK"],["tov","TOV"],["pf","PF"]];
beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Archive tests must never fetch"); })));
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe.each(counts)("LeBron career %s", (season, regular, playoffs, preseason) => {
  it.each([["Regular Season",regular],["Playoffs",playoffs],["Pre Season",preseason]] as const)("keeps %s identities, source and counts distinct", async (seasonType, count) => {
    const data = await getPlayerGameLogArchive(2544, season, seasonType);
    expect(data).not.toBeNull();
    expect(data!.rows).toHaveLength(count);
    expect(new Set(data!.rows.map(row => row.id)).size).toBe(count);
    expect(new Set(data!.rows.map(row => row.date)).size).toBe(count);
    expect(data!.rows.every(row => row.sourceProvider !== "StatMuse" || row.internalGameId === null)).toBe(true);
    expect(normalizePlayerGameLog(data, { playerId: 2544, season, seasonType })).toEqual(data);
    if (seasonType === "Regular Season") expect(data!.expectedGames).toBe(regular);
    if (seasonType === "Pre Season") expect(data!.expectedGames).toBeUndefined();
  });
  it("matches all 13 independently captured NBA regular-season totals", async () => {
    const capture = readFileSync("docs/evidence/player-career/2544-2026-10-03.json");
    expect(hash(capture)).toBe("680346925121f1c7b11aafe43b33ed73c9facf324cb02555455e2eee273fb6b8");
    const official = JSON.parse(capture.toString()).totals as { columns: string[]; seasonRows: string[][] };
    const line = official.seasonRows.find(row => row[0] === season)!;
    const data = await getPlayerGameLogArchive(2544, season, "Regular Season");
    expect(data!.rows).toHaveLength(Number(line[official.columns.indexOf("GP")]));
    for (const [key, column] of fields) expect(data!.rows.reduce((sum, row) => sum + row[key]!, 0), `${season} ${column}`).toBe(Number(line[official.columns.indexOf(column)].replaceAll(",", "")));
  });
});

it("pins review integrity, all 23 seasons and 1,924 distinct regular/playoff appearances", async () => {
  expect(hash(bytes(reviewManifest.file))).toBe(reviewManifest.sha256);
  expect(getPlayerLogArchiveSeasons(2544)).toHaveLength(23);
  const all = (await Promise.all(counts.flatMap(([season]) => (["Regular Season", "Playoffs"] as const).map(type => getPlayerGameLogArchive(2544, season, type))))).flatMap(data => data!.rows);
  expect(all).toHaveLength(1924);
  expect(new Set(all.map(row => row.id)).size).toBe(1924);
  expect(counts.reduce((sum, row) => sum + row[1], 0)).toBe(1622);
  expect(counts.reduce((sum, row) => sum + row[2], 0)).toBe(302);
  expect(all.filter(row => row.sourceProvider === "StatMuse")).toHaveLength(46);
  expect(all.filter(row => row.historicalIdentity)).toHaveLength(55);
  expect(all.filter(row => row.assistReview)).toHaveLength(1);
});

it.each(reviewManifest.seasons)("keeps %s ESPN evidence and every untouched statistic intact", async season => {
  for (const phase of ["Regular Season", "Playoffs", "Pre Season"] as const) {
    const { entry, data: original } = source(season, phase);
    expect(hash(bytes(entry.file))).toBe(entry.sha256);
    const data = await getPlayerGameLogArchive(2544, season, phase);
    expect(data).not.toBeNull();
    for (const row of original.rows) {
      const saved = data!.rows.find(item => item.id === row.id)!;
      expect(saved).toBeDefined();
      for (const [key] of fields) expect(saved[key]).toBe(key === "ast" && row.id === "espn:400489766" ? 4 : row[key]);
      expect(saved.min).toBe(row.min);
      expect(saved.nbaGameId).toBeNull();
      expect(saved.internalGameId).toBeNull();
      expect(saved.sourceUrl).toBe(row.sourceUrl);
      expect(saved.oreb).toBeNull();
      expect(saved.dreb).toBeNull();
      expect(saved.plusMinus).toBeNull();
    }
  }
});

it("verifies all 46 recovered rows against unchanged numeric source tables", async () => {
  const manifests = JSON.parse(readFileSync("docs/evidence/player-game-log/statmuse-manifest.json", "utf8"));
  const map: Record<string,string> = { min:"MIN",pts:"PTS",reb:"REB",ast:"AST",stl:"STL",blk:"BLK",fgm:"FGM",fga:"FGA",fg3m:"3PM",fg3a:"3PA",ftm:"FTM",fta:"FTA",oreb:"OREB",dreb:"DREB",tov:"TOV",pf:"PF",plusMinus:"+/-" };
  let recovered = 0;
  for (const entry of manifests) {
    const compressed = readFileSync(`docs/evidence/player-game-log/${entry.tablesFile}`);
    expect(hash(compressed)).toBe(entry.tablesGzipSha256);
    const raw = gunzipSync(compressed);
    expect(hash(raw)).toBe(entry.tablesUncompressedSha256);
    const tables = JSON.parse(raw.toString());
    for (const type of ["Regular Season","Playoffs"] as const) {
      const data = await getPlayerGameLogArchive(2544, entry.season, type);
      for (const row of data!.rows.filter(row => row.sourceProvider === "StatMuse")) {
        const matches = tables.flatMap((table: { rows: Record<string, { value: string | number }>[] }) => table.rows).filter((item: Record<string, { value: string | number }>) => String(item.DATE.value).slice(0,10) === row.date);
        expect(matches).toHaveLength(1);
        expect(matches[0].TM.value).toBe(row.team);
        expect(matches[0].OPP.value).toBe(row.opponent);
        expect(matches[0].ALIGNMENT.value).toBe(row.home ? "vs" : "@");
        for (const [key, sourceKey] of Object.entries(map)) expect(row[key as PlayerLogStat]).toBe(matches[0][sourceKey].value);
        expect(row.sourceUrl).toBe(entry.sourceUrl);
        expect(row.id).toBe(`statmuse:lebron-${entry.season}-${type === "Playoffs" ? "playoffs" : "regular"}-${row.date}`);
        expect(row.nbaGameId).toMatch(type === "Playoffs" ? /^004\d{7}$/ : /^002\d{7}$/);
        expect(row.internalGameId).toBeNull();
        recovered++;
      }
    }
  }
  expect(recovered).toBe(46);
});

it("fails closed on wrong player, hash, phase, alias, supplement identity or counting totals", () => {
  const { data, entry } = source("2003-04");
  expect(applyLeBronGameLogReview(data, review(), "0".repeat(64))).toBeNull();
  expect(applyLeBronGameLogReview({ ...data, playerId: 1 }, review(), entry.sha256)).toBeNull();
  for (const mutate of [
    (r: ReturnType<typeof review>) => { r.seasons[0].phases[0].seasonType = "Playoffs"; },
    (r: ReturnType<typeof review>) => { r.seasons[0].phases[0].aliases[0].date = "2003-01-01"; },
    (r: ReturnType<typeof review>) => { r.seasons[0].phases[0].aliases[0].nbaGameId = "0040300001"; },
    (r: ReturnType<typeof review>) => { r.seasons[0].phases[0].totals.ast++; },
  ]) { const changed = review(); mutate(changed); expect(applyLeBronGameLogReview(data, changed, entry.sha256)).toBeNull(); }
  const recovered = source("2012-13");
  for (const field of ["nbaGameId", "sourceUrl", "id"] as const) {
    const changed = review(); const phase = changed.seasons.find((r: { season: string }) => r.season === "2012-13").phases[0];
    phase.supplements[0][field] = field === "nbaGameId" ? "0041200001" : field === "id" ? recovered.data.rows[0].id : "https://evil.example/data";
    expect(applyLeBronGameLogReview(recovered.data, changed, recovered.entry.sha256)).toBeNull();
  }
});

it("excludes only the exact reviewed Cup final from regular stats in archives and fresh ESPN data", () => {
  const { raw, data } = source("2023-24");
  expect(data.rows).toHaveLength(71);
  expect(data.rows.some(row => row.id === "espn:401607495")).toBe(false);
  const fresh = parseEspnPlayerGameLog(raw, data, "1966", "2026-10-06T12:00:00Z");
  expect(fresh!.rows).toHaveLength(71);
  raw.events["401607495"].opponent.id = "12";
  expect(parseEspnPlayerGameLog(raw, data, "1966", "2026-10-06T12:00:00Z")).toBeNull();
});

it("retains the explicitly limited assist reconciliation on a larger valid refresh", async () => {
  const { data } = source("2013-14");
  const archive = (await getPlayerGameLogArchive(2544, "2013-14", "Regular Season"))!;
  const fresh = { ...data, source: { ...data.source, archived: false }, rows: [...data.rows, { ...data.rows[0], id: "espn:999999999", date: "2014-04-17" }] };
  const reconciled = reconcileReviewedEspnGameLog(fresh, archive)!;
  expect(reconciled.rows).toHaveLength(78);
  expect(reconciled.rows.find(row => row.id === "espn:400489766")).toMatchObject({ ast: 4, assistReview: { sourceValue: 5, reviewedValue: 4, basis: "season-total-reconciliation" } });
  expect(reconciled.source).toMatchObject({ archived: false, provider: "ESPN + StatMuse", reviewed: true });
  fresh.rows.find(row => row.id === "espn:400489766")!.ast = 6;
  expect(reconcileReviewedEspnGameLog(fresh, archive)).toBeNull();
});

it("deduplicates a recovered game only when the new ESPN identity and counting stats agree", async () => {
  const { data } = source("2012-13");
  const archive = (await getPlayerGameLogArchive(2544, "2012-13", "Regular Season"))!;
  const recovered = archive.rows.find(row => row.sourceProvider === "StatMuse")!;
  const addition = { ...recovered, id: "espn:999999999", sourceProvider: "ESPN" as const, nbaGameId: null, sourceUrl: "https://www.espn.com/nba/boxscore/_/gameId/999999999" };
  const fresh = { ...data, rows: [...data.rows, addition] };
  const reconciled = reconcileReviewedEspnGameLog(fresh, archive)!;
  expect(reconciled.rows).toHaveLength(76);
  expect(reconciled.rows.filter(row => row.sourceProvider === "StatMuse")).toHaveLength(6);
  addition.pts!++;
  expect(reconcileReviewedEspnGameLog(fresh, archive)).toBeNull();
});

it("rejects a corrupted review gzip or digest before applying any deltas", async () => {
  const fs = await import("node:fs/promises");
  const { data, entry } = source("2012-13");
  const read = vi.mocked(fs.readFile);
  read.mockResolvedValueOnce(gzipSync(JSON.stringify({ ...review(), playerId: 1 })));
  expect(await withLeBronGameLogReview(data, entry.sha256)).toBeNull();
  read.mockResolvedValueOnce(Buffer.from("not a gzip"));
  expect(await withLeBronGameLogReview(data, entry.sha256)).toBeNull();
});

it("rejects mislabeled source provenance, invented record keys and fake internal links", async () => {
  const data = (await getPlayerGameLogArchive(2544, "2012-13", "Regular Season"))!;
  expect(normalizePlayerGameLog({ ...data, source: { ...data.source, provider: "ESPN" } }, data)).toBeNull();
  for (const change of [{ id: "statmuse:59572" }, { internalGameId: "0021200286" }, { sourceUrl: "https://www.statmuse.com/nba/player/another-player/game-log?seasonYear=2013" }]) {
    const bad = structuredClone(data);
    Object.assign(bad.rows.find(row => row.sourceProvider === "StatMuse")!, change);
    expect(normalizePlayerGameLog(bad, data)).toBeNull();
  }
});

it("does not discard reviewed counting values for an incomplete replacement in a larger refresh", async () => {
  const { data } = source("2012-13");
  const archive = (await getPlayerGameLogArchive(2544, "2012-13", "Regular Season"))!;
  const saved = archive.rows.find(row => row.sourceProvider === "StatMuse")!;
  const fresh = { ...data, rows: [...data.rows,
    { ...saved, id: "espn:999999991", sourceProvider: "ESPN" as const, nbaGameId: null, sourceUrl: "https://www.espn.com/nba/boxscore/_/gameId/999999991", ast: null },
    { ...data.rows[0], id: "espn:999999992", date: "2013-04-18" },
  ] };
  expect(reconcileReviewedEspnGameLog(fresh, archive)).toBeNull();
});
