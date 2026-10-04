import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import summaryIndex from "@/data/historical-shot-archive/catalog-index.json";
import spatialIndex from "@/data/historical-shot-spatial/index.json";
import report from "@/data/historical-shot-archive/early-import-validation-report.json";
import source from "@/data/historical-shot-archive/early-import-source-manifest.json";
import legacySpatial from "@/data/historical-shot-spatial/spatial-release-manifest.json";
import { projectHistoricalCourtSummary } from "./historical-shot-archive";
import { projectHistoricalShotMap } from "./historical-shot-spatial";
import { decodeSeasonShotMapResource } from "./season-shot-map-client";
import { decodeSeasonHeatmapResource } from "./season-heatmap-client";
import type { HeatmapIdentity } from "./season-heatmap";
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const read = (folder: string, file: string) => readFileSync(`src/data/${folder}/${file}`);
const raw = (folder: string, file: string) => JSON.parse(gunzipSync(read(folder, file)).toString());

describe("early shot import integrity", () => {
  it("conserves all rows with one explicit quarantine and truthful combined metadata", () => {
    expect(report).toMatchObject({ newArchiveCount: 18, archiveCount: 60, newRawRows: 1756750, newAcceptedRows: 1756749, allAcceptedRows: 6328070, quarantinedRows: 1, playerCount: 2840, playerSeasonTypeEntries: 20421 });
    expect(spatialIndex.entries).toHaveLength(60);
    expect(spatialIndex.totalAttempts).toBe(6328070);
    expect(spatialIndex.combinedCompressedBytes).toBe(spatialIndex.entries.reduce((sum, entry) => sum + entry.compressedBytes, 0));
    expect(spatialIndex.completeHistory).toBe(false);
    expect(spatialIndex.unavailableStartYears).toEqual([]);
    expect(source.archives).toHaveLength(18);
    expect(hash(read("historical-shot-archive", "early-import-source-manifest.json"))).toBe(report.sourceReleaseSha256);
    expect(hash(readFileSync("scripts/historical-shots/import_early_archives.py"))).toBe(source.parserCodeSha256);
    const quarantines = report.packReports.flatMap(pack => pack.quarantinedRows);
    expect(quarantines).toHaveLength(1);
    expect(quarantines[0]).toMatchObject({ reason: "unknown-explicit-shot-type", record: { PLAYER_ID: "376", PLAYER_NAME: "Eric Montross", GAME_ID: "29600245", GAME_EVENT_ID: "291", SHOT_TYPE: "", SHOT_MADE_FLAG: "0" } });
  });
  it("keeps the original 42 spatial and summary gzip bytes identical to their original manifests", () => {
    const originals = legacySpatial.files.filter(entry => entry.file.startsWith("assets/"));
    expect(originals).toHaveLength(42);
    for (const entry of originals) {
      const bytes = read("historical-shot-spatial", entry.file);
      expect(bytes.byteLength).toBe(entry.bytes); expect(hash(bytes)).toBe(entry.sha256);
    }
    const originalsSummary = summaryIndex.summaries.filter(entry => Number(entry.season.slice(0, 4)) >= 2005);
    expect(originalsSummary).toHaveLength(42);
    for (const entry of originalsSummary) {
      const manifestName = `manifests/${entry.season}-${entry.seasonType === "Playoffs" ? "playoffs" : "regular"}-manifest.json`;
      const manifest = JSON.parse(read("historical-shot-archive", manifestName).toString());
      expect(hash(read("historical-shot-archive", entry.file))).toBe(manifest.output.sha256);
    }
  });
  it("validates every new spatial pack through complete count, geometry and client contracts", () => {
    const early = spatialIndex.entries.filter(entry => Number(entry.season.slice(0, 4)) < 2005);
    expect(early).toHaveLength(18);
    for (const entry of early) {
      const bytes = read("historical-shot-spatial", entry.file);
      expect(bytes.length).toBe(entry.compressedBytes); expect(hash(bytes)).toBe(entry.sha256);
      const summaryEntry = summaryIndex.summaries.find(row => row.season === entry.season && row.seasonType === entry.seasonType)!;
      const summary = raw("historical-shot-archive", summaryEntry.file);
      const identity: HeatmapIdentity = { playerId: Number(Object.keys(summary.players)[0]), season: entry.season, seasonType: entry.seasonType as HeatmapIdentity["seasonType"] };
      const court = projectHistoricalCourtSummary(summary, identity);
      expect(court, entry.file).not.toBeNull(); if (!court) continue;
      const spatial = projectHistoricalShotMap(JSON.parse(gunzipSync(bytes).toString()), court);
      expect(spatial, entry.file).not.toBeNull();
      expect(decodeSeasonShotMapResource({ status: "ready", data: spatial }, identity).status, entry.file).toBe("ready");
    }
  });
  it("rejects misleading quarantine metadata at the strict client boundary", () => {
    const summary = raw("historical-shot-archive", "summaries/1996-97-regular.json.gz");
    const identity: HeatmapIdentity = { playerId: 376, season: "1996-97", seasonType: "Regular Season" };
    const data = projectHistoricalCourtSummary(summary, identity)!;
    expect(data.archive).toMatchObject({ sourceObservationKind: "local-blob-verification", sourceRowExclusions: { reason: "unknown-shot-type", leagueRows: 1, playerRows: 1 }, officialControl: null });
    expect(decodeSeasonHeatmapResource({ status: "ready", data }, identity).status).toBe("ready");
    for (const mutate of [
      (value: typeof data) => { value.archive!.sourceRowExclusions!.playerRows = 2; },
      (value: typeof data) => { value.archive!.sourceRowExclusions!.leagueRows = -1; },
      (value: typeof data) => { delete value.archive!.sourceObservationKind; },
    ]) {
      const changed = structuredClone(data); mutate(changed);
      expect(decodeSeasonHeatmapResource({ status: "ready", data: changed }, identity)).toEqual({ status: "error" });
    }
  });
});
