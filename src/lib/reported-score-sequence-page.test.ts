import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schedule from "@/data/schedule-2025-26.json";
import type { BoxScore, ScheduleGame } from "./api";
import { getReportedScoreSequence } from "./reported-score-sequence-archive";
import ReportedScoreSequence from "@/app/game/[id]/_components/ReportedScoreSequence";
import RecoveredPlayerBox from "@/app/game/[id]/_components/RecoveredPlayerBox";
import ProviderPlayerBox from "@/app/game/[id]/_components/ProviderPlayerBox";
import OfficialGameReport from "@/app/game/[id]/_components/OfficialGameReport";
import BoxScoreSection from "@/app/game/[id]/_components/BoxScoreSection";
import GamePreview from "@/app/game/[id]/_components/GamePreview";
import WithPlayByPlay from "@/app/game/[id]/_components/WithPlayByPlay";
import VerifiedShotChartSection from "@/app/game/[id]/_components/VerifiedShotChartSection";
import ShotChartSection from "@/app/game/[id]/_components/ShotChartSection";
import PlayByPlaySection from "@/app/game/[id]/_components/PlayByPlaySection";
import KeyMomentsSection from "@/app/game/[id]/_components/KeyMomentsSection";
import ReplaySection from "@/app/game/[id]/_components/ReplaySection";
import ScoringFlowSection from "@/app/game/[id]/_components/ScoringFlowSection";
import GameRecap from "@/app/game/[id]/_components/GameRecap";
import ShootingEfficiency from "@/app/game/[id]/_components/ShootingEfficiency";
import type { GamePlayByPlay } from "./game-play-by-play";
import GameAutoRefresh from "@/components/GameAutoRefresh";

const mocks = vi.hoisted(() => ({
  box: vi.fn(),
  players: vi.fn(),
  schedule: vi.fn(),
  pbp: vi.fn(),
  locale: vi.fn(),
}));

vi.mock("@/lib/api", async (original) => ({
  ...await original<typeof import("./api")>(),
  getBoxScore: mocks.box,
  getPlayerIndex: mocks.players,
  getFullSchedule: mocks.schedule,
}));
vi.mock("@/lib/game-play-by-play", () => ({ getGamePlayByPlay: mocks.pbp }));
vi.mock("@/lib/locale", () => ({ getLocale: mocks.locale }));

import GamePage from "@/app/game/[id]/page";

const gameId = "0022500961";
const canonical = schedule.dates.flatMap((date) => date.games)
  .find((game) => game.gameId === gameId)! as ScheduleGame;

interface InspectedProps {
  children?: ReactNode;
  fallback?: ReactNode;
  [key: string]: unknown;
}

// Inspect the server page's returned tree without executing async children.
// This also checks Suspense fallbacks while an optional PBP request is pending.
function elementsOf(node: ReactNode, component: unknown): ReactElement<InspectedProps>[] {
  if (Array.isArray(node)) return node.flatMap((child) => elementsOf(child, component));
  if (!isValidElement<InspectedProps>(node)) return [];
  return [
    ...(node.type === component ? [node] : []),
    ...elementsOf(node.props.children, component),
    ...elementsOf(node.props.fallback, component),
  ];
}

function useScheduleGame(game: ScheduleGame) {
  mocks.schedule.mockResolvedValue([{ gameDate: "03/13/2026 00:00:00", games: [game] }]);
}

function genuineBox(gameStatus: number): BoxScore {
  return {
    gameId,
    gameCode: canonical.gameCode,
    gameStatus,
    gameStatusText: gameStatus === 3 ? "Final" : gameStatus === 2 ? "Q2" : "Scheduled",
    gameTimeUTC: canonical.gameDateTimeUTC,
    arena: { arenaName: "Little Caesars Arena", arenaCity: "Detroit" },
    homeTeam: { ...canonical.homeTeam, players: [], periods: [], statistics: {} },
    awayTeam: { ...canonical.awayTeam, players: [], periods: [], statistics: {} },
  };
}

