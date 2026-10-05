import Link from "next/link";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerIdentity } from "./player-identity";
import { PLAYER_LOG_STATS, type PlayerGameLogData, type PlayerLogRow, type PlayerLogSeasonType } from "./player-game-log-data";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  locale: "en", seasonType: "Regular Season", loading: true, error: false,
  index: 0, data: null as PlayerGameLogData | null, commitUrl: vi.fn(), setRetry: vi.fn(),
}));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: vi.fn(),
  useMemo: (calculate: () => unknown) => calculate(),
  useState: (initial: unknown) => {
    const index = state.index++;
    if (index === 0) return [{ ...(initial as object), data: state.data, loading: state.loading, error: state.error }, vi.fn()];
    return [index === 1 ? 0 : 20, index === 1 ? state.setRetry : vi.fn()];
  },
}));
vi.mock("@/components/player/PlayerProfilePanels", async original => ({
  ...await original<typeof import("@/components/player/PlayerProfilePanels")>(),
  usePlayerProfileLocation: () => new URLSearchParams({ gameSeason: "2025-26", gameType: state.seasonType }).toString(),
  commitPlayerProfileUrl: (href: string) => state.commitUrl(href),
}));
vi.mock("@/components/LocaleProvider", () => ({
  useLocale: () => ({
    locale: state.locale,
    t: { statsPage: { regularSeason: "Regular Season", playoffs: "Playoffs" }, playerStats: {}, common: {} },
  }),
}));
import ArchivedPlayerProfile from "@/components/player/ArchivedPlayerProfile";
import PlayerGameLog from "@/components/player/PlayerGameLog";

type Props = { children?: ReactNode; [key: string]: unknown };
function nodes(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (isValidElement<Props>(node)) return text(node.props.children);
  return typeof node === "string" || typeof node === "number" ? String(node) : "";
}
const player: PlayerIdentity = {
  id: 999999, name: "Identity only", aliases: [], sources: ["all-time-registry"],
  href: "/player/999999", teamLabel: null, teamAbbr: null, position: null,
  indexProvenance: null, shotCoverage: null,
};
beforeEach(() => {
  Object.assign(state, { locale: "en", seasonType: "Regular Season", loading: true, error: false, index: 0, data: null });
  state.commitUrl.mockClear(); state.setRetry.mockClear();
  vi.stubGlobal("window", { location: { href: "https://nba.xpy.me/player/2544?panel=games&gameSeason=2025-26" } });
});
afterEach(() => vi.unstubAllGlobals());

describe.each(["en", "zh"] as const)("archived profile navigation in %s", locale => {
  it.each(["ready", "error"] as const)("labels identity-only availability honestly with %s archive status", shotArchiveStatus => {
    const tree = ArchivedPlayerProfile({ player: { ...player, shotArchiveStatus }, locale, catalog: [], initialSelection: null, initialResource: null });
    const all = nodes(tree);
    const nav = all.find(node => node.type === "nav")!;
    const links = nodes(nav).filter(node => node.type === Link);
    expect(links.every(link => link.props.prefetch === false)).toBe(true);
    expect(links.map(link => link.props.href)).toEqual(["#overview", "#shooting"]);
    expect(text(links[1])).toBe(locale === "zh" ? "数据可用情况" : "Data availability");
    expect(all.filter(node => node.props.id === "shooting")).toHaveLength(1);
    expect(all.filter(node => node.props.id === "career")).toHaveLength(1);
    expect(all.find(node => node.props.id === "shooting")?.props.role).toBe("status");
  });
  it.each([true, false])("preserves rich-profile navigation for selection present: %s", selected => {
    const tree = ArchivedPlayerProfile({
      player: { ...player, id: selected ? player.id : 893 }, locale, catalog: [],
      initialSelection: selected ? { playerId: player.id, season: "2000-01", seasonType: "Regular Season" } : null,
      initialResource: null,
    });
    const nav = nodes(tree).find(node => node.type === "nav")!;
    const links = nodes(nav).filter(node => node.type === Link);
    expect(links.every(link => link.props.prefetch === false)).toBe(true);
    expect(links.map(node => node.props.href)).toEqual(["#overview", "#shooting", "#career"]);
  });
});

const seasonTypes = ["Regular Season", "Playoffs", "Pre Season"] as const;
function logData(rows: PlayerLogRow[] = []): PlayerGameLogData {
  return {
    playerId: 2544, season: "2025-26", seasonType: state.seasonType as PlayerLogSeasonType, rows,
    source: { provider: "NBA Stats", url: "https://www.nba.com/stats/player/2544/boxscores-traditional", retrievedAt: "2026-10-05T08:00:00.000Z", archived: false },
    coverage: "source-season",
  };
}
const renderLog = () => PlayerGameLog({ playerId: 2544, seasons: ["2025-26", "2024-25"] });

