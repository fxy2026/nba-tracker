import Select from "@/components/ui/Select";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode, type ReactElement } from "react";
import ShotChartExplorer from "@/components/ShotChartExplorer";
import ComparisonCourtView from "@/components/shot-chart/ComparisonCourtView";
import ReportedScoreChart from "@/app/game/[id]/_components/ReportedScoreChart";
import { getVerifiedShotChart } from "./verified-shot-chart-archive";
import type { CourtShot } from "./court-shots";
import type { ScorePeriod } from "./reported-score-chart";
import facts from "@/data/reported-score-sequences/0022500961.json";
import schedule from "@/data/schedule-2025-26.json";

// Both real chart handlers share the same state adapter. This deterministic
// harness complements (and does not replace) real-provider SSR / browser QA.
const harness = vi.hoisted(() => ({
  states: { court: [] as unknown[], score: [] as unknown[] },
  owner: "court" as "court" | "score", index: 0, period: 0 as ScorePeriod,
}));
vi.mock("@/components/GamePeriodProvider", () => ({ useLinkedGamePeriod: () => ({
  period: harness.period, selectPeriod: (period: ScorePeriod) => { harness.period = period; },
}) }));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: "en" }) }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useId: () => "linked-period-test", useEffect: () => {}, useRef: () => ({ current: null }), useMemo: (fn: () => unknown) => fn(),
  useState: (initial: unknown) => {
    const owner = harness.owner, index = harness.index++;
    if (!(index in harness.states[owner])) harness.states[owner][index] = initial;
    return [harness.states[owner][index], (next: unknown) => {
      harness.states[owner][index] = typeof next === "function" ? next(harness.states[owner][index]) : next;
    }];
  },
}));
interface Props { children?: ReactNode; onClick?: () => void; onValueChange?: (value: string) => void; onChange?: (event: { target: { value: string }; currentTarget: { value: string } }) => void; [key: string]: unknown }
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
const game = schedule.dates.flatMap(date => date.games).find(game => game.gameId === "0022500961")!;
const data = getVerifiedShotChart(game)!;
function render() {
  harness.owner = "court"; harness.index = 0; const court = ShotChartExplorer({ data });
  harness.owner = "score"; harness.index = 0;
  const score = ReportedScoreChart({ rows: facts.reportedScoreRows, homeTricode: "DET", awayTricode: "MEM", sourceUrl: "https://statsdmz.nba.com/pdfs/20260313/20260313_MEMDET_book.pdf", isZh: false });
  return { court, score, view: elements(court, ComparisonCourtView)[0].props, slider: elements(score, "input")[0].props };
}
function change(node: ReactNode, label: string, value: string) {
  elements(node, Select).find(item => item.props["aria-label"] === label)!.props.onValueChange!(value);
}
function click(node: ReactNode, label: string) {
  elements(node, "button").find(item => item.props["aria-label"] === label || text(item) === label)!.props.onClick!();
}
function selected(node: ReactNode, label: string) { return elements(node, Select).find(item => item.props["aria-label"] === label)!.props.value; }
beforeEach(() => { harness.states = { court: [], score: [] }; harness.period = 0; harness.index = 0; });

