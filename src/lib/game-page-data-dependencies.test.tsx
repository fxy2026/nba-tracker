import { isValidElement, Suspense, type ReactElement, type ReactNode } from "react";
import { PassThrough } from "node:stream";
import { renderToPipeableStream } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schedule from "@/data/schedule-2025-26.json";
import type { BoxScore, PlayerInfo, ScheduleGame } from "./api";
import { EMPTY_PLAY_BY_PLAY, type GamePlayByPlay } from "./game-play-by-play";
import GameLeaders from "@/app/game/[id]/_components/GameLeaders";
import BoxScoreSection from "@/app/game/[id]/_components/BoxScoreSection";
import PreGameHero from "@/app/game/[id]/_components/PreGameHero";
import GamePreview from "@/app/game/[id]/_components/GamePreview";
import WithPlayByPlay from "@/app/game/[id]/_components/WithPlayByPlay";
import WithPlayerInfo from "@/app/game/[id]/_components/WithPlayerInfo";
import GameHero from "@/app/game/[id]/_components/GameHero";
import VerifiedShotChartSection from "@/app/game/[id]/_components/VerifiedShotChartSection";
import ReportedScoreSequence from "@/app/game/[id]/_components/ReportedScoreSequence";

const mocks = vi.hoisted(() => ({ box: vi.fn(), index: vi.fn(), schedule: vi.fn(), pbp: vi.fn() }));
vi.mock("@/lib/api", async original => ({
  ...await original<typeof import("./api")>(),
  getBoxScore: mocks.box,
  getPlayerIndex: mocks.index,
  getFullSchedule: mocks.schedule,
}));
vi.mock("@/lib/game-play-by-play", async original => ({
  ...await original<typeof import("./game-play-by-play")>(),
  getGamePlayByPlay: mocks.pbp,
}));
vi.mock("@/lib/locale", () => ({ getLocale: async () => "en" }));
import GamePage from "@/app/game/[id]/page";

