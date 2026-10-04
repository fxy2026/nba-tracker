import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTranslations } from "@/locales";

const runtime = vi.hoisted(() => ({
  mounted: true,
  locale: "en",
  push: vi.fn(),
  effects: [] as (() => void | (() => void))[],
  refs: [] as { current: unknown }[],
}));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: () => [runtime.mounted, vi.fn()],
  useMemo: (factory: () => unknown) => factory(),
  useCallback: (callback: unknown) => callback,
  useRef: () => { const ref = { current: null }; runtime.refs.push(ref); return ref; },
  useEffect: (effect: () => void | (() => void)) => { runtime.effects.push(effect); },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: runtime.push }) }));
vi.mock("@/components/LocaleProvider", () => ({
  useLocale: () => ({ locale: runtime.locale, t: getTranslations(runtime.locale as "en" | "zh") }),
}));
vi.mock("@/lib/timezone", async original => ({
  ...await original<typeof import("./timezone")>(), localTz: () => "America/Los_Angeles",
}));
import DateNav from "@/components/DateNav";

type Props = { children?: ReactNode; className?: string; [key: string]: unknown };
function nodes(tree: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return isValidElement<Props>(tree) ? [tree, ...nodes(tree.props.children)] : [];
}
function text(tree: ReactNode): string {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  return isValidElement<Props>(tree) ? text(tree.props.children) : "";
}
function render(selectedDate = "2026-10-20", onDateChange?: (date: string) => void) {
  runtime.refs = []; runtime.effects = [];
  const tree = DateNav({ selectedDate, timeZone: "America/Los_Angeles", onDateChange });
  const all = nodes(tree);
  const controls = all.filter(node => node.type === "button");
  const days = controls.filter(node => nodes(node).some(child => child.type === "span" && /^\d+\/\d+$/.test(text(child))));
  const scroller = all.find(node => node.props.className?.includes("overflow-x-auto"))!;
  return { tree, all, controls, days, scroller, today: controls[controls.length - 1] };
}
function baseClasses(node: ReactElement<Props>) { return (node.props.className ?? "").split(/\s+/).filter(token => !token.includes(":")); }
// Numeric contracts for the default 16px root. This is not a CSS rendering test.
function spacing(node: ReactElement<Props>, prefix: string) {
  const token = baseClasses(node).find(value => new RegExp(`^${prefix}-(?:[\\d.]+|\\[[\\d.]+px\\])$`).test(value));
  if (!token) throw new Error(`Missing ${prefix} width/spacing contract`);
  const value = token.slice(prefix.length + 1);
  return value.startsWith("[") ? Number(value.slice(1, -3)) : Number(value) * 4;
}
beforeEach(() => {
  runtime.mounted = true; runtime.locale = "en"; runtime.push.mockReset();
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("narrow date-navigation layout contracts", () => {
  it.each(["en", "zh"].flatMap(locale => [320, 325, 375].map(width => ({ locale, width }))))(
    "budgets full selected and neighbor chips at $width px in $locale without smaller date text", ({ locale, width }) => {
      runtime.locale = locale;
      const { tree, controls, days, scroller, today } = render();
      const arrows = controls.filter(control => control.props["aria-label"]);
      expect(arrows).toHaveLength(2);
      const arrowWidth = arrows.reduce((sum, node) => sum + spacing(node, "min-w"), 0);
      expect(arrows.every(node => spacing(node, "min-w") >= 44 && spacing(node, "min-h") >= 44)).toBe(true);
      expect(spacing(today, "w")).toBe(44); expect(spacing(today, "min-h")).toBe(44);
      expect(spacing(today, "px")).toBe(2); expect(baseClasses(today)).toContain("tracking-normal");
      expect(text(today)).toBe(locale === "zh" ? "今天" : "Today");
      const available = width - 2 * spacing(tree, "px") - arrowWidth - spacing(today, "w") - 3 * spacing(tree, "gap");
      const threeChips = 3 * spacing(days[3], "w") + 2 * spacing(scroller, "gap");
      expect(threeChips).toBe(176); expect(available).toBeGreaterThanOrEqual(threeChips);
      expect(days).toHaveLength(7);
      expect(days.slice(2, 5).map(day => nodes(day).filter(node => node.type === "span").map(text).at(-1))).toEqual(["10/19", "10/20", "10/21"]);
      expect(days.filter(day => day.props["aria-current"] === "date")).toEqual([days[3]]);
      for (const day of days) {
        expect(baseClasses(day)).toContain("shrink-0"); expect(spacing(day, "min-h")).toBeGreaterThanOrEqual(44);
        const label = nodes(day).find(node => node.type === "span" && /^\d+\/\d+$/.test(text(node)))!;
        expect(baseClasses(label)).toContain("text-sm"); expect(baseClasses(label)).toContain("tabular-nums");
      }
    },
  );

  it.each(["en", "zh"])("reserves the same Today slot before hydration, after hydration and on today in %s", locale => {
    runtime.locale = locale; runtime.mounted = false;
    const before = render();
    expect(before.today.props.disabled).toBe(true); expect(before.today.props["aria-hidden"]).toBe(true);
    expect(baseClasses(before.today)).toContain("invisible");
    (before.today.props.onClick as () => void)(); expect(runtime.push).not.toHaveBeenCalled();
    runtime.mounted = true;
    const after = render();
    expect(after.today.props.disabled).toBe(false); expect(after.today.props["aria-hidden"]).toBeUndefined();
    const current = render("2026-10-04");
    expect(current.today.props.disabled).toBe(true); expect(baseClasses(current.today)).toContain("invisible");
    for (const view of [before, after, current]) {
      expect(view.controls).toHaveLength(10); expect(spacing(view.today, "w")).toBe(44);
      expect(baseClasses(view.scroller)).toContain("flex-1");
    }
  });

  it("preserves previous/next, all seven dates, Today, timezone, callbacks and scroll:false", () => {
    const changed = vi.fn();
    const { controls, days, today } = render("2026-10-20", changed);
    const targets = [controls[0], ...days, controls[8], today];
    targets.forEach(node => (node.props.onClick as () => void)());
    const dates = ["2026-10-19", ...[17, 18, 19, 20, 21, 22, 23].map(day => `2026-10-${day}`), "2026-10-21", "2026-10-04"];
    expect(changed.mock.calls.map(([date]) => date)).toEqual(dates);
    expect(runtime.push.mock.calls).toEqual(dates.map(date => [`/?date=${date}&tz=America%2FLos_Angeles`, { scroll: false }]));
  });

  it.each([180, 185, 235])("centers only the selected-date scroller, including resize (%s px)", width => {
    render();
    const selected = { offsetLeft: 180, offsetWidth: 56 };
    const row = { scrollLeft: 0, clientWidth: width, querySelector: vi.fn(() => selected) };
    runtime.refs[1].current = row;
    const observe = vi.fn(), disconnect = vi.fn(); let resized!: () => void;
    vi.stubGlobal("ResizeObserver", class { constructor(callback: () => void) { resized = callback; } observe = observe; disconnect = disconnect; });
    const cleanup = runtime.effects[2]();
    expect(row.querySelector).toHaveBeenCalledWith('[aria-current="date"]');
    expect(row.scrollLeft).toBe(180 - (width - 56) / 2); expect(observe).toHaveBeenCalledWith(row);
    row.clientWidth = 300; resized(); expect(row.scrollLeft).toBe(58);
    if (typeof cleanup === "function") cleanup(); expect(disconnect).toHaveBeenCalledOnce();
  });

  it("keeps arrow keys local while leaving editing, dialogs and browser history shortcuts alone", () => {
    class Element { isContentEditable = false; matches = new Set<string>(); closest(selector: string) { return this.matches.has(selector) ? this : null; } }
    class Input extends Element {} class TextArea extends Element {} class Select extends Element {}
    vi.stubGlobal("HTMLElement", Element); vi.stubGlobal("HTMLInputElement", Input);
    vi.stubGlobal("HTMLTextAreaElement", TextArea); vi.stubGlobal("HTMLSelectElement", Select);
    const addEventListener = vi.fn(), removeEventListener = vi.fn();
    vi.stubGlobal("window", { addEventListener, removeEventListener });
    render(); runtime.refs[0].current = { contains: () => false };
    const cleanup = runtime.effects[1]();
    const handle = addEventListener.mock.calls[0][1] as (event: Record<string, unknown>) => void;
    const preventDefault = vi.fn();
    handle({ key: "ArrowLeft", preventDefault }); handle({ key: "ArrowRight", preventDefault });
    expect(runtime.push.mock.calls.map(([url]) => url)).toEqual(["/?date=2026-10-19&tz=America%2FLos_Angeles", "/?date=2026-10-21&tz=America%2FLos_Angeles"]);
    const dialog = new Element(); dialog.matches.add('[role="dialog"], [role="combobox"], [role="slider"]');
    const outsideButton = new Element(); outsideButton.matches.add("button, a");
    const editable = new Element(); editable.isContentEditable = true;
    for (const extra of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }, { isComposing: true }, { defaultPrevented: true }, { target: new Input() }, { target: new TextArea() }, { target: new Select() }, { target: editable }, { target: dialog }, { target: outsideButton }]) {
      handle({ key: "ArrowLeft", preventDefault, ...extra });
    }
    expect(runtime.push).toHaveBeenCalledTimes(2); expect(preventDefault).toHaveBeenCalledTimes(2);
    if (typeof cleanup === "function") cleanup(); expect(removeEventListener).toHaveBeenCalledWith("keydown", handle);
  });
});
