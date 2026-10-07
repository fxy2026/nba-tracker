import { isValidElement, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

type Effect = { deps: unknown[]; cleanup?: () => void };
const runtime = vi.hoisted(() => ({
  slots: [] as unknown[], index: 0, effects: [] as (() => void)[], dirty: false,
  locale: "en" as "en" | "zh",
}));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = runtime.index++;
    if (!(index in runtime.slots)) runtime.slots[index] = initial;
    return [runtime.slots[index], (next: unknown) => { runtime.slots[index] = next; runtime.dirty = true; }];
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
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: runtime.locale }) }));
import InstallPrompt from "./InstallPrompt";

type Node = ReactElement<{ children?: ReactNode; className?: string; style?: CSSProperties; [key: string]: unknown }>;
let view: Node[];
let windowEvents: EventTarget, documentEvents: EventTarget, storage: Map<string, string>;
function nodes(node: ReactNode): Node[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return isValidElement<Node["props"]>(node) ? [node, ...nodes(node.props.children)] : [];
}
function render() {
  runtime.dirty = true;
  for (let count = 0; runtime.dirty; count++) {
    if (count > 12) throw new Error("Effects did not settle");
    runtime.dirty = false; runtime.index = 0;
    view = nodes(InstallPrompt());
    runtime.effects.splice(0).forEach(run => run());
  }
}
function installEvent(outcome: "accepted" | "dismissed" = "accepted") {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    platforms: ["web"], prompt, userChoice: Promise.resolve({ outcome, platform: "web" }),
  });
  windowEvents.dispatchEvent(event); render(); return event;
}
const dialog = () => view.find(node => node.props.role === "dialog");
const buttons = () => view.filter(node => node.type === "button");
const dismiss = () => buttons().find(node => node.props["aria-label"] === (runtime.locale === "zh" ? "关闭" : "Dismiss"))!;
function remount() {
  for (const slot of runtime.slots) (slot as Effect | undefined)?.cleanup?.();
  runtime.slots = []; runtime.effects = []; render();
}
async function dismissPrompt(method: "close" | "Escape" | "native") {
  if (method === "close") (dismiss().props.onClick as () => void)();
  else if (method === "Escape") documentEvents.dispatchEvent(Object.assign(new Event("keydown"), { key: "Escape" }));
  else await (buttons().find(button => !button.props["aria-label"])!.props.onClick as () => Promise<void>)();
  render();
}
beforeEach(() => {
  runtime.slots = []; runtime.index = 0; runtime.effects = []; runtime.dirty = false; runtime.locale = "en";
  view = []; storage = new Map(); windowEvents = new EventTarget(); documentEvents = new EventTarget();
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-06T09:00:00Z"));
  const navigator = { userAgent: "Chrome", standalone: false };
  vi.stubGlobal("navigator", navigator);
  vi.stubGlobal("window", {
    navigator, matchMedia: () => ({ matches: false }),
    addEventListener: windowEvents.addEventListener.bind(windowEvents), removeEventListener: windowEvents.removeEventListener.bind(windowEvents),
  });
  vi.stubGlobal("document", {
    addEventListener: documentEvents.addEventListener.bind(documentEvents), removeEventListener: documentEvents.removeEventListener.bind(documentEvents),
  });
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
});
afterEach(() => {
  for (const slot of runtime.slots) (slot as Effect | undefined)?.cleanup?.();
  expect(vi.getTimerCount()).toBe(0); vi.useRealTimers(); vi.unstubAllGlobals();
});

it.each(["en", "zh"] as const)("anchors the install banner to the viewport above the glass-tile CSS and keeps 44px controls (%s)", locale => {
  runtime.locale = locale; render(); expect(dialog()).toBeUndefined();
  const event = installEvent(); expect(event.defaultPrevented).toBe(true);
  const banner = dialog()!;
  // An inline position wins over unlayered .glass-tile { position:relative }.
  // The old layered .fixed utility lost that cascade and shifted a full-width
  // relative box 16px outside the viewport. These are layout contracts, not a DOM measurement.
  expect(banner.props.style?.position).toBe("fixed");
  const classes = banner.props.className!.split(/\s+/);
  expect(classes).toEqual(expect.arrayContaining(["left-4", "right-4", "sm:left-auto", "sm:max-w-sm", "mobile-floating"]));
  expect(classes).not.toContain("overflow-x-hidden");
  expect(view.some(node => node.props.className === "flex-1 min-w-0")).toBe(true);
  expect(buttons()).toHaveLength(2);
  for (const button of buttons()) {
    expect(button.props.type).toBe("button");
    expect(button.props.className).toContain("min-h-[44px]");
    expect(button.props.className).toContain("min-w-[44px]");
  }
  (dismiss().props.onClick as () => void)(); render();
  expect(dialog()).toBeUndefined(); expect(storage.get("nba-tracker-install-dismissed")).toBe(String(Date.now()));
  expect(event.prompt).not.toHaveBeenCalled();
});

