import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// A deterministic hook lifecycle harness; actual browser hydration is checked separately.
const hooks = vi.hoisted(() => ({ index: 0, slots: [] as unknown[], effects: [] as (() => void)[] }));
vi.mock("react", () => ({
  useState: (initial: unknown) => {
    const i = hooks.index++;
    if (!(i in hooks.slots)) hooks.slots[i] = typeof initial === "function" ? initial() : initial;
    return [hooks.slots[i], (value: unknown) => { hooks.slots[i] = value; }];
  },
  useRef: (initial: unknown) => {
    const i = hooks.index++;
    if (!(i in hooks.slots)) hooks.slots[i] = { current: initial };
    return hooks.slots[i];
  },
  useEffect: (run: () => void | (() => void), deps: unknown[]) => {
    const i = hooks.index++;
    const previous = hooks.slots[i] as { deps: unknown[]; cleanup?: () => void } | undefined;
    if (!previous || deps.some((v, n) => !Object.is(v, previous.deps[n]))) {
      hooks.effects.push(() => { previous?.cleanup?.(); hooks.slots[i] = { deps, cleanup: run() }; });
    }
  },
}));
import { useCountUp } from "./useCountUp";
let time = 0, nextId = 0;
let frames: Map<number, FrameRequestCallback>;
let cancel: ReturnType<typeof vi.fn>;
function RenderHook(target: number, duration = 1000) {
  hooks.index = 0; const value = useCountUp(target, duration);
  const effects = hooks.effects.splice(0); effects.forEach(run => run()); return value;
}
function frame(now: number) { time = now; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(cb => cb(now)); }
function unmount() { hooks.slots.forEach(slot => (slot as { cleanup?: () => void } | undefined)?.cleanup?.()); }
beforeEach(() => {
  hooks.index = 0; hooks.slots = []; hooks.effects = []; time = 0; nextId = 0; frames = new Map();
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
  vi.stubGlobal("performance", { now: () => time });
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { frames.set(++nextId, cb); return nextId; });
  cancel = vi.fn((id: number) => frames.delete(id)); vi.stubGlobal("cancelAnimationFrame", cancel);
});
afterEach(() => { unmount(); vi.unstubAllGlobals(); });
describe("useCountUp lifecycle", () => {
  it("starts at target without scheduling an unnecessary mount animation", () => { expect(RenderHook(10.1)).toBe(10.1); expect(frames.size).toBe(0); });
  it("animates updated targets from the displayed value and finishes exactly", () => {
    RenderHook(10); expect(RenderHook(20)).toBe(10); frame(500); expect(RenderHook(20)).toBe(18.75);
    frame(1000); expect(RenderHook(20)).toBe(20); expect(frames.size).toBe(0);
  });
  it("cancels interrupted updates and continues from the displayed intermediate value", () => {
    RenderHook(10); RenderHook(20); frame(500); expect(RenderHook(20)).toBe(18.75);
    const oldCallback = [...frames.values()][0]; RenderHook(5); expect(cancel).toHaveBeenCalled();
    oldCallback(1000); expect(RenderHook(5)).toBe(18.75);
    frame(1500); expect(RenderHook(5)).toBe(5);
  });
  it("honors reduced motion without scheduling frames", () => {
    RenderHook(10); vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    RenderHook(20); expect(RenderHook(20)).toBe(20); expect(frames.size).toBe(0);
  });
  it.each([0, -1, NaN, Infinity])("snaps immediately for duration %s", duration => { RenderHook(10); RenderHook(20, duration); expect(RenderHook(20, duration)).toBe(20); expect(frames.size).toBe(0); });
  it("cancels frames on unmount and ignores a queued callback", () => {
    RenderHook(10); RenderHook(20); const callback = [...frames.values()][0]; unmount(); callback(1000);
    expect(cancel).toHaveBeenCalled(); expect(frames.size).toBe(0); expect(hooks.slots[0]).toBe(10);
  });
  it("does not animate on server or from nonfinite values", () => {
    vi.stubGlobal("window", undefined); expect(RenderHook(5)).toBe(5); expect(frames.size).toBe(0);
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) }); RenderHook(Infinity); expect(RenderHook(Infinity)).toBe(Infinity);
    RenderHook(3); expect(RenderHook(3)).toBe(3); expect(frames.size).toBe(0);
  });
});
