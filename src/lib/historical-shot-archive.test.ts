import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import index from "@/data/historical-shot-archive/catalog-index.json";
import { createHistoricalShotArchiveStore, getHistoricalShotCatalog, getHistoricalShotPlayer, loadHistoricalShotArchive, projectHistoricalShotSummary, searchHistoricalShotPlayers } from "./historical-shot-archive";
import { getPlayerSeasonHeatmapCatalog, loadPlayerSeasonHeatmapArchive } from "./season-heatmap-catalog-server";
import { decodeSeasonHeatmapResource } from "./season-heatmap-client";
import { loadSeasonHeatmapArchive } from "./verified-season-heatmap-archive";
import type { HeatmapIdentity } from "./season-heatmap";

const root = path.join(process.cwd(), "src/data/historical-shot-archive");
const current: HeatmapIdentity = { playerId: 203507, season: "2025-26", seasonType: "Regular Season" };
const read = (file: string) => readFileSync(path.join(root, file));
const summary = (season = "2025-26", type = "regular") => JSON.parse(gunzipSync(read(`summaries/${season}-${type}.json.gz`)).toString());
const rawCurrent = summary();
const fixture = () => structuredClone(rawCurrent);

function testStore(mutate: (file: string, data: Buffer) => Buffer = (_, data) => data) {
  const reader = vi.fn(async (file: string) => mutate(file, read(file)));
  return { store: createHistoricalShotArchiveStore(index, reader), reader };
}

