import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AccoladeTile, buildRadarStats, comparisonPeriodsCompatible, comparisonSourceLabel, EraContext, ShootingSplits, ThreeWayCompare, type PlayerData } from "@/app/compare/CompareClient";

vi.mock("next/image", () => ({ default: (props: { alt: string }) => createElement("img", { alt: props.alt }) }));
const player: PlayerData = {
  personId: 1, firstName: "First", lastName: "Player", teamAbbr: "BOS", teamCity: "Boston", teamName: "Celtics", jersey: "1", position: "F", pts: 20, reb: 5, ast: 6,
  indexProvenance: { source: "nba-cdn", season: "2025-26", stale: false, retrievedAt: "2026-10-02T00:00:00Z" },
};
const t = { comparePage: { samePosition: "Same position", statsComparison: "Stats comparison" }, common: { vs: "vs" } };

describe("null-safe comparison components", () => {
  it.each([null, undefined, NaN, Infinity])("three-way missing value %s never crashes or awards a winner", missing => {
    const html = renderToStaticMarkup(createElement(ThreeWayCompare, { p1: { ...player, pts: missing, reb: missing, ast: missing }, p2: player, p3: player, isZh: false, t }));
    expect(html).toContain("Incomplete stats: overall comparison unavailable");
    expect(html.match(/>—</g)).toHaveLength(3);
    expect(html).not.toContain("ring-1 ring-accent-amber/40");
    expect(html).not.toMatch(/NaN|Infinity/);
  });
  it("shows partial optional stats without false highlights and preserves explicit zero honours", () => {
    const p1 = { ...player, fgPct: null, accolades: { championships: 0 } };
    const p2 = { ...player, fgPct: 0.5, accolades: { championships: 4 } };
    const html = renderToStaticMarkup(createElement(ThreeWayCompare, { p1, p2, p3: { ...player, fgPct: 0 }, isZh: false, t }));
    expect(html).toContain("50.0%");
    expect(html).toContain("0.0%");
    expect(html).toContain("as of the start of 2025-26");
    expect(html).toContain("Incomplete stats: overall comparison unavailable");
    expect(html).not.toContain("text-accent-amber font-bold");
    expect(html).toMatch(/>0<\/span>/);
  });
  it("only builds radar axes from complete pairs, including zero", () => {
    expect(buildRadarStats({ ...player, pts: null }, player, "RS").map(axis => axis.label)).toEqual(["RPG", "APG"]);
    expect(buildRadarStats({ ...player, pts: null, reb: null, ast: null }, player, "RS")).toEqual([]);
    expect(buildRadarStats({ ...player, pts: 0 }, { ...player, pts: 0 }, "RS")[0]).toMatchObject({ home: 0, away: 0 });
    expect(buildRadarStats({ ...player, playoffPpg: 30 }, { ...player, playoffPpg: 20, playoffRpg: 10 }, "PO")).toEqual([{ label: "PPG", home: 30, away: 20, max: 30 }]);
    expect(buildRadarStats(player, player, "PO")).toEqual([]);
  });
  it("shooting and honours show unknown as dash with no comparative bar", () => {
    const shooting = renderToStaticMarkup(createElement(ShootingSplits, { p1: { ...player, fgPct: null }, p2: { ...player, fgPct: 0.5 }, isZh: false }));
    expect(shooting).toContain("—");
    expect(shooting).not.toContain("width:");
    expect(shooting).not.toContain("text-accent-amber");
    const unknown = renderToStaticMarkup(createElement(AccoladeTile, { label: "Rings", v1: undefined, v2: 4 }));
    expect(unknown).toContain("—");
    expect(unknown).not.toContain("width:");
    expect(unknown).not.toContain("text-accent-amber");
    const knownZero = renderToStaticMarkup(createElement(AccoladeTile, { label: "Rings", v1: 0, v2: 4 }));
    expect(knownZero).toContain(">0</span>");
    expect(knownZero).toContain("width:0%");
  });
  it("era context never fabricates a missing player's scoring share", () => {
    const html = renderToStaticMarkup(createElement(EraContext, { p1: { ...player, pts: null, seasonYear: 2016 }, p2: player, isZh: false }));
    expect(html).toContain("—");
    expect(html).not.toContain("0.0% of team output");
    expect(html).not.toMatch(/NaN|Infinity/);
  });
  it("retains the valid three-way winner and zero values", () => {
    const html = renderToStaticMarkup(createElement(ThreeWayCompare, { p1: player, p2: { ...player, pts: 0, reb: 0, ast: 0 }, p3: { ...player, pts: 1, reb: 1, ast: 1 }, isZh: false, t }));
    expect(html).toContain("leads 3/3 categories");
    expect(html.match(/>0\.0</g)).toHaveLength(3);
  });
});

describe("comparison periods and source labels", () => {
  it("only declares compatible career or same-known-season sets", () => {
    expect(comparisonPeriodsCompatible([player, player])).toBe(true);
    expect(comparisonPeriodsCompatible([player, { ...player, isIconicSeason: true, season: "2025-26" }])).toBe(true);
    expect(comparisonPeriodsCompatible([player, { ...player, isIconicSeason: true, season: "2015-16" }])).toBe(false);
    expect(comparisonPeriodsCompatible([player, { ...player, indexProvenance: undefined }])).toBe(false);
    expect(comparisonPeriodsCompatible([{ ...player, isLegend: true }, { ...player, isLegend: true }])).toBe(true);
    expect(comparisonPeriodsCompatible([player, { ...player, isLegend: true }])).toBe(false);
  });
  it("distinguishes index, archive, stale, career, iconic and old cached metadata", () => {
    expect(comparisonSourceLabel(player, false)).toBe("2025-26 · NBA player index");
    expect(comparisonSourceLabel({ ...player, indexProvenance: { ...player.indexProvenance!, source: "bundled-archive" } }, false)).toContain("archived snapshot");
    expect(comparisonSourceLabel({ ...player, indexProvenance: { ...player.indexProvenance!, stale: true } }, false)).toContain("refresh unavailable");
    expect(comparisonSourceLabel({ ...player, isLegend: true }, false)).toBe("Curated career averages");
    expect(comparisonSourceLabel({ ...player, isIconicSeason: true, season: "2015-16" }, false)).toBe("2015-16 · curated single-season stats");
    expect(comparisonSourceLabel({ ...player, indexProvenance: undefined }, false)).toBe("Source information unavailable");
    expect(comparisonSourceLabel({ ...player, indexProvenance: undefined }, true)).toBe("来源信息暂不可用");
  });
});
