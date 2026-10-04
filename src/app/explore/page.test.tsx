import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

const locale = vi.hoisted(() => vi.fn());
vi.mock("@/lib/locale", () => ({ getLocale: locale }));
import ExplorePage from "./page";

function nodes(node: ReactNode): ReactElement<{ children?: ReactNode; href?: string }>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<{ children?: ReactNode; href?: string }>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return text(node.props.children);
  return typeof node === "string" ? node : "";
}

afterEach(() => vi.unstubAllGlobals());
it.each(["en", "zh"])("labels statistical archives as history and retains every archive link in %s", async language => {
  locale.mockResolvedValue(language);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected Explore fetch"); }));
  const tree = await ExplorePage();
  const archive = nodes(tree).find(node => node.type === "section" &&
    nodes(node).some(child => child.type === "h2" && text(child) === (language === "zh" ? "比赛档案" : "Game Archive")));
  expect(archive).toBeDefined();
  expect(text(archive)).toContain(language === "zh" ? "历史回顾" : "History");
  expect(text(archive)).not.toContain(language === "zh" ? "回放" : "Replay");
  expect(nodes(archive).flatMap(node => node.props.href ? [node.props.href] : [])).toEqual([
    "/best-games", "/records", "/this-day", "/history", "/season/2025-26", "/iconic-seasons", "/iconic-games", "/h2h",
  ]);
  expect(fetch).not.toHaveBeenCalled();
});
