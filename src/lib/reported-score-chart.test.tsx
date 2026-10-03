import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import facts from "@/data/reported-score-sequences/0022500961.json";
import schedule from "@/data/schedule-2025-26.json";
import type { ScheduleGame } from "./api";
import { getReportedScoreSequence } from "./reported-score-sequence-archive";
import {
  moveReportedScoreSelection, nearestReportedScorePoint, reportedScorePoints,
  scoreChartDomain, scoreChartPointsForPeriod, type ReportedScoreChartProps,
} from "./reported-score-chart";
import ReportedScoreChart from "@/app/game/[id]/_components/ReportedScoreChart";
import ReportedScoreSequence from "@/app/game/[id]/_components/ReportedScoreSequence";

const rows = facts.reportedScoreRows;
const points = reportedScorePoints(rows);
const props: ReportedScoreChartProps = { rows, homeTricode: "DET", awayTricode: "MEM", sourceUrl: "https://statsdmz.nba.com/pdfs/20260313/20260313_MEMDET_book.pdf", isZh: false };

function clientProps(node: ReactNode): ReportedScoreChartProps | undefined {
  if (Array.isArray(node)) return node.map(clientProps).find(Boolean);
  if (!isValidElement<{ children?: ReactNode }>(node)) return;
  if (node.type === ReportedScoreChart) return node.props as ReportedScoreChartProps;
  return clientProps(node.props.children);
}

describe("printed score chart transform", () => {
  it("preserves all 124 source rows, clocks, page references and source order without adding endpoints", () => {
    expect(points).toHaveLength(124);
    expect(points.map(({ sourceIndex, elapsedSeconds, ...row }, index) => {
      expect(sourceIndex).toBe(index);
      expect(Number.isFinite(elapsedSeconds)).toBe(true);
      return row;
    })).toEqual(rows);
    expect(points[0].elapsedSeconds).toBe(49);
    expect(points.at(-1)?.elapsedSeconds).toBeCloseTo(2846.9);
    expect(points.some(point => point.elapsedSeconds === 0 || point.elapsedSeconds === 2880)).toBe(false);
  });

  it("retains repeated decimal clocks as distinct observations at the same exact x coordinate", () => {
    const repeated = points.filter(point => point.period === 1 && point.clockAsPrinted === ":31.7");
    expect(repeated.map(point => point.awayScore)).toEqual([33, 34, 35]);
    expect(new Set(repeated.map(point => point.sourceIndex)).size).toBe(3);
    expect(new Set(repeated.map(point => point.elapsedSeconds)).size).toBe(1);
    expect(repeated[0].elapsedSeconds).toBeCloseTo(688.3);
  });

  it("keeps three genuine opening possession rows without fabricating an opening score", () => {
    expect(points.filter(point => point.clockAsPrinted === "12:00").map(point => point.elapsedSeconds)).toEqual([720, 1440, 2160]);
    expect(points.filter(point => point.clockAsPrinted === "00:00")).toHaveLength(0);
    expect(rows[0]).toEqual(facts.reportedScoreRows[0]);
  });

  it.each(["bad", "12:01", "99:00", "00:60", "1:02", ":31.70"])("rejects unsupported or unverified clock %s", clock => {
    expect(() => reportedScorePoints([{ ...rows[0], clockAsPrinted: clock }])).toThrow();
  });
  it.each([0, 1.5, 5])("rejects a non-regulation period %s", period => {
    expect(() => reportedScorePoints([{ ...rows[0], period }])).toThrow();
  });

  it("uses a fixed 48-minute regulation scale and four exact quarter domains", () => {
    expect(scoreChartDomain(0)).toEqual([0, 2880]);
    for (const period of [1, 2, 3, 4] as const) {
      expect(scoreChartDomain(period)).toEqual([(period - 1) * 720, period * 720]);
      expect(scoreChartPointsForPeriod(points, period)).toEqual(points.filter(point => point.period === period));
    }
    expect([1, 2, 3, 4].map(period => points.filter(point => point.period === period).length)).toEqual([33, 30, 29, 32]);
  });
});

