import { isValidElement, type ComponentProps, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OfficialPeriodScores from "@/app/game/[id]/_components/OfficialPeriodScores";
import QuarterBars from "@/components/QuarterBars";
import schedule from "@/data/schedule-2025-26.json";
import finalsEvidence from "../../docs/evidence/game-period-scores/finals-2025-26.json";
import remainingEvidence from "../../docs/evidence/game-period-scores/remaining-2025-26.json";
import type { BoxScore, ScheduleGame } from "./api";

const mocks = vi.hoisted(() => ({ box: vi.fn(), pbp: vi.fn(), full: vi.fn(), players: vi.fn(), locale: vi.fn() }));
vi.mock("@/lib/api", async (original) => ({
  ...await original<typeof import("./api")>(),
  getBoxScore: mocks.box,
  getPlayerIndex: mocks.players,
  getFullSchedule: mocks.full,
}));
vi.mock("@/lib/game-play-by-play", () => ({ getGamePlayByPlay: mocks.pbp }));
vi.mock("@/lib/locale", () => ({ getLocale: mocks.locale }));
vi.mock("@/lib/official-period-score-archive", async (original) => {
  const actual = await original<typeof import("./official-period-score-archive")>();
  return { ...actual, getOfficialPeriodScores: vi.fn(actual.getOfficialPeriodScores) };
});

import Page from "@/app/game/[id]/page";
import { getOfficialPeriodScores } from "./official-period-score-archive";

const evidenceGames = [...finalsEvidence.games, ...remainingEvidence.games];
const ids = evidenceGames.map(game => game.gameId);
const game = (id = ids[0]): ScheduleGame => structuredClone(schedule.dates.flatMap((date) => date.games).find((game) => game.gameId === id)!);
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const useSchedule = (game: ScheduleGame) => {
  const date = game.gameCode.split("/")[0];
  mocks.full.mockResolvedValue([{ gameDate: `${date.slice(4, 6)}/${date.slice(6, 8)}/${date.slice(0, 4)} 00:00:00`, games: [game] }]);
};

// Inspect the actual async page's selected element tree rather than invoking
// its unrelated async descendants. Full RSC rendering belongs in browser QA.
function findProps<Props>(node: ReactNode, component: unknown): Props[] {
  if (Array.isArray(node)) return node.flatMap((child) => findProps<Props>(child, component));
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return node.type === component ? [node.props as Props] : findProps<Props>(node.props.children, component);
}
const archived = (node: ReactNode) => findProps<ComponentProps<typeof OfficialPeriodScores>>(node, OfficialPeriodScores);
function visibleText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(visibleText).join(" ");
  if (!isValidElement<{ children?: ReactNode }>(node)) return "";
  return visibleText(node.props.children);
}
const regularQuarterBars = (node: ReactNode) => findProps<ComponentProps<typeof QuarterBars>>(node, QuarterBars);

function boxScore(scheduleGame: ScheduleGame, status = 3, hasPeriods = true): BoxScore {
  const team = (side: "homeTeam" | "awayTeam") => ({
    ...scheduleGame[side],
    players: [],
    statistics: {},
    // Deliberately differs from the archive while preserving the final total.
    periods: hasPeriods ? [1, 2, 3, scheduleGame[side].score - 6].map((score, index) => ({ period: index + 1, periodType: "REGULAR", score })) : [],
  });
  return {
    gameId: scheduleGame.gameId,
    gameCode: scheduleGame.gameCode,
    gameStatus: status,
    gameStatusText: status === 3 ? "Final" : status === 2 ? "Q1" : "Scheduled",
    gameTimeUTC: scheduleGame.gameDateTimeUTC,
    arena: { arenaName: "Arena", arenaCity: scheduleGame.homeTeam.teamCity },
    homeTeam: team("homeTeam"),
    awayTeam: team("awayTeam"),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.box.mockReset().mockResolvedValue(null);
  mocks.full.mockReset().mockResolvedValue(schedule.dates);
  mocks.players.mockReset().mockResolvedValue([]);
  mocks.locale.mockReset().mockResolvedValue("en");
  mocks.pbp.mockReset().mockReturnValue(new Promise(() => {}));
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected request while selecting archived quarter scores"); }));
});
afterEach(() => {
  try { expect(fetch).not.toHaveBeenCalled(); }
  finally { vi.unstubAllGlobals(); }
});

describe.each(["en", "zh"] as const)("actual game page archive selection in %s", (locale) => {
  it.each(ids)("selects verified quarter scores for %s without PBP or an extra request", async (id) => {
    mocks.locale.mockResolvedValue(locale);
    const result = await Page(params(id));
    const restored = archived(result);
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({
      scores: { gameId: id, kind: "official-reported-period-scores", source: { publisher: "NBA" } },
      isZh: locale === "zh",
    });
    const expected = evidenceGames.find(source => source.gameId === id)!;
    expect(restored[0].scores.home.periodPoints).toEqual(expected.home.periodPoints);
    expect(restored[0].scores.away.periodPoints).toEqual(expected.away.periodPoints);
    expect(restored[0].scores.source.reportUrl).toBe(expected.source.reportUrl);
    expect(visibleText(result)).toContain(locale === "zh"
      ? "投篮图与逐回合暂不可用。"
      : "Shot charts and play-by-play remain unavailable.");
    expect(getOfficialPeriodScores).toHaveBeenCalledExactlyOnceWith(game(id));
    expect(regularQuarterBars(result)).toHaveLength(0);
    expect(mocks.box).toHaveBeenCalledExactlyOnceWith(id);
    expect(mocks.players).toHaveBeenCalledExactlyOnceWith();
    expect(mocks.full).toHaveBeenCalledExactlyOnceWith();
    expect(mocks.pbp).not.toHaveBeenCalled();
  });
});

