import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import index from "@/data/historical-shot-archive/catalog-index.json";
import { loadHistoricalCourtArchive, projectHistoricalCourtSummary } from "./historical-shot-archive";
import { decodeSeasonHeatmapResource } from "./season-heatmap-client";
import { courtBasic12Zones, courtZoneForSource } from "./season-heatmap-court-zones";
import type { HeatmapIdentity } from "./season-heatmap";
const root = path.join(process.cwd(), "src/data/historical-shot-archive");
const rawSummary = (season = "2025-26", type = "regular") => JSON.parse(gunzipSync(readFileSync(path.join(root, `summaries/${season}-${type}.json.gz`))).toString());
const current: HeatmapIdentity = { playerId: 201939, season: "2025-26", seasonType: "Regular Season" };

describe("court-aligned shooting archive", () => {
  it("reconciles all 14,824 identities and retains every explicit point-type contradiction outside the court", () => {
    let players = 0, zeroZones = 0;
    const totals = { fgm: 0, fga: 0, fg3m: 0, fg3a: 0 }, conflict = { ...totals };
    for (const entry of index.summaries) {
      const raw = JSON.parse(gunzipSync(readFileSync(path.join(root, entry.file))).toString());
      for (const [id, source] of Object.entries(raw.players)) {
        const player = source as typeof totals;
        const identity: HeatmapIdentity = { playerId: Number(id), season: entry.season, seasonType: entry.seasonType as HeatmapIdentity["seasonType"] };
        const data = projectHistoricalCourtSummary(raw, identity);
        if (!data) throw new Error(`Missing court summary ${id}:${entry.file}`);
        const decoded = decodeSeasonHeatmapResource({ status: "ready", data }, identity);
        if (decoded.status !== "ready") throw new Error(`Client rejected court summary ${id}:${entry.file}`);
        expect(data.geometryVersion).toBe("nba-court-basic12-v1");
        expect(data.zones.map(row => row.id)).toEqual(courtBasic12Zones.map(zone => zone.id));
        const rows = [...data.zones, ...data.residuals];
        for (const key of ["fgm", "fga", "fg3m", "fg3a"] as const) {
          expect(rows.reduce((total, row) => total + (row[key] ?? 0), 0)).toBe(player[key]);
          totals[key] += player[key];
          conflict[key] += data.residuals.find(row => row.id === "classification-conflict")?.[key] ?? 0;
        }
        for (const zone of courtBasic12Zones) {
          const row = data.zones.find(row => row.id === zone.id)!;
          expect(row.fg3m).toBe(zone.shotValue === 3 ? row.fgm : 0);
          expect(row.fg3a).toBe(zone.shotValue === 3 ? row.fga : 0);
          if (row.fga === 0) { zeroZones++; expect(row.fgPct).toBeNull(); }
        }
        players++;
      }
    }
    expect(players).toBe(14824); expect(zeroZones).toBe(40304);
    expect(totals).toEqual({ fgm: 2100828, fga: 4571321, fg3m: 504695, fg3a: 1408408 });
    expect(conflict).toEqual({ fgm: 518, fga: 1505, fg3m: 430, fg3a: 1206 });
  }, 120000);

  it("recomputes Curry's paint groups instead of relabelling the old under-8-ft total", async () => {
    const result = await loadHistoricalCourtArchive(current);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.data.zones.find(row => row.id === "restricted-area")).toMatchObject({ fgm: 84, fga: 122, fg3m: 0, fg3a: 0 });
    expect(result.data.zones.find(row => row.id === "paint-non-ra")).toMatchObject({ fgm: 51, fga: 97, fg3m: 0, fg3a: 0 });
    expect(result.data.totals).toEqual({ fgm: 374, fga: 799 });
    expect(result.data.zones.some(row => row.id === "center-under-8")).toBe(false);
    expect(Object.isFrozen(result.data.zones[0])).toBe(true);
    expect(await loadHistoricalCourtArchive(current)).toBe(result);
  });

  it("keeps 2015 Curry's missing 1/2 separate from the official control and never invents a mapped zone", async () => {
    const result = await loadHistoricalCourtArchive({ ...current, season: "2015-16" });
    expect(result).toMatchObject({ status: "ready", data: { totals: { fgm: 804, fga: 1596 }, coverage: { aggregate: "archive-source-only", seasonAttemptDenominator: 1596 }, archive: { fg3m: 401, fg3a: 884, coverageStatus: "official-shooting-totals-mismatch", officialControl: { fgm: 805, fga: 1598, fg3m: 402, fg3a: 886 } } } });
    if (result.status !== "ready") return;
    const rows = [...result.data.zones, ...result.data.residuals];
    expect(rows.reduce((sum, row) => sum + row.fga, 0)).toBe(1596);
    expect(result.data.residuals.some(row => row.id === "unclassified" && row.fgm === 1 && row.fga === 2)).toBe(false);
    for (const row of rows) expect(row.attemptShare).toBe(row.fga / 1596);
  });

  it("weights league references after the exact same BASIC/AREA and point-type split", () => {
    const raw = rawSummary(), data = projectHistoricalCourtSummary(raw, current)!;
    const ra = raw.league.sourceZoneCounts.find((group: { basic: string }) => group.basic === "Restricted Area");
    expect(data.zones[0].leagueAverage).toMatchObject({ leagueFgm: ra.fgm - ra.fg3m, leagueFga: ra.fga - ra.fg3a, provenance: "weighted-archive-counts-not-official-displayed-LA" });
    expect(data.benchmark).toMatchObject({ season: "2025-26", seasonType: "Regular Season", leagueFgm: raw.league.fgm, leagueFga: raw.league.fga });
    const po = projectHistoricalCourtSummary(rawSummary("2015-16", "playoffs"), { ...current, season: "2015-16", seasonType: "Playoffs" })!;
    expect(po.benchmark).toMatchObject({ season: "2015-16", seasonType: "Playoffs" });
  });

  it("retains unknown classifications non-spatially rather than coercing them into a court region", () => {
    const raw = rawSummary();
    const player = raw.players[String(current.playerId)];
    const original = player.sourceZoneCounts.find((group: { basic: string }) => group.basic === "Restricted Area");
    original.basic = "Unrecognized source classification";
    raw.league.sourceZoneCounts.find((group: { basic: string }) => group.basic === "Restricted Area").basic = "Unrecognized source classification";
    const result = projectHistoricalCourtSummary(raw, current)!;
    expect(result).not.toBeNull();
    expect(result.zones.find(row => row.id === "restricted-area")).toMatchObject({ fgm: 0, fga: 0 });
    expect(result.residuals.find(row => row.id === "unclassified")).toMatchObject({ fgm: 84, fga: 122 });
    expect(result.totals).toEqual({ fgm: 374, fga: 799 });
  });

  it("does not map historical or contradictory ranges into an assumed modern court boundary", () => {
    expect(courtZoneForSource("Above the Break 3", "Center(C)", "16-24 ft.")).toBeNull();
    expect(courtZoneForSource("Mid-Range", "Center(C)", "24+ ft.")).toBeNull();
    expect(courtZoneForSource("Restricted Area", "Right Side(R)", "Less Than 8 ft.")).toBeNull();
    expect(courtZoneForSource("In The Paint (Non-RA)", "Center(C)", "8-16 ft.")?.id).toBe("paint-non-ra");
  });

  it.each(["duplicate group", "mismatched group count", "missing group", "invalid point types"])("fails closed for corrupt source triples: %s", corruption => {
    const raw = rawSummary(), player = raw.players[String(current.playerId)];
    if (corruption === "duplicate group") player.sourceZoneCounts.push(player.sourceZoneCounts[0]);
    if (corruption === "mismatched group count") player.sourceZoneCounts[0].fga++;
    if (corruption === "missing group") player.sourceZoneCounts.pop();
    if (corruption === "invalid point types") player.sourceZoneCounts[0].fg3a = player.sourceZoneCounts[0].fga + 1;
    expect(projectHistoricalCourtSummary(raw, current)).toBeNull();
  });
});
