import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import index from "@/data/historical-shot-spatial/index.json";
import { createHistoricalShotMapStore, projectHistoricalShotMap } from "./historical-shot-spatial";
import { loadHistoricalCourtArchive } from "./historical-shot-archive";
import * as geometry from "./season-shot-map";
import type { HeatmapIdentity, SeasonHeatmapArchiveResource } from "./season-heatmap";

const read = (file: string) => readFile(`src/data/historical-shot-spatial/${file}`);
const identity = (season = "2025-26", playerId = 201939): HeatmapIdentity => ({ playerId, season, seasonType: "Regular Season" });
const key = (value: HeatmapIdentity) => `${value.playerId}:${value.season}:${value.seasonType}`;
const courts = new Map<string, SeasonHeatmapArchiveResource>();
const loadCourt = async (value: HeatmapIdentity) => courts.get(key(value)) ?? loadHistoricalCourtArchive(value);
let raw: { players: Record<string, { bins: Record<string, number[][]> }>; league: { bins: Record<string, number[][]> } };
beforeAll(async () => {
  for (const season of ["2025-26", "2024-25", "2021-22"]) for (const playerId of [201939, 2544, 201142]) {
    const value = identity(season, playerId), court = await loadHistoricalCourtArchive(value);
    expect(court.status).toBe("ready"); courts.set(key(value), court);
  }
  raw = JSON.parse(gunzipSync(await read("assets/2025-26-regular.json.gz")).toString("utf8"));
});
afterEach(() => vi.restoreAllMocks());

