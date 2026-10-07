import { createElement, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLAYER_LOG_STATS, type PlayerGameLogData, type PlayerLogRow, type PlayerLogSeasonType } from "@/lib/player-game-log-data";

type Instance = { type: unknown; slots: unknown[]; index: number };
type Effect = { deps: unknown[]; cleanup?: () => void };
type Props = { children?: ReactNode; [key: string]: unknown };
const runtime = vi.hoisted(() => ({
  current: null as Instance | null, instances: new Map<string, Instance>(), effects: [] as (() => void)[],
  context: { mobile: null as boolean | null, active: "data" }, server: true, notifications: 0, locale: "en",
}));

// Run the actual client components against deterministic hooks and history.
// This verifies lifecycle/data ownership, not browser layout or hydration.
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useContext: () => runtime.context,
  useState: (initial: unknown) => {
    const instance = runtime.current!, index = instance.index++;
    if (!(index in instance.slots)) instance.slots[index] = typeof initial === "function" ? initial() : initial;
    return [instance.slots[index], (value: unknown) => { instance.slots[index] = typeof value === "function" ? value(instance.slots[index]) : value; }];
  },
  useRef: (initial: unknown) => { const instance = runtime.current!, index = instance.index++; return instance.slots[index] ?? (instance.slots[index] = { current: initial }); },
  useEffect: (run: () => void | (() => void), deps: unknown[]) => {
    const instance = runtime.current!, index = instance.index++, prior = instance.slots[index] as Effect | undefined;
    if (!runtime.server && (!prior || deps.some((value, i) => value !== prior.deps[i]))) runtime.effects.push(() => { prior?.cleanup?.(); instance.slots[index] = { deps, cleanup: run() }; });
  },
  useSyncExternalStore: (subscribe: (notify: () => void) => () => void, snapshot: () => unknown, serverSnapshot: () => unknown) => {
    const instance = runtime.current!, index = instance.index++;
    if (runtime.server) return serverSnapshot();
    if (!instance.slots[index]) instance.slots[index] = { cleanup: subscribe(() => { runtime.notifications++; }) };
    return snapshot();
  },
}));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: runtime.locale }) }));
vi.mock("@/components/TeamLogo", () => ({ default: ({ tricode }: { tricode: string }) => <span>{tricode}</span> }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: Props) => createElement("a", props, children) }));

import PlayerProfilePanels, { commitPlayerProfileUrl, PlayerProfilePart } from "./PlayerProfilePanels";
let PlayerGameLog: typeof import("./PlayerGameLog").default;
let url: URL;
let events: Map<string, Set<() => void>>;
let history: string[], historyIndex: number;
let fetcher: ReturnType<typeof vi.fn>;

