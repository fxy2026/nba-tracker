import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import PlayerGameCards from "./PlayerGameCards";
import { PLAYER_LOG_STATS, type PlayerLogRow } from "@/lib/player-game-log-data";
vi.mock("@/components/TeamLogo", () => ({ default: ({ tricode }: { tricode: string }) => <span>{tricode}</span> }));
const row: PlayerLogRow = { ...Object.fromEntries(PLAYER_LOG_STATS.map(key => [key, null])) as Record<typeof PLAYER_LOG_STATS[number], number | null>, id: "espn:401810664", nbaGameId: null, internalGameId: "0022500809", date: "2026-02-20", team: "LAL", opponent: "LAC", home: true, wl: "W", sourceUrl: "https://www.espn.com/nba/boxscore/_/gameId/401810664", pts: 30, reb: 0, ast: 7, stl: 0 };
it.each([false, true])("keeps compact core stats, readable result and separate game/disclosure actions (%s)", isZh => {
  const html = renderToStaticMarkup(<PlayerGameCards rows={[row]} isZh={isZh} />);
  const primary = html.slice(html.indexOf('<a '), html.indexOf('</a>') + 4);
  expect(primary).toContain('href="/game/0022500809"'); expect(primary).not.toContain('target="_blank"'); expect(primary).not.toContain('<summary');
  expect(primary).toContain('30 PTS, 0 REB, 7 AST'); expect(primary).toContain('dateTime="2026-02-20"');
  expect(primary).toContain(isZh ? "胜" : "WIN"); expect(html).toContain('aria-label="2026-02-20 LAC');
  expect(html.indexOf('<details')).toBeGreaterThan(html.indexOf('</a>')); expect(html).not.toContain('<details open');
  for (const label of ["MIN", "STL", "BLK", "FG", "3P", "FT", "OREB", "DREB", "TOV", "PF", "+/−"]) expect(html).toContain(label);
  expect(html).toContain('>—</dd>'); expect(html).toContain('>0</dd>'); expect(html).not.toContain("NaN");
});
it("expands unmatched games locally, including NBA-shaped IDs lacking route readiness", () => {
  const html = renderToStaticMarkup(<PlayerGameCards rows={[{ ...row, nbaGameId: "0022500809", internalGameId: null }]} isZh={false} />);
  expect(html).not.toContain('href="/game/');
  const summary = html.slice(html.indexOf('<summary'), html.indexOf('</summary>'));
  expect(summary).toContain("LAC"); expect(summary).toContain("PTS"); expect(summary).not.toContain('<a ');
  expect(html).toContain('A full game page is not available here yet'); expect(html).toContain('Original source');
});
it("hides the full desktop table only on phones and keeps complete averages accessible", () => {
  const css = readFileSync(new URL('./player-game-log.module.css', import.meta.url), 'utf8');
  expect(css).toContain('.mobileGames, .mobileAverages { display: none; }'); expect(css).toContain('@media (max-width: 639px)'); expect(css).toContain('.desktopGames { display: none; }');
  expect(css).toContain('min-height: 44px'); expect(css).toContain(':focus-visible');
  const source = readFileSync(new URL('./PlayerGameLog.tsx', import.meta.url), 'utf8');
  expect(source).toContain('Recorded averages · all stats'); expect(source).toContain('<tfoot>'); expect(source).toContain('rows.slice(0, limit)');
});
