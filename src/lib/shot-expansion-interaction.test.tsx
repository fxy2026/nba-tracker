import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import schedule from "@/data/schedule-2025-26.json";
import ShotChartExplorer from "@/components/ShotChartExplorer";
import CourtView from "@/components/shot-chart/ComparisonCourtView";
import { getVerifiedShotChart } from "./verified-shot-chart-archive";
import type { CourtShot } from "./court-shots";

// Hook harness exercises actual filter/list/selection handlers without a browser.
// Production smoke independently checks the final rendered pages and bundle boundary.
const harness = vi.hoisted(() => ({ states: [] as unknown[], index: 0, locale: "en" as "en" | "zh" }));
// Standalone handler harness; real shared-context coverage is separate.
vi.mock("@/components/GamePeriodProvider", () => ({ useLinkedGamePeriod: () => null }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useMemo: (fn: () => unknown) => fn(),
  useState: (initial: unknown) => {
    const index = harness.index++;
    if (!(index in harness.states)) harness.states[index] = initial;
    return [harness.states[index], (value: unknown) => { harness.states[index] = typeof value === "function" ? value(harness.states[index]) : value; }];
  },
}));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: harness.locale }) }));
interface Props { children?: ReactNode; onClick?: () => void; onChange?: (event: { target: { value: string } }) => void; [key: string]: unknown }
function elements(node: ReactNode, type: unknown): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(child => elements(child, type));
  if (!isValidElement<Props>(node)) return [];
  return [...(node.type === type ? [node] : []), ...elements(node.props.children, type)];
}
function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return isValidElement<Props>(node) ? text(node.props.children) : "";
}
const game = schedule.dates.flatMap(date => date.games).find(row => row.gameId === "0042500173")!;
const data = getVerifiedShotChart(game)!;
function render() { harness.index = 0; return ShotChartExplorer({ data }); }
function click(tree: ReactNode, label: string) { elements(tree, "button").find(button => text(button) === label)!.props.onClick!(); }
beforeEach(() => { harness.states = []; harness.index = 0; harness.locale = "en"; });

describe("reviewed OT1 filters and truthful shot details", () => {
  it.each(["en", "zh"] as const)("keeps all 15 OT attempts, source clocks and correct result counts (%s)", locale => {
    harness.locale = locale;
    let tree = render();
    const period = elements(tree, "select").find(select=>select.props["aria-label"]===(locale === "en" ? "Period" : "节次"))!;
    expect(elements(period, "option").map(text)).toEqual(locale === "en" ? ["Whole game", "Q1", "Q2", "Q3", "Q4", "OT1"] : ["全场", "第 1 节", "第 2 节", "第 3 节", "第 4 节", "加时1"]);
    period.props.onChange!({ target: { value: "5" } });
    tree = render();
    const shots = elements(tree, CourtView)[0].props.shots as CourtShot[];
    expect(shots).toHaveLength(15);
    expect(shots.every(shot => shot.period === 5)).toBe(true);
    expect(text(tree)).toContain(locale === "en" ? "15 shots · OT1" : "15 次投篮 · 加时1");
    (elements(tree, CourtView)[0].props.onSelect as (id: number) => void)(shots[0].eventId);
    tree = render();
    expect(text(tree)).toContain(locale === "en" ? "OT1" : "加时1");
    expect(text(tree)).not.toContain("Q5");
    expect(text(tree)).not.toContain("PT0");
    click(tree, locale === "en" ? "Browse every shot (15)" : "查看逐次投篮 (15)");
    tree = render();
    expect(elements(tree, "li")).toHaveLength(15);
    expect(elements(tree, "li").every(row => text(row).includes(locale === "en" ? "OT1" : "加时1"))).toBe(true);
    elements(tree, "select").find(select=>select.props["aria-label"]===(locale === "en" ? "Result" : "结果"))!.props.onChange!({ target: { value: "Made" } });
    tree = render();
    expect(elements(tree, CourtView)[0].props.shots).toHaveLength(5);
    expect(elements(tree, CourtView)[0].props.selectedId).toBeNull();
    click(tree, locale === "en" ? "Clear filters" : "清除筛选");
    tree = render();
    expect(elements(tree, CourtView)[0].props.shots).toHaveLength(177);
    expect(elements(tree, "li")).toHaveLength(177);
  });
});
