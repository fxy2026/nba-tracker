import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import en from '@/locales/en';
import zh from '@/locales/zh';
import type { ScheduleGame } from '@/lib/api';
import { LocaleProvider } from './LocaleProvider';
import GameCard from './GameCard';

function game(): ScheduleGame {
  return {
    gameId: '0022600001', gameStatus: 3, gameStatusText: 'Final', gameCode: '20261023/PORSAS', gameDateTimeUTC: '2026-10-24T00:30:00Z',
    awayTeam: { teamId: 1610612757, teamTricode: 'POR', teamCity: 'Portland', teamName: 'Trail Blazers', teamSlug: 'blazers', score: 95 },
    homeTeam: { teamId: 1610612759, teamTricode: 'SAS', teamCity: 'San Antonio', teamName: 'Spurs', teamSlug: 'spurs', score: 114 },
  };
}
function render(row: ScheduleGame, locale: 'en' | 'zh' = 'en') {
  // Real component/provider SSR: hooks are not replaced or disabled by mocks.
  const html = renderToStaticMarkup(<LocaleProvider initialLocale={locale}><GameCard game={row} /></LocaleProvider>);
  const records = [...html.matchAll(/<p class="text-xs text-text-secondary font-mono tabular-nums">([^<]*)<\/p>/g)].map(match => match[1]);
  const scores = [...html.matchAll(/<span class="text-xl[^\"]*">(\d+)/g)].map(match => Number(match[1]));
  return { html, records, scores };
}

it.each(['en', 'zh'] as const)('unknown records/seeds stay hidden while actual final scores and navigation remain in %s', locale => {
  const { html, records, scores } = render(game(), locale);
  expect(records).toEqual([]); expect(scores).toEqual([95, 114]);
  expect(html).toContain('href="/game/0022600001"'); expect(html).toContain('Portland Trail Blazers'); expect(html).toContain('San Antonio Spurs');
  expect(html).not.toContain('undefined'); expect(html).not.toContain('NaN'); expect(html).not.toContain('0-0');
});
it.each(['en', 'zh'] as const)('real zero-win and zero-loss played records remain visible in %s', locale => {
  const row = game(); Object.assign(row.awayTeam, { wins: 0, losses: 3, seed: 8 }); Object.assign(row.homeTeam, { wins: 3, losses: 0, seed: 1 });
  expect(render(row, locale)).toMatchObject({ records: ['0-3 · #8', '3-0 · #1'], scores: [95, 114] });
});
it('valid records without seeds retain only the observed win-loss values', () => {
  const row = game(); Object.assign(row.awayTeam, { wins: 0, losses: 3 }); Object.assign(row.homeTeam, { wins: 3, losses: 0 });
  expect(render(row).records).toEqual(['0-3', '3-0']);
});
it.each(['homeTeam', 'awayTeam'] as const)('zero-zero and seed-only values do not invent a played record for %s', side => {
  const row = game(); row[side].seed = 8;
  expect(render(row).records).toEqual([]);
  Object.assign(row[side], { wins: 0, losses: 0 }); expect(render(row).records).toEqual([]);
});
it.each(['homeTeam', 'awayTeam'] as const)('missing or invalid record fields are hidden independently for %s', side => {
  const invalid: unknown[] = [undefined, null, '0', NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1];
  for (const field of ['wins', 'losses'] as const) for (const value of invalid) {
    const row = game(); Object.assign(row[side], { wins: 1, losses: 2, seed: 8 }); Reflect.set(row[side], field, value);
    expect(render(row).records, `${side}.${field}=${String(value)}`).toEqual([]);
    expect(render(row).scores).toEqual([95, 114]);
  }
});
it.each(['homeTeam', 'awayTeam'] as const)('invalid seeds are hidden without losing the valid %s record', side => {
  for (const seed of [undefined, null, '8', 0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const row = game(); Object.assign(row[side], { wins: 0, losses: 3 }); Reflect.set(row[side], 'seed', seed);
    expect(render(row).records, `${side}.seed=${String(seed)}`).toEqual(['0-3']);
    expect(render(row).scores).toEqual([95, 114]);
  }
});

it.each(['en', 'zh'] as const)('game-card navigation and score states remain intact without a replay badge in %s', locale => {
  for (const gameStatus of [1, 2, 3]) {
    const row = game(); row.gameStatus = gameStatus;
    row.gameStatusText = gameStatus === 3 ? 'Final' : gameStatus === 2 ? 'Q2 5:30' : '7:00 PM';
    const { html, scores } = render(row, locale);
    expect(html).toContain('href="/game/0022600001"');
    expect(html).toContain('Portland Trail Blazers');
    expect(html).toContain('San Antonio Spurs');
    expect(scores).toEqual(gameStatus === 1 ? [] : [95, 114]);
    expect(html).not.toContain((locale === 'zh' ? zh : en).gameCard.replay);
    expect(html).not.toContain('lucide-play');
  }
});
it.each(['en', 'zh'] as const)('the final-game quarters and scorer control remains available in %s', locale => {
  const row = game();
  row.homeTeam.periods = [{ period: 1, periodType: 'REGULAR', score: 25 }];
  row.awayTeam.periods = [{ period: 1, periodType: 'REGULAR', score: 24 }];
  const { html } = render(row, locale);
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain(locale === 'zh' ? '节次·得分王' : 'Quarters · Top scorer');
  expect(html).toContain('href="/game/0022600001"');
});
