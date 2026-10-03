import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import index from "@/data/historical-shot-spatial/index.json";
import { createHistoricalShotMapStore, loadHistoricalShotMap, projectHistoricalShotMap } from "./historical-shot-spatial";
import { loadHistoricalCourtArchive } from "./historical-shot-archive";
import { decodeSeasonShotMapResource } from "./season-shot-map-client";
import type { HeatmapIdentity } from "./season-heatmap";
const identity: HeatmapIdentity = { playerId: 201939, season: "2025-26", seasonType: "Regular Season" };
const read = (file: string) => readFile(`src/data/historical-shot-spatial/${file}`);

describe("server-only real spatial archive", () => {
  it("projects actual Curry packs and keeps geometry residuals distinct from source-zone labels", async () => {
    for (const [season, total, plotted, makes] of [["2025-26", 799, 799, 374], ["2015-16", 1596, 1585, 802]] as const) {
      const selection = { ...identity, season }, resource = await loadHistoricalShotMap(selection);
      expect(resource.status).toBe("ready"); if (resource.status !== "ready") continue;
      expect(resource.data.totals.fga).toBe(total); expect(resource.data.plotted).toMatchObject({ fgm: makes, fga: plotted });
      expect(decodeSeasonShotMapResource(resource, selection)).toEqual(resource);
      expect(JSON.stringify(resource).length).toBeLessThan(60_000);
      expect(JSON.stringify(resource)).not.toMatch(/sourceZoneCounts|evidencePath|sourceSha256|\/workspace\/|"players"|"names"|generatingCode/);
      if (season === "2015-16") {
        expect(resource.data.residuals).toContainEqual({ reason: "backcourt", fgm: 2, fga: 11, fg3m: 2, fg3a: 11 });
        expect(resource.data.totals).toEqual({ fgm: 804, fga: 1596, fg3m: 401, fg3a: 884 });
        expect(resource.data.archive.officialControl).toMatchObject({ fgm: 805, fga: 1598 });
        expect(resource.data.archive.coverageStatus).toBe("official-shooting-totals-mismatch");
      }
      expect(Object.isFrozen(resource.data.resolutions[0].bins)).toBe(true);
    }
  });
  it("shares a pending compact-pack read and immutable DTOs, with no upstream fetch", async () => {
    const reader = vi.fn(read), fetchSpy = vi.spyOn(globalThis, "fetch");
    const store = createHistoricalShotMapStore(index, reader);
    const results = await Promise.all([store.load(identity), store.load(identity)]);
    expect(results.every(result => result.status === "ready")).toBe(true); expect(reader).toHaveBeenCalledTimes(1);
    const cached = await store.load(identity); expect(cached).toBe(results[1]); expect(fetchSpy).not.toHaveBeenCalled(); fetchSpy.mockRestore();
  });
  it("fails closed on corrupted bytes and retries a later valid read", async () => {
    const reader = vi.fn(read).mockResolvedValueOnce(Buffer.from("bad")), store = createHistoricalShotMapStore(index, reader);
    expect(await store.load(identity)).toEqual({ status: "error" }); expect((await store.load(identity)).status).toBe("ready"); expect(reader).toHaveBeenCalledTimes(2);
  });
  it("never fabricates no-attempt or missing seasons", async () => {
    expect(await loadHistoricalShotMap({ ...identity, season: "2004-05" })).toEqual({ status: "unavailable" });
    expect(await loadHistoricalShotMap({ ...identity, playerId: 900000001 })).toEqual({ status: "unavailable" });
  });
  it("rejects false source identity, geometry, missing coordinates and non-reconciled league bins", async () => {
    const entry = index.entries.find(entry => entry.season === identity.season && entry.seasonType === identity.seasonType)!;
    const raw = JSON.parse(gunzipSync(await read(entry.file)).toString("utf8"));
    const court = await loadHistoricalCourtArchive(identity); expect(court.status).toBe("ready"); if (court.status !== "ready") return;
    expect(projectHistoricalShotMap(raw, court.data)).not.toBeNull();
    for (const mutate of [
      (x: typeof raw) => { x.provenance.sourceSummarySha256 = "0".repeat(64); },
      (x: typeof raw) => { x.coordinateFrame.coordinateTransform = "reflected"; },
      (x: typeof raw) => { x.geometry.resolutions.fine = 24; },
      (x: typeof raw) => { x.players["201939"].bins.fine[0][3]++; },
      (x: typeof raw) => { x.league.bins.fine[0][3]++; },
      (x: typeof raw) => { x.players["201939"].residuals["missing-coordinate"].fga++; },
    ]) { const changed = structuredClone(raw); mutate(changed); expect(projectHistoricalShotMap(changed, court.data)).toBeNull(); }
  });
});
