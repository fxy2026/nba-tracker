import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import OfficialPeriodScores from "@/app/game/[id]/_components/OfficialPeriodScores";
import { LocaleProvider } from "@/components/LocaleProvider";
import schedule from "@/data/schedule-2025-26.json";
import { getOfficialPeriodScores } from "./official-period-score-archive";

// Independent expectations make reordered periods or swapped sides visible.
const finals = [
  { id: "0042500401", date: "20260603", away: "NYK", home: "SAS", awayPoints: [19, 29, 28, 29], homePoints: [27, 28, 21, 19] },
  { id: "0042500402", date: "20260605", away: "NYK", home: "SAS", awayPoints: [25, 31, 28, 21], homePoints: [34, 18, 23, 29] },
  { id: "0042500403", date: "20260608", away: "SAS", home: "NYK", awayPoints: [33, 24, 35, 23], homePoints: [22, 42, 27, 20] },
  { id: "0042500404", date: "20260610", away: "SAS", home: "NYK", awayPoints: [41, 35, 14, 16], homePoints: [22, 27, 26, 32] },
  { id: "0042500405", date: "20260613", away: "NYK", home: "SAS", awayPoints: [13, 24, 28, 29], homePoints: [23, 19, 30, 18] },
];

describe.each(["en", "zh"] as const)("official Finals quarter scores in %s", (locale) => {
  it.each(finals)("renders $id with the actual QuarterBars and localized attribution", (fixture) => {
    const game = schedule.dates.flatMap((date) => date.games).find((game) => game.gameId === fixture.id)!;
    const scores = getOfficialPeriodScores(game);
    expect(scores).not.toBeNull();
    if (!scores) throw new Error(`Missing verified quarter scores for ${fixture.id}`);

    const html = renderToStaticMarkup(
      <LocaleProvider initialLocale={locale}>
        <OfficialPeriodScores scores={scores} isZh={locale === "zh"} />
      </LocaleProvider>,
    );
    const summary = fixture.homePoints.map((points, index) =>
      `Q${index + 1}: ${fixture.away} ${fixture.awayPoints[index]} ${fixture.home} ${points}`,
    ).join("; ");
    expect(html).toContain(`aria-label="By quarter — ${summary}"`);
    expect(html.match(/role="group"/g)).toHaveLength(1);
    expect(html).toContain(locale === "zh" ? "每节得分</h3>" : "Points by Quarter</h3>");

    // Check visible scores as well as the accessible summary. The chart prints
    // away then home for each quarter, retaining all eight reported values.
    const visiblePoints = [...html.matchAll(/<span\b[^>]*>(\d+)<\/span>/g)].map((match) => Number(match[1]));
    expect(visiblePoints).toEqual(fixture.awayPoints.flatMap((points, index) => [points, fixture.homePoints[index]]));
    for (const quarter of [1, 2, 3, 4]) expect(html).toContain(`>Q${quarter}</span>`);
    expect(html).not.toContain(">OT1</span>");
    expect(html).toContain(`>${fixture.away}</span>`);
    expect(html).toContain(`>${fixture.home}</span>`);

    const attribution = locale === "zh"
      ? "每节得分：NBA 官方赛后报告 · 第 1 页 · 核验于 2026-10-03（外部 PDF）"
      : "Quarter scores: NBA official final report · page 1 · verified 2026-10-03 (external PDF)";
    const reportUrl = `https://statsdmz.nba.com/pdfs/${fixture.date}/${fixture.date}_${fixture.away}${fixture.home}.pdf`;
    const links = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
    expect(links).toHaveLength(1);
    expect(links[0][1]).toContain(`href="${reportUrl}"`);
    expect(links[0][1]).toContain('target="_blank"');
    expect(links[0][1]).toContain('rel="noopener noreferrer"');
    expect(links[0][2]).toContain(attribution);
    expect(html).not.toContain("BigBallsData");
    expect(html).not.toMatch(/<(?:iframe|script|table)\b/);
  });
});
