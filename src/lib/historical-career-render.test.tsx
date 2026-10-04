import { readFileSync } from "node:fs";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import archive from "@/data/historical-career-archives/893-2026-10-04.json";
import { normalizeHistoricalCareerData, type HistoricalCareerSeasonType } from "./historical-career-data";

const state = vi.hoisted(() => ({ index: 0, seasonType: "Regular Season", mode: "per-game" }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: () => {
    const key = state.index++ === 0 ? "seasonType" : "mode";
    return [state[key], (value: string) => { state[key] = value; }];
  },
}));
import HistoricalPlayerCareer, { HistoricalCareerTable } from "@/components/player/HistoricalPlayerCareer";

const data = normalizeHistoricalCareerData(archive, 893)!;
type Props = { children?: ReactNode; [key: string]: unknown };
function nodes(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
const render = (locale: "en" | "zh", seasonType: HistoricalCareerSeasonType, mode: "per-game" | "totals") => renderToStaticMarkup(createElement(HistoricalCareerTable, { data, locale, seasonType, mode }));
beforeEach(() => { state.index = 0; state.seasonType = "Regular Season"; state.mode = "per-game"; });

describe.each(["en", "zh"] as const)("historical season table in %s", locale => {
  it("server-renders 15 regular seasons with a weighted total and stable row labels", () => {
    const html = render(locale, "Regular Season", "per-game");
    expect(html).toContain('role="region"'); expect(html).toContain('tabindex="0"');
    expect(html).toContain("1984-85"); expect(html).toContain("2002-03");
    expect(html).toContain(">30.1</td>"); expect(html).toContain(">1072</td>");
    expect(html.match(/scope="row"/g)).toHaveLength(16);
    expect(html).toContain(locale === "zh" ? "未知或有争议" : "unknown or disputed");
    expect(html).not.toContain("1993-94"); expect(html).not.toContain("NaN");
    const minutesRow = html.match(/<tr>\s*<th[^>]+scope="row"[^>]*><span[^>]*>2001-02[\s\S]*?<\/tr>/)?.[0];
    expect(minutesRow).toContain(">—</td>");
  });
  it("renders independent 13-season playoff totals and exact shooting volume", () => {
    const html = render(locale, "Playoffs", "totals");
    expect(html.match(/scope="row"/g)).toHaveLength(14);
    expect(html).toContain(">5987</td>"); expect(html).toContain(">179</td>");
    expect(html).toContain(">33.4</dd>"); expect(html).toContain("FGM");
    expect(html).not.toContain("2001-02"); expect(html).not.toContain("2002-03");
  });
  it("folds precise provenance and disputed values without claiming shot coverage", () => {
    const html = renderToStaticMarkup(createElement(HistoricalPlayerCareer, { data, locale }));
    expect(html).toContain('data-historical-career="893"');
    expect(html).toContain("2026-10-04T03:24:33Z");
    expect(html).toContain("2093"); expect(html).toContain("2094");
    expect(html).toContain("https://www.statmuse.com/nba/ask/jordan-stats-career-total");
    expect(html).toContain("https://history.basketballmonster.com/Player/Details/11364?name=Michael_Jordan");
    expect(html).toContain(locale === "zh" ? "并非 NBA 官方核验" : "not an NBA-officially verified");
    expect(html).toContain(locale === "zh" ? "不代表投篮坐标" : "do not establish shot-coordinate");
    expect(html).toContain(locale === "zh" ? "常规赛 15 季 · 季后赛 13 季" : "Regular season: 15 seasons · Playoffs: 13 seasons");
    expect(html).toMatch(/<details[^>]*>/); expect(html).not.toMatch(/<details[^>]*open/);
  });
  it("shows missing competition data rather than invented zeros", () => {
    const html = renderToStaticMarkup(createElement(HistoricalCareerTable, { data: { ...data, rows: [] }, locale, seasonType: "Playoffs", mode: "totals" }));
    expect(html).toContain(locale === "zh" ? "不代表零次出场" : "does not imply zero appearances");
    expect(html).not.toContain("<table"); expect(html).not.toContain("0.0");
  });
});

it("keeps season selection and display mode independent through repeated switches", () => {
  const tree = () => { state.index = 0; return HistoricalPlayerCareer({ data, locale: "en" }); };
  let all = nodes(tree());
  let buttons = all.filter(node => node.type === "button");
  expect(buttons).toHaveLength(4);
  expect(buttons.map(button => button.props["aria-pressed"])).toEqual([true, false, true, false]);
  for (const button of buttons) { expect(button.props.type).toBe("button"); expect(button.props.className).toContain("min-h-11"); }
  (buttons[1].props.onClick as () => void)();
  (buttons[3].props.onClick as () => void)();
  all = nodes(tree()); buttons = all.filter(node => node.type === "button");
  expect(buttons.map(button => button.props["aria-pressed"])).toEqual([false, true, false, true]);
  expect(all.find(node => node.type === HistoricalCareerTable)?.props).toMatchObject({ seasonType: "Playoffs", mode: "totals" });
  (buttons[0].props.onClick as () => void)();
  expect(nodes(tree()).find(node => node.type === HistoricalCareerTable)?.props).toMatchObject({ seasonType: "Regular Season", mode: "totals" });
  (buttons[2].props.onClick as () => void)();
  expect(nodes(tree()).find(node => node.type === HistoricalCareerTable)?.props).toMatchObject({ seasonType: "Regular Season", mode: "per-game" });
});

it("contains mobile overflow locally and uses opaque sticky season cells", () => {
  const css = readFileSync(new URL("../components/player/historical-career.module.css", import.meta.url), "utf8");
  expect(css).toContain("max-width: 100%"); expect(css).toContain("overflow-x: auto");
  expect(css).toContain("position: sticky"); expect(css).toContain("background-color: var(--bg-card)");
  expect(css).toContain("background-color: var(--bg-secondary)");
  expect(css).toContain("@media (max-width: 639px)"); expect(css).not.toContain("100vw");
});