describe.each(["en", "zh"] as const)("NBA source precedence in %s", (locale) => {
  describe.each([
    { label: "final with existing periods", status: 3, hasPeriods: true },
    { label: "final with empty periods", status: 3, hasPeriods: false },
    { label: "live with empty periods", status: 2, hasPeriods: false },
    { label: "scheduled with empty periods", status: 1, hasPeriods: false },
  ])("NBA box score stays preferred: $label", ({ status, hasPeriods }) => {
    it.each(ids)("does not supplement or replace %s with archived periods", async (id) => {
      mocks.locale.mockResolvedValue(locale);
      const box = boxScore(game(id), status, hasPeriods);
      mocks.box.mockResolvedValue(box);
      const result = await Page(params(id));
      expect(archived(result)).toHaveLength(0);
      expect(getOfficialPeriodScores).not.toHaveBeenCalled();
      expect(mocks.full).not.toHaveBeenCalled();
      const periods = regularQuarterBars(result);
      if (hasPeriods) {
        expect(periods).toHaveLength(1);
        expect(periods[0].homePeriods).toBe(box.homeTeam.periods);
        expect(periods[0].awayPeriods).toBe(box.awayTeam.periods);
      } else {
        expect(periods).toHaveLength(0);
      }
      if (status >= 2) expect(mocks.pbp).toHaveBeenCalledExactlyOnceWith(id);
      else expect(mocks.pbp).not.toHaveBeenCalled();
    });
  });

});

describe.each(["en", "zh"] as const)("archive remains unavailable in %s", (locale) => {
  beforeEach(() => mocks.locale.mockResolvedValue(locale));

  describe.each([1, 2])("schedule-only game with status %i", (status) => {
    it.each(ids)("does not apply the completed archive to %s", async (id) => {
      useSchedule({ ...game(id), gameStatus: status });
      const result = await Page(params(id));
      expect(archived(result)).toHaveLength(0);
      expect(regularQuarterBars(result)).toHaveLength(0);
      expect(getOfficialPeriodScores).not.toHaveBeenCalled();
      expect(mocks.pbp).not.toHaveBeenCalled();
    });
  });

  it("does not use another game's periods for an unknown final", async () => {
    const unknown = { ...game(), gameId: "0042500406" };
    useSchedule(unknown);
    const result = await Page(params(unknown.gameId));
    expect(archived(result)).toHaveLength(0);
    expect(regularQuarterBars(result)).toHaveLength(0);
    expect(getOfficialPeriodScores).toHaveBeenCalledExactlyOnceWith(unknown);
    expect(getOfficialPeriodScores).toHaveLastReturnedWith(null);
    expect(mocks.pbp).not.toHaveBeenCalled();
    expect(visibleText(result)).toContain(locale === "zh"
      ? "本场比赛的详细数据（Box Score、投篮图、逐回合）暂不可用。"
      : "Detailed stats for this game (box score, shot chart, play-by-play) are currently unavailable.");
  });

  it("does not invent periods when neither NBA box nor schedule knows the game", async () => {
    mocks.full.mockResolvedValue([]);
    expect(archived(await Page(params(ids[0])))).toHaveLength(0);
    expect(getOfficialPeriodScores).not.toHaveBeenCalled();
    expect(mocks.pbp).not.toHaveBeenCalled();
  });

  it.each([
    { label: "local game date", change: (game: ScheduleGame) => { game.gameCode = "20260604/NYKSAS"; } },
    { label: "away team ID", change: (game: ScheduleGame) => { game.awayTeam.teamId = 1610612738; } },
    { label: "home team ID", change: (game: ScheduleGame) => { game.homeTeam.teamId = 1610612738; } },
    { label: "away tricode", change: (game: ScheduleGame) => { game.awayTeam.teamTricode = "BOS"; } },
    { label: "home tricode", change: (game: ScheduleGame) => { game.homeTeam.teamTricode = "BOS"; } },
    { label: "away final score", change: (game: ScheduleGame) => { game.awayTeam.score += 1; } },
    { label: "home final score", change: (game: ScheduleGame) => { game.homeTeam.score += 1; } },
    { label: "home/away orientation", change: (game: ScheduleGame) => { [game.homeTeam, game.awayTeam] = [game.awayTeam, game.homeTeam]; game.gameCode = "20260603/SASNYK"; } },
  ])("withholds archived component when $label conflicts with the actual schedule", async ({ change }) => {
    const mismatched = game();
    change(mismatched);
    useSchedule(mismatched);
    const result = await Page(params(mismatched.gameId));
    expect(archived(result)).toHaveLength(0);
    expect(regularQuarterBars(result)).toHaveLength(0);
    expect(getOfficialPeriodScores).toHaveBeenCalledExactlyOnceWith(mismatched);
    expect(getOfficialPeriodScores).toHaveLastReturnedWith(null);
    expect(mocks.pbp).not.toHaveBeenCalled();
  });

});
