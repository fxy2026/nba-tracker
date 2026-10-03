import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import schedule from "@/data/schedule-2025-26.json";
import type { ScheduleGame } from "./api";
import { getReportedScoreSequence } from "./reported-score-sequence-archive";
import ReportedScoreSequence from "@/app/game/[id]/_components/ReportedScoreSequence";

const game = schedule.dates.flatMap((date) => date.games)
  .find((candidate) => candidate.gameId === "0022500961")! as ScheduleGame;
const sequence = getReportedScoreSequence(game)!;
const sourceUrl = "https://statsdmz.nba.com/pdfs/20260313/20260313_MEMDET_book.pdf";

function render(isZh = false) {
  return renderToStaticMarkup(createElement(ReportedScoreSequence, { sequence, isZh }));
}

function textContent(markup: string) {
  return markup.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function printedRows(html: string) {
  return [...html.matchAll(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/g)].flatMap((body, index) =>
    [...body[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((row) => {
      const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => cell[1]);
      expect(cells).toHaveLength(4);
      const source = cells[3].match(/href="([^"]+)"/);
      expect(source).not.toBeNull();
      return {
        period: index + 1,
        clockAsPrinted: textContent(cells[0]),
        homeScore: Number(textContent(cells[1])),
        awayScore: Number(textContent(cells[2])),
        sourceUrl: source![1],
      };
    }),
  );
}

describe("official gamebook reported score sequence rendering", () => {
  it.each([false, true])("uses the bilingual heading and clear limited-scope copy (zh=%s)", (isZh) => {
    const html = render(isZh);
    expect(html).toContain(isZh
      ? "官方赛后报告记载的比分序列"
      : "Reported score sequence from the official gamebook");
    expect(textContent(html)).toContain(isZh
      ? "124 行原文明确印有时间与比分的记录，其中包括 3 行球权记录"
      : "124 explicitly printed timed score rows, including 3 possession rows");
    expect(textContent(html)).toContain(isZh
      ? "不是完整逐回合或实时事件数据"
      : "not a complete play-by-play or live event feed");
    expect(textContent(html)).toContain(isZh
      ? "本节不提供球员动作、投篮、回放、领先变化或连续得分分析"
      : "does not provide player actions, shots, replay, lead-change or scoring-run analysis");
    expect(html).toContain("2026-03-13");
    expect(html).toContain(`href="${sourceUrl}#page=9"`);
  });

  it.each([false, true])("renders four native, initially collapsed quarter disclosures (zh=%s)", (isZh) => {
    const html = render(isZh);
    const details = [...html.matchAll(/<details\b[^>]*>/g)].map((match) => match[0]);
    expect(details).toHaveLength(4);
    expect(details.every((tag) => !/\sopen(?:\s|=|>)/.test(tag))).toBe(true);
    const summaries = [...html.matchAll(/<summary\b[^>]*>([\s\S]*?)<\/summary>/g)]
      .map((match) => textContent(match[1]));
    expect(summaries).toEqual([33, 30, 29, 32].map((count, index) => isZh
      ? `第 ${index + 1} 节 · ${count} 行带时间的比分记录`
      : `Q${index + 1} · ${count} printed timed score rows`));
    expect(html.match(/<table\b/g)).toHaveLength(4);
    expect(html).not.toMatch(/<(?:button|script|video|canvas)\b/);
  });

  it.each([false, true])("preserves every timed row, team column, printed clock, and source page in original order (zh=%s)", (isZh) => {
    const html = render(isZh);
    const rows = printedRows(html);
    expect(rows).toHaveLength(124);
    expect(rows).toEqual(sequence.reportedScoreRows.map(({ sourcePage, ...row }) => ({
      ...row,
      sourceUrl: `${sourceUrl}#page=${sourcePage}`,
    })));
    expect(rows[0]).toMatchObject({ period: 1, clockAsPrinted: "11:11", homeScore: 0, awayScore: 2 });
    expect(rows.at(-1)).toMatchObject({ period: 4, clockAsPrinted: ":33.1", homeScore: 126, awayScore: 110 });
    expect(rows.every((row) => row.clockAsPrinted !== "00:00")).toBe(true);
    const headers = [...html.matchAll(/<thead\b[^>]*>([\s\S]*?)<\/thead>/g)];
    expect(headers).toHaveLength(4);
    for (const header of headers) {
      const cells = [...header[1].matchAll(/<th\b([^>]*)>([\s\S]*?)<\/th>/g)];
      expect(cells.every((cell) => cell[1].includes('scope="col"'))).toBe(true);
      expect(cells.map((cell) => textContent(cell[2]))).toEqual(isZh
        ? ["原文时间", "DET (主)", "MEM (客)", "PDF 来源"]
        : ["Printed clock", "DET (home)", "MEM (away)", "PDF source"]);
    }
  });

  it("keeps duplicate decimal clocks as distinct source rows without sorting or rounding", () => {
    const rows = printedRows(render());
    expect(rows.filter((row) => row.period === 1 && row.clockAsPrinted === ":31.7"))
      .toEqual([33, 34, 35].map((awayScore) => ({
        period: 1,
        clockAsPrinted: ":31.7",
        homeScore: 35,
        awayScore,
        sourceUrl: `${sourceUrl}#page=10`,
      })));
    expect(rows.filter((row) => row.clockAsPrinted === "12:00")).toEqual([
      { period: 2, clockAsPrinted: "12:00", homeScore: 37, awayScore: 35, sourceUrl: `${sourceUrl}#page=11` },
      { period: 3, clockAsPrinted: "12:00", homeScore: 68, awayScore: 61, sourceUrl: `${sourceUrl}#page=14` },
      { period: 4, clockAsPrinted: "12:00", homeScore: 98, awayScore: 84, sourceUrl: `${sourceUrl}#page=17` },
    ]);
  });

  it.each([false, true])("keeps all period-end scores separate from timed rows and never invents a clock (zh=%s)", (isZh) => {
    const html = render(isZh);
    const summaries = [...html.matchAll(/<\/table>\s*(<p\b[^>]*>[\s\S]*?<\/p>)/g)]
      .map((match) => match[1]);
    expect(summaries).toHaveLength(4);
    expect(sequence.reportedPeriodEnds).toEqual([
      { period: 1, homeScore: 37, awayScore: 35, sourcePage: 10 },
      { period: 2, homeScore: 68, awayScore: 61, sourcePage: 12 },
      { period: 3, homeScore: 98, awayScore: 84, sourcePage: 15 },
      { period: 4, homeScore: 126, awayScore: 110, sourcePage: 19 },
    ]);
    summaries.forEach((summary, index) => {
      const endpoint = sequence.reportedPeriodEnds[index];
      expect(textContent(summary)).toContain(isZh
        ? "节末摘要（原文未印时间）"
        : "Period-end summary (no printed clock)");
      expect(textContent(summary)).toContain(`DET ${endpoint.homeScore}, MEM ${endpoint.awayScore}`);
      expect(summary).toContain(`href="${sourceUrl}#page=${endpoint.sourcePage}"`);
      expect(textContent(summary)).not.toMatch(/(?:\d{1,2})?:\d{2}(?:\.\d+)?/);
    });
    for (const body of html.matchAll(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/g)) {
      expect(body[1]).not.toContain(isZh ? "节末摘要" : "Period-end summary");
    }
  });

  it.each([false, true])("identifies every source as an external official PDF without adding player or event links (zh=%s)", (isZh) => {
    const html = render(isZh);
    const anchors = [...html.matchAll(/<a\b[^>]*>/g)].map((match) => match[0]);
    expect(anchors).toHaveLength(129); // 124 timed rows, 4 endpoints, 1 source overview.
    for (const anchor of anchors) {
      expect(anchor).toContain(`href="${sourceUrl}#page=`);
      expect(anchor).toContain('target="_blank"');
      expect(anchor).toContain('rel="noopener noreferrer"');
      expect(anchor).toContain(isZh ? "NBA 官方赛后报告 PDF 第" : "NBA official gamebook PDF page");
      expect(anchor).toContain(isZh ? "外部链接" : "external link");
    }
    expect(html).not.toMatch(/href="[^\"]*(?:\/player\/|\/replay\/)/);
    expect(html).not.toContain("NaN");
  });
});
