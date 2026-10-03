import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import facts from "@/data/reported-score-sequences/0022500961.json";
import ReportedScoreChart from "@/app/game/[id]/_components/ReportedScoreChart";

// Exercise the actual component handlers in a deterministic hook harness. Browser
// layout/native input behavior is a separate smoke test, not claimed by this file.
const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useId: () => "score-chart-test",
  useEffect: () => {},
  useRef: () => ({ current: null }),
  useMemo: (factory: () => unknown) => factory(),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [hooks.values[index], (next: unknown) => { hooks.values[index] = next; }];
  },
}));

interface Props {
  children?: ReactNode;
  type?: string;
  value?: number;
  max?: number;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-pressed"?: boolean;
  "aria-valuetext"?: string;
  onClick?: () => void;
  onChange?: (event: { currentTarget: { value: string } }) => void;
  onPointerDown?: (event: unknown) => void;
  onPointerMove?: (event: unknown) => void;
}
function elements(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function render(isZh = false) {
  hooks.cursor = 0;
  const nodes = elements(ReportedScoreChart({ rows: facts.reportedScoreRows, homeTricode: "DET", awayTricode: "MEM", sourceUrl: "https://statsdmz.nba.com/pdfs/20260313/20260313_MEMDET_book.pdf", isZh }));
  return {
    slider: nodes.find(node => node.type === "input")!.props,
    button: (label: string) => nodes.find(node => node.type === "button" && (node.props["aria-label"] === label || node.props.children === label))!.props,
    svg: nodes.find(node => node.type === "svg" && node.props.onPointerDown)!.props,
    observations: nodes.filter(node => Object.hasOwn(node.props, "data-score-observation")).length,
    circles: nodes.filter(node => node.type === "circle").length,
    selectedSquares: nodes.filter(node => node.type === "rect" && !Object.hasOwn(node.props, "data-quarter-band")).length,
  };
}
beforeEach(() => { hooks.values = []; hooks.cursor = 0; });

describe("reported chart component handlers", () => {
  it("starts at the last real row and supports repeated next/previous navigation without overshoot", () => {
    expect(render().slider.value).toBe(123);
    expect(render().button("Next record").disabled).toBe(true);
    render().button("Previous record").onClick!();
    expect(render().slider.value).toBe(122);
    render().button("Previous record").onClick!();
    expect(render().slider.value).toBe(121);
    render().button("Next record").onClick!();
    expect(render().slider.value).toBe(122);
    render().slider.onChange!({ currentTarget: { value: "0" } });
    expect(render().button("Previous record").disabled).toBe(true);
    expect(render().slider["aria-valuetext"]).toContain("11:11, DET 0, MEM 2");
  });

  it("filters all four quarters, retains an in-range selection and restores the complete chart", () => {
    for (const [period, count] of [33, 30, 29, 32].entries()) {
      render().button(`Q${period + 1}`).onClick!();
      const view = render();
      expect(view.slider.value).toBe(0);
      expect(view.slider.max).toBe(count - 1);
      expect(view.observations).toBe(1);
      expect(view.button(`Q${period + 1}`)["aria-pressed"]).toBe(true);
    }
    render().button("Next record").onClick!();
    const sameQuarter = render().slider["aria-valuetext"];
    render().button("Q4").onClick!();
    expect(render().slider["aria-valuetext"]).toBe(sameQuarter);
    render().button("Game").onClick!();
    expect(render().observations).toBe(1);
    expect(render().slider.max).toBe(123);
    expect(render().slider["aria-valuetext"]).toBe(sameQuarter);
  });

  it("makes all repeated decimal-clock observations separately inspectable through the slider", () => {
    render().button("Q1").onClick!();
    for (const [index, row] of facts.reportedScoreRows.entries()) {
      if (row.period !== 1 || row.clockAsPrinted !== ":31.7") continue;
      render().slider.onChange!({ currentTarget: { value: String(index) } });
      expect(render().slider["aria-valuetext"]).toContain(`Record ${index + 1} of 124, Q1, :31.7, DET 35, MEM ${row.awayScore}`);
    }
  });

  it("uses pointer taps and mouse moves while ignoring passive touch moves, with the same localized selection", () => {
    const event = { currentTarget: { getBoundingClientRect: () => ({ left: 10, top: 20, width: 720, height: 236 }) }, clientX: 10 + 49 / 4, clientY: 20 + 236, pointerType: "touch", buttons: 0 };
    render().svg.onPointerMove!(event);
    expect(render().slider.value).toBe(123);
    render().svg.onPointerDown!(event);
    expect(render().slider.value).toBe(0);
    expect(render().observations).toBe(1);
    expect(render().circles).toBe(1);
    expect(render().selectedSquares).toBe(1);
    expect(render(true).slider["aria-valuetext"]).toContain("第 1 / 124 条记录, 第 1 节, 11:11, DET 0, MEM 2");
    render().slider.onChange!({ currentTarget: { value: "123" } });
    render().svg.onPointerMove!({ ...event, pointerType: "mouse" });
    expect(render().slider.value).toBe(0);
  });
});
