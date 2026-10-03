import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import GamePeriodProvider, { useLinkedGamePeriod } from "@/components/GamePeriodProvider";
import { LocaleProvider } from "@/components/LocaleProvider";
import ShotChartExplorer from "@/components/ShotChartExplorer";
import ReportedScoreSequence from "@/app/game/[id]/_components/ReportedScoreSequence";
import { getVerifiedShotChart } from "./verified-shot-chart-archive";
import { getReportedScoreSequence } from "./reported-score-sequence-archive";
import { getOfficialPeriodScores } from "./official-period-score-archive";
import schedule from "@/data/schedule-2025-26.json";

// Real React providers, hooks and descendants. No mocked context or hook state.
// Hydrated browser interaction is checked separately on the published site.
const game = schedule.dates.flatMap(date => date.games).find(game => game.gameId === "0022500961")!;
const shots = getVerifiedShotChart(game)!;
const sequence = getReportedScoreSequence(game)!;
const periods = getOfficialPeriodScores(game)!;
function ContextProbe() {
  const linked = useLinkedGamePeriod();
  return <output data-context-state={linked ? linked.period : "standalone"} />;
}

describe("real shared-period context and SSR composition", () => {
  it.each(["en", "zh"] as const)("renders both factual panels under one provider before hydration (%s)", locale => {
    const html = renderToStaticMarkup(<LocaleProvider initialLocale={locale}>
      <GamePeriodProvider>
        <ContextProbe />
        <ShotChartExplorer data={shots} />
        <ReportedScoreSequence sequence={sequence} periodScores={periods} isZh={locale === "zh"} />
      </GamePeriodProvider>
    </LocaleProvider>);
    expect(html).toContain('data-linked-game-period="all"');
    expect(html).toContain('data-context-state="0"');
    expect(html.match(/data-shot-id=/g)).toHaveLength(181);
    expect(html.match(/data-score-connector=/g)).toHaveLength(2);
    expect(html).toContain('min="0" max="123"');
    expect(html.match(/<table\b/g)).toHaveLength(5);
    expect(html.match(/<details\b/g)).toHaveLength(1);
    expect(html).not.toContain('<details open');
    expect(html.match(/Period-end summary \(no printed clock\)|节末摘要（原文未印时间）/g)).toHaveLength(4);
    expect(html).toContain(locale === "en" ? "Period linked with score trend" : "节次与比分走势联动");
    expect(html).toContain(locale === "en" ? "Scores remain cumulative" : "比分始终为累计得分");
    expect(html).not.toMatch(/>00:00<|<canvas|score-at-shot/);
    expect(html).toContain(":33.1");
    expect(html).toContain(shots.source.url);
    expect(html).toContain(`${sequence.source.url}#page=19`);
  });
  it("has an explicit standalone fallback and does not link unrelated courts", () => {
    expect(renderToStaticMarkup(<ContextProbe />)).toContain('data-context-state="standalone"');
    const other = schedule.dates.flatMap(date => date.games).find(game => game.gameId === "0042500173")!;
    const html = renderToStaticMarkup(<LocaleProvider initialLocale="en"><ShotChartExplorer data={getVerifiedShotChart(other)!} /></LocaleProvider>);
    expect(html).not.toMatch(/data-linked-game-period|data-court-linked-scope|data-score-linked-scope/);
    expect(html).toContain('role="combobox" aria-label="Period"');
    expect(getVerifiedShotChart(other)!.shots.filter(shot => shot.period === 5)).toHaveLength(15); // Choosing OT is covered by the real component-handler suite.
    expect(html.match(/data-shot-id=/g)).toHaveLength(177);
  });
});