describe.each(["en", "zh"] as const)("mobile game log states in %s", locale => {
  it("keeps the five loading skeleton rows in normal flow with an accessible busy status", () => {
    state.locale = locale;
    const all = nodes(renderLog());
    const status = all.find(node => node.props.role === "status" && node.props["aria-busy"] === "true")!;
    expect(status).toBeDefined();
    expect(text(status)).toContain(locale === "zh" ? "正在加载该赛季比赛" : "Loading this season’s games");
    expect(nodes(status).filter(node => String(node.props.className).includes("skeleton-shimmer"))).toHaveLength(5);
    expect(nodes(status).every(node => !String(node.props.className).includes("w-32"))).toBe(true);
    expect(all.filter(node => node.type === "table")).toHaveLength(0);
  });
  it.each(seasonTypes)("exposes selected %s and >=44px touch targets through loading, error and valid-empty states", seasonType => {
    for (const [loading, error] of [[true, false], [false, true], [false, false]]) {
      Object.assign(state, { locale, seasonType, loading, error, index: 0 });
      state.data = !loading && !error ? logData() : null;
      const tree = renderLog(), all = nodes(tree);
      const group = all.find(node => node.props.role === "group")!;
      expect(group.props["aria-label"]).toBe(locale === "zh" ? "赛事类型" : "Season type");
      const buttons = nodes(group).filter(node => node.type === "button");
      expect(buttons).toHaveLength(3);
      for (const [index, button] of buttons.entries()) {
        expect(button.props.type).toBe("button");
        expect(button.props["aria-pressed"]).toBe(seasonTypes[index] === seasonType);
        expect(button.props.className).toContain("min-h-11");
        (button.props.onClick as () => void)();
        const destination = new URL(state.commitUrl.mock.calls.at(-1)![0], "https://nba.xpy.me");
        expect(destination.searchParams.get("gameType")).toBe(seasonTypes[index]);
        expect(destination.searchParams.get("gameSeason")).toBe("2025-26");
        expect(destination.searchParams.get("panel")).toBe("games");
        expect(state.setRetry).toHaveBeenLastCalledWith(0);
      }
      expect(all.find(node => node.type === "select")?.props.className).toContain("min-h-11");
      if (loading) expect(text(tree)).toContain(locale === "zh" ? "正在加载该赛季比赛" : "Loading this season’s games");
      else if (error) {
        expect(text(tree)).toContain(locale === "zh" ? "不代表没有出场" : "does not mean no games were played");
        const retry = all.find(node => node.type === "button" && text(node) === (locale === "zh" ? "重试" : "Retry"))!;
        expect(retry.props.className).toContain("min-h-11");
        (retry.props.onClick as () => void)();
        const increment = state.setRetry.mock.calls.at(-1)![0] as (value: number) => number;
        expect(increment(0)).toBe(1);
      } else expect(text(tree)).toContain(locale === "zh" ? "空白不等于球员零出场" : "an empty source does not establish zero appearances");
      expect(all.filter(node => node.type === "table")).toHaveLength(0);
    }
  });
  it("contains loaded game columns in a labelled keyboard-accessible local horizontal scroller", () => {
    Object.assign(state, { locale, loading: false, error: false });
    const row: PlayerLogRow = {
      ...Object.fromEntries(PLAYER_LOG_STATS.map(key => [key, null])) as Record<typeof PLAYER_LOG_STATS[number], number | null>,
      id: "nba:0022500001", nbaGameId: "0022500001", date: "2025-10-22", team: "LAL", opponent: "GSW", home: true, wl: "W",
      sourceUrl: "https://www.nba.com/game/0022500001/box-score", pts: 20, reb: 6, ast: 7, stl: 0,
    };
    state.data = logData([row]);
    const all = nodes(renderLog());
    const scroller = all.find(node => node.props.role === "region")!;
    expect(scroller.props.className).toContain("overflow-x-auto");
    expect(scroller.props.className).toContain("overscroll-x-contain");
    expect(scroller.props.tabIndex).toBe(0);
    expect(scroller.props["aria-label"]).toBe(locale === "zh" ? "逐场比赛数据表，可横向滚动" : "Game log table, horizontally scrollable");
    expect(nodes(scroller).filter(node => node.type === "table")).toHaveLength(1);
    expect(nodes(scroller).filter(node => String(node.props.className).includes("sticky left-0")).length).toBeGreaterThanOrEqual(3);
    expect(text(scroller)).toContain("—/—");
    expect(text(scroller)).toContain(locale === "zh" ? "已收录场均" : "Recorded averages");
    const summary = all.find(node => node.type === "summary")!;
    expect(summary.props.className).toContain("min-h-11");
    expect(text(summary)).toBe(locale === "zh" ? "月度拆分" : "Monthly splits");
    for (const button of all.filter(node => node.type === "button")) expect(button.props.className).toContain("min-h-11");
  });
});
