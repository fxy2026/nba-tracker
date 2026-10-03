import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import en from "@/locales/en";

const runtime = vi.hoisted(() => ({ cursor: 0, slots: [] as unknown[], effects: [] as (() => void | (() => void))[], push: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: (initial: unknown) => { const index = runtime.cursor++; if (!(index in runtime.slots)) runtime.slots[index] = initial; return [runtime.slots[index], (next: unknown) => { runtime.slots[index] = typeof next === "function" ? next(runtime.slots[index]) : next; }]; },
  useRef: (initial: unknown) => ({ current: initial }), useMemo: (fn: () => unknown) => fn(),
  useEffect: (effect: () => void | (() => void)) => runtime.effects.push(effect),
}));
vi.mock("react-dom", async original => ({ ...await original<typeof import("react-dom")>(), createPortal: (node: ReactNode) => node }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: runtime.push }) }));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: "en", t: en }) }));
import Navbar from "@/components/Navbar";
import CommandPalette from "@/components/CommandPalette";

let cleanups: (() => void)[];
const handlers = new Map<string, Set<(event: unknown) => void>>();
function nodes(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [node as ReactElement<Record<string, unknown>>, ...nodes(node.props.children)];
}
function render() {
  for (const cleanup of cleanups) cleanup(); cleanups = [];
  runtime.cursor = 0; runtime.effects = [];
  const tree = Navbar();
  for (const effect of runtime.effects) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }
  return nodes(tree);
}
function keyboard(key: string, modifier: "metaKey" | "ctrlKey") {
  const preventDefault = vi.fn();
  for (const callback of handlers.get("keydown") ?? []) callback({ key, [modifier]: true, preventDefault });
  return preventDefault;
}
beforeEach(() => {
  runtime.cursor = 0; runtime.slots = []; runtime.effects = []; runtime.push.mockReset(); cleanups = []; handlers.clear(); vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (fn: () => void) => fn());
  vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal("document", { body: { scrollTop: 0, style: { overflow: "" } }, documentElement: { scrollTop: 0 }, activeElement: null,
    addEventListener: (name: string, callback: (event: unknown) => void) => { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name)!.add(callback); },
    removeEventListener: (name: string, callback: (event: unknown) => void) => handlers.get(name)?.delete(callback),
  });
});
afterEach(() => { for (const cleanup of cleanups) cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it.each(["metaKey", "ctrlKey"] as const)("%s+K opens the existing global player-search form", modifier => {
  render(); expect(keyboard("k", modifier)).toHaveBeenCalledTimes(1);
  const input = render().find(node => node.type === "input"); expect(input).toBeDefined(); expect(input!.props.name).toBe("q");
});
it.each(["Curry", "Michael Jordan", "乔丹", "2544", "Jokić", "Otis Thorpe", "Warriors"])("header search passes %s to the shared canonical player search page", query => {
  let tree = render(); const trigger = tree.find(node => node.props["aria-label"] === "Open search")!;
  (trigger.props.onClick as () => void)(); tree = render();
  const input = tree.find(node => node.type === "input")!;
  (input.props.onChange as (event: unknown) => void)({ target: { value: query } }); tree = render();
  const preventDefault = vi.fn(); (tree.find(node => node.type === "form")!.props.onSubmit as (event: unknown) => void)({ preventDefault });
  expect(preventDefault).toHaveBeenCalledTimes(1); expect(runtime.push).toHaveBeenCalledWith(`/search?q=${encodeURIComponent(query)}`);
  expect(render().some(node => node.type === "input")).toBe(false);
});
it("the mobile header opens the same search page", () => {
  const button = render().find(node => node.type === "button" && node.props["aria-label"] === "Search")!;
  (button.props.onClick as () => void)(); expect(runtime.push).toHaveBeenCalledWith("/search");
});
it("Cmd+M remains the independent navigation palette and the team modal retains all 30 team links", () => {
  render(); keyboard("m", "metaKey");
  let tree = render(); expect(tree.find(node => node.type === CommandPalette)!.props.open).toBe(true);
  expect(tree.some(node => node.type === "input")).toBe(false);
  const teams = tree.find(node => node.type === "button" && node.props["aria-label"] === "Teams menu")!;
  (teams.props.onClick as () => void)(); tree = render();
  expect(tree.filter(node => typeof node.props.href === "string" && node.props.href.startsWith("/team/"))).toHaveLength(30);
});