describe("source-row inspection", () => {
  it("lets next/previous controls reach every row including every repeated clock, then clamps at bounds", () => {
    let selection = 0;
    for (let index = 0; index < points.length; index++) {
      expect(selection).toBe(index);
      selection = moveReportedScoreSelection(points, selection, 1)!;
    }
    expect(selection).toBe(123);
    for (let index = 123; index >= 0; index--) {
      expect(selection).toBe(index);
      selection = moveReportedScoreSelection(points, selection, -1)!;
    }
    expect(selection).toBe(0);
  });

  it("keeps filtered-quarter navigation bounded and resolves overlapping clocks by score position", () => {
    const quarter = scoreChartPointsForPeriod(points, 1);
    expect(moveReportedScoreSelection(quarter, 0, -1)).toBe(0);
    expect(moveReportedScoreSelection(quarter, 32, 1)).toBe(32);
    const repeated = quarter.filter(point => point.clockAsPrinted === ":31.7");
    for (const point of repeated.slice(0, 2)) {
      expect(nearestReportedScorePoint(repeated, point.elapsedSeconds, 140 - point.awayScore, 720, 140, [0, 720], 140)).toBe(point.sourceIndex);
    }
    expect(nearestReportedScorePoint([], 0, 0, 720, 140, [0, 720], 140)).toBeNull();
    expect(moveReportedScoreSelection([], 0, 1)).toBeNull();
    expect(nearestReportedScorePoint(points, NaN, 0, 720, 140, [0, 2880], 140)).toBeNull();
    expect(nearestReportedScorePoint(points, 0, 0, 0, 140, [0, 2880], 140)).toBeNull();
  });
});

describe("score chart rendering and archive boundary", () => {
  it.each([false, true])("renders every factual observation with accessible controls and a concise source label (zh=%s)", isZh => {
    const html = renderToStaticMarkup(createElement(ReportedScoreChart, { ...props, isZh }));
    expect([...html.matchAll(/data-score-observation="(\d+)"/g)].map(match => Number(match[1]))).toEqual(points.map(point => point.sourceIndex));
    expect(html.match(/data-score-connector=/g)).toHaveLength(2);
    expect(html).toContain('stroke-dasharray="4 4"');
    expect(html).toContain('type="range"');
    expect(html).toContain('min="0" max="123"');
    expect(html).toContain('value="123"');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-atomic="true"');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(4);
    expect(html).toContain(isZh ? "上一条记录" : "Previous record");
    expect(html).toContain(isZh ? "下一条记录" : "Next record");
    expect(html).toContain(isZh ? "第 124 / 124 条记录" : "Record 124 of 124");
    expect(html).toContain(":33.1");
    expect(html).toContain(`${props.sourceUrl}#page=19`);
    expect(html).not.toMatch(/NaN|Infinity|00:00|lead changes|scoring runs|领先变化|连续得分/);
  });

  it("passes only the explicit reviewed chart facts through the server/client boundary", () => {
    const game = schedule.dates.flatMap(date => date.games).find(game => game.gameId === "0022500961")! as ScheduleGame;
    const sequence = getReportedScoreSequence(game)!;
    const chart = clientProps(ReportedScoreSequence({ sequence, isZh: false }))!;
    expect(Object.keys(chart).sort()).toEqual(["awayTricode", "homeTricode", "isZh", "rows", "sourceUrl"]);
    expect(chart.rows).toEqual(rows);
    expect(chart.rows).not.toBe(sequence.reportedScoreRows);
    expect(chart.rows.every(row => Object.keys(row).sort().join() === "awayScore,clockAsPrinted,homeScore,period,sourcePage")).toBe(true);
    expect(JSON.stringify(chart)).not.toMatch(/sha256|pageCount|teamId|gameId|reportedPeriodEnds|description|actionNumber/);
  });
});