describe("historical shooting archive server boundary", () => {
  it("ships all 60 pinned packs with only source-backed player seasons", async () => {
    expect(index.stagedArchiveCount).toBe(60);
    expect(index.playerCount).toBe(2840);
    expect(index.summaries.map(row => row.season).sort()[0]).toBe("1996-97");
    expect(index.summaries.map(row => row.season).sort().at(-1)).toBe("2025-26");
    const search = await searchHistoricalShotPlayers("", 1);
    expect(search).toMatchObject({ status: "ready", total: 2840, page: 1, pageSize: 48, seasonCount: 30, archiveCount: 60 });
    if (search.status === "ready") expect(search.players).toHaveLength(48);
  });

  it("verifies every bundled compressed digest and projects each season/type with the strict client decoder", () => {
    let attempts = 0, identities = 0;
    for (const entry of index.summaries) {
      const bytes = read(entry.file);
      expect(bytes.length).toBe(entry.compressedBytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
      const raw = JSON.parse(gunzipSync(bytes).toString());
      attempts += raw.league.fga;
      identities += Object.keys(raw.players).length;
      const playerId = Number(Object.keys(raw.players)[0]);
      const identity: HeatmapIdentity = { playerId, season: entry.season, seasonType: entry.seasonType as HeatmapIdentity["seasonType"] };
      const projected = projectHistoricalShotSummary(raw, identity);
      expect(projected, entry.file).not.toBeNull();
      const resource = { status: "ready", data: projected };
      expect(decodeSeasonHeatmapResource(resource, identity), entry.file).toEqual(resource);
      expect(Buffer.byteLength(JSON.stringify(resource))).toBeLessThan(16000);
    }
    expect(attempts).toBe(6328070);
    expect(identities).toBe(20421);
  });

  it("projects all 20,421 player-season/type records without dropping control mismatches", () => {
    let visited = 0, matches = 0, mismatches = 0;
    for (const entry of index.summaries) {
      const raw = JSON.parse(gunzipSync(read(entry.file)).toString());
      for (const playerId of Object.keys(raw.players)) {
        const identity: HeatmapIdentity = { playerId: Number(playerId), season: entry.season, seasonType: entry.seasonType as HeatmapIdentity["seasonType"] };
        const projected = projectHistoricalShotSummary(raw, identity);
        if (!projected) throw new Error(`Rejected ${playerId} ${entry.file}`);
        if (decodeSeasonHeatmapResource({ status: "ready", data: projected }, identity).status !== "ready") throw new Error(`Client rejected ${playerId} ${entry.file}`);
        expect(projected.totals).toEqual({ fgm: raw.players[playerId].fgm, fga: raw.players[playerId].fga });
        matches += projected.archive?.coverageStatus === "official-shooting-totals-match" ? 1 : 0;
        mismatches += projected.archive?.coverageStatus === "official-shooting-totals-mismatch" ? 1 : 0;
        visited++;
      }
    }
    expect(visited).toBe(20421); expect(matches).toBe(56); expect(mismatches).toBe(6);
  }, 120000);

  it("does not infer point value from 14-zone boundaries in a synthetic shortened-line season", () => {
    const raw = fixture(), identity: HeatmapIdentity = { ...current, season: "1996-97" };
    raw.season = identity.season; raw.seasonStartYear = 1996;
    raw.provenance.sourceUrl = raw.provenance.sourceUrl.replace("2025.tar", "1996.tar");
    raw.quality.minGameDate = "1996-11-01"; raw.quality.maxGameDate = "1996-11-01";
    raw.quality.csvRows = 3; raw.quality.playersWithShots = 1; raw.quality.shotBearingGames = 1;
    const zones = Object.fromEntries(raw.zoneOrder.map((key: string) => [key, { fgm: 0, fga: 0, fg3m: 0, fg3a: 0 }]));
    zones["Center(C) | 16-24 ft."] = { fgm: 1, fga: 2, fg3m: 1, fg3a: 2 };
    zones["Center(C) | 24+ ft."] = { fgm: 1, fga: 1, fg3m: 0, fg3a: 0 };
    const block = { fgm: 2, fga: 3, fg3m: 1, fg3a: 2, shotBearingGames: 1, zones, residualZones: [] };
    raw.league = block;
    raw.players = { [identity.playerId]: { ...block, playerId: String(identity.playerId), officialGp: null, officialControl: null, coverageStatus: "not-officially-reconciled" } };
    const projected = projectHistoricalShotSummary(raw, identity)!;
    expect(projected).not.toBeNull();
    expect(projected.zones.find(row => row.id === "center-16-24")).toMatchObject({ fgm: 1, fga: 2, fg3m: 1, fg3a: 2 });
    expect(projected.zones.find(row => row.id === "center-24-plus")).toMatchObject({ fgm: 1, fga: 1, fg3m: 0, fg3a: 0 });
    expect(decodeSeasonHeatmapResource({ status: "ready", data: projected }, identity).status).toBe("ready");
  });

  it("uses court counts by default while preserving official Curry source facts and deduplicating catalogs", async () => {
    for (const season of ["2025-26", "2015-16"]) {
      const identity: HeatmapIdentity = { playerId: 201939, season, seasonType: "Regular Season" };
      expect(await loadPlayerSeasonHeatmapArchive(identity)).toMatchObject({ status: "ready", data: { geometryVersion: "nba-court-basic12-v1", status: "archive-summary", totals: { fga: season === "2015-16" ? 1596 : 799 } } });
      expect(loadSeasonHeatmapArchive(identity)).toMatchObject({ status: "ready", data: { status: "verified-aggregate", totals: { fga: season === "2015-16" ? 1598 : 799 } } });
    }
    const raw = await loadHistoricalShotArchive({ playerId: 201939, season: "2015-16", seasonType: "Regular Season" });
    expect(raw).toMatchObject({ status: "ready", data: { status: "archive-summary", totals: { fgm: 804, fga: 1596 }, archive: { fg3m: 401, fg3a: 884, coverageStatus: "official-shooting-totals-mismatch" } } });
    const catalog = await getPlayerSeasonHeatmapCatalog(201939);
    expect(catalog[0]).toEqual({ playerId: 201939, season: "2025-26", seasonType: "Regular Season", availability: "available" });
    expect(new Set(catalog.map(row => `${row.season}:${row.seasonType}`)).size).toBe(catalog.length);
    expect(catalog).toContainEqual({ playerId: 201939, season: "2015-16", seasonType: "Playoffs", availability: "available" });
    expect(Buffer.byteLength(JSON.stringify(catalog))).toBeLessThan(7000);
  });

  it("retains 35 shot-bearing games separately from Giannis's 36 official GP and normalized true dates", async () => {
    const resource = await loadHistoricalShotArchive(current);
    expect(resource).toMatchObject({ status: "ready", data: { totals: { fgm: 373, fga: 598 }, archive: { shotBearingGames: 35, officialGp: 36, coverageStatus: "official-shooting-totals-match", sourceCoverage: { from: "2025-10-21", to: "2026-04-12" }, metadataObservedAtUtc: "2026-10-03T10:47:00.000Z" }, source: { capturedAtUtc: "2026-10-03T09:45:03.679Z" } } });
    if (resource.status !== "ready") return;
    expect(resource.data.coverage.aggregate).toBe("archive-source-only");
    expect(resource.data.benchmark).toMatchObject({ kind: "weighted-archive-counts-not-official-displayed-LA", season: "2025-26", seasonType: "Regular Season", leagueFgm: 103227, leagueFga: 219160, shotBearingGames: 1230 });
    expect(Object.isFrozen(resource)).toBe(true);
    expect(Object.isFrozen(resource.data.archive)).toBe(true);
    expect(Object.isFrozen(resource.data.zones[0])).toBe(true);
    expect(await loadHistoricalShotArchive(current)).toBe(resource);
  });

  it("uses explicit 3P fields even when distance zones contradict point value", () => {
    const raw = fixture();
    const playerId = Object.keys(raw.players).find(id => Object.entries(raw.players[id].zones).some(([key, value]) => {
      const v = value as { fga: number; fg3a: number };
      return key.includes("24+ ft.") ? v.fga !== v.fg3a : v.fg3a > 0;
    }));
    expect(playerId).toBeDefined();
    const id = { ...current, playerId: Number(playerId) }, result = projectHistoricalShotSummary(raw, id)!;
    expect(result).not.toBeNull();
    expect(result.archive?.fg3a).toBe(raw.players[playerId!].fg3a);
    const rows = [...result.zones, ...result.residuals];
    expect(rows.reduce((sum, row) => sum + (row.fg3a ?? 0), 0)).toBe(result.archive?.fg3a);
    for (const row of result.zones) expect(row.fg3a).toBe(raw.players[playerId!].zones[row.sourceZoneId].fg3a);
    // A short historical three-point line does not change region counts or synthesize positions.
    const historical = summary("2005-06");
    const historicalId = Number(Object.keys(historical.players)[0]);
    expect(projectHistoricalShotSummary(historical, { ...current, playerId: historicalId, season: "2005-06" })?.archive?.fg3a).toBe(historical.players[historicalId].fg3a);
  });

  it("retains residuals in the full denominator and source-specific weighted comparison", () => {
    const raw = summary("2015-16"), identity: HeatmapIdentity = { ...current, playerId: 201939, season: "2015-16" };
    const result = projectHistoricalShotSummary(raw, identity)!;
    expect(result.residuals.reduce((sum, row) => sum + row.fga, 0)).toBe(12);
    expect(result.coverage).toMatchObject({ normalZoneAttempts: 1584, residualAttempts: 12, seasonAttemptDenominator: 1596 });
    expect(result.residuals[0]).toMatchObject({ id: "backcourt", fg3m: 3, fg3a: 12 });
    for (const row of [...result.zones, ...result.residuals]) expect(row.attemptShare).toBe(row.fga / 1596);
    const zone = result.zones[0], league = raw.league.zones[zone.sourceZoneId];
    expect(zone.leagueAverage).toMatchObject({ provenance: "weighted-archive-counts-not-official-displayed-LA", leagueFgm: league.fgm, leagueFga: league.fga });
  });

  it("keeps genuine zero-attempt zones neutral and missing seasons unavailable", async () => {
    const result = await loadHistoricalShotArchive({ ...current, playerId: 203999 });
    expect(result.status).toBe("ready");
    for (const identity of [{ ...current, playerId: 999999999 }, { ...current, season: "1996-97" }, { ...current, season: "2004-05" }, { ...current, season: "2005-06" }]) expect(await loadHistoricalShotArchive(identity)).toEqual({ status: "unavailable" });
    const raw = summary("2005-06");
    const id = Object.keys(raw.players).find(id => Object.values(raw.players[id].zones).some(value => (value as { fga: number }).fga === 0))!;
    const projected = projectHistoricalShotSummary(raw, { ...current, playerId: Number(id), season: "2005-06" })!;
    expect(projected.zones.filter(row => row.fga === 0).length).toBeGreaterThan(0);
    for (const row of projected.zones.filter(row => row.fga === 0)) expect(row).toMatchObject({ fgm: 0, fg3m: 0, fg3a: 0, fgPct: null, fgPctDisplay: null, status: "no-attempts" });
  });

  it("never double counts multi-team/TOT splits", () => {
    const raw = fixture(), id = Object.keys(raw.players).find(id => raw.players[id].teams.length > 1)!;
    expect(id).toBeDefined();
    const result = projectHistoricalShotSummary(raw, { ...current, playerId: Number(id) })!;
    expect(result.totals).toEqual({ fgm: raw.players[id].fgm, fga: raw.players[id].fga });
    expect(raw.players[id].teams.every((team: { teamId: string }) => team.teamId !== "TOT")).toBe(true);
    expect(result.zones.reduce((sum, row) => sum + row.fga, 0) + result.residuals.reduce((sum, row) => sum + row.fga, 0)).toBe(raw.players[id].fga);
  });

  it("bounds directory responses, normalizes search, and provides older players absent current index", async () => {
    expect(await getHistoricalShotPlayer(977)).toMatchObject({ playerId: 977, name: "Kobe Bryant", firstSeason: "1996-97", lastSeason: "2015-16" });
    expect(await getHistoricalShotPlayer(999999999)).toBeNull();
    expect(await getHistoricalShotCatalog(999999999)).toEqual([]);
    expect(await searchHistoricalShotPlayers("Kobe Bryant", 999)).toMatchObject({ status: "ready", page: 1, total: 1, players: [{ playerId: 977 }] });
    expect(await searchHistoricalShotPlayers("no player matches qzxj", -1)).toMatchObject({ status: "ready", page: 1, total: 0, players: [] });
    expect(await searchHistoricalShotPlayers("OG Anunoby", 1)).toMatchObject({ status: "ready", total: 1, players: [{ playerId: 1628384 }] });
    expect(await searchHistoricalShotPlayers("Nikola Jokić", 1)).toMatchObject({ status: "ready", total: 1, players: [{ playerId: 203999 }] });
    expect(await searchHistoricalShotPlayers("977", 1)).toMatchObject({ status: "ready", total: 1 });
  });

  it.each(["wrong player", "wrong season", "wrong type", "bad zone", "invalid 3P", "invalid dates", "wrong source", "bad control", "league counts"])("fails closed for %s", corruption => {
    const raw = fixture();
    if (corruption === "wrong player") raw.players[current.playerId].playerId = "2544";
    if (corruption === "wrong season") raw.season = "2024-25";
    if (corruption === "wrong type") raw.seasonType = "Playoffs";
    if (corruption === "bad zone") delete raw.players[current.playerId].zones[raw.zoneOrder[0]];
    if (corruption === "invalid 3P") raw.players[current.playerId].fg3a = raw.players[current.playerId].fga + 1;
    if (corruption === "invalid dates") raw.quality.minGameDate = "2025-02-30";
    if (corruption === "wrong source") raw.provenance.sourceUrl = "https://example.com/incorrect";
    if (corruption === "bad control") raw.players[current.playerId].officialControl.expected.fgm--;
    if (corruption === "league counts") raw.league.fga++;
    expect(projectHistoricalShotSummary(raw, current)).toBeNull();
  });

  it("checks compressed hashes before parsing and retries failed reads without cache poisoning", async () => {
    let fail = true;
    const { store, reader } = testStore((file, bytes) => { if (fail && file.startsWith("summaries/")) return Buffer.concat([bytes, Buffer.from("corrupt")]); return bytes; });
    expect(await store.load(current)).toEqual({ status: "error" });
    fail = false;
    expect(await store.load(current)).toMatchObject({ status: "ready" });
    expect(reader.mock.calls.filter(([file]) => file.startsWith("summaries/"))).toHaveLength(2);
    const broken = testStore((file, bytes) => file === "player-season-catalog.json.gz" ? Buffer.from("bad") : bytes);
    expect(await broken.store.load(current)).toEqual({ status: "error" });
  });

  it("single-flights gzip reads and caches immutable per-selection DTOs", async () => {
    const { store, reader } = testStore();
    const [first, second] = await Promise.all([store.load(current), store.load({ ...current, playerId: 203999 })]);
    expect(first.status).toBe("ready"); expect(second.status).toBe("ready");
    expect(reader).toHaveBeenCalledTimes(2);
    const cached = await store.load(current);
    expect(cached).toBe(first); expect(reader).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(first)).not.toMatch(/sourceZoneCounts|rawPlayerIds|coordinateExtrema|gitBlobSha1|compressedSha256|sourceSha256|sourceOrder|pathD|GAME_EVENT_ID/);
  });

  it("rejects unsafe catalog filenames and decompression bombs", async () => {
    const unsafe = structuredClone(index); unsafe.summaries[0].file = "../../secrets.json.gz";
    expect(() => createHistoricalShotArchiveStore(unsafe, async () => Buffer.alloc(0))).toThrow();
    const changed = structuredClone(index), bomb = gzipSync(Buffer.alloc(16 * 1024 * 1024 + 1));
    changed.catalog.bytes = bomb.length; changed.catalog.sha256 = createHash("sha256").update(bomb).digest("hex");
    const store = createHistoricalShotArchiveStore(changed, async () => bomb);
    expect(await store.load(current)).toEqual({ status: "error" });
  });
});
