import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import archive from '../data/recovered-player-boxes.json';
import provider from '../data/provider-player-boxes.json';
import schedule from '../data/schedule-2025-26.json';
import { validateRecoveredPlayerBox } from './recovered-player-box';
import type { ScheduleGame } from './api';
import RecoveredPlayerBox from '../app/game/[id]/_components/RecoveredPlayerBox';
const ids = ['0042500401', '0042500402', '0042500403'] as const;
const gameFor = (id: string) => schedule.dates.flatMap(day => day.games).find(game => game.gameId === id)! as ScheduleGame;
it.each(ids)('%s has validated historical sides and report-backed minutes', id => {
  const box = validateRecoveredPlayerBox(archive[id], gameFor(id));
  expect(box).not.toBeNull();
  expect(Object.hasOwn(provider, id)).toBe(false);
  for (const player of box!.players) {
    expect(['NYK', 'SAS']).toContain(player.team);
    if (player.minutesCorrection) {
      expect(player.minutesCorrection.reportUrl).toBe(box!.reportUrl);
      const [m,s] = player.minutesCorrection.officialDuration.split(':').map(Number);
      expect(player.minutes).toBe(Math.round(m+s/60));
    }
  }
});
it('all 59 rows preserved with exactly eight minute-only corrections', () => {
  const boxes = ids.map(id => validateRecoveredPlayerBox(archive[id], gameFor(id))!);
  expect(boxes.flatMap(box => box.players)).toHaveLength(59);
  const corrections = boxes.flatMap(box => box.players.filter(p => p.minutesCorrection));
  expect(corrections).toHaveLength(8);
  expect(corrections.map(p => [p.name,p.minutesCorrection!.originalProviderMinutes,p.minutes])).toEqual([
    ['Jalen Brunson',36,37],['Devin Vassell',35,36],['Victor Wembanyama',37,38],
    ['Mikal Bridges',40,41],['Devin Vassell',37,38],['OG Anunoby',36,37],['Stephon Castle',27,28],['Jeremy Sochan',null,0],
  ]);
});
it.each([true,false])('correction source is visible in both languages: %s', isZh => {
  const box = validateRecoveredPlayerBox(archive['0042500403'],gameFor('0042500403'))!;
  const html = renderToStaticMarkup(createElement(RecoveredPlayerBox,{box,isZh}));
  expect(html).toContain('0†');
  expect(html).toContain(isZh ? '原始数据源分钟保留' : 'Original provider minutes are retained');
  expect(html.match(/<table/g)).toHaveLength(2);
});
it.each([
  { minutes: 1 },
  { minutesCorrection: { ...archive['0042500403'].players.find(p=>p.name==='Jeremy Sochan')!.minutesCorrection, officialDuration:'00:99' } },
  { minutesCorrection: { ...archive['0042500403'].players.find(p=>p.name==='Jeremy Sochan')!.minutesCorrection, reportUrl:archive['0042500401'].reportUrl } },
  { minutesCorrection: { ...archive['0042500403'].players.find(p=>p.name==='Jeremy Sochan')!.minutesCorrection, originalProviderMinutes:-1 } },
])('rejects mismatched/malformed correction %#', mutation => {
  const raw = structuredClone(archive['0042500403']);
  Object.assign(raw.players.find(p=>p.name==='Jeremy Sochan')!,mutation);
  expect(validateRecoveredPlayerBox(raw,gameFor('0042500403'))).toBeNull();
});
