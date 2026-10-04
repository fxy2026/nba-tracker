import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerIndexSnapshot, PlayerInfo } from "./api";
import type { PlayerIndexProvenance } from "./player-index-provenance";

// Runtime snapshots can carry missing averages despite the legacy API type.
type FixturePlayer = Omit<PlayerInfo, "pts" | "reb" | "ast"> & { pts: number | null; reb: number | null; ast: number | null };
type FixtureSnapshot = Omit<PlayerIndexSnapshot, "players"> & { players: FixturePlayer[] };
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ locale: "en", snapshot: null as FixtureSnapshot | null }));
vi.mock("@/lib/locale", () => ({ getLocale: async () => state.locale }));
vi.mock("@/lib/api", async original => ({ ...await original<typeof import("./api")>(), getPlayerIndexSnapshot: async () => state.snapshot }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/components/FavoriteButton", () => ({ default: () => null }));
vi.mock("@/components/ShareButton", () => ({ default: () => null }));
vi.mock("@/components/RecentVisitTracker", () => ({ default: () => null }));
vi.mock("@/components/PlayerHeadshot", () => ({ default: () => null }));
vi.mock("@/components/CountUpNumber", () => ({ default: ({ value }: { value: number }) => <span>{value}</span> }));
vi.mock("@/lib/season-heatmap-catalog-server", () => ({ getPlayerSeasonHeatmapCatalog: async () => [], loadPlayerSeasonHeatmapArchive: vi.fn() }));
import Page from "@/app/player/[id]/page";

const player: PlayerInfo = { personId: 900000001, firstName: "Test", lastName: "Player", slug: "test-player", teamId: 1610612738, teamAbbr: "BOS", teamCity: "Boston", teamName: "Celtics", jersey: "1", position: "F", height: "6-8", weight: "200", college: "", country: "", draftYear: null, draftRound: null, draftNumber: null, fromYear: "2025", toYear: "2025", pts: 10, reb: 0, ast: 2 };
const peers = [
  { ...player, personId: 900000002, pts: 20, reb: 10, ast: null },
  { ...player, personId: 900000003, pts: 15, reb: null, ast: 3 },
  { ...player, personId: 900000004, pts: 30, reb: null, ast: 0 },
  { ...player, personId: 900000005, pts: 0, reb: 20, ast: 20 },
];
const archived: PlayerIndexProvenance = { source: "bundled-archive", season: "2025-26", stale: true, retrievedAt: null };
type Props = { children?: ReactNode; [key: string]: unknown };
function nodes(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
function overview(tree: ReactNode): ReactElement<Props> {
  return nodes(tree).find(node => node.props.id === "overview")!;
}
function renderOverview(tree: ReactNode): string { return renderToStaticMarkup(overview(tree)); }
const page = () => Page({ params: Promise.resolve({ id: String(player.personId) }) });
beforeEach(() => { state.locale = "en"; state.snapshot = { players: [player, ...peers], provenance: archived }; });

describe.each(["en", "zh"] as const)("profile comparison disclosure (%s)", locale => {
  const cases: [PlayerIndexProvenance, string, string][] = [
    [archived, "2025-26 · archived snapshot", "2025-26 · 存档快照"],
    [{ source: "nba-cdn", season: "2025-26", stale: false, retrievedAt: "2026-10-04T00:00:00Z" }, "2025-26 · NBA player index", "2025-26 · NBA 球员索引"],
    [{ source: "nba-cdn", season: "2025-26", stale: true, retrievedAt: "2026-10-04T00:00:00Z" }, "2025-26 · NBA cached snapshot (refresh unavailable)", "2025-26 · NBA 缓存快照（刷新暂不可用）"],
    [{ source: "nba-cdn", season: null, stale: false, retrievedAt: null }, "season unspecified · NBA player index", "赛季未注明 · NBA 球员索引"],
  ];
  it.each(cases)("preserves source state %j alongside one closed native sample disclosure", async (provenance, en, zh) => {
    state.locale = locale; state.snapshot!.provenance = provenance;
    const tree = await page(); const html = renderToStaticMarkup(tree);
    expect(html).toContain(locale === "zh" ? zh : en);
    const disclosure = nodes(tree).filter(node => node.props.id === "profile-comparison-basis");
    expect(disclosure).toHaveLength(1); expect(disclosure[0].type).toBe("p");
    expect(disclosure[0].props.className).toContain("break-words");
    const details = nodes(tree).filter(node => node.type === "details" && nodes(node.props.children).includes(disclosure[0]));
    expect(details).toHaveLength(1); expect(details[0].props.open).toBeUndefined();
    const summary = nodes(details[0].props.children).filter(node => node.type === "summary");
    expect(summary).toHaveLength(1);
    expect(summary[0].props.children).toBe(locale === "zh" ? "样本对比口径" : "Comparison basis");
    expect(summary[0].props.className).toContain("min-h-11");
    expect(summary[0].props.className).toContain("focus-visible:outline-2");
    expect(details[0].props.onToggle).toBeUndefined();
    expect(nodes(details[0]).some(node => node.props.id === "overview")).toBe(false);
    const copy = renderToStaticMarkup(disclosure[0]);
    for (const expected of locale === "zh" ? ["已记录的场均值", "场均得分大于 0", "等权", "不设出场数或上场时间门槛", "严格低于", "四舍五入", "同值并列"] : ["recorded per-game values", "positive PPG", "equally", "no games-played or minutes minimum", "strictly below", "rounded", "Ties share rank and P"]) expect(copy).toContain(expected);
    const hero = renderOverview(tree);
    for (const rank of locale === "zh" ? ["4 人中第 4", "2 人中第 2", "3 人中第 2"] : ["#4 of 4", "#2 of 2", "#2 of 3"]) expect(hero).toContain(rank);
    expect(hero).toContain(locale === "zh" ? "对比样本均值" : "vs sample avg");
    expect(hero).toContain("18.8"); expect(hero).toContain("P0");
    expect(hero).not.toContain("in NBA"); expect(hero).not.toContain("league avg");
  });
  it.each([null, 0])("keeps unknown/zero subject %s out of the comparison without inventing ranks", async value => {
    state.locale = locale; state.snapshot!.players = [{ ...player, pts: value, reb: value, ast: value }, ...peers];
    const hero = renderOverview(await page());
    expect(hero).toContain(locale === "zh" ? "对比样本均值" : "vs sample avg");
    expect(hero).not.toMatch(/#\d+ of|人中第|>P\d+/);
    expect(hero).toContain(value === null ? "—" : ">0</span>");
  });
  it("renders equal rank and P0 for one-player and all-tied samples", async () => {
    state.locale = locale;
    for (const players of [[player], [player, { ...player, personId: 900000002 }]]) {
      state.snapshot!.players = players;
      const hero = renderOverview(await page());
      expect(hero).toContain(locale === "zh" ? `${players.length} 人中第 1` : `#1 of ${players.length}`);
      expect(hero).toContain("P0"); expect(hero).not.toContain("NaN");
    }
  });
  it("lets sample labels wrap separately from nonshrinking statistic values", async () => {
    state.locale = locale;
    const tree = await page();
    const hero = overview(tree);
    const statTiles = nodes(hero).filter(node => typeof node.type === "function" && node.type.name === "DataStatTile");
    expect(statTiles).toHaveLength(2);
    for (const tile of statTiles) {
      const renderTile = tile.type as (props: Props) => ReactElement<Props>;
      const longTile = renderTile({ ...tile.props, ctx: { rank: 1234, percentile: 50, cohortSize: 12345, sampleAvg: 12, delta: 1234 } });
      const markup = renderToStaticMarkup(longTile);
      expect(markup).toContain(locale === "zh" ? "12345 人中第 1234" : "#1234 of 12345");
      expect(markup).toContain("flex flex-wrap items-start");
      expect(markup).toContain("min-w-0 break-words");
      expect(markup).toContain("flex flex-wrap items-baseline");
      expect(markup).toContain("shrink-0 text-2xl");
      expect(longTile.props["aria-describedby"]).toBe("profile-comparison-basis");
    }
    expect(renderOverview(tree)).toContain("flex flex-wrap items-start justify-between");
    expect(renderOverview(tree)).toContain("flex flex-wrap items-center justify-between");
  });
});
