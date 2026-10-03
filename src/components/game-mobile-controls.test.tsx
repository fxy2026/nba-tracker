import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PeriodScore } from "@/lib/api";
import en from "@/locales/en";
import zh from "@/locales/zh";

const runtime = vi.hoisted(() => ({
  slots: [] as unknown[], cursor: 0, locale: "en",
  scroller: { current: { scrollWidth: 600, scrollTo: vi.fn() } },
}));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  memo: (component: unknown) => component,
  useMemo: (factory: () => unknown) => factory(),
  useRef: () => runtime.scroller,
  useState: (initial: unknown) => {
    const index = runtime.cursor++;
    if (!(index in runtime.slots)) runtime.slots[index] = initial;
    return [runtime.slots[index], (next: unknown) => { runtime.slots[index] = next; }];
  },
}));
vi.mock("@/components/LocaleProvider", () => ({
  useLocale: () => ({ locale: runtime.locale, t: runtime.locale === "zh" ? zh : en }),
}));
import ScoringFlow from "./ScoringFlow";
import PlayByPlay, { type PlayAction } from "./PlayByPlay";

type HostProps = { children?: ReactNode; [key: string]: unknown };
function nodes(node: ReactNode): ReactElement<HostProps>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<HostProps>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  return isValidElement<HostProps>(node) ? text(node.props.children) : "";
}
function click(node: ReactElement<HostProps>) { (node.props.onClick as () => void)(); }
const periods = (scores: number[]): PeriodScore[] => scores.map((score, index) => ({ period: index + 1, periodType: index < 4 ? "REGULAR" : "OVERTIME", score }));
const chartProps = { homePeriods: periods([20, 25, 25, 30, 10, 11]), awayPeriods: periods([21, 25, 26, 28, 10, 10]), homeTricode: "BOS", awayTricode: "NYK" };
beforeEach(() => {
  runtime.slots = []; runtime.cursor = 0; runtime.locale = "en";
  runtime.scroller.current.scrollTo.mockClear();
});

