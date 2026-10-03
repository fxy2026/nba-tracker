import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AbsoluteShotLegend, ShotSampleCoverage } from "@/components/ShotSampleContext";
import CareerCourt from "@/app/lab/career-arc/CareerCourt";
import { playerShotRequestUrl } from "./player-shot-request";
import { getAbsoluteZoneColor } from "./shot-zones";

describe("absolute sample FG percentage", () => {
  it.each([false, true])("has a numeric 0–100 scale without an invented comparison (Chinese: %s)", isZh => {
    const html = renderToStaticMarkup(<AbsoluteShotLegend isZh={isZh} />);
    expect(html).toContain("0%");
    expect(html).toContain("50%");
    expect(html).toContain("100%");
    expect(html).toContain(isZh ? "样本区域命中率" : "Sample zone FG%");
    expect(html).not.toMatch(/league|above avg|below avg|联盟|均值/i);
  });

  it("uses absolute endpoints and clamps out-of-range percentages", () => {
    expect(getAbsoluteZoneColor(0)).toBe("rgb(71,85,105)");
    expect(getAbsoluteZoneColor(50)).toBe("rgb(84,125,178)");
    expect(getAbsoluteZoneColor(100)).toBe("rgb(96,165,250)");
    expect(getAbsoluteZoneColor(-1)).toBe(getAbsoluteZoneColor(0));
    expect(getAbsoluteZoneColor(101)).toBe(getAbsoluteZoneColor(100));
    expect(getAbsoluteZoneColor(Number.NaN)).toBe(getAbsoluteZoneColor(0));
  });

  it("preserves exact zone FG and ignores the legacy leagueAvg prop", () => {
    const props = { zoneStats: [{ zone: "Paint" as const, made: 1, total: 2, pct: 50 }], overallPct: 50, isZh: false, seasonLabel: "2025-26" };
    const html = renderToStaticMarkup(<CareerCourt {...props} />);
    expect(renderToStaticMarkup(<CareerCourt {...props} leagueAvg={46} />)).toBe(html);
    expect(html).toContain("50.0%");
    expect(html).toMatch(/1<!-- -->\/<!-- -->2|1\/2/);
    expect(html).toContain("Available-game sample");
    expect(html).toContain(getAbsoluteZoneColor(50));
    expect(html).not.toMatch(/league|above avg|below avg|联盟|均值/i);
  });
});

describe("sample coverage disclosure", () => {
  const url = (season: string, team = "LAL") => playerShotRequestUrl(2544, team, season, "regular", "2026-27");

  it("identifies partial current-team schedule coverage without claiming player appearances", () => {
    const html = renderToStaticMarkup(<ShotSampleCoverage requestUrl={url("2026-27")} games={{ loaded: 30, total: 82 }} isZh={false} />);
    expect(html).toContain('data-shot-coverage="partial-sample"');
    expect(html).toContain("30 / 82 game feeds loaded");
    expect(html).toContain("30 most recent games");
    expect(html).toContain("current LAL schedule");
    expect(html).toContain("not the player&#x27;s full-season appearances");
    expect(html).toContain("Full-season shot coverage is not verified");
  });

  it.each(["2025-26", "2026-27"])("identifies the actual historical/TOT player-log route for %s", season => {
    const html = renderToStaticMarkup(<ShotSampleCoverage requestUrl={url(season, "TOT")} games={{ loaded: 20, total: 20 }} isZh={false} />);
    expect(html).toContain('data-shot-coverage="available-sample"');
    expect(html).toContain("20 / 20 game feeds loaded");
    expect(html).toContain("selected player game log");
    expect(html).toContain("Full-season shot coverage is not verified");
    expect(html).not.toContain("current TOT schedule");
    expect(html).not.toMatch(/complete season|full-season coverage verified/i);
  });

  it.each([undefined, { loaded: 0, total: 0 }])("does not infer zero attempts or completeness from absent/empty feeds", games => {
    const html = renderToStaticMarkup(<ShotSampleCoverage requestUrl={url("2025-26")} games={games} isZh={false} />);
    expect(html).toContain("Available-game sample");
    expect(html).toContain("Full-season shot coverage is not verified");
    expect(html).not.toContain("0%");
    expect(html).not.toContain("No attempts");
  });

  it("keeps the sample and denominator qualification in Chinese", () => {
    const html = renderToStaticMarkup(<ShotSampleCoverage requestUrl={url("2026-27")} games={{ loaded: 30, total: 82 }} isZh />);
    expect(html).toContain("部分比赛样本");
    expect(html).toContain("已载入 30 / 82 场比赛数据");
    expect(html).toContain("不是球员的完整赛季出场数");
    expect(html).toContain("完整赛季投篮覆盖尚未核实");
  });
});
