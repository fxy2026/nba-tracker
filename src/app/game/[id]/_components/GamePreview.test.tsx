import { isValidElement, Suspense, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoxScore, ScheduleDate, ScheduleGame } from "@/lib/api";

const mocks = vi.hoisted(() => ({ schedule: vi.fn(), box: vi.fn() }));
vi.mock("@/lib/api", async (original) => ({
  ...await original<typeof import("@/lib/api")>(),
  getFullSchedule: mocks.schedule,
  getBoxScore: mocks.box,
}));
vi.mock("@/lib/locale", () => ({ getLocale: async () => "en" }));
import GamePage from "../page";
import GamePreview from "./GamePreview";

// Synthetic scheduled and final games exercise pre-game branches without
// claiming that the baked archive currently contains an upcoming game.
const finalGame: ScheduleGame = {
  gameId: "0022500001", gameStatus: 3, gameStatusText: "Final",
  gameCode: "20251022/LALBOS", gameDateTimeUTC: "2025-10-22T23:00:00Z",
  homeTeam: { teamId: 1610612738, teamTricode: "BOS", teamName: "Celtics", teamCity: "Boston", teamSlug: "celtics", score: 120 },
  awayTeam: { teamId: 1610612747, teamTricode: "LAL", teamName: "Lakers", teamCity: "Los Angeles", teamSlug: "lakers", score: 110 },
};
const upcoming: ScheduleGame = {
  ...finalGame, gameId: "0022500002", gameStatus: 1, gameStatusText: "Scheduled",
  gameCode: "20251024/LALBOS", gameDateTimeUTC: "2025-10-24T23:00:00Z",
  homeTeam: { ...finalGame.homeTeam, score: 0 },
  awayTeam: { ...finalGame.awayTeam, score: 0 },
  arenaName: "Preview Test Arena", arenaCity: "Boston",
};
const schedule: ScheduleDate[] = [
  { gameDate: "10/22/2025 00:00:00", games: [finalGame] },
  { gameDate: "10/24/2025 00:00:00", games: [upcoming] },
];
const box: BoxScore = {
  ...upcoming, gameTimeUTC: upcoming.gameDateTimeUTC,
  arena: { arenaName: upcoming.arenaName!, arenaCity: upcoming.arenaCity! },
  homeTeam: { ...upcoming.homeTeam, statistics: {}, players: [], periods: [] },
  awayTeam: { ...upcoming.awayTeam, statistics: {}, players: [], periods: [] },
};
const props: Parameters<typeof GamePreview>[0] = {
  gameId: upcoming.gameId, gameTimeUTC: upcoming.gameDateTimeUTC,
  home: { ...upcoming.homeTeam, tricode: "BOS" },
  away: { ...upcoming.awayTeam, tricode: "LAL" },
  arenaName: upcoming.arenaName, arenaCity: upcoming.arenaCity, isZh: false,
};
const injuries = {
  injuries: [
    { displayName: "Boston Celtics", injuries: [
      { status: "Out", athlete: { displayName: "Home Player", position: { abbreviation: "C" } } },
    ] },
    { displayName: "Los Angeles Lakers", injuries: Array.from({ length: 6 }, (_, index) => ({
      status: "Questionable", athlete: { displayName: `Away Player ${index + 1}`, position: { abbreviation: "G" } },
    })) },
  ],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function expectSchedule(html: string) {
  expect(html).toContain("Game Preview");
  expect(html).toContain("Preview Test Arena, Boston");
  expect(html).toContain("Beijing");
  expect(html).toContain("07:00");
  expect(html).toContain("Record");
  expect(html).toContain("1-0");
  expect(html).toContain("0-1");
  expect(html).toContain("120.0");
  expect(html).toContain("110.0");
  expect(html).toContain("Last 5");
  expect(html).toContain("Season series");
  expect(html).toContain(`/game/${finalGame.gameId}`);
  expect(html).toContain("LAL 110");
  expect(html).toContain("120 BOS");
}

function expectNoInjuries(html: string) {
  expectSchedule(html);
  expect(html.match(/No injuries reported/g)).toHaveLength(2);
  expect(html).not.toContain("Home Player");
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.schedule.mockReset().mockResolvedValue(schedule);
  mocks.box.mockReset().mockResolvedValue(null);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GamePreview injury deadline", () => {
  it.each([
    ["headers", true], ["headers", false], ["body", true], ["body", false],
  ] as const)("bounds stalled %s at five seconds (transport respects abort: %s)", async (stage, respectsAbort) => {
    const pending = deferred<Response>();
    const body = deferred<unknown>();
    let signal!: AbortSignal;
    const abort = vi.fn();
    const json = vi.fn(() => body.promise);
    const fetcher = vi.fn((_url: string, init: RequestInit) => {
      signal = init.signal!;
      signal.addEventListener("abort", () => {
        abort();
        if (respectsAbort) (stage === "headers" ? pending : body).reject(new Error("aborted"));
      }, { once: true });
      return pending.promise;
    });
    vi.stubGlobal("fetch", fetcher);
    let settled = false;
    const result = GamePreview(props).then((tree) => { settled = true; return tree; });
    await vi.advanceTimersByTimeAsync(1000);
    if (stage === "body") {
      pending.resolve({ ok: true, json } as unknown as Response);
      await vi.advanceTimersByTimeAsync(0);
      expect(json).toHaveBeenCalledOnce();
    }
    await vi.advanceTimersByTimeAsync(3999);
    expect(settled).toBe(false);
    expect(signal.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
    const html = renderToStaticMarkup(await result);
    expectNoInjuries(html);
    expect(signal.aborted).toBe(true);
    expect(abort).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(mocks.schedule).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    // Promise.race must consume late rejections rather than leak an unhandled
    // rejection after the preview has already rendered its schedule fallback.
    if (!respectsAbort) (stage === "headers" ? pending : body).reject(new Error("late failure"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(abort).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves successful injuries, the five-row display limit, and the request/cache settings", async () => {
    const body = deferred<unknown>();
    let signal!: AbortSignal;
    const json = vi.fn(() => body.promise);
    const fetcher = vi.fn((_url: string, init: RequestInit) => {
      signal = init.signal!;
      return Promise.resolve({ ok: true, json });
    });
    vi.stubGlobal("fetch", fetcher);
    const result = GamePreview(props);
    await vi.advanceTimersByTimeAsync(4999);
    expect(json).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(1);
    body.resolve(injuries);
    const html = renderToStaticMarkup(await result);
    expectSchedule(html);
    expect(html).toContain("Home Player");
    expect(html).toContain("Out");
    expect(html).toContain("Questionable");
    for (let i = 1; i <= 5; i++) expect(html).toContain(`Away Player ${i}`);
    expect(html).not.toContain("Away Player 6");
    expect(html).not.toContain("No injuries reported");
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries",
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }, next: { revalidate: 1800 }, signal },
    );
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(signal.aborted).toBe(false);
  });

  it.each(["network", "body", "invalid JSON", "HTTP"])("cleans up and preserves schedule data on %s failure", async (failure) => {
    let signal!: AbortSignal;
    const json = vi.fn(() => failure === "body"
      ? Promise.reject(new Error("body failed"))
      : new Response("not valid JSON").json());
    const fetcher = vi.fn((_url: string, init: RequestInit) => {
      signal = init.signal!;
      if (failure === "network") return Promise.reject(new Error("offline"));
      return Promise.resolve({ ok: failure !== "HTTP", json });
    });
    vi.stubGlobal("fetch", fetcher);
    expectNoInjuries(renderToStaticMarkup(await GamePreview(props)));
    expect(fetcher).toHaveBeenCalledOnce();
    expect(json).toHaveBeenCalledTimes(failure === "body" || failure === "invalid JSON" ? 1 : 0);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(signal.aborted).toBe(false);
  });

  it.each([null, {}, { injuries: null }, { injuries: [] }, { injuries: {} }, { injuries: "invalid" }])(
    "handles empty or non-array injury envelopes without blocking schedule data: %j", async (payload) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
      expectNoInjuries(renderToStaticMarkup(await GamePreview(props)));
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("does not replace the timeout fallback when an ignored-abort body later succeeds", async () => {
    const body = deferred<unknown>();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => body.promise }));
    const result = GamePreview(props);
    await vi.advanceTimersByTimeAsync(5000);
    const tree = await result;
    expectNoInjuries(renderToStaticMarkup(tree));
    body.resolve(injuries);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await result).toBe(tree);
    expectNoInjuries(renderToStaticMarkup(tree));
    expect(vi.getTimerCount()).toBe(0);
  });
});

