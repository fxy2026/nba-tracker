import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

type Effect = { deps: unknown[]; cleanup?: () => void };
const runtime = vi.hoisted(() => ({
  slots: [] as unknown[], index: 0, effects: [] as (() => void)[], dirty: false,
  isZh: false, push: vi.fn(),
}));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = runtime.index++;
    if (!(index in runtime.slots)) runtime.slots[index] = initial;
    return [runtime.slots[index], (next: unknown) => {
      if (!Object.is(runtime.slots[index], next)) { runtime.slots[index] = next; runtime.dirty = true; }
    }];
  },
  useRef: (initial: unknown) => {
    const index = runtime.index++;
    if (!(index in runtime.slots)) runtime.slots[index] = { current: initial };
    return runtime.slots[index];
  },
  useEffect: (run: () => void | (() => void), deps: unknown[]) => {
    const index = runtime.index++, old = runtime.slots[index] as Effect | undefined;
    if (!old || old.deps.length !== deps.length || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
      const effect: Effect = { deps }; runtime.slots[index] = effect;
      runtime.effects.push(() => { old?.cleanup?.(); effect.cleanup = run() || undefined; });
    }
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: runtime.push }) }));
import PlayerPicker from "./PlayerPicker";

type Props = { children?: ReactNode; [key: string]: unknown };
type Element = ReactElement<Props>;
type Result = { personId: number; firstName: string; lastName: string; teamAbbr: string; teamCity: string; teamName: string; position: string; pts: number };
const results: Result[] = Array.from({ length: 12 }, (_, index) => ({
  personId: 800000 + index, firstName: "Search", lastName: `Result ${index + 1}`,
  teamAbbr: "CHI", teamCity: "Chicago", teamName: "Bulls", position: "G", pts: 10,
}));
let view: Element[];
let fetcher: ReturnType<typeof vi.fn>;
let listeners: Map<string, Set<(event: { target: unknown }) => void>>;
function nodes(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return isValidElement<Props>(node) ? [node, ...nodes(node.props.children)] : [];
}
function render() {
  runtime.dirty = true;
  for (let count = 0; runtime.dirty; count++) {
    if (count > 12) throw new Error("Effects did not settle");
    runtime.dirty = false; runtime.index = 0;
    view = nodes(PlayerPicker({ isZh: runtime.isZh, currentName: "" }));
    const ref = view[0].props.ref as { current: unknown };
    ref.current = { contains: (target: unknown) => view.includes(target as Element) };
    runtime.effects.splice(0).forEach(run => run());
  }
}
async function settle() { for (let i = 0; i < 10; i++) { await Promise.resolve(); render(); } }
const input = () => view.find(node => node.type === "input")!;
const popup = () => view.find(node => node.type === "div" && String(node.props.className).includes("z-50"));
function type(query: string) { (input().props.onChange as (event: unknown) => void)({ target: { value: query } }); render(); }
async function search(query = "Search") { type(query); await vi.advanceTimersByTimeAsync(250); await settle(); }
function press(target: unknown) { for (const listener of listeners.get("mousedown") ?? []) listener({ target }); render(); }
beforeEach(() => {
  runtime.slots = []; runtime.index = 0; runtime.effects = []; runtime.dirty = false; runtime.isZh = false; runtime.push.mockReset();
  view = []; listeners = new Map(); vi.useFakeTimers();
  vi.stubGlobal("document", {
    addEventListener: (name: string, listener: (event: { target: unknown }) => void) => {
      if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name)!.add(listener);
    },
    removeEventListener: (name: string, listener: (event: { target: unknown }) => void) => listeners.get(name)?.delete(listener),
  });
  fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ data: results }) }));
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  for (const slot of runtime.slots) (slot as Effect | undefined)?.cleanup?.();
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
});

it.each([false, true])("keeps long result lists anchored and scrollable without losing the final-row click (Chinese: %s)", async isZh => {
  runtime.isZh = isZh; render(); await search();
  const panel = popup()!;
  // The inline longhands win over unlayered glass-tile relative/hidden rules.
  // These inspect real render/handlers, not a browser scroll measurement.
  expect(panel.props.style).toMatchObject({ position: "absolute", overflowY: "auto" });
  expect(panel.props.className).toContain("top-full");
  expect(panel.props.className).toContain("w-full");
  expect(panel.props.className).toContain("max-h-[360px]");
  const rows = nodes(panel).filter(node => node.type === "button");
  expect(rows).toHaveLength(12);
  const last = rows.at(-1)!;
  press(last); expect(popup()).toBeDefined();
  (last.props.onClick as () => void)(); render(); await settle();
  expect(runtime.push).toHaveBeenCalledExactlyOnceWith("/lab/career-arc?id=800011");
  expect(popup()).toBeUndefined(); expect(input().props.value).toBe("");
});

it.each([false, true])("keeps the empty-state overlay anchored and preserves outside dismissal (Chinese: %s)", async isZh => {
  runtime.isZh = isZh; fetcher.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
  render(); await search("Nobody");
  expect(popup()?.props.style).toMatchObject({ position: "absolute" });
  expect(nodes(popup()).some(node => node.props.children === (isZh ? "未找到 “Nobody”" : "No players match “Nobody”"))).toBe(true);
  press({ outside: true }); expect(popup()).toBeUndefined(); expect(runtime.push).not.toHaveBeenCalled();
});

it("preserves outside dismissal, focus reopening and clear for populated results", async () => {
  render(); await search(); press({ outside: true }); expect(popup()).toBeUndefined();
  (input().props.onFocus as () => void)(); render(); expect(popup()).toBeDefined();
  const clear = view.find(node => node.type === "button" && node.props["aria-label"] === "Clear")!;
  (clear.props.onClick as () => void)(); render(); await settle();
  expect(popup()).toBeUndefined(); expect(input().props.value).toBe(""); expect(runtime.push).not.toHaveBeenCalled();
});
