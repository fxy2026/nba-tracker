import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import currentFacts from "@/data/verified-season-heatmaps/201939-2025-26-regular.json";
import historicalFacts from "@/data/verified-season-heatmaps/201939-2015-16-regular.json";
import {
  getSeasonHeatmapCatalog, isSeasonHeatmapIdentity, loadSeasonHeatmapArchive, validateSeasonHeatmapArchive,
} from "./verified-season-heatmap-archive";
import type { HeatmapIdentity } from "./season-heatmap";

const current: HeatmapIdentity = { playerId: 201939, season: "2025-26", seasonType: "Regular Season" };
const historical: HeatmapIdentity = { ...current, season: "2015-16" };
afterEach(() => { vi.restoreAllMocks(); vi.doUnmock("@/data/verified-season-heatmaps/201939-2025-26-regular.json"); });

describe("verified Curry aggregate archive", () => {
  it("reconciles current official totals and full normal-zone coverage", () => {
    const resource = loadSeasonHeatmapArchive(current);
    expect(resource.status).toBe("ready");
    if (resource.status !== "ready") throw new Error("Expected archive");
    expect(resource.data).toMatchObject({ ...current, status: "verified-aggregate", totals: { fgm: 374, fga: 799 },
      coverage: { aggregate: "full-season-reconciled", rawPoints: "not-captured", normalZoneAttempts: 799, residualAttempts: 0, seasonAttemptDenominator: 799 } });
    expect(resource.data.zones).toHaveLength(14);
    expect(resource.data.residuals).toEqual([]);
    expect(currentFacts.independentCareerTotals).toMatchObject({ fgm: 374, fga: 799, fg3m: 190, fg3a: 484 });
  });

  it("retains historical residuals and uses all 1598 attempts for every share", () => {
    const resource = loadSeasonHeatmapArchive(historical);
    expect(resource.status).toBe("ready");
    if (resource.status !== "ready") throw new Error("Expected archive");
    const { data } = resource;
    expect(data.totals).toEqual({ fgm: 805, fga: 1598 });
    expect(data.coverage).toMatchObject({ normalZoneAttempts: 1584, residualAttempts: 14, seasonAttemptDenominator: 1598, rawPoints: "not-captured" });
    expect(data.zones.reduce((total, row) => total + row.fgm, 0)).toBe(801);
    expect(data.residuals).toEqual([
      expect.objectContaining({ id: "backcourt", fgm: 3, fga: 12, attemptShare: 12 / 1598 }),
      expect.objectContaining({ id: "unclassified", fgm: 1, fga: 2, attemptShare: 2 / 1598 }),
    ]);
    for (const row of [...data.zones, ...data.residuals]) expect(row.attemptShare).toBe(row.fga / 1598);
    expect(historicalFacts.independentCareerTotals).toMatchObject({ fgm: 805, fga: 1598, fg3m: 402, fg3a: 886 });
    expect(historicalFacts.residuals.map(row => row.shotType)).toEqual(["unknown", "unknown"]);
  });

  it("does not replace genuine source counts with fabricated zero attempts", () => {
    const data = validateSeasonHeatmapArchive(currentFacts, current)!;
    expect(data.zones.every(row => row.fga > 0 && row.status === "has-attempts")).toBe(true);
    const tampered = structuredClone(currentFacts);
    Object.assign(tampered.zones[0], { fgm: 0, fga: 0, fgPctDisplay: "0.0", distributionPctDisplay: "0.0" });
    expect(validateSeasonHeatmapArchive(tampered, current)).toBeNull();
  });

  it("retains season-specific displayed LA and never supplies a proved league denominator", () => {
    const now = validateSeasonHeatmapArchive(currentFacts, current)!;
    const past = validateSeasonHeatmapArchive(historicalFacts, historical)!;
    expect(now.benchmark).toEqual({ kind: "source-displayed-unverified-scope", independentlyVerifiedScope: null, leagueFgm: null, leagueFga: null });
    expect(past.benchmark).toEqual(now.benchmark);
    const nowCenter = now.zones.find(row => row.id === "center-under-8")!;
    const pastCenter = past.zones.find(row => row.id === "center-under-8")!;
    expect(nowCenter.leagueAverage?.displayedPct).not.toBe(pastCenter.leagueAverage?.displayedPct);
    expect(pastCenter.leagueAverage?.displayedPct).toBe("55.5");
    expect(past.source?.url).toContain("Season=2015-16");
    expect(now.source).toEqual({ url: currentFacts.source.url, capturedAtUtc: null, observedAtWindowUtc: ["2026-10-03T09:11:55Z", "2026-10-03T09:12:31Z"] });
  });

  it("projects only the minimal public DTO fields", () => {
    const data = validateSeasonHeatmapArchive(historicalFacts, historical)!;
    expect(Object.keys(data).sort()).toEqual(["playerId", "season", "seasonType", "geometryVersion", "status", "source", "zones", "residuals", "totals", "coverage", "benchmark"].sort());
    expect(Object.keys(data.source!).sort()).toEqual(["url", "capturedAtUtc", "observedAtWindowUtc"].sort());
    const text = JSON.stringify(data);
    for (const forbidden of ["evidencePath", "Sha256", "report", "pathD", "labelGroup", "rawPointCoverage", "sourceOrder", "private-", "shotType", "independentCareerTotals", "sourceOverall", "sourceTraditionalScaleValue"])
      expect(text).not.toContain(forbidden);
  });

  it("deep-freezes cached results, nested rows, source windows, and catalog metadata", () => {
    const first = loadSeasonHeatmapArchive(current), second = loadSeasonHeatmapArchive({ ...current });
    expect(first).toBe(second);
    if (first.status !== "ready") throw new Error("Expected archive");
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.data.zones)).toBe(true);
    expect(Object.isFrozen(first.data.zones[0].leagueAverage)).toBe(true);
    expect(Object.isFrozen(first.data.source?.observedAtWindowUtc)).toBe(true);
    expect(() => { first.data.totals.fga = 0; }).toThrow();
    expect(() => { first.data.zones.pop(); }).toThrow();
    expect(loadSeasonHeatmapArchive(current)).toMatchObject({ status: "ready", data: { totals: { fga: 799 } } });
    const catalog = getSeasonHeatmapCatalog(201939);
    expect(catalog).toEqual([{ ...current, availability: "available" }, { ...historical, availability: "available" }]);
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog[0])).toBe(true);
    expect(getSeasonHeatmapCatalog(2544)).toEqual([]);
    expect(getSeasonHeatmapCatalog(NaN)).toEqual([]);
  });

  it.each([
    null, {}, { ...current, playerId: "201939" }, { ...current, playerId: 0 }, { ...current, playerId: -1 },
    { ...current, playerId: 201939.1 }, { ...current, playerId: Number.MAX_SAFE_INTEGER + 1 },
    { ...current, season: "2025-27" }, { ...current, season: "2025" }, { ...current, season: " 2025-26" },
    { ...current, seasonType: "Regular+Season" }, { ...current, seasonType: "Pre Season" }, { ...current, extra: "scope" },
  ])("rejects malformed identity without coercion: %j", identity => {
    expect(isSeasonHeatmapIdentity(identity)).toBe(false);
    expect(loadSeasonHeatmapArchive(identity)).toEqual({ status: "unavailable" });
    expect(validateSeasonHeatmapArchive(currentFacts, identity)).toBeNull();
  });

  it.each([{ ...current, playerId: 2544 }, { ...current, season: "2024-25" }, { ...current, seasonType: "Playoffs" }])("never substitutes an unsupported identity: %j", identity => {
    expect(isSeasonHeatmapIdentity(identity)).toBe(true);
    expect(loadSeasonHeatmapArchive(identity)).toEqual({ status: "unavailable" });
    expect(validateSeasonHeatmapArchive(currentFacts, identity)).toBeNull();
  });

  it("rejects stale season facts, changed counts/LA/source, extra fields, and removed residuals", () => {
    expect(validateSeasonHeatmapArchive(currentFacts, historical)).toBeNull();
    const changedCount = structuredClone(historicalFacts); changedCount.zones[0].fgm -= 1;
    const changedLa = structuredClone(historicalFacts); changedLa.zones[0].leagueAveragePctDisplay = "99.9";
    const changedSource = structuredClone(historicalFacts); changedSource.source.url += "&GameID=0021500001";
    const removedResidual = structuredClone(historicalFacts); removedResidual.residuals.pop();
    for (const tampered of [changedCount, changedLa, changedSource, removedResidual, { ...historicalFacts, unexpected: "value" }, null, []])
      expect(validateSeasonHeatmapArchive(tampered, historical)).toBeNull();
  });

  it("pins canonical facts independently of JSON property order", () => {
    const reordered = Object.fromEntries(Object.entries(historicalFacts).reverse());
    expect(validateSeasonHeatmapArchive(reordered, historical)).toEqual(validateSeasonHeatmapArchive(historicalFacts, historical));
  });

  it("fails closed on corrupted registered facts while retaining catalog registration", async () => {
    const tampered = structuredClone(currentFacts); tampered.zones[0].fgm -= 1;
    vi.resetModules();
    vi.doMock("@/data/verified-season-heatmaps/201939-2025-26-regular.json", () => ({ default: tampered }));
    const fresh = await import("./verified-season-heatmap-archive");
    expect(fresh.loadSeasonHeatmapArchive(current)).toEqual({ status: "error" });
    expect(fresh.loadSeasonHeatmapArchive(historical).status).toBe("ready");
    expect(fresh.getSeasonHeatmapCatalog(201939)).toHaveLength(2);
    expect(fresh.loadSeasonHeatmapArchive(current)).not.toHaveProperty("data");
  });
});
