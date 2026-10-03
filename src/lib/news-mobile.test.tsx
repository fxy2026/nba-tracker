import { isValidElement, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ locale: "en", values: [null, null] as (string | null)[], index: 0 }));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useMemo: (fn: () => unknown) => fn(),
  useState: () => {
    const index = state.index++;
    return [state.values[index], (value: string | null) => { state.values[index] = value; }];
  },
}));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: state.locale }) }));
import NewsFeed, { type NewsArticle } from "@/app/news/NewsFeed";
import styles from "@/app/news/news-mobile.module.css";

type Props = { children?: ReactNode; [key: string]: unknown };
function nodes(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  return isValidElement<Props>(node) ? text(node.props.children) : "";
}
const articles: NewsArticle[] = [
  { id: "1", type: "Story", headline: "A complete long headline", description: "The full source description", link: "https://www.espn.com/nba/story/1", published: "2026-10-03T10:00:00Z", byline: "Reporter", image: "https://a.espncdn.com/1.jpg", teams: [{ tricode: "BOS", label: "Boston Celtics" }] },
  { id: "2", type: "Recap", headline: "Recap without image", description: "", link: "", published: "invalid", byline: "", image: "", teams: [{ tricode: "LAL", label: "Los Angeles Lakers" }] },
  { id: "3", type: "Unknown", headline: "Fallback category", description: "", link: "https://www.espn.com/nba/story/3", published: "2026-09-01T10:00:00Z", byline: "", image: "", teams: [] },
];
function render(input = articles) { state.index = 0; return NewsFeed({ articles: input, fetchedAt: Date.parse("2026-10-03T11:00:00Z") }); }
function group(tree: ReactNode, label: string) { return nodes(tree).find(n => n.props["aria-label"] === label)!; }
function button(tree: ReactNode, label: string) { return nodes(tree).find(n => n.type === "button" && text(n) === label)!; }
function click(node: ReactElement<Props>) { (node.props.onClick as () => void)(); }
function rows(tree: ReactNode) { return nodes(tree).filter(n => n.type === "article"); }
beforeEach(() => { state.values = [null, null]; state.locale = "en"; });

describe("news filter accessibility and unchanged selection behavior", () => {
  it.each(["en", "zh"])("filters, toggles and resets independently in %s", locale => {
    state.locale = locale;
    const category = locale === "zh" ? "资讯分类" : "News category";
    const teams = locale === "zh" ? "球队筛选" : "Filter by team";
    const all = locale === "zh" ? "全部" : "All";
    const story = locale === "zh" ? "报道" : "Story";
    let tree = render();
    expect(rows(tree)).toHaveLength(3);
    expect(button(group(tree, category), all).props["aria-pressed"]).toBe(true);
    click(button(group(tree, category), story));
    tree = render();
    expect(rows(tree)).toHaveLength(1);
    expect(button(group(tree, category), story).props["aria-pressed"]).toBe(true);
    click(button(group(tree, teams), "BOS"));
    tree = render(); expect(rows(tree)).toHaveLength(1); expect(text(tree)).toContain("1 / 3");
    click(button(group(tree, teams), "BOS"));
    expect(state.values).toEqual(["Story", null]);
    click(button(group(render(), category), story));
    expect(state.values).toEqual([null, null]);
    click(button(group(render(), teams), "LAL"));
    click(button(group(render(), category), story));
    tree = render(); expect(rows(tree)).toHaveLength(0);
    expect(text(tree)).toContain(locale === "zh" ? "没有符合筛选条件的资讯" : "No news matches the current filters");
    click(button(tree, locale === "zh" ? "清除筛选" : "Clear filters"));
    expect(state.values).toEqual([null, null]); expect(rows(render())).toHaveLength(3);
    state.values = ["Story", "BOS"];
    click(button(group(render(), category), all)); expect(state.values).toEqual([null, "BOS"]);
    click(button(group(render(), teams), all)); expect(state.values).toEqual([null, null]);
  });

  it("preserves content, source URLs, team destinations and missing-link fallbacks", () => {
    const html = renderToStaticMarkup(render());
    for (const a of articles) {
      expect(html).toContain(a.headline);
      if (a.link) expect(html).toContain(`href="${a.link}"`);
      for (const team of a.teams) expect(html).toContain(`href="/team/${team.tricode}"`);
    }
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('alt=""');
    expect(html).not.toContain('href=""');
    expect(html).toContain("Reporter"); expect(html).toContain("ESPN");
    expect(html).toContain("The full source description");
    expect(rows(render()).filter(n => String(n.props.className).includes(styles.withImage))).toHaveLength(1);
    for (const b of nodes(render()).filter(n => n.type === "button")) {
      expect(b.props.type).toBe("button"); expect(typeof b.props["aria-pressed"]).toBe("boolean");
    }
  });

  it("keeps empty and single-category feeds safe", () => {
    expect(rows(render([]))).toHaveLength(0);
    expect(nodes(render([])).filter(n => n.props.role === "group")).toHaveLength(0);
    expect(nodes(render([articles[0]])).filter(n => n.props["aria-label"] === "News category")).toHaveLength(0);
  });

  it("scopes larger targets, single-row team scrolling and full-width reading to mobile", () => {
    const css = readFileSync("src/app/news/news-mobile.module.css", "utf8");
    expect(css.replace(/\/\*[\s\S]*?\*\//g, "").trim().startsWith("@media (max-width: 639px) {")).toBe(true);
    expect(css).toMatch(/\.filterChip,\s*\.teamLink,\s*\.clearButton\s*\{[^}]*min-height: 44px;[^}]*min-width: 44px;/);
    expect(css).toMatch(/\.teamFilters\s*\{[^}]*flex-wrap: nowrap;[^}]*overflow-x: auto;/);
    expect(css).toContain("scrollbar-width: thin"); expect(css).toContain("grid-column: 1 / -1");
    expect(css).not.toMatch(/display: none|overflow-x: hidden|font-size:/);
  });
});

it("article team badges retain exact destinations and disable secondary prefetch", () => {
  const links = nodes(render()).filter(node => node.type === Link);
  expect(links.map(node => node.props.href)).toEqual(["/team/BOS", "/team/LAL"]);
  expect(links.map(node => text(node))).toEqual(["BOS", "LAL"]);
  expect(links.map(node => node.props.title)).toEqual(["Boston Celtics", "Los Angeles Lakers"]);
  for (const link of links) expect(link.props.prefetch).toBe(false);
});