const id = "0022500961";
const game = schedule.dates.flatMap(date => date.games).find(game => game.gameId === id)! as ScheduleGame;
const player: PlayerInfo = {
  personId: 1631105, firstName: "Jalen", lastName: "Duren", slug: "jalen-duren",
  teamId: game.homeTeam.teamId, teamAbbr: "DET", teamCity: "Detroit", teamName: "Pistons",
  jersey: "0", position: "C", height: "6-10", weight: "250", college: "Memphis", country: "USA",
  draftYear: 2022, draftRound: 1, draftNumber: 13, fromYear: "2022", toYear: "2025",
  pts: 0, reb: 0, ast: 0,
};
interface Props { children?: ReactNode; fallback?: ReactNode; [key: string]: unknown }
function elements(node: ReactNode, component: unknown): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(child => elements(child, component));
  if (!isValidElement<Props>(node)) return [];
  return [
    ...(node.type === component ? [node] : []),
    ...elements(node.props.children, component),
    ...elements(node.props.fallback, component),
  ];
}
function box(status: number): BoxScore {
  return {
    gameId: id, gameCode: game.gameCode, gameStatus: status,
    gameStatusText: status === 3 ? "Final" : status === 2 ? "Q1" : "Scheduled",
    gameTimeUTC: game.gameDateTimeUTC,
    arena: { arenaName: "Little Caesars Arena", arenaCity: "Detroit" },
    homeTeam: { ...game.homeTeam, players: [], periods: [], statistics: {} },
    awayTeam: { ...game.awayTeam, players: [], periods: [], statistics: {} },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function settle() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
const render = () => GamePage({ params: Promise.resolve({ id }) });
function metadataConsumers(tree: ReactNode) {
  const pbpChildren = elements(tree, WithPlayByPlay).map(wrapper =>
    (wrapper.props.children as unknown as (data: GamePlayByPlay) => ReactNode)(EMPTY_PLAY_BY_PLAY));
  return [...elements(tree, WithPlayerInfo), ...elements(pbpChildren, WithPlayerInfo)];
}
function consumeMetadata(wrapper: ReactElement<Props>) {
  return WithPlayerInfo(wrapper.props as unknown as Parameters<typeof WithPlayerInfo>[0]);
}
function tableBoundaries(tree: ReactNode) {
  return elements(tree, Suspense).filter(boundary => elements(boundary.props.fallback, BoxScoreSection).length > 0);
}

beforeEach(() => {
  mocks.box.mockReset().mockResolvedValue(null);
  // A permanently pending index makes any accidental dependency observable.
  mocks.index.mockReset().mockReturnValue(new Promise<PlayerInfo[]>(() => {}));
  mocks.schedule.mockReset().mockResolvedValue(schedule.dates);
  mocks.pbp.mockReset().mockReturnValue(new Promise<GamePlayByPlay>(() => {}));
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected source fetch")));
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe("game page request dependencies", () => {
  it("renders the verified archive without starting or waiting for a player index", async () => {
    let rendered = false;
    const page = render().then(tree => { rendered = true; return tree; });
    await settle();
    expect(rendered).toBe(true);
    expect(mocks.index).not.toHaveBeenCalled();
    expect(mocks.pbp).not.toHaveBeenCalled();
    const tree = await page;
    expect(elements(tree, VerifiedShotChartSection)[0].props.data).toMatchObject({
      gameId: id, coverage: { mapped: 181, total: 181, complete: true },
    });
    expect(elements(tree, ReportedScoreSequence)).toHaveLength(1);
    expect(elements(tree, WithPlayByPlay)).toHaveLength(0);
    expect(elements(tree, WithPlayerInfo)).toHaveLength(0);
  });

  it.each(["schedule", "box"])("renders an upcoming %s preview with no index or PBP request", async source => {
    if (source === "box") mocks.box.mockResolvedValue(box(1));
    else mocks.schedule.mockResolvedValue([{ gameDate: "03/13/2026 00:00:00", games: [{ ...game, gameStatus: 1 }] }]);
    let rendered = false;
    const page = render().then(tree => { rendered = true; return tree; });
    await settle();
    expect(rendered).toBe(true);
    expect(mocks.index).not.toHaveBeenCalled();
    expect(mocks.pbp).not.toHaveBeenCalled();
    const tree = await page;
    expect(elements(tree, PreGameHero)).toHaveLength(1);
    expect(elements(tree, GamePreview)).toHaveLength(1);
    expect(elements(tree, GameLeaders)).toHaveLength(0);
    expect(elements(tree, WithPlayByPlay)).toHaveLength(0);
    expect(elements(tree, WithPlayerInfo)).toHaveLength(0);
  });

  it.each([2, 3])("starts PBP and player info only after a status-%s box, without serializing them", async status => {
    const pendingBox = deferred<BoxScore | null>();
    const pendingIndex = deferred<PlayerInfo[]>();
    const pendingPbp = deferred<GamePlayByPlay>();
    mocks.box.mockReturnValue(pendingBox.promise);
    mocks.index.mockReturnValue(pendingIndex.promise);
    mocks.pbp.mockReturnValue(pendingPbp.promise);
    let rendered = false;
    const page = render().then(tree => { rendered = true; return tree; });
    await settle();
    expect(mocks.box).toHaveBeenCalledExactlyOnceWith(id);
    expect(mocks.index).not.toHaveBeenCalled();
    expect(mocks.pbp).not.toHaveBeenCalled();

    pendingBox.resolve(box(status));
    await settle();
    expect(mocks.pbp).toHaveBeenCalledExactlyOnceWith(id);
    expect(mocks.index).toHaveBeenCalledTimes(1);
    expect(mocks.pbp.mock.invocationCallOrder[0]).toBeLessThan(mocks.index.mock.invocationCallOrder[0]);
    expect(rendered).toBe(true); // Neither pending optional request blocks the page.
    const tree = await page;
    expect(elements(tree, GameHero)).toHaveLength(1);
    expect(elements(tree, GameHero)[0].props.boxScore).toMatchObject({ gameStatus: status });
    const leaders = elements(tree, GameLeaders);
    expect(leaders).toHaveLength(1);
    expect(leaders[0].props.playerInfoMap).toEqual(new Map());
    expect(leaders[0].props.isLive).toBe(status === 2);
    expect(elements(tree, BoxScoreSection)).toHaveLength(2);
    for (const table of elements(tree, BoxScoreSection)) expect(table.props.playerInfoMap).toEqual(new Map());

    const wrappers = elements(tree, WithPlayByPlay);
    expect(wrappers.length).toBeGreaterThan(0);
    for (const wrapper of wrappers) expect(wrapper.props.data).toBe(pendingPbp.promise);
    const consumers = metadataConsumers(tree);
    expect(consumers).toHaveLength(3);
    for (const consumer of consumers) expect(consumer.props.data).toBe(consumers[0].props.data);
    expect(tableBoundaries(tree)).toHaveLength(2);
    for (const boundary of tableBoundaries(tree)) {
      expect(elements(boundary.props.children, Suspense)).toHaveLength(0);
      expect(elements(boundary.props.children, WithPlayByPlay)).toHaveLength(1);
    }

    pendingIndex.resolve([player]);
    const enriched = await Promise.all(consumers.map(consumeMetadata));
    const enrichedLeaders = elements(enriched, GameLeaders);
    expect(enrichedLeaders).toHaveLength(1);
    const info = enrichedLeaders[0].props.playerInfoMap;
    expect(info).toEqual(new Map([[player.personId, player]]));
    const streamedTables = elements(enriched, BoxScoreSection);
    expect(streamedTables).toHaveLength(2);
    for (const table of streamedTables) expect(table.props.playerInfoMap).toBe(info);
    expect(elements(enriched, Suspense)).toHaveLength(0);
    expect(mocks.index).toHaveBeenCalledTimes(1);
    expect(mocks.schedule).not.toHaveBeenCalled();
  });

  it.each([2, 3])("keeps status-%s leaders and box fallbacks when player info fails", async status => {
    mocks.box.mockResolvedValue(box(status));
    const pendingIndex = deferred<PlayerInfo[]>();
    mocks.index.mockReturnValue(pendingIndex.promise);
    const tree = await render();
    expect(mocks.index).toHaveBeenCalledTimes(1);
    expect(mocks.pbp).toHaveBeenCalledExactlyOnceWith(id);
    expect(elements(tree, GameLeaders)).toHaveLength(1);
    expect(elements(tree, BoxScoreSection)).toHaveLength(2);
    for (const component of [...elements(tree, GameLeaders), ...elements(tree, BoxScoreSection)]) {
      expect(component.props.playerInfoMap).toEqual(new Map());
    }
    pendingIndex.reject(new Error("Player index unavailable"));
    const enriched = await Promise.all(metadataConsumers(tree).map(consumeMetadata));
    const consumers = [...elements(enriched, GameLeaders), ...elements(enriched, BoxScoreSection)];
    expect(consumers).toHaveLength(3);
    for (const component of consumers) expect(component.props.playerInfoMap).toEqual(new Map());
    if (status === 3) {
      expect(elements(tree, VerifiedShotChartSection)[0].props.data).toMatchObject({ gameId: id });
    }
  });

  it.each(["index", "pbp"])("streams the existing basic table until both inputs settle, with %s first", async first => {
    mocks.box.mockResolvedValue(box(2));
    const pendingIndex = deferred<PlayerInfo[]>();
    const pendingPbp = deferred<GamePlayByPlay>();
    mocks.index.mockReturnValue(pendingIndex.promise);
    mocks.pbp.mockReturnValue(pendingPbp.promise);
    const tree = await render();
    const boundary = tableBoundaries(tree)[0];
    const output = new PassThrough();
    let html = "";
    let allReady = false;
    const errors: unknown[] = [];
    output.on("data", chunk => { html += chunk.toString(); });
    const done = new Promise<void>((yes, no) => { output.on("end", yes); output.on("error", no); });
    const stream = renderToPipeableStream(<main><h1>Basic game hero</h1>{boundary}</main>, {
      onShellReady() { stream.pipe(output); },
      onAllReady() { allReady = true; },
      onError(error) { errors.push(error); },
    });
    try {
      await vi.waitFor(() => expect(html).toContain("110"));
      expect(html).toContain("Basic game hero");
      expect(html).toContain("<table");
      expect(allReady).toBe(false);
      if (first === "index") pendingIndex.resolve([player]);
      else pendingPbp.resolve(EMPTY_PLAY_BY_PLAY);
      await new Promise<void>(resolve => setImmediate(resolve));
      expect(allReady).toBe(false);
      if (first === "index") pendingPbp.resolve(EMPTY_PLAY_BY_PLAY);
      else pendingIndex.resolve([player]);
      await done;
      expect(allReady).toBe(true);
      expect(errors).toEqual([]);
      expect(mocks.index).toHaveBeenCalledTimes(1);
      expect(mocks.pbp).toHaveBeenCalledExactlyOnceWith(id);
    } finally {
      stream.abort();
    }
  });
});
