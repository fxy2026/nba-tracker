import { Children, isValidElement, Suspense, type ReactElement } from "react";
import { renderToPipeableStream, renderToStaticMarkup } from "react-dom/server";
import { PassThrough } from "node:stream";
import { beforeEach, expect, it, vi } from "vitest";
import type { NbaGame } from "@/lib/api";
const provider = vi.hoisted(() => ({ scoreboard: vi.fn<() => Promise<NbaGame[]>>() }));
vi.mock("@/lib/api", () => ({ formatDate: () => "2026-10-04", getTodayScoreboard: provider.scoreboard }));
vi.mock("@/lib/locale", () => ({ getLocale: async () => "en" }));
vi.mock("@/components/HomePlayerSearch", () => ({ default: () => <div>Player search shell</div> }));
vi.mock("@/components/HomeClient", () => ({ default: ({ initialGames }: { initialGames?: unknown }) => <div data-testid="streamed-games">{JSON.stringify(initialGames)}</div> }));
vi.mock("@/components/OffseasonHero", () => ({ default: () => null }));
vi.mock("@/components/BestOfNightCard", () => ({ default: () => null }));
vi.mock("@/components/DailyIconicPick", () => ({ default: () => null }));
import HomePage from "@/app/page";
import HomeGames, { HomeGamesLoading } from "./HomeGames";
import HomePlayerSearch from "./HomePlayerSearch";

const live = {
  gameId: "0022600001", gameCode: "20261004/LALBOS", gameStatus: 2, gameStatusText: "Q2",
  gameTimeUTC: "2026-10-04T19:00:00Z", gameEt: "2026-10-04T15:00:00",
  homeTeam: { teamId: 1, teamTricode: "BOS", teamName: "Celtics", teamCity: "Boston", teamSlug: "celtics", score: 44, wins: 0, losses: 0, seed: 0, periods: [{ period: 1, periodType: "REGULAR", score: 25 }] },
  awayTeam: { teamId: 2, teamTricode: "LAL", teamName: "Lakers", teamCity: "Los Angeles", teamSlug: "lakers", score: 39, wins: 0, losses: 0, seed: 0 },
  seriesText: "Test series", gameLeaders: { homeLeaders: { personId: 1, name: "Test", teamTricode: "BOS", points: 15, rebounds: 3, assists: 2 } },
} satisfies NbaGame;
beforeEach(() => { provider.scoreboard.mockReset(); });

it("returns search and an explicit games Suspense boundary while its scoreboard is unresolved", async () => {
  let release!: (rows: NbaGame[]) => void;
  provider.scoreboard.mockReturnValue(new Promise(resolve => { release = resolve; }));
  const page = await HomePage({ searchParams: Promise.resolve({}) });
  const children = Children.toArray(page.props.children).filter(isValidElement);
  const search = children.findIndex(child => child.type === HomePlayerSearch);
  const boundary = children[search + 1] as ReactElement<{ fallback: ReactElement; children: ReactElement<Parameters<typeof HomeGames>[0]> }>;
  expect(search).toBeGreaterThan(-1);
  expect(boundary.type).toBe(Suspense);
  expect(boundary.props.fallback.type).toBe(HomeGamesLoading);
  expect(boundary.props.children.type).toBe(HomeGames);
  let settled = false;
  const pending = HomeGames(boundary.props.children.props).then(result => { settled = true; return result; });
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(provider.scoreboard).toHaveBeenCalledTimes(1);
  release([live]);
  const result = await pending;
  expect(result.props.initialGames).toEqual([{ gameId: live.gameId, gameCode: live.gameCode, gameStatus: live.gameStatus, gameStatusText: live.gameStatusText, gameDateTimeUTC: live.gameTimeUTC, homeTeam: { ...live.homeTeam, teamSlug: "" }, awayTeam: { ...live.awayTeam, teamSlug: "" }, seriesText: live.seriesText, gameLeaders: live.gameLeaders }]);
  expect(result.props.initialDate).toBe("2026-10-04");
  expect(result.props.initialIsToday).toBe(true);
  expect(result.props.afterGames).toBe(boundary.props.children.props.afterGames);
});
it.each(["empty", "failure"])("preserves client recovery rather than an empty-day seed for %s", async kind => {
  if (kind === "empty") provider.scoreboard.mockResolvedValue([]);
  else provider.scoreboard.mockRejectedValue(new Error("offline"));
  const tree = await HomeGames({ initialDate: "2026-10-04", initialIsToday: true });
  expect(tree.props.initialGames).toBeUndefined();
});
it("never requests the scoreboard or schedule for a dated server segment", async () => {
  const tree = await HomeGames({ initialDate: "2026-10-03", initialIsToday: false });
  expect(tree.props.initialGames).toBeUndefined();
  expect(tree.props.initialDate).toBe("2026-10-03");
  expect(provider.scoreboard).not.toHaveBeenCalled();
});
it.each(["en", "zh"] as const)("shows a labelled pending state, not an empty day (%s)", locale => {
  const html = renderToStaticMarkup(<HomeGamesLoading locale={locale} />);
  expect(html).toContain('role="status"'); expect(html).toContain('aria-busy="true"');
  expect(html).toContain(locale === "zh" ? "正在加载比赛" : "Loading games");
  expect(html).not.toMatch(/No games|没有比赛/);
});

it("flushes the search and loading HTML before the scoreboard completes, then streams the scores", async () => {
  let release!: (rows: NbaGame[]) => void;
  provider.scoreboard.mockReturnValue(new Promise(resolve => { release = resolve; }));
  const page = await HomePage({ searchParams: Promise.resolve({}) });
  const chunks: string[] = [], errors: unknown[] = [];
  const output = new PassThrough();
  output.on("data", chunk => chunks.push(chunk.toString()));
  const ended = new Promise<void>((resolve, reject) => { output.on("end", resolve); output.on("error", reject); });
  const stream = renderToPipeableStream(page, {
    onShellReady() { stream.pipe(output); },
    onError(error) { errors.push(error); },
  });
  try {
    await vi.waitFor(() => expect(chunks.join("")).toContain("Loading games"));
    expect(chunks.join("")).toContain("Player search shell");
    expect(chunks.join("")).not.toContain('data-testid="streamed-games"');
    expect(provider.scoreboard).toHaveBeenCalledTimes(1);
    release([live]);
    await ended;
    expect(chunks.join("")).toContain('data-testid="streamed-games"');
    expect(chunks.join("")).toContain("44");
    expect(errors).toEqual([]);
  } finally { stream.abort(); }
});