type ElementProps = { children?: ReactNode; fallback?: ReactNode };
function elements(node: ReactNode, component: unknown): ReactElement<ElementProps>[] {
  if (Array.isArray(node)) return node.flatMap((child) => elements(child, component));
  if (!isValidElement<ElementProps>(node)) return [];
  return [...(node.type === component ? [node] : []), ...elements(node.props.children, component)];
}

it.each(["schedule fallback", "box-score shell"])("releases the actual upcoming route's %s preview when injuries time out", async (branch) => {
  mocks.box.mockResolvedValue(branch === "box-score shell" ? box : null);
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: () => new Promise(() => {}) });
  vi.stubGlobal("fetch", fetcher);
  const page = await GamePage({ params: Promise.resolve({ id: upcoming.gameId }) });
  const previews = elements(page, GamePreview);
  expect(previews).toHaveLength(1);
  const boundary = elements(page, Suspense).find((node) => elements(node.props.children, GamePreview).length)!;
  expect(renderToStaticMarkup(boundary.props.fallback)).toContain("skeleton-shimmer");
  const result = GamePreview(previews[0].props as Parameters<typeof GamePreview>[0]);
  await vi.advanceTimersByTimeAsync(5000);
  expectNoInjuries(renderToStaticMarkup(await result));
  expect(mocks.schedule).toHaveBeenCalledTimes(branch === "box-score shell" ? 1 : 2);
  expect(fetcher).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
