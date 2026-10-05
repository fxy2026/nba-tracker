import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import type { EspnScoreboardView } from '@/lib/espn-scoreboard';
const state = vi.hoisted(() => ({ locale: 'zh' }));
vi.mock('./LocaleProvider', () => ({ useLocale: () => ({ locale: state.locale }) }));
vi.mock('./TeamLogo', () => ({ default: ({ tricode }: { tricode: string }) => <span>{tricode}</span> }));
import EspnScoreboard from './EspnScoreboard';
const fixture = (): EspnScoreboardView => ({ source: 'espn', state: 'ready', date: '2026-10-05', timeZone: 'Asia/Shanghai', retrievedAtUTC: '2026-10-05T05:19:00Z', games: [{
  source: 'espn', eventId: '401914127', key: 'espn:401914127', tipoffUTC: '2026-10-04T23:00:00Z', seasonYear: 2027, seasonType: 1, status: 'final', statusText: 'Final',
  sourceUrl: 'https://www.espn.com/nba/game/_/gameId/401914127/jazz-nuggets',
  away: { id: '26', abbreviation: 'UTAH', name: 'Utah Jazz', tricode: 'UTA', score: 109 }, home: { id: '7', abbreviation: 'DEN', name: 'Denver Nuggets', tricode: 'DEN', score: 97 },
}] });
beforeEach(() => { state.locale = 'zh'; });
it.each(['zh', 'en'])('labels source, season type, correct timezone date and external details in %s', locale => {
  state.locale = locale; const html = renderToStaticMarkup(<EspnScoreboard view={fixture()} />);
  expect(html).toContain(locale === 'zh' ? '季前赛' : 'Preseason'); expect(html).toContain('ESPN'); expect(html).toContain('Asia/Shanghai'); expect(html).toContain('109'); expect(html).toContain('97');
  expect(html).toContain('href="https://www.espn.com/nba/game/_/gameId/401914127/jazz-nuggets"'); expect(html).toContain('rel="noopener noreferrer"');
  expect(html).not.toContain('href="/game/'); expect(html).not.toContain('/api/boxscore'); expect(html).not.toContain('/player/');
});
it('does not turn unplayed scores into 0–0 or display a final badge', () => {
  const view = fixture(); view.games[0].status = 'scheduled'; view.games[0].home.score = null; view.games[0].away.score = null;
  const html = renderToStaticMarkup(<EspnScoreboard view={view} />); expect(html).toContain('未开始'); expect(html).not.toContain('已结束'); expect(html.match(/>—</g)).toHaveLength(2);
});
it('renders unavailable distinctly from a validated empty day', () => {
  const view = fixture(); view.games = []; const empty = renderToStaticMarkup(<EspnScoreboard view={view} />); expect(empty).toContain('未列出比赛');
  view.state = 'unavailable'; const failed = renderToStaticMarkup(<EspnScoreboard view={view} />); expect(failed).toContain('无法确认'); expect(failed).not.toContain('未列出比赛');
});