describe("linked period handlers across both panels", () => {
  it("synchronizes both directions, retaining cumulative Q2 scores and exact counts", () => {
    let tree = render(); change(tree.court, "Period", "2"); tree = render();
    expect(tree.slider.max).toBe(29); expect(tree.slider.value).toBe(0);
    expect(tree.slider["aria-valuetext"]).toContain("12:00, DET 37, MEM 35");
    expect(tree.view.shots).toHaveLength(45);
    expect(text(tree.court)).toContain("39.1%FG9 / 23"); expect(text(tree.court)).toContain("59.1%FG13 / 22");
    for (const [period, scores, shots] of [[1, 33, 46], [2, 30, 45], [3, 29, 43], [4, 32, 47]]) {
      click(tree.score, `Q${period}`); tree = render();
      expect(selected(tree.court, "Period")).toBe(String(period)); expect(tree.slider.max).toBe(scores - 1); expect(tree.view.shots).toHaveLength(shots);
    }
    click(tree.score, "Game"); tree = render(); expect(tree.slider.max).toBe(123); expect(tree.view.shots).toHaveLength(181);
  });
  it("keeps both players, result, focus and list local; shot reset preserves shared period and focus", () => {
    let tree = render(); const away = String(data.shots.find(shot => shot.teamTricode === "MEM")!.personId), home = String(data.shots.find(shot => shot.teamTricode === "DET")!.personId);
    change(tree.court, "MEM Player", away); tree = render(); change(tree.court, "DET Player", home); tree = render();
    change(tree.court, "Result", "Missed"); tree = render(); click(tree.court, "MEM Half court"); tree = render();
    click(tree.score, "Q2"); tree = render();
    expect(selected(tree.court, "MEM Player")).toBe(away); expect(selected(tree.court, "DET Player")).toBe(home); expect(selected(tree.court, "Result")).toBe("Missed"); expect(tree.view.focus).toBe("away");
    click(tree.court, `Browse every shot (${(tree.view.shots as CourtShot[]).length})`); tree = render();
    click(tree.court, "Clear shot filters"); tree = render();
    expect(harness.period).toBe(2); expect(tree.view.focus).toBe("away"); expect(tree.view.shots).toHaveLength(23); expect(elements(tree.court, "li")).toHaveLength(23);
    expect(selected(tree.court, "MEM Player")).toBe("all"); expect(selected(tree.court, "DET Player")).toBe("all"); expect(selected(tree.court, "Result")).toBe("all");
    click(tree.score, "Game"); tree = render(); expect(tree.view.focus).toBe("away"); expect(elements(tree.court, "li")).toHaveLength(89);
  });
  it("clears out-of-period shots without resurrecting them and retains valid selections", () => {
    let tree = render(); const shot = data.shots.find(shot => shot.period === 1)!;
    (tree.view.onSelect as (id: number) => void)(shot.eventId); tree = render();
    click(tree.score, "Q1"); tree = render(); expect(tree.view.selectedId).toBe(shot.eventId);
    click(tree.score, "Q2"); tree = render(); expect(tree.view.selectedId).toBeNull();
    click(tree.score, "Q1"); tree = render(); expect(tree.view.selectedId).toBeNull();
    click(tree.score, "Game"); tree = render(); expect(tree.view.selectedId).toBeNull();
  });
  it("preserves source-row inspection for repeated selection and never filters court by a score event", () => {
    let tree = render(); change(tree.court, "Period", "1"); tree = render();
    for (const [index, row] of facts.reportedScoreRows.entries()) if (row.period === 1 && row.clockAsPrinted === ":31.7") {
      tree.slider.onChange!({ target: { value: String(index) }, currentTarget: { value: String(index) } }); tree = render();
      expect(tree.slider["aria-valuetext"]).toContain(`:31.7, DET 35, MEM ${row.awayScore}`); expect(tree.view.shots).toHaveLength(46); expect(tree.view.selectedId).toBeNull();
    }
    const value = tree.slider["aria-valuetext"]; click(tree.score, "Q1"); tree = render(); expect(tree.slider["aria-valuetext"]).toBe(value);
    change(tree.court, "Period", "all"); tree = render(); expect(tree.slider["aria-valuetext"]).toBe(value);
    change(tree.court, "Period", "2"); tree = render(); expect(tree.slider["aria-valuetext"]).toContain("12:00, DET 37, MEM 35");
    change(tree.court, "Period", "all"); tree = render(); expect(tree.slider["aria-valuetext"]).toContain("12:00, DET 37, MEM 35");
  });
  it("keeps FG denominators truthful under result visibility and ignores unsupported linked periods", () => {
    let tree = render(); click(tree.score, "Q2"); tree = render(); change(tree.court, "Result", "Made"); tree = render();
    expect(tree.view.shots).toHaveLength(22); expect(text(tree.court)).toContain("39.1%FG9 / 23"); expect(text(tree.court)).toContain("59.1%FG13 / 22");
    change(tree.court, "Period", "5"); tree = render(); expect(harness.period).toBe(2); expect(tree.view.shots).toHaveLength(22);
  });
});
