import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import jordan from "@/data/historical-career-archives/893-2026-10-04.json";
import archive from "@/data/player-career-archives/201939-2026-10-03.json";
import { normalizeHistoricalCareerData } from "@/lib/historical-career-data";
import { normalizePlayerCareerData } from "@/lib/player-career-data";
import { careerSeasonStats, historicalSeasonStats } from "@/lib/player-season-stats";

const runtime = vi.hoisted(() => ({
  result: {} as Record<string, unknown>,
  hook: vi.fn(),
  selection: null as { season: string; team: string } | null,
}));
vi.mock("@/lib/usePlayerCareer", () => ({ usePlayerCareer: (...args: unknown[]) => { runtime.hook(...args); return runtime.result; } }));
vi.mock("react", async original => {
  const react = await original<typeof import("react")>();
  return { ...react, useState: (initial: unknown) => runtime.selection && typeof initial === "object" && initial !== null && "season" in initial
    ? [runtime.selection, (selection: { season: string; team: string }) => { runtime.selection = selection; }]
    : react.useState(initial) };
});
import PlayerSeasonStats, { SeasonStatsContent } from "./PlayerSeasonStats";

const row = { SEASON_ID: "2025-26", TEAM_ABBREVIATION: "LAL", GP: 70, MIN: 30, PTS: 20, REB: 5, AST: 6, STL: 1, BLK: 0, FG_PCT: .5, FG3_PCT: 0, FT_PCT: null, FGA: 18, FG3A: 1, TOV: 2.1 };
const historical = normalizeHistoricalCareerData(jordan, 893)!;
const render = (locale: "en" | "zh" = "en") => renderToStaticMarkup(createElement(PlayerSeasonStats, { playerId: 2544, playerName: "LeBron James", teamTricode: "LAL", locale }));
beforeEach(() => {
  runtime.selection = null;
  runtime.hook.mockClear();
  runtime.result = { data: { careerSeasons: [row] }, loading: false, error: false, stale: false, retry: vi.fn() };
});

describe.each(["en", "zh"] as const)("season detail cards in %s", locale => {
  it("renders meaningful stats, all three shooting groups, missing marks and optional values", () => {
    const html = render(locale);
    for (const key of ["PTS", "REB", "AST", "GP", "MIN", "STL", "BLK", "TOV"]) expect(html).toContain(`data-season-stat="${key}"`);
    for (const kind of ["FG", "FG3", "FT"]) expect(html).toContain(`data-season-shooting="${kind}"`);
    expect(html).toContain("2025-26"); expect(html).toContain("LAL");
    expect(html).toContain(">18.0</dd>"); expect(html).toContain(">0.0</dd>"); expect(html).toContain(">—</dd>");
    expect(html).toContain(locale === "zh" ? "场均数据" : "Per game");
    expect(html).not.toContain("data-season-stat=\"GS\""); expect(html).not.toContain("<table");
  });
  it("renders loading, source-empty and unavailable as different recoverable states", () => {
    runtime.result = { data: null, loading: true, error: false };
    expect(render(locale)).toContain(locale === "zh" ? "正在载入赛季统计" : "Loading season statistics");
    runtime.result = { data: null, loading: false, error: true, retry: vi.fn() };
    expect(render(locale)).toContain(locale === "zh" ? "重试" : "Retry");
    runtime.result = { data: { careerSeasons: [] }, loading: false, error: false, retry: vi.fn() };
    expect(render(locale)).toContain(locale === "zh" ? "数据源已响应" : "The source responded");
  });
  it("renders reviewed initial rows with capture date while the shared hook refreshes", () => {
    const initialData = normalizePlayerCareerData(archive.data)!;
    runtime.result = { data: initialData, loading: true, error: false, stale: true, retry: vi.fn() };
    const html = renderToStaticMarkup(createElement(PlayerSeasonStats, { playerId: 201939, playerName: "Stephen Curry", teamTricode: "GSW", locale, initialData }));
    expect(runtime.hook).toHaveBeenCalledWith(201939, "Stephen Curry", "GSW", initialData);
    expect(html).toContain("2025-26"); expect(html).toContain("GSW"); expect(html).toContain("2026-10-03");
    expect(html).toContain(locale === "zh" ? "正在检查实时来源" : "Checking live sources");
    expect(html).toContain("NBA.com"); expect(html).toContain("disabled=\"\"");
  });
  it("renders historical totals without fetching live career and separates playoff rows", () => {
    const html = renderToStaticMarkup(createElement(PlayerSeasonStats, { playerId: 893, locale, historicalCareer: historical }));
    expect(runtime.hook).not.toHaveBeenCalled();
    expect(html).toContain("2002-03"); expect(html).toContain("StatMuse");
    expect(html).toContain(locale === "zh" ? "第三方总计存档" : "Secondary-source totals archive");
    expect(html).toContain('aria-pressed="true"'); expect(html).toContain('aria-pressed="false"');
    const playoffs = renderToStaticMarkup(createElement(SeasonStatsContent, { playerId: 893, locale, seasonType: "Playoffs", historicalCareer: historical, rows: historical.rows.filter(row => row.seasonType === "Playoffs").map(historicalSeasonStats) }));
    expect(playoffs).toContain("1997-98"); expect(playoffs).not.toContain("2002-03");
    expect(playoffs).toContain(locale === "zh" ? "季后赛" : "Playoffs");
  });
  it("preserves last-good rows and source after refresh failure", () => {
    runtime.result = { ...runtime.result, error: true, stale: true };
    const html = render(locale);
    expect(html).toContain("2025-26"); expect(html).toContain(locale === "zh" ? "保留上次成功" : "last successful");
    expect(html).toContain(locale === "zh" ? "重试" : "Retry");
  });
});

type NodeProps = { children?: ReactNode; [key: string]: unknown };
function nodes(node: ReactNode): ReactElement<NodeProps>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<NodeProps>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
it("repeated season/team switches select actual rows and reset stale team selections", () => {
  runtime.selection = { season: "", team: "" };
  const rows = [row, { ...row, TEAM_ABBREVIATION: "TOT", GP: 80 }, { ...row, SEASON_ID: "2024-25", TEAM_ABBREVIATION: "CLE", GP: 50 }].map(careerSeasonStats);
  const tree = () => SeasonStatsContent({ playerId: 2544, rows, locale: "en" });
  const select = (id: string) => nodes(tree()).find(node => node.props.id === `season-stats-2544-${id}`)!;
  expect(select("team").props.value).toBe("TOT");
  (select("team").props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "LAL" } });
  expect(select("team").props.value).toBe("LAL");
  (select("season").props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "2024-25" } });
  expect(select("season").props.value).toBe("2024-25");
  expect(nodes(tree()).filter(node => node.type === "select")).toHaveLength(1);
  (select("season").props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "2025-26" } });
  expect(select("team").props.value).toBe("TOT");
  for (const node of nodes(tree()).filter(node => node.type === "select")) expect(node.props.className).toContain("min-h-11");
});