describe("bounded spatial validation and concurrent caches", () => {
  it("checks each exact lattice cell once per pack parse without retaining that memo", () => {
    const court = courts.get(key(identity()))!; if (court.status !== "ready") throw new Error("Missing fixture");
    const predicate = vi.spyOn(geometry, "shotMapCellIntersectsFrame");
    const unique = new Set<string>();
    for (const block of [raw.league, ...Object.values(raw.players)]) for (const spec of geometry.SHOT_MAP_RESOLUTIONS) {
      for (const [q, r] of block.bins[spec.id]) unique.add(`${spec.radius}:${q}:${r}`);
    }
    const result = projectHistoricalShotMap(raw, court.data);
    expect(result).not.toBeNull();
    const projectedChecks = result!.resolutions.reduce((total, resolution) => total + resolution.bins.length, 0);
    expect(predicate).toHaveBeenCalledTimes(unique.size + projectedChecks);
    predicate.mockClear();
    expect(projectHistoricalShotMap(raw, court.data)).toEqual(result);
    expect(predicate).toHaveBeenCalledTimes(unique.size + projectedChecks);
    const invalid = structuredClone(raw);
    invalid.players["201939"].bins.fine[0][0] = 32;
    invalid.players["201939"].bins.fine[0][1] = 32;
    expect(projectHistoricalShotMap(invalid, court.data)).toBeNull();
  });

  it("coalesces the full same-identity load and shares one frozen result", async () => {
    const reader = vi.fn(read), courtReader = vi.fn(loadCourt), store = createHistoricalShotMapStore(index, reader, courtReader);
    const results = await Promise.all(Array.from({ length: 10 }, () => store.load(identity())));
    expect(results.every(result => result.status === "ready")).toBe(true);
    expect(new Set(results).size).toBe(1);
    expect(reader).toHaveBeenCalledTimes(1); expect(courtReader).toHaveBeenCalledTimes(1);
    expect(Object.isFrozen(results[0])).toBe(true);
    expect(await store.load(identity())).toBe(results[0]);
  });

  it("keeps queued pack work deduplicated across A/B/C/A for different players", async () => {
    const reader = vi.fn(read), store = createHistoricalShotMapStore(index, reader, loadCourt);
    const requests = [identity(), identity("2024-25"), identity("2021-22"), identity("2025-26", 2544)];
    const results = await Promise.all(requests.map(value => store.load(value)));
    expect(results.every(result => result.status === "ready")).toBe(true);
    expect(reader.mock.calls.map(([file]) => file)).toEqual([
      "assets/2025-26-regular.json.gz", "assets/2024-25-regular.json.gz", "assets/2021-22-regular.json.gz",
    ]);
  });

  it("retains exactly two settled packs and refreshes their access order", async () => {
    const reader = vi.fn(read), store = createHistoricalShotMapStore(index, reader, loadCourt);
    for (const value of [identity(), identity("2024-25"), identity("2025-26", 2544), identity("2021-22"), identity("2025-26", 201142)]) {
      expect((await store.load(value)).status).toBe("ready");
    }
    expect(reader).toHaveBeenCalledTimes(3);
    expect((await store.load(identity("2024-25", 2544))).status).toBe("ready");
    expect(reader.mock.calls.map(([file]) => file)).toEqual([
      "assets/2025-26-regular.json.gz", "assets/2024-25-regular.json.gz", "assets/2021-22-regular.json.gz", "assets/2024-25-regular.json.gz",
    ]);
  });

  it.each(["read rejection", "corrupt bytes"])("clears failed pack and identity work after %s without blocking queued seasons", async failure => {
    const reader = vi.fn(read);
    if (failure === "read rejection") reader.mockRejectedValueOnce(new Error("Controlled read failure"));
    else reader.mockResolvedValueOnce(Buffer.from("corrupt"));
    const courtReader = vi.fn(loadCourt), store = createHistoricalShotMapStore(index, reader, courtReader);
    const results = await Promise.all([store.load(identity()), store.load(identity()), store.load(identity("2024-25"))]);
    expect(results).toMatchObject([{ status: "error" }, { status: "error" }, { status: "ready" }]);
    expect(courtReader).toHaveBeenCalledTimes(2);
    expect((await store.load(identity())).status).toBe("ready");
    expect(reader).toHaveBeenCalledTimes(3); expect(courtReader).toHaveBeenCalledTimes(3);
  });

  it.each(["reject", "unavailable"])("clears a %s court lookup so a later load can retry", async failure => {
    const reader = vi.fn(read), courtReader = vi.fn(loadCourt);
    if (failure === "reject") courtReader.mockRejectedValueOnce(new Error("Controlled court failure"));
    else courtReader.mockResolvedValueOnce({ status: "unavailable" });
    const store = createHistoricalShotMapStore(index, reader, courtReader);
    const results = await Promise.all([store.load(identity()), store.load(identity())]);
    expect(results).toEqual([{ status: failure === "reject" ? "error" : "unavailable" }, { status: failure === "reject" ? "error" : "unavailable" }]);
    expect(reader).not.toHaveBeenCalled(); expect(courtReader).toHaveBeenCalledTimes(1);
    expect((await store.load(identity())).status).toBe("ready");
    expect(reader).toHaveBeenCalledTimes(1); expect(courtReader).toHaveBeenCalledTimes(2);
  });

  it("rejects an invalid identity before touching either pending cache", async () => {
    const reader = vi.fn(read), courtReader = vi.fn(loadCourt), store = createHistoricalShotMapStore(index, reader, courtReader);
    expect(await store.load({ ...identity(), playerId: -1 })).toEqual({ status: "unavailable" });
    expect(reader).not.toHaveBeenCalled(); expect(courtReader).not.toHaveBeenCalled();
  });

  it("keeps the 128-resource LRU limit and updates recency on a cache hit", async () => {
    const values = Object.keys(raw.players).slice(0, 130).map(playerId => identity("2025-26", Number(playerId)));
    const reader = vi.fn(read), store = createHistoricalShotMapStore(index, reader, loadCourt);
    const first = await store.load(values[0]), second = await store.load(values[1]);
    expect(first.status).toBe("ready"); expect(second.status).toBe("ready");
    for (const value of values.slice(2, 128)) expect((await store.load(value)).status).toBe("ready");
    expect(await store.load(values[0])).toBe(first);
    expect((await store.load(values[128])).status).toBe("ready");
    expect(await store.load(values[0])).toBe(first);
    expect(await store.load(values[1])).not.toBe(second);
    expect(reader).toHaveBeenCalledTimes(1);
  });

  it("enforces the accounted 4 MiB byte budget before the resource-count limit", async () => {
    const values = Object.keys(raw.players).slice(0, 33).map(playerId => identity("2025-26", Number(playerId)));
    // Isolate cache accounting without enlarging or changing verified source DTOs.
    vi.spyOn(Buffer, "byteLength").mockReturnValue(128 * 1024);
    const store = createHistoricalShotMapStore(index, read, loadCourt);
    const first = await store.load(values[0]), second = await store.load(values[1]);
    expect(first.status).toBe("ready"); expect(second.status).toBe("ready");
    for (const value of values.slice(2, 32)) expect((await store.load(value)).status).toBe("ready");
    expect(await store.load(values[0])).toBe(first);
    expect((await store.load(values[32])).status).toBe("ready");
    expect(await store.load(values[0])).toBe(first);
    expect(await store.load(values[1])).not.toBe(second);
  });
});