describe("older scoring chart mobile presentation", () => {
  it.each(["en", "zh"])("keeps a bounded 180px-tall mobile plot, readable labels, scores and navigation in %s", locale => {
    runtime.locale = locale;
    const tree = ScoringFlow(chartProps);
    const all = nodes(tree);
    const region = all.find(node => node.props.role === "region")!;
    const svg = all.find(node => node.type === "svg")!;
    expect(region.props.className).toContain("max-w-full overflow-x-auto");
    expect(region.props.tabIndex).toBe(0);
    expect(region.props["aria-label"]).toBe(locale === "zh" ? "得分走势，可左右滚动查看整场比赛" : "Scoring flow: scroll horizontally to view the whole game");
    expect(svg.props.viewBox).toBe("0 0 600 180");
    expect(svg.props.className).toContain("min-w-[600px] sm:min-w-0");
    const axisLabels = all.filter(node => node.type === "text" && node.props.fontSize === 8);
    expect(axisLabels).toHaveLength(11);
    expect(axisLabels.every(node => node.props.className === "text-[12px] sm:text-[8px]")).toBe(true);
    const mobileLegend = all.find(node => String(node.props.className).includes("text-sm font-semibold tabular-nums sm:hidden"))!;
    expect(text(mobileLegend)).toBe("BOS 121NYK 120");
    expect(text(tree)).toContain(locale === "zh" ? "左右滑动或使用方向键" : "Swipe or use arrow keys");
    expect(svg.props["aria-label"]).toContain("NYK 120 vs BOS 121");
    const controls = all.filter(node => node.type === "button");
    expect(controls).toHaveLength(2);
    for (const button of controls) expect(button.props.className).toContain("min-h-[44px] min-w-[44px]");
    click(controls[1]); click(controls[0]); click(controls[1]);
    expect(runtime.scroller.current.scrollTo.mock.calls).toEqual([[{ left: 600 }], [{ left: 0 }], [{ left: 600 }]]);
  });

  it("retains every fallback quarter/OT score and the regulation/OT time scales", () => {
    const tree = ScoringFlow(chartProps);
    const lines = nodes(tree).filter(node => node.type === "path" && node.props.fill === "none");
    const x = [0, 12, 24, 36, 48, 53, 58].map(t => (36 + t / 58 * 516).toFixed(1));
    const path = (values: number[]) => values.map((v, i) => `${i ? "L" : "M"}${x[i]},${(152 - v / 121 * 136).toFixed(1)}`).join(" ");
    expect(lines.map(node => node.props.d)).toEqual([path([0, 20, 45, 70, 100, 110, 121]), path([0, 21, 46, 72, 100, 110, 120])]);
    expect(text(tree)).toContain("Q1Q2Q3Q4OT1OT2");
  });

  it("retains the detailed event threshold, clock normalization, unchanged-score filtering and exact score paths", () => {
    const samples = [
      [1, "PT11M00.00S", 2, 0, 1], [1, "PT10M00.00S", 2, 3, 2],
      [1, "PT09M00.00S", 4, 3, 3], [1, "PT00M00.00S", 20, 21, 12],
      [2, "PT11M00.00S", 22, 21, 13], [2, "PT00M00.00S", 45, 46, 24],
      [3, "PT00M00.00S", 70, 72, 36], [4, "PT00M00.00S", 100, 100, 48],
      [5, "PT04M00.00S", 102, 100, 49], [5, "PT00M00.00S", 110, 110, 53],
      [6, "PT00M00.00S", 121, 120, 58],
    ] as const;
    const events: NonNullable<Parameters<typeof ScoringFlow>[0]["scoreEvents"]> = samples.map(([period, clock, scoreHome, scoreAway]) => ({ period, clock, scoreHome: Number(scoreHome), scoreAway: Number(scoreAway) }));
    events.splice(1, 0, { ...events[0] }, { period: 1, clock: "PT10M30.00S", scoreHome: NaN, scoreAway: 0 });
    // The existing renderer also accepts provider scores encoded as strings.
    events[0].scoreHome = "2" as unknown as number;
    const tree = ScoringFlow({ ...chartProps, scoreEvents: events });
    const lines = nodes(tree).filter(node => node.type === "path" && node.props.fill === "none");
    const normalized = [[0, 0, 0], ...samples.map(([, , home, away, time]) => [time, home, away])];
    const path = (side: number) => normalized.map((point, index) => `${index ? "L" : "M"}${(36 + point[0] / 58 * 516).toFixed(1)},${(152 - point[side] / 121 * 136).toFixed(1)}`).join(" ");
    expect(lines.map(node => node.props.d)).toEqual([path(1), path(2)]);
    expect(text(tree)).toContain("12 plays");
    expect(renderToStaticMarkup(tree)).not.toMatch(/NaN|Infinity/);
    const fallback = ScoringFlow({ ...chartProps, scoreEvents: events.slice(0, 10) });
    const expected = ScoringFlow(chartProps);
    expect(nodes(fallback).filter(node => node.type === "path").map(node => node.props.d)).toEqual(nodes(expected).filter(node => node.type === "path").map(node => node.props.d));
  });

  it("keeps missing/zero data handling and close final scores unchanged", () => {
    expect(ScoringFlow({ ...chartProps, homePeriods: [] })).toBeNull();
    const zero = ScoringFlow({ ...chartProps, homePeriods: periods([0]), awayPeriods: [] });
    expect(renderToStaticMarkup(zero)).not.toMatch(/NaN|Infinity/);
    expect(text(zero)).toContain("BOS 0NYK 0");
    const tied = ScoringFlow({ ...chartProps, awayPeriods: chartProps.homePeriods });
    const legend = nodes(tied).find(node => String(node.props.className).includes("text-sm font-semibold tabular-nums sm:hidden"))!;
    expect(text(legend)).toBe("BOS 121NYK 121");
  });
});

