import { beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import archive from "@/data/playerindex-2025-26.json";
import registry from "@/data/player-identity/official-all-player-identities.compact.json";
import corrections from "@/data/player-identity/verified-curated-id-corrections.json";
import { ALL_TIME_LEADERS } from "./allTimeLeaders";
import { FRANCHISE_FIVE } from "./franchiseAllTimeFive";
import franchiseCorrections from "@/data/player-identity/verified-franchise-five-id-corrections.json";
import { ICONIC_SEASONS, findIconicSeason } from "./iconicSeasons";
import { getAccolades } from "./playerAccolades";
import { buildPlayerIdentityDirectory, parsePlayerId, searchPlayerIdentities } from "./player-identity";
import type { PlayerIndexSnapshot } from "./api";
vi.mock("server-only", () => ({}));
import { OFFICIAL_PLAYER_IDENTITIES, parseOfficialPlayerRegistry } from "./official-player-registry";
import { getPlayerIdentityDirectory, resolvePlayerIdentity } from "./player-identity-server";
import { getHistoricalShotPlayers } from "./historical-shot-archive";
import * as historicalModule from "./historical-shot-archive";

const snapshot = { players: archive.resultSets[0].rowSet.map(r => ({ personId: r[0], firstName: r[2], lastName: r[1], teamCity: r[7], teamName: r[8], teamAbbr: r[9], position: r[11] })), provenance: { source: "bundled-archive", season: "2025-26", stale: true, retrievedAt: null } } as PlayerIndexSnapshot;
let directory: Awaited<ReturnType<typeof getPlayerIdentityDirectory>>;
beforeAll(async () => { directory = await getPlayerIdentityDirectory(snapshot); });
describe("canonical all-player identities", () => {
  it("resolves all 5,238 official IDs and every 2,224 shot ID without duplicate profiles", async () => {
    expect(directory).toHaveLength(5238);
    expect(new Set(directory.map(p => p.id)).size).toBe(directory.length);
    const map = new Map(directory.map(p => [p.id, p]));
    for (const p of OFFICIAL_PLAYER_IDENTITIES) expect(map.get(p.id)?.href, String(p.id)).toBe(`/player/${p.id}`);
    const historical = await getHistoricalShotPlayers(); expect(historical).toHaveLength(2224);
    for (const p of historical) expect(map.get(p.playerId)?.sources).toContain("historical-shots");
    for (const p of snapshot.players) expect(map.get(p.personId)?.sources).toContain("player-index");
    // Exercise the actual route resolver, not just the pure union.
    const resolved = await Promise.all(directory.map(p => resolvePlayerIdentity(String(p.id), snapshot)));
    expect(resolved.map(p => p?.id)).toEqual(directory.map(p => p.id));
  });
  it("retains the 587 bundled identities without making source coverage into career facts", () => {
    expect(directory.filter(p => p.sources.includes("player-index"))).toHaveLength(587);
    expect(directory.find(p => p.id === 1642850)).toMatchObject({ name: "Thomas Sorber", shotCoverage: null });
    const old = directory.find(p => p.id === 15)!;
    expect(old).toMatchObject({ name: "Eric Piatkowski", shotCoverage: { firstSeason: "2005-06", lastSeason: "2007-08" }, sourceYears: { from: 1994, to: 2007 }, teamLabel: null, indexProvenance: null });
    expect(old).not.toHaveProperty("active"); expect(old).not.toHaveProperty("pts"); expect(old).not.toHaveProperty("birthday");
  });
  it("keeps namesakes distinct, including Patrick Ewing father and son", () => {
    const result = searchPlayerIdentities(directory, "Patrick Ewing");
    expect(result.map(p => p.id)).toEqual([121, 201607]);
    expect(result.map(p => p.sourceYears)).toEqual([{ from: 1985, to: 2001 }, { from: 2010, to: 2010 }]);
  });
  it.each([[787, "Charles Barkley"], [901, "Otis Thorpe"], [76804, "George Gervin"], [76681, "Julius Erving"]])("never confuses verified NBA ID %s", (id, name) => {
    const p = directory.find(p => p.id === id)!; expect(p.name).toBe(name);
    expect(searchPlayerIdentities(directory, String(id))[0]?.id).toBe(id);
    if (id === 901) expect(p.aliases).not.toContain("Charles Barkley");
    if (id === 76681) expect(p.aliases).not.toContain("George Gervin");
  });
  it("every franchise-list identity matches the officially checked NBA ID", () => {
    expect(FRANCHISE_FIVE.flatMap(team => team.five)).toHaveLength(100);
    for (const row of franchiseCorrections.mappings) expect(FRANCHISE_FIVE.find(team => team.tricode === row.team)?.five.find(player => player.name === row.name)?.personId, row.name).toBe(row.personId);
  });
  it("fixes all verified curated IDs and preserves stats with the correct person", () => {
    for (const correction of corrections.corrections) expect(ALL_TIME_LEADERS.find(p => p.name === correction.name)?.personId).toBe(correction.personId);
    expect(ICONIC_SEASONS.find(p => p.name === "Charles Barkley")).toMatchObject({ id: "787-1992", personId: 787 });
    expect(getAccolades(787)).toMatchObject({ mvps: 1 });
    expect(getAccolades(901)).toBeNull();
    expect(getAccolades(78497)).toMatchObject({ finalsMvps: 1 });
    expect(getAccolades(78491)).toBeNull();
    expect(getAccolades(600015)).toMatchObject({ mvps: 1 });
    for (const id of [77506, 76246, 77381]) expect(getAccolades(id)).toBeNull();
  });
  it.each([[2775, "Seung-Jin Ha", "Ha Seung-jin"], [201180, "Yue Sun", "Sun Yue"], [1642385, "Cui Yongxi", "Yongxi Cui"]])("uses source-backed name override %s without mutating raw source", (id, name, alias) => {
    expect(directory.find(p => p.id === id)?.name).toBe(name);
    expect(searchPlayerIdentities(directory, String(alias)).some(p => p.id === id)).toBe(true);
    expect(registry.rows.find(row => row[0] === id)?.[1]).not.toBe(name);
  });
  it("corrects iconic records while preserving only exact legacy composite links", () => {
    expect(ICONIC_SEASONS.find(p => p.name === "Oscar Robertson")).toMatchObject({ id: "600015-1961", personId: 600015 });
    expect(ICONIC_SEASONS.find(p => p.name === "Bill Walton")).toMatchObject({ id: "78450-1977", personId: 78450 });
    for (const [old, id] of [["901-1992", 787], ["77506-1961", 600015], ["78318-1977", 78450]] as const) expect(findIconicSeason(old)?.personId).toBe(id);
    expect(findIconicSeason("901")).toBeUndefined();
    expect(directory.find(p => p.id === 77506)?.name).toBe("Johnny McCarthy");
    expect(directory.find(p => p.id === 78318)?.name).toBe("Isiah Thomas");
  });
  it("supports accents, nicknames, historical variants and known single-digit IDs", () => {
    for (const [query, id] of [["jokic", 203999], ["库里", 201939], ["kobe", 977], ["2", 2], ["15", 15], ["Cameron Reynolds", 1629244], ["Nat Hickey", 77016], ["巴克利", 787], ["冰人", 76804]] as const) expect(searchPlayerIdentities(directory, query).some(p => p.id === id), query).toBe(true);
  });
  it.each(["0", "-1", "0977", "977junk", "1e3", "9007199254740992", "", " 977"])("rejects malformed route ID %s", async value => { expect(parsePlayerId(value)).toBeNull(); expect(await resolvePlayerIdentity(value, snapshot)).toBeNull(); });
  it("default autocomplete identities load without starting any live fetch", async () => {
    const fetch = vi.fn(() => { throw new Error("No upstream autocomplete requests"); });
    vi.stubGlobal("fetch", fetch);
    try {
      const local = await getPlayerIdentityDirectory();
      expect(local).toHaveLength(5238); expect(fetch).not.toHaveBeenCalled();
      expect(local.find(p => p.id === 201939)?.indexProvenance).toMatchObject({ source: "bundled-archive", season: "2025-26", stale: true });
    } finally { vi.unstubAllGlobals(); }
  });
  it("a shot-catalog failure retains all official/current identities and recovers on retry", async () => {
    const separateSnapshot = { ...snapshot };
    const mock = vi.spyOn(historicalModule, "getHistoricalShotPlayers").mockRejectedValueOnce(new Error("Archive unavailable"));
    try {
      const degraded = await getPlayerIdentityDirectory(separateSnapshot);
      expect(degraded).toHaveLength(5238); expect(degraded.find(p => p.id === 201939)).toMatchObject({ shotArchiveStatus: "error", name: "Stephen Curry" });
      const recovered = await getPlayerIdentityDirectory(separateSnapshot);
      expect(recovered.find(p => p.id === 201939)?.shotCoverage).not.toBeNull();
      expect(recovered.some(p => p.shotArchiveStatus === "error")).toBe(false);
    } finally { mock.mockRestore(); }
  });
  it("unknown valid IDs remain absent and memoization follows the actual index snapshot", async () => {
    expect(await resolvePlayerIdentity("999999999", snapshot)).toBeNull();
    expect(await getPlayerIdentityDirectory(snapshot)).toBe(directory);
    expect(await getPlayerIdentityDirectory({ ...snapshot })).not.toBe(directory);
  });
  it("merges same-ID aliases but never collapses identical names on different IDs", () => {
    const result = buildPlayerIdentityDirectory({ snapshot: { ...snapshot, players: [] }, historical: [{ playerId: 3, name: "Old Name", firstSeason: "2010-11", lastSeason: "2010-11", datasetCount: 1 }], legends: [], registry: [{ id: 3, name: "Updated Name" }, { id: 4, name: "Updated Name" }, { id: 0, name: "Invalid" }] });
    expect(result).toHaveLength(2); expect(result[0].aliases).toEqual(["Old Name", "Updated Name"]); expect(result[1].id).toBe(4);
  });
  it("fails closed for duplicate/invalid official source identities", () => {
    const row = registry.rows[0];
    for (const rows of [[row, row], [[0, "Unknown", 2000, 2001]], [[4, "", 2000, 2001]], [[4, "Name", 2001, 2000]]]) expect(() => parseOfficialPlayerRegistry({ ...registry, rows })).toThrow();
  });
  it("retains original archive catalog player counts and source identity data", () => {
    const raw = JSON.parse(gunzipSync(readFileSync("src/data/historical-shot-archive/player-season-catalog.json.gz")).toString());
    expect(Object.keys(raw.players)).toHaveLength(2224); expect(raw.stagedArchiveCount).toBe(42);
    expect(raw.players["977"].names).toContain("Kobe Bryant");
  });
});