function gameData(season = "2025-26", seasonType: PlayerLogSeasonType = "Regular Season", playerId = 2544, points = 20): PlayerGameLogData {
  const row: PlayerLogRow = {
    ...Object.fromEntries(PLAYER_LOG_STATS.map(key => [key, null])) as Record<typeof PLAYER_LOG_STATS[number], number | null>,
    id: `fixture:${playerId}:${season}:${seasonType}`, nbaGameId: null,
    date: `${Number(season.slice(0, 4)) + 1}-03-01`, team: "LAL", opponent: "GSW", home: true, wl: "W",
    sourceUrl: "https://www.espn.com/nba/game/_/gameId/401000001", pts: points, reb: 5, ast: 7, stl: 0,
  };
  return {
    playerId, season, seasonType, rows: [row],
    source: { provider: "ESPN", url: `https://www.espn.com/nba/player/gamelog/_/id/${playerId}`, retrievedAt: "2026-10-05T07:30:00.000Z", archived: true },
    coverage: "partial-source", expectedGames: 60,
  };
}
const response = (data: unknown) => ({ ok: true, json: async () => data }) as Response;
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function cleanup(instance: Instance) { instance.slots.forEach(slot => (slot as Effect | undefined)?.cleanup?.()); }
function expand(node: ReactNode, path: string, seen: Set<string>): ReactNode {
  if (Array.isArray(node)) return node.map((child, index) => expand(child, `${path}.${index}`, seen));
  if (!isValidElement<Props>(node)) return node;
  const key = `${path}:${node.key ?? ""}`;
  if (node.type === Fragment) return expand(node.props.children, `${key}.fragment`, seen);
  if (typeof node.type === "object" && "_currentValue" in node.type) {
    const previous = runtime.context; runtime.context = node.props.value as typeof runtime.context;
    const children = expand(node.props.children, `${key}.context`, seen); runtime.context = previous; return children;
  }
  if (typeof node.type === "function") {
    let instance = runtime.instances.get(key);
    if (instance && instance.type !== node.type) { cleanup(instance); instance = undefined; }
    if (!instance) { instance = { type: node.type, slots: [], index: 0 }; runtime.instances.set(key, instance); }
    seen.add(key); instance.index = 0; runtime.current = instance;
    const rendered = (node.type as (props: Props) => ReactNode)(node.props); runtime.current = null;
    return expand(rendered, `${key}.child`, seen);
  }
  const { children, ref, ...props } = node.props;
  if (ref) (ref as { current: unknown }).current = { contains: () => false, getBoundingClientRect: () => ({ top: 300, height: 52 }), scrollIntoView: vi.fn() };
  return createElement(node.type, { ...props, key }, expand(children, `${key}.host`, seen));
}
function render(node: ReactNode) {
  const seen = new Set<string>(), tree = expand(node, "root", seen);
  for (const [key, instance] of runtime.instances) if (!seen.has(key)) { cleanup(instance); runtime.instances.delete(key); }
  runtime.effects.splice(0).forEach(run => run());
  return { tree, html: renderToStaticMarkup(tree) };
}
function nodes(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
function changeSeason(tree: ReactNode, value: string) {
  const select = nodes(tree).find(node => node.type === "select")!;
  (select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
}
function click(tree: ReactNode, text: string) {
  const button = nodes(tree).find(node => node.type === "button" && node.props.children === text)!;
  expect(button, `Button ${text} exists`).toBeDefined();
  (button.props.onClick as () => void)();
}
function navigate(href: string) { url = new URL(href, url); window.dispatchEvent(new Event("popstate")); }
function back() {
  expect(historyIndex).toBeGreaterThan(0);
  url = new URL(history[--historyIndex]); window.dispatchEvent(new Event("popstate"));
}
function log(props: Partial<Parameters<typeof PlayerGameLog>[0]> = {}) {
  return <PlayerGameLog playerId={2544} playerName="LeBron James" seasons={["2025-26", "2024-25"]} {...props} />;
}

beforeEach(async () => {
  runtime.instances.forEach(cleanup); runtime.instances.clear(); runtime.effects = []; runtime.server = true;
  runtime.context = { mobile: null, active: "data" }; runtime.notifications = 0; runtime.locale = "en";
  vi.resetModules();
  PlayerGameLog = (await import("./PlayerGameLog")).default;
  events = new Map(); url = new URL("https://nba.xpy.me/player/2544?panel=games"); history = [url.href]; historyIndex = 0;
  fetcher = vi.fn(async input => {
    const params = new URL(String(input), url).searchParams;
    return response(gameData(params.get("season")!, params.get("seasonType") as PlayerLogSeasonType, Number(params.get("playerId"))));
  });
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal("window", {
    location: { get href() { return url.href; }, get pathname() { return url.pathname; }, get search() { return url.search; }, get hash() { return url.hash; } },
    history: { pushState: vi.fn((_state, _unused, href) => { url = new URL(href, url); history = history.slice(0, historyIndex + 1); history.push(url.href); historyIndex++; }) },
    matchMedia: () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    addEventListener: (event: string, notify: () => void) => { if (!events.has(event)) events.set(event, new Set()); events.get(event)!.add(notify); },
    removeEventListener: (event: string, notify: () => void) => events.get(event)?.delete(notify),
    dispatchEvent: (event: Event) => { events.get(event.type)?.forEach(notify => notify()); },
    scrollY: 0, scrollTo: vi.fn(),
  });
  vi.stubGlobal("document", { activeElement: null, getElementById: () => null });
  vi.stubGlobal("getComputedStyle", () => ({ top: "48px" }));
});
afterEach(() => { runtime.instances.forEach(cleanup); runtime.instances.clear(); vi.unstubAllGlobals(); });

describe.each(["/player/2544", "/player/2544/gamelog"])("game-log controls on %s", pathname => {
  it("preserves unrelated query/hash state and restores season/type with Back without refetching cached data", async () => {
    url = new URL(`https://nba.xpy.me${pathname}?panel=games&season=2020-21#games`); history = [url.href]; historyIndex = 0;
    runtime.server = false;
    const seed = gameData();
    const fixture = () => log({ initialData: seed });
    expect(render(fixture()).html).toContain("2025-26"); expect(fetcher).not.toHaveBeenCalled();
    changeSeason(render(fixture()).tree, "2024-25"); render(fixture()); await settle();
    expect(url.pathname).toBe(pathname); expect(url.searchParams.get("season")).toBe("2020-21");
    expect(url.searchParams.get("panel")).toBe("games"); expect(url.hash).toBe("#games");
    expect(url.searchParams.get("gameSeason")).toBe("2024-25");
    expect(render(fixture()).html).toContain("2024-25 · Regular season");
    click(render(fixture()).tree, "Playoffs"); render(fixture()); await settle();
    expect(url.searchParams.get("gameType")).toBe("Playoffs");
    expect(render(fixture()).html).toContain("2024-25 · Playoffs");
    expect(fetcher).toHaveBeenCalledTimes(2);
    back(); expect(render(fixture()).html).toContain("2024-25 · Regular season");
    back(); expect(render(fixture()).html).toContain("2025-26 · Regular season");
    expect(fetcher).toHaveBeenCalledTimes(2); expect(runtime.notifications).toBeGreaterThan(0);
    for (const request of fetcher.mock.calls) expect(new URL(String(request[0]), url).searchParams.get("playerId")).toBe("2544");
  });
});

it("honors a deep-linked season/type on SSR and fetches only that selection after mount", async () => {
  const search = "panel=games&gameSeason=2024-25&gameType=Playoffs";
  url = new URL(`https://nba.xpy.me/player/2544?${search}`);
  const seed = gameData();
  const fixture = () => log({ initialData: seed, initialSearch: search });
  const initial = render(fixture()).html;
  expect(initial).toContain("2024-25 · Playoffs");
  expect(initial).not.toContain("1 / 60 recorded games"); expect(fetcher).not.toHaveBeenCalled();
  runtime.server = false; render(fixture()); await settle();
  expect(render(fixture()).html).toContain("1 / 60 recorded games"); expect(fetcher).toHaveBeenCalledOnce();
  expect(String(fetcher.mock.calls[0][0])).toContain("season=2024-25&seasonType=Playoffs");
});

it("keeps the default archive request-free inside an unvisited mobile Games panel and across revisit", () => {
  url = new URL("https://nba.xpy.me/player/2544?panel=data");
  const seed = gameData();
  const fixture = () => <PlayerProfilePanels playerId={2544} locale="en" header={<h1>LeBron</h1>}>
    <PlayerProfilePart panel="data"><p>Overview</p></PlayerProfilePart>
    <PlayerProfilePart panel="games" deferred mobileOnly>{log({ initialData: seed })}</PlayerProfilePart>
  </PlayerProfilePanels>;
  expect(render(fixture()).html).not.toContain("recorded games");
  runtime.server = false; expect(render(fixture()).html).not.toContain("recorded games"); expect(fetcher).not.toHaveBeenCalled();
  commitPlayerProfileUrl("/player/2544?panel=games");
  expect(render(fixture()).html).toContain("1 / 60 recorded games");
  commitPlayerProfileUrl("/player/2544?panel=data"); render(fixture());
  commitPlayerProfileUrl("/player/2544?panel=games");
  expect(render(fixture()).html).toContain("1 / 60 recorded games"); expect(fetcher).not.toHaveBeenCalled();
});

it("ignores late prior-season and prior-player responses when navigation changes identity", async () => {
  runtime.server = false;
  const pending: ((data: Response) => void)[] = [];
  fetcher.mockImplementation(() => new Promise<Response>(resolve => pending.push(resolve)));
  const seed = gameData();
  const fixture = (id = 2544) => log({ playerId: id, initialData: id === 2544 ? seed : null });
  changeSeason(render(fixture()).tree, "2024-25"); render(fixture());
  expect(pending).toHaveLength(1);
  click(render(fixture()).tree, "Playoffs"); render(fixture());
  expect(pending).toHaveLength(2);
  pending[1](response(gameData("2024-25", "Playoffs", 2544, 42))); await settle();
  expect(render(fixture()).html).toContain(">42.0</dd>");
  pending[0](response(gameData("2024-25", "Regular Season", 2544, 99))); await settle();
  expect(render(fixture()).html).not.toContain(">99.0</dd>");
  expect(render(fixture()).html).toContain("2024-25 · Playoffs");
  navigate("/player/201939?gameSeason=2025-26"); render(fixture(201939));
  expect(pending).toHaveLength(3);
  expect(render(fixture(201939)).html).not.toContain(">42.0</dd>");
  navigate("/player/2544?gameSeason=2025-26"); render(fixture());
  pending[2](response(gameData("2025-26", "Regular Season", 201939, 88))); await settle();
  expect(render(fixture()).html).toContain(">20.0</dd>"); expect(render(fixture()).html).not.toContain(">88.0</dd>");
});

it.each(["en", "zh"])("keeps missing stats unknown, genuine zeros numeric and partial coverage explicit in %s", locale => {
  runtime.locale = locale;
  const seed = gameData(); seed.rows[0].ast = null; seed.rows[0].blk = null;
  const html = render(log({ initialData: seed })).html;
  expect(html).toContain(locale === "zh" ? "已收录 1 / 60 场" : "1 / 60 recorded games");
  expect(html).toContain(locale === "zh" ? "部分记录，不代表完整赛季" : "Partial records, not a complete season");
  expect(html).toContain("ESPN"); expect(html).toContain("2026-10-05");
  expect(html).toContain(">—</dd>"); expect(html).toContain(">—/—</td>");
  expect(html).toContain(">0</td>"); expect(html).not.toContain("NaN");
  expect(html).not.toContain("0.0%");
  expect(html).toContain("https://www.espn.com/nba/game/_/gameId/401000001");
  expect(html).not.toContain('href="/game/');
});

it("rejects a mismatched response identity and retains an archive when explicit refresh fails", async () => {
  runtime.server = false;
  fetcher.mockResolvedValueOnce(response(gameData("2024-25")));
  const seed = gameData();
  const fixture = () => log({ initialData: seed });
  click(render(fixture()).tree, "Refresh source"); render(fixture()); await settle();
  const html = render(fixture()).html;
  expect(html).toContain("Refresh failed; keeping the loaded records"); expect(html).toContain("2025-26 · Regular season");
  expect(html).toContain("1 / 60 recorded games"); expect(html).toContain(">20.0</dd>");
  expect(String(fetcher.mock.calls[0][0])).toContain("refresh=1");
});

it("keeps a successful newer refresh ahead of the older archive after switching type and season and returning", async () => {
  runtime.server = false;
  const seed = gameData();
  const newer = gameData("2025-26", "Regular Season", 2544, 35);
  newer.source = { ...newer.source, archived: false, retrievedAt: "2026-10-05T08:00:00.000Z" };
  fetcher.mockResolvedValueOnce(response(newer));
  const fixture = () => log({ initialData: seed });
  expect(render(fixture()).html).toContain(">20.0</dd>");
  click(render(fixture()).tree, "Refresh source"); render(fixture()); await settle();
  expect(render(fixture()).html).toContain(">35.0</dd>");
  click(render(fixture()).tree, "Playoffs"); render(fixture()); await settle();
  expect(render(fixture()).html).toContain("2025-26 · Playoffs");
  changeSeason(render(fixture()).tree, "2024-25"); render(fixture()); await settle();
  expect(render(fixture()).html).toContain("2024-25 · Playoffs");
  changeSeason(render(fixture()).tree, "2025-26"); render(fixture());
  click(render(fixture()).tree, "Regular season");
  // The navigation render and the following effect render must both keep the
  // refreshed cache, rather than flashing/restoring the original archive seed.
  for (let i = 0; i < 2; i++) {
    const html = render(fixture()).html;
    expect(html).toContain("2025-26 · Regular season");
    expect(html).toContain(">35.0</dd>"); expect(html).not.toContain(">20.0</dd>");
    expect(html).toContain("Source response"); expect(html).not.toContain('aria-busy="true"');
  }
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it("switches preseason independently without leaking regular-season archive rows", async () => {
  runtime.server = false;
  const seed = gameData();
  const preseason = gameData("2025-26", "Pre Season", 2544, 12);
  preseason.rows[0].date = "2025-10-05"; preseason.expectedGames = 1; preseason.coverage = "source-season";
  fetcher.mockResolvedValueOnce(response(preseason));
  const fixture = () => log({ initialData: seed });
  click(render(fixture()).tree, "Preseason");
  expect(url.searchParams.get("gameType")).toBe("Pre Season");
  expect(render(fixture()).html).not.toContain(">20.0</dd>"); await settle();
  expect(render(fixture()).html).toContain("2025-26 · Preseason");
  expect(render(fixture()).html).toContain(">12.0</dd>");
  expect(String(fetcher.mock.calls[0][0])).toContain("seasonType=Pre+Season");
  click(render(fixture()).tree, "Regular season");
  expect(render(fixture()).html).toContain(">20.0</dd>"); expect(fetcher).toHaveBeenCalledOnce();
});

it("deduplicates one in-flight selection shared by mounted consumers", async () => {
  runtime.server = false;
  let finish!: (response: Response) => void;
  fetcher.mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; }));
  const fixture = () => <>{log()}{log()}</>;
  render(fixture()); expect(fetcher).toHaveBeenCalledOnce();
  finish(response(gameData())); await settle();
  expect(render(fixture()).html.match(/1 \/ 60 recorded games/g)).toHaveLength(2);
  expect(fetcher).toHaveBeenCalledOnce();
});


it("keeps cached seasons request-free on Back after refreshing another season", async () => {
  runtime.server = false;
  const seed = gameData();
  const fixture = () => log({ initialData: seed });
  render(fixture());
  changeSeason(render(fixture()).tree, "2024-25"); render(fixture()); await settle(); render(fixture());
  expect(fetcher).toHaveBeenCalledTimes(1);
  changeSeason(render(fixture()).tree, "2025-26"); render(fixture()); await settle(); render(fixture());
  expect(fetcher).toHaveBeenCalledTimes(1);
  click(render(fixture()).tree, "Refresh source"); render(fixture()); await settle(); render(fixture());
  expect(fetcher).toHaveBeenCalledTimes(2);
  back(); render(fixture()); await settle();
  expect(render(fixture()).html).toContain("2024-25 · Regular season");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("keeps repeated Back/Forward request-free after a completed explicit refresh", async () => {
  runtime.server = false;
  const seed = gameData();
  const fixture = () => log({ initialData: seed });
  render(fixture());
  changeSeason(render(fixture()).tree, "2024-25"); render(fixture()); await settle(); render(fixture());
  changeSeason(render(fixture()).tree, "2025-26"); render(fixture());
  click(render(fixture()).tree, "Refresh source"); render(fixture()); await settle(); render(fixture());
  for (let i = 0; i < 3; i++) {
    back(); render(fixture()); await settle();
    expect(render(fixture()).html).toContain("2024-25 · Regular season");
    url = new URL(history[++historyIndex]); window.dispatchEvent(new Event("popstate"));
    render(fixture()); await settle();
    expect(render(fixture()).html).toContain("2025-26 · Regular season");
  }
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("allows repeated explicit refreshes and deduplicates extra clicks while one is pending", async () => {
  runtime.server = false;
  const seed = gameData();
  const fixture = () => log({ initialData: seed });
  let finish!: (response: Response) => void;
  fetcher.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
  render(fixture());
  click(render(fixture()).tree, "Refresh source"); render(fixture());
  click(render(fixture()).tree, "Refresh source"); render(fixture());
  expect(fetcher).toHaveBeenCalledOnce();
  finish(response(gameData("2025-26", "Regular Season", 2544, 35))); await settle();
  expect(render(fixture()).html).toContain(">35.0</dd>");
  click(render(fixture()).tree, "Refresh source"); render(fixture()); await settle(); render(fixture());
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.every(call => String(call[0]).includes("refresh=1"))).toBe(true);
});

it.each(["success", "failure"])("does not leak pending refresh intent or stale %s into cached Back/Forward selection", async outcome => {
  runtime.server = false;
  const seed = gameData();
  const fixture = () => log({ initialData: seed });
  fetcher.mockResolvedValueOnce(response(gameData("2024-25", "Regular Season", 2544, 31)));
  render(fixture());
  changeSeason(render(fixture()).tree, "2024-25"); render(fixture()); await settle();
  expect(render(fixture()).html).toContain(">31.0</dd>");
  changeSeason(render(fixture()).tree, "2025-26"); render(fixture());
  let finish!: (response: Response) => void, fail!: (error: Error) => void;
  fetcher.mockImplementationOnce(() => new Promise<Response>((resolve, reject) => { finish = resolve; fail = reject; }));
  click(render(fixture()).tree, "Refresh source"); render(fixture());
  back(); render(fixture());
  expect(fetcher).toHaveBeenCalledTimes(2);
  if (outcome === "success") finish(response(gameData("2025-26", "Regular Season", 2544, 35)));
  else fail(new Error("old refresh failed"));
  await settle();
  const cached = render(fixture()).html;
  expect(cached).toContain("2024-25 · Regular season"); expect(cached).toContain(">31.0</dd>");
  expect(cached).not.toContain(">35.0</dd>"); expect(cached).not.toContain("Refresh failed");
  url = new URL(history[++historyIndex]); window.dispatchEvent(new Event("popstate")); render(fixture()); await settle();
  expect(render(fixture()).html).toContain(outcome === "success" ? ">35.0</dd>" : ">20.0</dd>");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("rejoins an in-flight refresh on effect replay instead of losing the refreshed result", async () => {
  runtime.server = false;
  const seed = gameData();
  const fixture = () => log({ initialData: seed });
  let finish!: (response: Response) => void;
  fetcher.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
  render(fixture()); click(render(fixture()).tree, "Refresh source"); render(fixture());
  // Deterministically replay mounted effects with hook state preserved, as the
  // real effect cleanup/setup cycle can do; this is not a browser StrictMode test.
  for (const instance of runtime.instances.values()) {
    instance.slots.forEach((slot, index) => {
      if (slot && typeof slot === "object" && "deps" in slot) {
        (slot as Effect).cleanup?.(); instance.slots[index] = undefined;
      }
    });
  }
  render(fixture()); expect(fetcher).toHaveBeenCalledOnce();
  finish(response(gameData("2025-26", "Regular Season", 2544, 38))); await settle();
  expect(render(fixture()).html).toContain(">38.0</dd>");
});

it("rejoins the original pending refresh on Forward without starting another request", async () => {
  runtime.server = false;
  const seed = gameData();
  const fixture = () => log({ initialData: seed });
  render(fixture());
  changeSeason(render(fixture()).tree, "2024-25"); render(fixture()); await settle(); render(fixture());
  changeSeason(render(fixture()).tree, "2025-26"); render(fixture());
  let finish!: (response: Response) => void;
  fetcher.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
  click(render(fixture()).tree, "Refresh source"); render(fixture());
  back(); render(fixture());
  expect(fetcher).toHaveBeenCalledTimes(2);
  url = new URL(history[++historyIndex]); window.dispatchEvent(new Event("popstate")); render(fixture());
  expect(fetcher).toHaveBeenCalledTimes(2);
  finish(response(gameData("2025-26", "Regular Season", 2544, 36))); await settle();
  expect(render(fixture()).html).toContain(">36.0</dd>");
  expect(fetcher).toHaveBeenCalledTimes(2);
});