const action = (period: number, index: number): PlayAction => ({
  actionNumber: period * 1000 + index, clock: "PT04M12.50S", period, teamTricode: "BOS",
  actionType: "2pt", subType: "Jump Shot", description: `Period ${period}, play ${index}`,
  personId: 1, playerNameI: "A. Player", shotResult: index % 3 === 0 ? "Made" : "Missed",
  scoreHome: "121", scoreAway: "120",
});
function feed(actions: PlayAction[], isLive = false) { runtime.cursor = 0; return PlayByPlay({ actions, isLive }); }
function periodButtons(tree: ReactNode) {
  const group = nodes(tree).find(node => node.props.role === "group")!;
  return { group, buttons: nodes(group).filter(node => node.type === "button") };
}

describe("play-by-play mobile controls", () => {
  it.each(["en", "zh"])("wraps 44px periods with three-digit counts and six overtimes in %s", locale => {
    runtime.locale = locale;
    const actions = Array.from({ length: 10 }, (_, p) => Array.from({ length: 123 }, (_, i) => action(p + 1, i))).flat();
    const tree = feed(actions);
    const { group, buttons } = periodButtons(tree);
    expect(group.props.className).toContain("max-w-full flex-wrap");
    expect(group.props.className).not.toContain("overflow-hidden");
    expect(buttons).toHaveLength(10);
    expect(buttons.every(node => String(node.props.className).includes("min-h-[44px] min-w-[44px] shrink-0"))).toBe(true);
    expect(buttons.every(node => text(node).includes("(123)"))).toBe(true);
    expect(buttons[9].props["aria-pressed"]).toBe(true);
    click(buttons[0]);
    expect(periodButtons(feed(actions)).buttons[0].props["aria-pressed"]).toBe(true);
    const scoring = nodes(feed(actions)).find(node => node.type === "button" && text(node) === (locale === "zh" ? zh.playByPlayComp.scoringOnly : en.playByPlayComp.scoringOnly))!;
    expect(scoring.props.className).toContain("min-h-[44px]");
    click(scoring);
    const scoringTree = feed(actions);
    expect(periodButtons(scoringTree).buttons.every(node => text(node).includes("(41)"))).toBe(true);
    expect(nodes(scoringTree).filter(node => node.type === "p")).toHaveLength(41);
    click(periodButtons(scoringTree).buttons[9]);
    expect(periodButtons(feed(actions)).buttons[9].props["aria-pressed"]).toBe(true);
  });

  it("keeps auto-follow on the latest period, but preserves a manually pinned period across live refreshes", () => {
    const actions = [action(4, 1), action(4, 2)];
    expect(periodButtons(feed(actions, true)).buttons[3].props["aria-pressed"]).toBe(true);
    const overtime = [...actions, action(5, 1), action(5, 2)];
    const latest = feed(overtime, true);
    expect(periodButtons(latest).buttons[4].props["aria-pressed"]).toBe(true);
    const descriptions = nodes(latest).filter(node => node.type === "p").map(text);
    expect(descriptions[0]).toContain("play 2"); expect(descriptions[1]).toContain("play 1");
    click(periodButtons(latest).buttons[3]);
    const refreshed = feed([...overtime, action(6, 1)], true);
    expect(periodButtons(refreshed).buttons[3].props["aria-pressed"]).toBe(true);
    expect(nodes(refreshed).filter(node => node.type === "p").map(text).every(value => value.includes("Period 4"))).toBe(true);
    const final = feed(overtime);
    expect(nodes(final).filter(node => node.type === "p").map(text)[0]).toContain("play 1");
  });

  it("retains empty feed and no-scoring-period behavior", () => {
    expect(feed([])).toBeNull();
    const actions = [action(1, 1)];
    const tree = feed(actions);
    click(nodes(tree).find(node => node.type === "button" && text(node) === en.playByPlayComp.scoringOnly)!);
    expect(text(feed(actions))).toContain(en.playByPlayComp.noPlayData);
    expect(text(periodButtons(feed(actions)).buttons[0])).toContain("(0)");
  });
});
