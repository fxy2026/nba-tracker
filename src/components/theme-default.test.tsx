import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  theme: undefined as "dark" | "light" | undefined,
  effects: [] as Array<() => void>,
}));

vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useState(initial: "dark" | "light") {
    hooks.theme ??= initial;
    return [hooks.theme, (value: "dark" | "light") => { hooks.theme = value; }];
  },
  useEffect(effect: () => void) { hooks.effects.push(effect); },
}));
vi.mock("@/components/LocaleProvider", () => ({
  useLocale: () => ({ t: { theme: { switchToLight: "Switch to light", switchToDark: "Switch to dark" } } }),
}));

import ThemeScript from "./ThemeScript";
import ThemeToggle from "./ThemeToggle";

function documentFixture(initialTheme?: string, metaCount = 2) {
  const attributes = new Map<string, string>();
  if (initialTheme) attributes.set("data-theme", initialTheme);
  const metas = Array.from({ length: metaCount }, () => ({ setAttribute: vi.fn() }));
  return {
    documentElement: {
      getAttribute: (name: string) => attributes.get(name) ?? null,
      setAttribute: (name: string, value: string) => { attributes.set(name, value); },
    },
    querySelectorAll: vi.fn(() => metas),
    metas,
  };
}

function runStartup(saved: string | null, { storageFails = false, metaCount = 2 } = {}) {
  const document = documentFixture(undefined, metaCount);
  const matchMedia = vi.fn(() => ({ matches: true }));
  runInNewContext(ThemeScript().props.dangerouslySetInnerHTML.__html, {
    document,
    window: { matchMedia },
    localStorage: {
      getItem: vi.fn(() => {
        if (storageFails) throw new Error("Storage is blocked");
        return saved;
      }),
    },
  });
  expect(matchMedia).not.toHaveBeenCalled();
  return document;
}

beforeEach(() => {
  hooks.theme = undefined;
  hooks.effects = [];
});
afterEach(() => vi.unstubAllGlobals());

describe("light-first site theme", () => {
  it.each([null, "", "invalid", "system", "DARK", "light"])("defaults to light for stored value %j regardless of the OS", saved => {
    const document = runStartup(saved);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    for (const meta of document.metas) expect(meta.setAttribute).toHaveBeenCalledWith("content", "#F8FAFC");
  });

  it("respects saved dark and sets an explicit dark attribute", () => {
    const document = runStartup("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    for (const meta of document.metas) expect(meta.setAttribute).toHaveBeenCalledWith("content", "#060912");
  });

  it("still applies light when reading storage throws", () => {
    expect(runStartup("dark", { storageFails: true }).documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("still applies light when storage is unavailable and meta tags are absent", () => {
    const document = documentFixture(undefined, 0);
    runInNewContext(ThemeScript().props.dangerouslySetInnerHTML.__html, { document });
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("uses the same light-first toggle label for SSR and initial client render", () => {
    vi.stubGlobal("document", undefined);
    expect(ThemeToggle().props["aria-label"]).toBe("Switch to dark");
    vi.stubGlobal("document", documentFixture("dark"));
    expect(ThemeToggle().props["aria-label"]).toBe("Switch to dark");
    for (const effect of hooks.effects.splice(0)) effect();
    expect(ThemeToggle().props["aria-label"]).toBe("Switch to light");
  });

  it.each([undefined, "invalid", "light", "dark"])("toggles explicit themes repeatedly from %j and persists each choice", initial => {
    const document = documentFixture(initial);
    const setItem = vi.fn();
    vi.stubGlobal("document", document);
    vi.stubGlobal("localStorage", { setItem });
    const button = ThemeToggle();
    for (const effect of hooks.effects.splice(0)) effect();
    const expected = initial === "dark" ? ["light", "dark", "light"] : ["dark", "light", "dark"];
    // Repeated clicks also work before React has rerendered this handler.
    for (const next of expected) {
      button.props.onClick();
      expect(document.documentElement.getAttribute("data-theme")).toBe(next);
      expect(hooks.theme).toBe(next);
      expect(setItem).toHaveBeenLastCalledWith("theme", next);
      for (const meta of document.metas) expect(meta.setAttribute).toHaveBeenLastCalledWith("content", next === "light" ? "#F8FAFC" : "#060912");
    }
  });

  it("still changes theme if saving the preference fails", () => {
    const document = documentFixture("light");
    vi.stubGlobal("document", document);
    vi.stubGlobal("localStorage", { setItem: () => { throw new Error("Storage is blocked"); } });
    ThemeToggle().props.onClick();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(hooks.theme).toBe("dark");
    for (const meta of document.metas) expect(meta.setAttribute).toHaveBeenCalledWith("content", "#060912");
  });
});
