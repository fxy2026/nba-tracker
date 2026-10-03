import { Children, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { ScatterArchive } from "./scatter-archive";
const runtime = vi.hoisted(() => ({ cursor: 0, slots: [] as unknown[], effects: [] as (() => void | (() => void))[], locale: "en" }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: (initial: unknown) => { const i = runtime.cursor++; return [i in runtime.slots ? runtime.slots[i] : initial, (v: unknown) => { runtime.slots[i] = v; }]; },
  useRef: (initial: unknown) => { const i = runtime.cursor++; return runtime.slots[i] ?? (runtime.slots[i] = { current: initial }); },
  useEffect: (fn: () => void) => { runtime.effects.push(fn); },
  useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn,
}));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: runtime.locale }) }));
import ScatterExplorer from "@/app/lab/explore/ScatterExplorer";
const archive: ScatterArchive = { season: "2025-26", total: 3, omitted: 1, rows: [
  { PLAYER_ID: 1, PLAYER: "Zero Player", TEAM: "", PTS: 0, REB: 0, AST: 0 },
  { PLAYER_ID: 2, PLAYER: "Archive Player", TEAM: "LAL", PTS: 20, REB: 5, AST: 3 },
] };
function render() { runtime.cursor = 0; runtime.effects = []; return ScatterExplorer({ archive }); }
function nodes(node: ReactNode): { type: unknown; props: Record<string, unknown> }[] {
  const out: { type: unknown; props: Record<string, unknown> }[] = [];
  Children.forEach(node, child => { if (isValidElement<Record<string, unknown>>(child)) { out.push(child); out.push(...nodes(child.props.children as ReactNode)); } }); return out;
}
function clickText(text: string) {
  const n = nodes(render()).find(n => n.type === "button" && n.props.children === text)!;
  expect(n).toBeDefined(); return (n.props.onClick as () => unknown)();
}
const response = { resultSet: { headers: ["PLAYER_ID", "PLAYER", "TEAM", "GP", "MIN", "PTS", "AST", "REB"], rowSet: [[3, "Current Player", "BOS", 2, 20, 24, 6, 4]] } };
beforeEach(() => { runtime.locale = "en"; runtime.cursor = 0; runtime.slots = [false, { current: null }, [], false, "Error: 502", "PTS", "AST", 15, null, { current: null }]; vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("502"))); });
afterEach(() => vi.unstubAllGlobals());
it("keeps failure as default and enters archive only after an explicit request, with no fetch", () => {
  expect(renderToStaticMarkup(render())).toContain("Failed to load data");
  expect(nodes(render()).some(n => n.type === "svg")).toBe(false);
  clickText("View 2025-26 archive");
  const html = renderToStaticMarkup(render());
  expect(html).toContain("Failed to load data"); expect(html).toContain("2025-26 archived index averages");
  expect(html).toContain("2 of 3 indexed players plotted; 1 missing");
  expect(html).not.toContain("Min MPG"); expect(html).not.toContain("True Shooting %");
  const pickers = nodes(render()).filter(n => Array.isArray(n.props.axes));
  expect(pickers).toHaveLength(2); for (const p of pickers) expect((p.props.axes as {key: string}[]).map(a => a.key)).toEqual(["PTS", "REB", "AST"]);
  expect(nodes(render()).filter(n => n.type === "circle")).toHaveLength(2);
  expect(fetch).not.toHaveBeenCalled();
});
it("retains archive and original failure while retrying and after another failure", async () => {
  clickText("View 2025-26 archive");
  const pending = clickText("Retry 2026-27 current data");
  expect(renderToStaticMarkup(render())).toContain("Failed to load data");
  expect(renderToStaticMarkup(render())).toContain("Retrying current data");
  expect(nodes(render()).filter(n => n.props.action)).toHaveLength(0);
  expect(nodes(render()).filter(n => n.type === "button" && n.props.disabled === true)).toHaveLength(1);
  await pending;
  expect(renderToStaticMarkup(render())).toContain("2025-26 archived index averages");
  expect(renderToStaticMarkup(render())).toContain("Failed to load data");
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("successful explicit retry returns clearly to current mode and the unchanged current query", async () => {
  clickText("View 2025-26 archive");
  vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => response } as Response);
  await clickText("Retry 2026-27 current data");
  const html = renderToStaticMarkup(render());
  expect(html).toContain("2026-27 regular season · Current data"); expect(html).toContain("Min MPG"); expect(html).not.toContain("Failed to load data");
  const [url] = vi.mocked(fetch).mock.calls[0]; const qs = new URL(String(url), "http://localhost").searchParams;
  expect(Object.fromEntries(qs)).toEqual({endpoint:"leagueleaders",LeagueID:"00",PerMode:"PerGame",Scope:"S",Season:"2026-27",SeasonType:"Regular Season",StatCategory:"PTS"});
});
it("tap/keyboard exposes persistent zero values, unknown team and explicit link; Close and Escape dismiss", () => {
  clickText("View 2025-26 archive");
  const point = nodes(render()).find(n => n.type === "circle")!;
  expect(point.props.fill).toBe("#64748B"); (point.props.onClick as () => void)();
  let html = renderToStaticMarkup(render());
  expect(html).toContain("Unknown team"); expect(html).toContain("Points: 0.0"); expect(html).toContain('href="/player/1"'); expect(html).not.toContain("MPG");
  const focus = vi.fn(); runtime.slots[9] = {current:{focus}};
  clickText("Close"); expect(focus).toHaveBeenCalledTimes(1); expect(nodes(render()).some(n => n.props.href === "/player/1")).toBe(false);
  (nodes(render()).find(n => n.type === "svg")!.props.onKeyDown as (e: unknown) => void)({key:"Enter", preventDefault:vi.fn()});
  (nodes(render()).find(n => n.type === "svg")!.props.onKeyDown as (e: unknown) => void)({key:"ArrowRight", preventDefault:vi.fn()});
  html = renderToStaticMarkup(render()); expect(html).toContain('href="/player/2"');
  (render().props.onKeyDown as (e: unknown) => void)({key:"Escape"}); expect(nodes(render()).some(n => n.props.href)).toBe(false); expect(focus).toHaveBeenCalledTimes(2);
});
it("unmount aborts initial request and repeated retries cancel stale work", async () => {
  let resolve!: (r: Response) => void;
  vi.mocked(fetch).mockImplementation(() => new Promise(r => { resolve = r; }));
  render(); const cleanup = runtime.effects[0]() as () => void;
  const signal = vi.mocked(fetch).mock.calls[0][1]!.signal!;
  cleanup(); expect(signal.aborted).toBe(true);
  resolve({ok:true,json:async()=>response} as Response); await new Promise(r => setTimeout(r, 0));
  expect(runtime.slots[2]).toEqual([]);
  runtime.slots[3] = false; clickText("View 2025-26 archive");
  const first = clickText("Retry 2026-27 current data"); const firstSignal = vi.mocked(fetch).mock.calls[1][1]!.signal!;
  const firstResolve = resolve;
  const retry = nodes(render()).find(n => n.type === "button" && n.props.disabled === true)!;
  const second = (retry.props.onClick as () => Promise<void>)(); expect(firstSignal.aborted).toBe(true);
  firstResolve({ok:true,json:async()=>response} as Response); await first;
  resolve({ok:true,json:async()=>response} as Response); await second;
  expect(runtime.slots[0]).toBe(false);
});
it("renders localized archive labels and unsupported-field explanation", () => {
  runtime.locale = "zh"; clickText("查看 2025-26 存档");
  const html = renderToStaticMarkup(render()); expect(html).toContain("2025-26 存档索引场均数据"); expect(html).toContain("存档未提供出场数"); expect(html).not.toContain("出场时间下限");
});

