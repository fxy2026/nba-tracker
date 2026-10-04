import { readFileSync } from "node:fs";
import Link from "next/link";
import { afterEach, expect, it, vi } from "vitest";
import SkipToContent from "./SkipToContent";

afterEach(() => vi.unstubAllGlobals());

it.each(["Skip to content", "跳至主要内容"])("keeps a router-owned skip hash and moves keyboard focus: %s", label => {
  const main = { focus: vi.fn() };
  const getElementById = vi.fn(() => main);
  vi.stubGlobal("document", { getElementById });
  const link = SkipToContent({ children: label });
  expect(link.type).toBe(Link);
  expect(link.props.href).toBe("#main-content");
  expect(link.props.prefetch).toBe(false);
  expect(link.props.children).toBe(label);
  expect(link.props.className).toContain("focus:not-sr-only");
  // Next calls onNavigate only for an unmodified same-tab navigation; modified
  // clicks retain browser behavior and do not move focus in the current tab.
  link.props.onNavigate();
  expect(getElementById).toHaveBeenCalledExactlyOnceWith("main-content");
  expect(main.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  expect(layout).toContain('<main id="main-content" tabIndex={-1}');
  expect(layout).toMatch(/<SkipToContent>\s*\{t.nav.skipToContent\}\s*<\/SkipToContent>/);
});


it("is safe when the main target is unavailable", () => {
  vi.stubGlobal("document", { getElementById: () => null });
  expect(() => SkipToContent({ children: "Skip to content" }).props.onNavigate()).not.toThrow();
});