beforeEach(() => {
  mocks.box.mockReset().mockResolvedValue(null);
  mocks.players.mockReset().mockResolvedValue([]);
  mocks.schedule.mockReset().mockResolvedValue(schedule.dates);
  mocks.pbp.mockReset().mockReturnValue(new Promise(() => {}));
  mocks.locale.mockReset().mockResolvedValue("en");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected archive-page fetch")));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const identityMismatches: [string, (game: ScheduleGame) => void][] = [
  ["another game ID", (game) => { game.gameId = "0022500340"; }],
  ["wrong archive date", (game) => { game.gameCode = "20260314/MEMDET"; }],
  ["wrong canonical UTC tipoff", (game) => { game.gameDateTimeUTC = "2026-03-14T23:30:00Z"; }],
  ["wrong game-code matchup", (game) => { game.gameCode = "20260313/DETMEM"; }],
  ["home tricode", (game) => { game.homeTeam.teamTricode = "BOS"; }],
  ["away tricode", (game) => { game.awayTeam.teamTricode = "ATL"; }],
  ["home numeric team ID", (game) => { game.homeTeam.teamId = 1610612738; }],
  ["away numeric team ID", (game) => { game.awayTeam.teamId = 1610612737; }],
  ["string home team ID", (game) => { Reflect.set(game.homeTeam, "teamId", "1610612765"); }],
  ["string away team ID", (game) => { Reflect.set(game.awayTeam, "teamId", "1610612763"); }],
  ["swapped home and away", (game) => { [game.homeTeam, game.awayTeam] = [game.awayTeam, game.homeTeam]; }],
  ["wrong home final", (game) => { game.homeTeam.score = 125; }],
  ["wrong away final", (game) => { game.awayTeam.score = 109; }],
  ["string final score", (game) => { Reflect.set(game.homeTeam, "score", "126"); }],
];

describe("reported score sequence allowlist", () => {
  it("loads only the canonical final identity and its official source", () => {
    const sequence = getReportedScoreSequence(canonical);
    expect(sequence).toMatchObject({
      gameId,
      gameDate: "2026-03-13",
      home: { teamId: 1610612765, teamTricode: "DET", score: 126 },
      away: { teamId: 1610612763, teamTricode: "MEM", score: 110 },
      source: {
        url: "https://statsdmz.nba.com/pdfs/20260313/20260313_MEMDET_book.pdf",
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        pageCount: 19,
      },
    });
    expect(sequence?.reportedScoreRows).toHaveLength(124);
    expect(sequence?.reportedPeriodEnds).toHaveLength(4);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(identityMismatches)("rejects %s without guessing identity", (_label, mutate) => {
    const game = structuredClone(canonical);
    mutate(game);
    expect(getReportedScoreSequence(game)).toBeNull();
  });

  it.each([0, 1, 2, 4])("withholds the archive for non-final status %s", (gameStatus) => {
    expect(getReportedScoreSequence({ ...canonical, gameStatus })).toBeNull();
  });

  it.each(["0022599999", "__proto__", "constructor", "toString"])("rejects unknown key %s", (unknownId) => {
    expect(getReportedScoreSequence({ ...canonical, gameId: unknownId })).toBeNull();
  });
});

describe("reported score sequence game-page isolation", () => {
  it.each(["en", "zh"])("adds the sequence beside existing recovered stats in the no-box final branch (%s)", async (locale) => {
    mocks.locale.mockResolvedValue(locale);
    const tree = await GamePage({ params: Promise.resolve({ id: gameId }) });
    const sequences = elementsOf(tree, ReportedScoreSequence);
    expect(sequences).toHaveLength(1);
    expect(sequences[0].props).toMatchObject({
      isZh: locale === "zh",
      sequence: { gameId, reportedScoreRows: expect.any(Array) },
      periodScores: { gameId, home: { periodPoints: [37, 31, 30, 28] }, away: { periodPoints: [35, 26, 23, 26] } },
    });
    expect(elementsOf(tree, RecoveredPlayerBox)).toHaveLength(1);
    expect(elementsOf(tree, RecoveredPlayerBox)[0].props.box).toMatchObject({ gameId, provider: "BigBallsData" });
    expect(elementsOf(tree, ProviderPlayerBox)).toHaveLength(0);
    expect(elementsOf(tree, OfficialGameReport)).toHaveLength(1);
    expect(mocks.box).toHaveBeenCalledExactlyOnceWith(gameId);
    expect(mocks.players).toHaveBeenCalledTimes(1);
    expect(mocks.schedule).toHaveBeenCalledTimes(1);
    expect(mocks.pbp).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    for (const component of [WithPlayByPlay, ShotChartSection, PlayByPlaySection, KeyMomentsSection, ReplaySection, ScoringFlowSection, GameAutoRefresh]) {
      expect(elementsOf(tree, component)).toHaveLength(0);
    }
  });

  it.each(identityMismatches)("suppresses the sequence on the page with %s", async (_label, mutate) => {
    const game = structuredClone(canonical);
    mutate(game);
    useScheduleGame(game);
    const tree = await GamePage({ params: Promise.resolve({ id: game.gameId }) });
    expect(elementsOf(tree, ReportedScoreSequence)).toHaveLength(0);
    expect(mocks.pbp).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([1, 2])("does not expose an archive when the schedule reports status %s", async (gameStatus) => {
    useScheduleGame({ ...canonical, gameStatus });
    const tree = await GamePage({ params: Promise.resolve({ id: gameId }) });
    expect(elementsOf(tree, ReportedScoreSequence)).toHaveLength(0);
    expect(elementsOf(tree, GamePreview)).toHaveLength(gameStatus === 1 ? 1 : 0);
    expect(mocks.pbp).not.toHaveBeenCalled();
  });

  it("does not substitute a sequence for an unknown or missing game", async () => {
    const unknownId = "0022599999";
    for (const dates of [[], [{ gameDate: "03/13/2026 00:00:00", games: [{ ...canonical, gameId: unknownId }] }]]) {
      mocks.schedule.mockResolvedValue(dates);
      const tree = await GamePage({ params: Promise.resolve({ id: unknownId }) });
      expect(elementsOf(tree, ReportedScoreSequence)).toHaveLength(0);
    }
    expect(mocks.pbp).not.toHaveBeenCalled();
  });

  it("retains another game's existing recovery without reusing the MEM–DET sequence", async () => {
    const tree = await GamePage({ params: Promise.resolve({ id: "0022500340" }) });
    expect(elementsOf(tree, RecoveredPlayerBox)).toHaveLength(1);
    expect(elementsOf(tree, RecoveredPlayerBox)[0].props.box).toMatchObject({ gameId: "0022500340" });
    expect(elementsOf(tree, ReportedScoreSequence)).toHaveLength(0);
    expect(mocks.pbp).not.toHaveBeenCalled();
  });

  it.each([1, 2, 3])("keeps a genuine box at status %s on the normal page path", async (gameStatus) => {
    const box = genuineBox(gameStatus);
    mocks.box.mockResolvedValue(box);
    const tree = await GamePage({ params: Promise.resolve({ id: gameId }) });
    expect(elementsOf(tree, ReplaySection)).toHaveLength(0);
    expect(elementsOf(tree, ReportedScoreSequence)).toHaveLength(0);
    expect(elementsOf(tree, RecoveredPlayerBox)).toHaveLength(0);
    expect(elementsOf(tree, ProviderPlayerBox)).toHaveLength(0);
    expect(mocks.schedule).not.toHaveBeenCalled();
    if (gameStatus === 1) {
      expect(mocks.pbp).not.toHaveBeenCalled();
      expect(elementsOf(tree, GamePreview)).toHaveLength(1);
    } else {
      expect(mocks.pbp).toHaveBeenCalledExactlyOnceWith(gameId);
      expect(elementsOf(tree, WithPlayByPlay).length).toBeGreaterThan(0);
      const tables = elementsOf(tree, BoxScoreSection);
      expect(tables.map((element) => element.props.team)).toEqual([box.awayTeam, box.homeTeam]);
      expect(tables.every((element) => Array.isArray(element.props.shots) && element.props.shots.length === 0)).toBe(true);
      // The video component is retired; statistical PBP, field-goal charts,
      // scoring flow, and the final-game recap retain their streaming paths.
      const data: GamePlayByPlay = { actions: [], shots: [], scoringShots: [], scoreEvents: [] };
      const streamed = elementsOf(tree, WithPlayByPlay).map(element =>
        (element.props.children as unknown as (data: GamePlayByPlay) => ReactNode)(data));
      expect(elementsOf(streamed, ReplaySection)).toHaveLength(0);
      expect(elementsOf(streamed, ShotChartSection).length + elementsOf(tree, VerifiedShotChartSection).length).toBe(1);
      expect(elementsOf(streamed, PlayByPlaySection)).toHaveLength(1);
      expect(elementsOf(tree, ShootingEfficiency)).toHaveLength(1);
      expect(elementsOf(streamed, GameRecap)).toHaveLength(gameStatus === 3 ? 1 : 0);
      expect(elementsOf(streamed, ScoringFlowSection)).toHaveLength(gameStatus === 3 ? 1 : 0);
      expect(elementsOf(streamed, KeyMomentsSection)).toHaveLength(gameStatus === 3 ? 1 : 0);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
