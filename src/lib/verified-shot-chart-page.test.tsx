import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schedule from "@/data/schedule-2025-26.json";
import type { BoxScore, ScheduleGame } from "./api";
import VerifiedShotChartSection from "@/app/game/[id]/_components/VerifiedShotChartSection";
import ReportedScoreSequence from "@/app/game/[id]/_components/ReportedScoreSequence";
import WithPlayByPlay from "@/app/game/[id]/_components/WithPlayByPlay";
import ShotChartSection from "@/app/game/[id]/_components/ShotChartSection";

const mocks = vi.hoisted(() => ({ box: vi.fn(), schedule: vi.fn(), pbp: vi.fn(), locale: vi.fn() }));
vi.mock("@/lib/api", async original => ({ ...await original<typeof import("./api")>(), getBoxScore: mocks.box, getPlayerIndex: async () => [], getFullSchedule: mocks.schedule }));
vi.mock("@/lib/game-play-by-play", () => ({ getGamePlayByPlay: mocks.pbp }));
vi.mock("@/lib/locale", () => ({ getLocale: mocks.locale }));
// The renderer has separate browser tests. These tests inspect actual server
// routing/props without waiting for WebGL or invoking client hooks.
vi.mock("@/app/game/[id]/_components/VerifiedShotChartSection", () => ({ default: function VerifiedSection() { return null; } }));
import GamePage from "@/app/game/[id]/page";

const id = "0022500961";
const game = schedule.dates.flatMap(date => date.games).find(game => game.gameId === id)! as ScheduleGame;
interface Props { children?: ReactNode; fallback?: ReactNode; [key: string]: unknown }
function elements(node: ReactNode, component: unknown): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(child => elements(child, component));
  if (!isValidElement<Props>(node)) return [];
  return [...(node.type === component ? [node] : []), ...elements(node.props.children, component), ...elements(node.props.fallback, component)];
}
function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join(" ");
  return isValidElement<Props>(node) ? text(node.props.children) : "";
}
function box(status: number): BoxScore {
  return { gameId: id, gameCode: game.gameCode, gameStatus: status, gameStatusText: "Final", gameTimeUTC: game.gameDateTimeUTC,
    arena: { arenaName: "Little Caesars Arena", arenaCity: "Detroit" },
    homeTeam: { ...game.homeTeam, players: [], periods: [], statistics: {} },
    awayTeam: { ...game.awayTeam, players: [], periods: [], statistics: {} } };
}
beforeEach(() => {
  mocks.box.mockReset().mockResolvedValue(null);
  mocks.schedule.mockReset().mockResolvedValue(schedule.dates);
  mocks.pbp.mockReset().mockReturnValue(new Promise(() => {}));
  mocks.locale.mockReset().mockResolvedValue("en");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected source fetch")));
});
afterEach(() => vi.unstubAllGlobals());

describe("verified court archive routing", () => {
  it.each(["en", "zh"])("restores a real chart independently of unavailable PBP (%s)", async locale => {
    mocks.locale.mockResolvedValue(locale);
    const tree = await GamePage({ params: Promise.resolve({ id }) });
    const chart = elements(tree, VerifiedShotChartSection);
    expect(chart).toHaveLength(1);
    expect(chart[0].props).toMatchObject({ isZh: locale === "zh", data: { gameId: id, coordinateSystem: "nba-legacy-basket-feet", coverage: { mapped: 181, total: 181, complete: true } } });
    expect(elements(tree, ReportedScoreSequence)).toHaveLength(1);
    expect(elements(tree, WithPlayByPlay)).toHaveLength(0);
    expect(elements(tree, ShotChartSection)).toHaveLength(0);
    expect(mocks.pbp).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(text(tree)).toContain(locale === "zh" ? "181 次真实出手坐标" : "181 verified shot locations");
    expect(text(tree)).not.toContain("Shot charts and play-by-play remain unavailable.");
    expect(text(tree)).not.toContain("3D court below");expect(text(tree)).not.toContain("下方 3D 球场");
    expect(text(tree)).not.toContain("投篮图与逐回合暂不可用。");
  });
  it("gives other recovered games an honest unavailable section, never MEM–DET points", async () => {
    const tree = await GamePage({ params: Promise.resolve({ id: "0042500401" }) });
    expect(elements(tree, VerifiedShotChartSection)[0].props.data).toBeNull();
    expect(text(tree)).not.toContain("181 verified");
    expect(mocks.pbp).not.toHaveBeenCalled();
  });
  it("withholds mismatched date or scores without hiding the unavailable section", async () => {
    for (const altered of [{ ...game, gameDateTimeUTC: "2026-03-14T23:30:00Z" }, { ...game, homeTeam: { ...game.homeTeam, score: 127 } }]) {
      mocks.schedule.mockResolvedValue([{ gameDate: "03/13/2026 00:00:00", games: [altered] }]);
      const tree = await GamePage({ params: Promise.resolve({ id }) });
      expect(elements(tree, VerifiedShotChartSection)[0].props.data).toBeNull();
    }
  });
  it("keeps archived shots visible while a valid normal-box PBP request is pending", async () => {
    mocks.box.mockResolvedValue(box(3));
    const tree = await GamePage({ params: Promise.resolve({ id }) });
    expect(elements(tree, VerifiedShotChartSection)[0].props.data).toMatchObject({ gameId: id, coverage: { mapped: 181 } });
    expect(elements(tree, ShotChartSection)).toHaveLength(0);
    expect(elements(tree, ReportedScoreSequence)).toHaveLength(0);
    expect(mocks.pbp).toHaveBeenCalledExactlyOnceWith(id);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([1, 2])("never exposes final shot facts for normal game status %s", async status => {
    mocks.box.mockResolvedValue(box(status));
    const tree = await GamePage({ params: Promise.resolve({ id }) });
    expect(elements(tree, VerifiedShotChartSection)).toHaveLength(0);
  });
});
