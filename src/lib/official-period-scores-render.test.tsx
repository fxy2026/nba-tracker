import { isValidElement, type ComponentProps, type ReactNode } from "react";
import QuarterBars from "@/components/QuarterBars";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import OfficialPeriodScores from "@/app/game/[id]/_components/OfficialPeriodScores";
import { LocaleProvider } from "@/components/LocaleProvider";
import schedule from "@/data/schedule-2025-26.json";
import { getOfficialPeriodScores } from "./official-period-score-archive";

// Literal reviewed expectations are intentionally independent of the runtime
// archive and evidence imports: drift in order, side, or any score must fail.
const fixtures = [
  { id: "0022500340", date: "20251205", away: "DEN", home: "ATL", awayPoints: [23, 31, 40, 40], homePoints: [41, 32, 30, 30] },
  { id: "0022500961", date: "20260313", away: "MEM", home: "DET", awayPoints: [35, 26, 23, 26], homePoints: [37, 31, 30, 28] },
  { id: "0042500101", date: "20260419", away: "ORL", home: "DET", awayPoints: [35, 20, 26, 31], homePoints: [27, 24, 23, 27] },
  { id: "0042500102", date: "20260422", away: "ORL", home: "DET", awayPoints: [21, 25, 16, 21], homePoints: [25, 21, 38, 14] },
  { id: "0042500103", date: "20260425", away: "DET", home: "ORL", awayPoints: [26, 28, 25, 26], homePoints: [26, 35, 26, 26] },
  { id: "0042500104", date: "20260427", away: "DET", home: "ORL", awayPoints: [27, 25, 17, 19], homePoints: [26, 28, 21, 19] },
  { id: "0042500105", date: "20260429", away: "ORL", home: "DET", awayPoints: [26, 34, 19, 30], homePoints: [38, 28, 23, 27] },
  { id: "0042500106", date: "20260501", away: "DET", home: "ORL", awayPoints: [26, 12, 24, 31], homePoints: [25, 35, 11, 8] },
  { id: "0042500107", date: "20260503", away: "ORL", home: "DET", awayPoints: [22, 27, 15, 30], homePoints: [20, 40, 23, 33] },
  { id: "0042500111", date: "20260419", away: "PHI", home: "BOS", awayPoints: [18, 28, 25, 20], homePoints: [33, 31, 31, 28] },
  { id: "0042500112", date: "20260421", away: "PHI", home: "BOS", awayPoints: [25, 37, 22, 27], homePoints: [28, 26, 23, 20] },
  { id: "0042500113", date: "20260424", away: "BOS", home: "PHI", awayPoints: [29, 25, 25, 29], homePoints: [24, 23, 27, 26] },
  { id: "0042500114", date: "20260426", away: "BOS", home: "PHI", awayPoints: [34, 22, 39, 33], homePoints: [18, 20, 36, 22] },
  { id: "0042500115", date: "20260428", away: "PHI", home: "BOS", awayPoints: [21, 29, 35, 28], homePoints: [23, 34, 29, 11] },
  { id: "0042500116", date: "20260430", away: "BOS", home: "PHI", awayPoints: [23, 26, 14, 30], homePoints: [20, 38, 24, 24] },
  { id: "0042500117", date: "20260502", away: "PHI", home: "BOS", awayPoints: [32, 23, 33, 21], homePoints: [19, 31, 25, 25] },
  { id: "0042500121", date: "20260418", away: "ATL", home: "NYK", awayPoints: [24, 31, 19, 28], homePoints: [30, 27, 26, 30] },
  { id: "0042500122", date: "20260420", away: "ATL", home: "NYK", awayPoints: [23, 31, 25, 28], homePoints: [32, 29, 30, 15] },
  { id: "0042500123", date: "20260423", away: "NYK", home: "ATL", awayPoints: [21, 29, 30, 28], homePoints: [33, 25, 30, 21] },
  { id: "0042500124", date: "20260425", away: "NYK", home: "ATL", awayPoints: [27, 31, 28, 28], homePoints: [20, 24, 21, 33] },
  { id: "0042500125", date: "20260428", away: "ATL", home: "NYK", awayPoints: [22, 26, 24, 25], homePoints: [35, 29, 26, 36] },
  { id: "0042500126", date: "20260430", away: "NYK", home: "ATL", awayPoints: [40, 43, 34, 23], homePoints: [15, 21, 28, 25] },
  { id: "0042500131", date: "20260418", away: "TOR", home: "CLE", awayPoints: [31, 23, 22, 37], homePoints: [35, 26, 36, 29] },
  { id: "0042500132", date: "20260420", away: "TOR", home: "CLE", awayPoints: [19, 29, 29, 28], homePoints: [26, 28, 30, 31] },
  { id: "0042500133", date: "20260423", away: "CLE", home: "TOR", awayPoints: [25, 29, 27, 23], homePoints: [31, 23, 29, 43] },
  { id: "0042500134", date: "20260426", away: "CLE", home: "TOR", awayPoints: [17, 19, 22, 31], homePoints: [14, 24, 22, 33] },
  { id: "0042500135", date: "20260429", away: "TOR", home: "CLE", awayPoints: [34, 40, 29, 17], homePoints: [38, 29, 33, 25] },
  { id: "0042500136", date: "20260501", away: "CLE", home: "TOR", awayPoints: [32, 19, 30, 23, 6], homePoints: [32, 29, 31, 12, 8] },
  { id: "0042500137", date: "20260503", away: "TOR", home: "CLE", awayPoints: [26, 23, 19, 34], homePoints: [24, 25, 38, 27] },
  { id: "0042500141", date: "20260419", away: "PHX", home: "OKC", awayPoints: [20, 24, 22, 18], homePoints: [35, 30, 32, 22] },
  { id: "0042500142", date: "20260422", away: "PHX", home: "OKC", awayPoints: [29, 28, 20, 30], homePoints: [30, 35, 35, 20] },
  { id: "0042500143", date: "20260425", away: "OKC", home: "PHX", awayPoints: [33, 29, 25, 34], homePoints: [28, 25, 26, 30] },
  { id: "0042500144", date: "20260427", away: "OKC", home: "PHX", awayPoints: [37, 38, 31, 25], homePoints: [33, 34, 31, 24] },
  { id: "0042500151", date: "20260419", away: "POR", home: "SAS", awayPoints: [21, 28, 23, 26], homePoints: [30, 29, 28, 24] },
  { id: "0042500152", date: "20260421", away: "POR", home: "SAS", awayPoints: [27, 30, 22, 27], homePoints: [28, 29, 23, 23] },
  { id: "0042500153", date: "20260424", away: "SAS", home: "POR", awayPoints: [27, 32, 29, 32], homePoints: [29, 36, 22, 21] },
  { id: "0042500154", date: "20260426", away: "SAS", home: "POR", awayPoints: [23, 18, 33, 40], homePoints: [25, 33, 16, 19] },
  { id: "0042500155", date: "20260428", away: "POR", home: "SAS", awayPoints: [24, 21, 20, 30], homePoints: [36, 29, 21, 28] },
  { id: "0042500161", date: "20260418", away: "MIN", home: "DEN", awayPoints: [33, 29, 17, 26], homePoints: [23, 39, 29, 25] },
  { id: "0042500162", date: "20260420", away: "MIN", home: "DEN", awayPoints: [25, 39, 26, 29], homePoints: [39, 25, 29, 21] },
  { id: "0042500163", date: "20260423", away: "DEN", home: "MIN", awayPoints: [11, 28, 29, 28], homePoints: [25, 36, 27, 25] },
  { id: "0042500164", date: "20260425", away: "DEN", home: "MIN", awayPoints: [23, 31, 24, 18], homePoints: [22, 28, 32, 30] },
  { id: "0042500165", date: "20260427", away: "MIN", home: "DEN", awayPoints: [29, 22, 24, 38], homePoints: [34, 26, 37, 28] },
  { id: "0042500166", date: "20260430", away: "DEN", home: "MIN", awayPoints: [30, 20, 24, 24], homePoints: [29, 28, 25, 28] },
  { id: "0042500171", date: "20260418", away: "HOU", home: "LAL", awayPoints: [29, 19, 18, 32], homePoints: [33, 17, 25, 32] },
  { id: "0042500172", date: "20260421", away: "HOU", home: "LAL", awayPoints: [26, 25, 17, 26], homePoints: [33, 21, 21, 26] },
  { id: "0042500173", date: "20260424", away: "LAL", home: "HOU", awayPoints: [39, 24, 17, 21, 11], homePoints: [32, 20, 23, 26, 7] },
  { id: "0042500174", date: "20260426", away: "LAL", home: "HOU", awayPoints: [21, 26, 18, 31], homePoints: [26, 30, 34, 25] },
  { id: "0042500175", date: "20260429", away: "HOU", home: "LAL", awayPoints: [21, 30, 25, 23], homePoints: [28, 19, 20, 26] },
  { id: "0042500176", date: "20260501", away: "LAL", home: "HOU", awayPoints: [23, 26, 22, 27], homePoints: [18, 13, 24, 23] },
  { id: "0042500201", date: "20260505", away: "CLE", home: "DET", awayPoints: [21, 25, 30, 25], homePoints: [37, 22, 24, 28] },
  { id: "0042500202", date: "20260507", away: "CLE", home: "DET", awayPoints: [18, 25, 32, 22], homePoints: [25, 29, 25, 28] },
  { id: "0042500203", date: "20260509", away: "DET", home: "CLE", awayPoints: [30, 18, 33, 28], homePoints: [32, 32, 19, 33] },
  { id: "0042500204", date: "20260511", away: "DET", home: "CLE", awayPoints: [24, 32, 21, 26], homePoints: [21, 31, 38, 22] },
  { id: "0042500205", date: "20260513", away: "CLE", home: "DET", awayPoints: [27, 25, 32, 19, 14], homePoints: [29, 31, 20, 23, 10] },
  { id: "0042500206", date: "20260515", away: "DET", home: "CLE", awayPoints: [27, 27, 30, 31], homePoints: [25, 26, 19, 24] },
  { id: "0042500207", date: "20260517", away: "CLE", home: "DET", awayPoints: [31, 33, 35, 26], homePoints: [22, 25, 26, 21] },
  { id: "0042500211", date: "20260504", away: "PHI", home: "NYK", awayPoints: [25, 26, 27, 20], homePoints: [33, 41, 35, 28] },
  { id: "0042500212", date: "20260506", away: "PHI", home: "NYK", awayPoints: [33, 29, 28, 12], homePoints: [31, 30, 28, 19] },
  { id: "0042500213", date: "20260508", away: "NYK", home: "PHI", awayPoints: [27, 33, 25, 23], homePoints: [31, 21, 24, 18] },
  { id: "0042500214", date: "20260510", away: "NYK", home: "PHI", awayPoints: [43, 38, 41, 22], homePoints: [24, 33, 26, 31] },
  { id: "0042500221", date: "20260505", away: "LAL", home: "OKC", awayPoints: [26, 27, 19, 18], homePoints: [31, 30, 23, 24] },
  { id: "0042500222", date: "20260507", away: "LAL", home: "OKC", awayPoints: [23, 35, 22, 27], homePoints: [27, 30, 36, 32] },
  { id: "0042500223", date: "20260509", away: "OKC", home: "LAL", awayPoints: [31, 26, 33, 41], homePoints: [25, 34, 20, 29] },
  { id: "0042500224", date: "20260511", away: "OKC", home: "LAL", awayPoints: [21, 28, 31, 35], homePoints: [26, 19, 39, 26] },
  { id: "0042500231", date: "20260504", away: "MIN", home: "SAS", awayPoints: [24, 21, 24, 35], homePoints: [23, 22, 27, 30] },
  { id: "0042500232", date: "20260506", away: "MIN", home: "SAS", awayPoints: [17, 18, 28, 32], homePoints: [24, 35, 39, 35] },
  { id: "0042500233", date: "20260508", away: "SAS", home: "MIN", awayPoints: [23, 28, 35, 29], homePoints: [22, 29, 28, 29] },
  { id: "0042500234", date: "20260510", away: "SAS", home: "MIN", awayPoints: [30, 26, 28, 25], homePoints: [34, 26, 20, 34] },
  { id: "0042500235", date: "20260512", away: "MIN", home: "SAS", awayPoints: [30, 17, 26, 24], homePoints: [34, 25, 32, 35] },
  { id: "0042500236", date: "20260515", away: "SAS", home: "MIN", awayPoints: [36, 38, 36, 29], homePoints: [27, 34, 23, 25] },
  { id: "0042500301", date: "20260519", away: "CLE", home: "NYK", awayPoints: [16, 32, 35, 18, 3], homePoints: [23, 23, 23, 32, 14] },
  { id: "0042500302", date: "20260521", away: "CLE", home: "NYK", awayPoints: [27, 22, 21, 23], homePoints: [24, 29, 32, 24] },
  { id: "0042500303", date: "20260523", away: "NYK", home: "CLE", awayPoints: [37, 23, 31, 30], homePoints: [27, 27, 28, 26] },
  { id: "0042500304", date: "20260525", away: "NYK", home: "CLE", awayPoints: [38, 30, 30, 32], homePoints: [26, 23, 22, 22] },
  { id: "0042500311", date: "20260518", away: "SAS", home: "OKC", awayPoints: [27, 24, 29, 21, 7, 14], homePoints: [27, 17, 29, 28, 7, 7] },
  { id: "0042500312", date: "20260520", away: "SAS", home: "OKC", awayPoints: [31, 20, 37, 25], homePoints: [31, 31, 34, 26] },
  { id: "0042500313", date: "20260522", away: "OKC", home: "SAS", awayPoints: [26, 32, 37, 28], homePoints: [31, 20, 33, 24] },
  { id: "0042500314", date: "20260524", away: "OKC", home: "SAS", awayPoints: [19, 19, 22, 22], homePoints: [28, 22, 28, 25] },
  { id: "0042500315", date: "20260526", away: "SAS", home: "OKC", awayPoints: [27, 31, 33, 23], homePoints: [29, 40, 32, 26] },
  { id: "0042500316", date: "20260528", away: "OKC", home: "SAS", awayPoints: [22, 31, 13, 25], homePoints: [35, 25, 32, 26] },
  { id: "0042500317", date: "20260530", away: "SAS", home: "OKC", awayPoints: [32, 24, 24, 31], homePoints: [25, 28, 24, 26] },
  { id: "0042500401", date: "20260603", away: "NYK", home: "SAS", awayPoints: [19, 29, 28, 29], homePoints: [27, 28, 21, 19] },
  { id: "0042500402", date: "20260605", away: "NYK", home: "SAS", awayPoints: [25, 31, 28, 21], homePoints: [34, 18, 23, 29] },
  { id: "0042500403", date: "20260608", away: "SAS", home: "NYK", awayPoints: [33, 24, 35, 23], homePoints: [22, 42, 27, 20] },
  { id: "0042500404", date: "20260610", away: "SAS", home: "NYK", awayPoints: [41, 35, 14, 16], homePoints: [22, 27, 26, 32] },
  { id: "0042500405", date: "20260613", away: "NYK", home: "SAS", awayPoints: [13, 24, 28, 29], homePoints: [23, 19, 30, 18] },
];
const periodMetadata = [
  { period: 1, periodType: "REGULAR" },
  { period: 2, periodType: "REGULAR" },
  { period: 3, periodType: "REGULAR" },
  { period: 4, periodType: "REGULAR" },
  { period: 5, periodType: "OVERTIME" },
  { period: 6, periodType: "OVERTIME" },
];
const displayLabels = ["Q1", "Q2", "Q3", "Q4", "OT1", "OT2"];
function quarterProps(node: ReactNode): ComponentProps<typeof QuarterBars>[] {
  if (Array.isArray(node)) return node.flatMap(quarterProps);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  if (node.type === QuarterBars) return [node.props as ComponentProps<typeof QuarterBars>];
  return quarterProps(node.props.children);
}

