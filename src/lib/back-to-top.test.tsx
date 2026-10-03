import { Children, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({ visible: false, locale: "en", effects: [] as (() => void | (() => void))[] }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  memo: (component: unknown) => component,
  useState: () => [runtime.visible, (value: boolean) => { runtime.visible = value; }],
  useEffect: (effect: () => void) => { runtime.effects.push(effect); },
}));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: runtime.locale }) }));
import BackToTop from "@/components/BackToTop";
function nodes(node: ReactNode): { type: unknown; props: Record<string, unknown> }[] {
  const out: { type: unknown; props: Record<string, unknown> }[] = [];
  Children.forEach(node, child => {
    if (isValidElement<Record<string, unknown>>(child)) {
      out.push(child, ...nodes(child.props.children as ReactNode));
    }
  });
  return out;
}
function render() { runtime.effects = []; return BackToTop({}); }
function buttons() { return nodes(render()).filter(node => node.type === "button"); }
beforeEach(() => {
  runtime.visible = false; runtime.locale = "en";
  vi.stubGlobal("window", { scrollY: 0, scrollTo: vi.fn(), matchMedia: vi.fn(() => ({ matches: false })), addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("HTMLInputElement", class Input {});
  vi.stubGlobal("HTMLTextAreaElement", class Textarea {});
  vi.stubGlobal("HTMLSelectElement", class Select {});
  vi.stubGlobal("requestAnimationFrame", vi.fn((fn: () => void) => { fn(); return 1; }));
});
afterEach(() => vi.unstubAllGlobals());

it("keeps the mobile action in flow after main and before footer, independent of scroll", () => {
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  expect(layout).toMatch(/<\/main>\s*<BackToTop \/>\s*<SiteFooter \/>/);
  const tree = nodes(render());
  expect(tree.find(node => node.type === "div")?.props.className).toBe("flex justify-center px-4 py-4 sm:hidden");
  const [mobile, desktop] = buttons();
  expect(mobile.props.className).toContain("min-h-11");
  expect(mobile.props.className).not.toMatch(/fixed|sticky|absolute/);
  expect(mobile.props["aria-hidden"]).toBeUndefined();
  expect(mobile.props.tabIndex).toBeUndefined();
  expect(desktop.props.className).toContain("hidden sm:flex");
  expect(desktop.props.className).toContain("bottom-8 fixed");
  expect(desktop.props.className).not.toContain("mobile-floating");
  // sm is the same 640px breakpoint used by the mobile navigation.
  expect(readFileSync("src/components/MobileNav.tsx", "utf8")).toContain("sm:hidden fixed");
  expect(desktop.props.tabIndex).toBe(-1);
  expect(desktop.props["aria-hidden"]).toBe(true);
  runtime.visible = true;
  expect(buttons()[1].props.tabIndex).toBe(0);
  expect(buttons()[1].props["aria-hidden"]).toBe(false);
});
it.each(["en", "zh"])("renders explicit button semantics and visible localized label in %s", locale => {
  runtime.locale = locale;
  const html = renderToStaticMarkup(render());
  const label = locale === "zh" ? "回到顶部" : "Back to top";
  expect(html).toContain(label);
  for (const button of buttons()) expect(button.props.type).toBe("button");
  expect(buttons()[0].props.children).toContain(label);
  expect(buttons()[1].props["aria-label"]).toBe(label);
});
it.each([false, true])("both actions honor reduced motion = %s on every activation", reduced => {
  vi.mocked(window.matchMedia).mockReturnValue({ matches: reduced } as MediaQueryList);
  for (const button of buttons()) (button.props.onClick as () => void)();
  expect(window.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  expect(window.scrollTo).toHaveBeenCalledTimes(2);
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: reduced ? "instant" : "smooth" });
});
it("preserves the strict desktop 400px threshold and cleans up listeners", () => {
  render(); const cleanup = runtime.effects[0]() as () => void;
  const listener = vi.mocked(window.addEventListener).mock.calls[0][1] as () => void;
  for (const [y, visible] of [[400, false], [401, true], [0, false]] as const) {
    Object.assign(window, { scrollY: y }); listener(); expect(runtime.visible).toBe(visible);
  }
  cleanup(); expect(window.removeEventListener).toHaveBeenCalledWith("scroll", listener);
});
it("retains the T shortcut, ignores form controls and modifiers, and respects reduced motion", () => {
  render(); const cleanup = runtime.effects[1]() as () => void;
  const listener = vi.mocked(window.addEventListener).mock.calls[0][1] as (event: object) => void;
  for (const target of [new HTMLInputElement(), new HTMLTextAreaElement(), new HTMLSelectElement()]) listener({ key: "t", target });
  listener({ key: "t", ctrlKey: true }); listener({ key: "t", metaKey: true }); listener({ key: "x" });
  expect(window.scrollTo).not.toHaveBeenCalled();
  listener({ key: "t" }); expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "smooth" });
  vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
  listener({ key: "t" }); expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "instant" });
  cleanup(); expect(window.removeEventListener).toHaveBeenCalledWith("keydown", listener);
});