it.each(["en", "zh"] as const)("preserves the delayed manual iOS hint with a touch-sized dismiss button (%s)", locale => {
  runtime.locale = locale;
  vi.stubGlobal("navigator", { userAgent: "iPhone Safari" });
  render(); expect(dialog()).toBeUndefined();
  vi.advanceTimersByTime(2000); render();
  expect(dialog()?.props.style?.position).toBe("fixed");
  expect(buttons()).toHaveLength(1);
  expect(view.some(node => node.props.children === (locale === "zh" ? "点击 Safari 分享按钮 → 添加到主屏幕" : "Tap Safari Share button → Add to Home Screen"))).toBe(true);
  expect(dismiss().props.className).toContain("min-w-[44px]");
  (dismiss().props.onClick as () => void)(); render(); expect(dialog()).toBeUndefined();
});

it.each(["accepted", "dismissed"] as const)("preserves the user-triggered native install outcome: %s", async outcome => {
  render(); const event = installEvent(outcome);
  await (buttons().find(button => !button.props["aria-label"])!.props.onClick as () => Promise<void>)(); render();
  expect(event.prompt).toHaveBeenCalledOnce(); expect(dialog()).toBeUndefined();
  expect(storage.has("nba-tracker-install-dismissed")).toBe(outcome === "dismissed");
});

it("still dismisses on Escape and respects the stored seven-day dismissal", () => {
  render(); installEvent();
  documentEvents.dispatchEvent(Object.assign(new Event("keydown"), { key: "Escape" })); render();
  expect(dialog()).toBeUndefined(); expect(storage.has("nba-tracker-install-dismissed")).toBe(true);
  for (const slot of runtime.slots) (slot as Effect | undefined)?.cleanup?.();
  runtime.slots = []; runtime.effects = []; render();
  installEvent(); expect(dialog()).toBeUndefined();
});

it("hides after appinstalled without changing the dismissal record", () => {
  render(); installEvent();
  windowEvents.dispatchEvent(new Event("appinstalled")); render();
  expect(dialog()).toBeUndefined(); expect(storage.size).toBe(0);
});

it.each(["close", "Escape", "native"] as const)("keeps a %s dismissal across repeated SPA install events and a reload", async method => {
  render(); installEvent("dismissed");
  await dismissPrompt(method);
  expect(dialog()).toBeUndefined();
  const dismissedAt = storage.get("nba-tracker-install-dismissed");

  // Root-layout components stay mounted through player → team → player navigation.
  for (let navigation = 0; navigation < 2; navigation++) {
    vi.advanceTimersByTime(1000);
    const event = installEvent();
    expect(event.defaultPrevented).toBe(true);
    expect(dialog()).toBeUndefined();
    expect(event.prompt).not.toHaveBeenCalled();
    expect(storage.get("nba-tracker-install-dismissed")).toBe(dismissedAt);
  }

  // Fresh component state on reload must still respect the stored preference.
  remount(); installEvent();
  expect(dialog()).toBeUndefined();
});

it.each(["close", "Escape", "native"] as const)("keeps a %s dismissal through SPA navigation when browser storage is blocked", async method => {
  vi.stubGlobal("localStorage", {
    getItem: () => { throw new Error("Storage blocked"); },
    setItem: () => { throw new Error("Storage blocked"); },
  });
  render(); installEvent("dismissed");
  await dismissPrompt(method);
  installEvent(); expect(dialog()).toBeUndefined();
  installEvent(); expect(dialog()).toBeUndefined();
});

it("allows a new install event after the existing seven-day dismissal expires", async () => {
  render(); installEvent(); await dismissPrompt("close");
  vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000 - 1);
  installEvent(); expect(dialog()).toBeUndefined();
  vi.advanceTimersByTime(1);
  installEvent(); expect(dialog()).toBeDefined();
});

it("rechecks stored dismissals when a later install event arrives", () => {
  render();
  storage.set("nba-tracker-install-dismissed", String(Date.now()));
  const event = installEvent();
  expect(event.defaultPrevented).toBe(true);
  expect(dialog()).toBeUndefined();
});

it("does not show a delayed iOS hint if the prompt was dismissed elsewhere while waiting", () => {
  vi.stubGlobal("navigator", { userAgent: "iPhone Safari" });
  render();
  storage.set("nba-tracker-install-dismissed", String(Date.now()));
  vi.advanceTimersByTime(2000); render();
  expect(dialog()).toBeUndefined();
});

it("keeps the iOS hint dismissed after reload until the seven-day policy expires", async () => {
  vi.stubGlobal("navigator", { userAgent: "iPhone Safari" });
  render(); vi.advanceTimersByTime(2000); render();
  await dismissPrompt("close");
  remount(); vi.advanceTimersByTime(2000); render();
  expect(dialog()).toBeUndefined();
  vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000);
  remount(); vi.advanceTimersByTime(2000); render();
  expect(dialog()).toBeDefined();
});
