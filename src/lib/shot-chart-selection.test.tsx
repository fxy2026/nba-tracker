import { isValidElement, type ComponentProps, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/locales/en";
import zh from "@/locales/zh";
import type { ShotAction } from "./api";

const hooks = vi.hoisted(() => ({ index: 0, states: [] as unknown[], locale: "en" as "en" | "zh" }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useMemo: (calculate: () => unknown) => calculate(),
  useState: (initial: unknown) => {
    const index = hooks.index++;
    if (!(index in hooks.states)) hooks.states[index] = initial;
    return [hooks.states[index], (value: unknown) => {
      hooks.states[index] = typeof value === "function" ? value(hooks.states[index]) : value;
    }];
  },
}));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: hooks.locale, t: hooks.locale === "zh" ? zh : en }) }));
import ShotChart from "@/components/ShotChart";
import Select from "@/components/ui/Select";

type Props = Record<string, unknown>;
function find(node: ReactNode, type: unknown): Props[] {
  if (Array.isArray(node)) return node.flatMap(child => find(child, type));
  if (!isValidElement<Props>(node)) return [];
  return [...(node.type === type ? [node.props] : []), ...find(node.props.children as ReactNode, type)];
}
const homeShot: ShotAction = { personId: 1, playerNameI: "A. Home", teamTricode: "DET", period: 1, clock: "PT10M00.00S", actionType: "2pt", subType: "Jump Shot", shotResult: "Made", x: 25, y: 50, shotDistance: 24, description: "Long two" };
const props: ComponentProps<typeof ShotChart> = {
  homeTricode: "DET", awayTricode: "MEM",
  shots: [homeShot, { ...homeShot, personId: 2, actionType: "3pt", shotResult: "Missed" }, { ...homeShot, personId: 3, teamTricode: "MEM", actionType: "3pt" }, { ...homeShot, actionType: "freethrow" }],
  players: [{ personId: 1, nameI: "A. Home", teamTricode: "DET" }, { personId: 2, nameI: "B. Home", teamTricode: "DET" }, { personId: 3, nameI: "C. Away", teamTricode: "MEM" }],
};
const component = (ShotChart as unknown as { type: (props: ComponentProps<typeof ShotChart>) => ReactNode }).type;
function draw() { hooks.index = 0; return component(props); }
function click(tree: ReactNode, label: string) {
  const button = find(tree, "button").find(props => props.children === label);
  expect(button).toBeDefined();
  (button!.onClick as () => void)();
  return draw();
}
function choose(tree: ReactNode, value: string) {
  (find(tree, Select)[0].onValueChange as (value: string) => void)(value);
  return draw();
}
function expectSummary(tree: ReactNode, made: number, total: number, percent: string) {
  const chart = find(tree, "svg").find(props => props.role === "img")!;
  expect(chart["aria-label"]).toBe(hooks.locale === "en"
    ? `Game shot chart — ${made} of ${total} made, ${percent}%`
    : `比赛投篮图 — ${made}/${total} 命中 ${percent}%`);
}

beforeEach(() => { hooks.index = 0; hooks.states = []; hooks.locale = "en"; });
describe("legacy shot chart shared player selector", () => {
  it.each(["en", "zh"] as const)("preserves numeric player filtering, all-player reset and team-change clearing (%s)", locale => {
    hooks.locale = locale;
    const t = locale === "en" ? en : zh;
    let tree = draw();
    expect(find(tree, Select)).toHaveLength(0);
    expectSummary(tree, 2, 3, "66.7");

    tree = click(tree, "DET");
    const select = find(tree, Select)[0];
    expect(select["aria-label"]).toBe(locale === "en" ? "Filter by player" : "按球员筛选");
    expect(select.value).toBe("");
    expect(select.options).toEqual([{ value: "", label: t.shotChartComp.allPlayers }, { value: "1", label: "A. Home" }, { value: "2", label: "B. Home" }]);
    expect(find(tree, "select")).toHaveLength(0);
    expectSummary(tree, 1, 2, "50.0");

    tree = choose(tree, "1");
    expect(find(tree, Select)[0].value).toBe("1");
    expectSummary(tree, 1, 1, "100.0");
    tree = choose(tree, "");
    expect(find(tree, Select)[0].value).toBe("");
    expectSummary(tree, 1, 2, "50.0");
    tree = choose(tree, "2");
    expectSummary(tree, 0, 1, "0.0");

    tree = click(tree, "MEM");
    expect(find(tree, Select)[0].value).toBe("");
    expect(find(tree, Select)[0].options).toEqual([{ value: "", label: t.shotChartComp.allPlayers }, { value: "3", label: "C. Away" }]);
    expectSummary(tree, 1, 1, "100.0");
    tree = choose(tree, "3");
    expect(find(tree, Select)[0].value).toBe("3");
    tree = click(tree, t.shotChartComp.all);
    expect(find(tree, Select)).toHaveLength(0);
    expectSummary(tree, 2, 3, "66.7");
    tree = click(tree, "MEM");
    expect(find(tree, Select)[0].value).toBe("");
  });
});