it("empty current response retains the selected archive and displays failure", async () => {
  clickText("View 2025-26 archive");
  vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ resultSet: {headers: response.resultSet.headers, rowSet: []} }) } as Response);
  await clickText("Retry 2026-27 current data");
  const html = renderToStaticMarkup(render()); expect(html).toContain("2025-26 archived index averages"); expect(html).toContain("Failed to load data");
  expect(nodes(render()).filter(n => n.props.action)).toHaveLength(0);
});

it("uses one chart tab stop, wraps keyboard selection and resets on axis/filter/mode changes", () => {
  clickText("View 2025-26 archive");
  const tree = render();
  expect(nodes(tree).filter(n => n.props.tabIndex === 0)).toHaveLength(1);
  expect(nodes(tree).filter(n => n.type === "select")).toHaveLength(0);
  const key = (key: string) => (nodes(render()).find(n => n.type === "svg")!.props.onKeyDown as (e: unknown) => void)({key, preventDefault:vi.fn()});
  key(" "); expect(runtime.slots[8]).toBe(0);
  key("ArrowLeft"); expect(runtime.slots[8]).toBe(1);
  key("ArrowRight"); expect(runtime.slots[8]).toBe(0);
  for (const [slot, value] of [[5,"REB"], [7,0], [0,false]] as const) {
    runtime.slots[8] = 1; runtime.slots[slot] = value; render(); runtime.effects[1](); expect(runtime.slots[8]).toBe(null);
  }
});