it("covers the complete 87-game approval with four single-OT and one double-OT report", () => {
  expect(fixtures).toHaveLength(87);
  expect(new Set(fixtures.map(fixture => fixture.id)).size).toBe(87);
  expect(fixtures.filter(fixture => fixture.homePoints.length === 5).map(fixture => fixture.id))
    .toEqual(["0042500136", "0042500173", "0042500205", "0042500301"]);
  expect(fixtures.filter(fixture => fixture.homePoints.length === 6).map(fixture => fixture.id))
    .toEqual(["0042500311"]);
});

describe.each(["en", "zh"] as const)("all approved official period-score renders in %s", (locale) => {
  it.each(fixtures)("renders $id with the actual QuarterBars and localized attribution", (fixture) => {
    const game = schedule.dates.flatMap((date) => date.games).find((game) => game.gameId === fixture.id)!;
    const scores = getOfficialPeriodScores(game);
    expect(scores).not.toBeNull();
    if (!scores) throw new Error(`Missing verified quarter scores for ${fixture.id}`);

    // Invoke the real wrapper, then assert the actual chart's complete input
    // contract. Rendering alone would miss a wrongly tagged overtime period.
    const chart = quarterProps(OfficialPeriodScores({ scores, isZh: locale === "zh" }));
    expect(chart).toHaveLength(1);
    expect(chart[0]).toEqual({
      awayTricode: fixture.away,
      homeTricode: fixture.home,
      awayPeriods: fixture.awayPoints.map((score, index) => ({ ...periodMetadata[index], score })),
      homePeriods: fixture.homePoints.map((score, index) => ({ ...periodMetadata[index], score })),
    });
    expect(scores.source.periodLabelsAsPrinted).toEqual(["1", "2", "3", "4", "OT1", "OT2"].slice(0, fixture.homePoints.length));

    const html = renderToStaticMarkup(
      <LocaleProvider initialLocale={locale}>
        <OfficialPeriodScores scores={scores} isZh={locale === "zh"} />
      </LocaleProvider>,
    );
    const summary = fixture.homePoints.map((points, index) =>
      `${displayLabels[index]}: ${fixture.away} ${fixture.awayPoints[index]} ${fixture.home} ${points}`,
    ).join("; ");
    expect(html).toContain(`aria-label="By quarter — ${summary}"`);
    expect(html.match(/role="group"/g)).toHaveLength(1);
    expect(html).toContain(locale === "zh" ? "每节得分</h3>" : "Points by Quarter</h3>");

    // Check visible scores as well as the accessible summary. The chart prints
    // away then home for every regulation and overtime period.
    const visiblePoints = [...html.matchAll(/<span\b[^>]*>(\d+)<\/span>/g)].map((match) => Number(match[1]));
    expect(visiblePoints).toEqual(fixture.awayPoints.flatMap((points, index) => [points, fixture.homePoints[index]]));
    for (const label of displayLabels.slice(0, fixture.homePoints.length)) expect(html).toContain(`>${label}</span>`);
    for (const label of displayLabels.slice(fixture.homePoints.length)) expect(html).not.toContain(`>${label}</span>`);
    expect(html).not.toContain(">Q5</span>");
    expect(html).not.toContain(">Q6</span>");
    expect(html).not.toContain(">OT3</span>");
    expect(html).toContain(`>${fixture.away}</span>`);
    expect(html).toContain(`>${fixture.home}</span>`);

    const attribution = locale === "zh"
      ? "每节得分：NBA 官方赛后报告 · 第 1 页 · 核验于 2026-10-03（外部 PDF）"
      : "Quarter scores: NBA official final report · page 1 · verified 2026-10-03 (external PDF)";
    const reportUrl = `https://statsdmz.nba.com/pdfs/${fixture.date}/${fixture.date}_${fixture.away}${fixture.home}${fixture.id === "0022500961" ? "_book" : ""}.pdf`;
    const links = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
    expect(links).toHaveLength(1);
    expect(links[0][1]).toContain(`href="${reportUrl}"`);
    expect(links[0][1]).toContain('target="_blank"');
    expect(links[0][1]).toContain('rel="noopener noreferrer"');
    expect(links[0][2]).toContain(attribution);
    expect(html).not.toContain("BigBallsData");
    expect(html).not.toContain("2026-10-03T");
    expect(html).not.toContain("originalPdf");
    expect(html).not.toContain("verifiedAt");
    expect(html).not.toMatch(/play.by.play|逐回合|event clock|estimated/i);
    expect(html).not.toMatch(/<(?:iframe|script|table)\b/);
  });
});
