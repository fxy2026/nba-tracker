import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import archive from '@/data/schedule-2025-26.json';
import observed from '@/data/observed-final-games.json';
import projection from '@/data/schedule-projection-revision.json';
import { createScheduleProjectionRevision } from '../../scripts/recovery/schedule-projection-revision';
import { generateStoredArchives } from '../../scripts/recovery/snapshot-store';
import { writeObservedFinals } from '../../scripts/recovery/official-game-store';
import { OFFICIAL_RECOVERY_SCHEDULE_URL, projectOfficialRecoverySchedule } from './recovery-official-schedule';
import type { ScheduleDate } from './api';

beforeEach(() => { vi.resetModules(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

// Real pre-fix collision: the March regular-season game occupied the playoff
// ID, and the actual regular-season ID was missing from the cached projection.
function oldProjection(): ScheduleDate[] {
  const dates = structuredClone(archive.dates) as ScheduleDate[];
  const regular = dates.flatMap(d => d.games).find(g => g.gameId === '0022500989')!;
  for (const day of dates) day.games = day.games.filter(g => !['0022500989', '0042500173'].includes(g.gameId));
  dates.find(d => d.gameDate.startsWith('03/16/2026'))!.games.push({ ...regular, gameId: '0042500173' });
  return dates;
}
function assertCorrected(dates: ScheduleDate[]) {
  const games = dates.flatMap(d => d.games);
  expect(games.find(g => g.gameId === '0042500173')).toMatchObject({
    gameCode: '20260424/LALHOU', gameStatus: 3, gameStatusText: 'Final/OT',
    awayTeam: { teamTricode: 'LAL', score: 112 }, homeTeam: { teamTricode: 'HOU', score: 108 },
  });
  expect(games.find(g => g.gameId === '0022500989')).toMatchObject({
    gameCode: '20260316/LALHOU', gameStatus: 3,
    awayTeam: { teamTricode: 'LAL', score: 100 }, homeTeam: { teamTricode: 'HOU', score: 92 },
  });
  expect(games.filter(g => g.gameId === '0042500173')).toHaveLength(1);
}

describe('revision-bound shared schedule cache', () => {
  it.each(['legacy', 'wrong-revision', 'wrong-schema'])('rejects %s cached identity and restores both corrected games when the CDN is blocked', async kind => {
    const identity = kind === 'legacy' ? {} : { ...projection,
      ...(kind === 'wrong-revision' ? { revision: 'obsolete' } : { schema: projection.schema - 1 }),
    };
    const obsolete = oldProjection();
    expect(obsolete.flatMap(d => d.games).find(g => g.gameId === '0042500173')?.gameCode).toBe('20260316/LALHOU');
    expect(obsolete.flatMap(d => d.games).find(g => g.gameId === '0022500989')).toBeUndefined();
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ ...identity, seasonYear: '2025', dates: obsolete }))
      .mockResolvedValue(new Response('blocked', { status: 403 }));
    vi.stubGlobal('fetch', fetcher);
    const api = await import('./api');
    const dates = await api.getFullSchedule();
    assertCorrected(dates);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[0][0])).toContain(`/api/schedule-slim?schema=${projection.schema}&revision=${projection.revision}`);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ next: { revalidate: 7200 } });
    expect(String(fetcher.mock.calls[1][0])).toContain('scheduleLeagueV2.json');
    expect(await api.getFullSchedule()).toBe(dates);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('preserves a matching projection and live/current data while deduplicating cold callers', async () => {
    const current = structuredClone(archive.dates[0].games[0]);
    Object.assign(current, { gameId: '0022600001', gameCode: '20261021/OKCHOU', gameDateTimeUTC: '2026-10-21T23:00:00Z', gameStatus: 2, gameStatusText: 'Q2 5:00' });
    current.homeTeam.score = 44; current.awayTeam.score = 42;
    const dates = [...archive.dates, { gameDate: '10/21/2026 00:00:00', games: [current] }];
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ...projection, seasonYear: '2026', dates }));
    vi.stubGlobal('fetch', fetcher);
    const api = await import('./api');
    const [first, second] = await Promise.all([api.getFullSchedule(), api.getFullSchedule()]);
    assertCorrected(first);
    expect(first).toEqual(dates); expect(second).toBe(first);
    expect(await api.getCurrentSeasonSchedule('2026-27')).toEqual([dates.at(-1)]);
    expect(api.getScheduleSeasonYear()).toBe('2026');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('falls back to fresh live data rather than discarding it after a mismatched projection', async () => {
    const liveDates = [{ gameDate: '10/21/2026 00:00:00', games: [] }];
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ ...projection, revision: 'old', dates: oldProjection() }))
      .mockResolvedValueOnce(Response.json({ leagueSchedule: { seasonYear: '2026-27', gameDates: liveDates } }));
    vi.stubGlobal('fetch', fetcher);
    const api = await import('./api');
    const dates = await api.getFullSchedule();
    assertCorrected(dates);
    expect(dates).toContainEqual(liveDates[0]); expect(api.getScheduleSeasonYear()).toBe('2026');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('generated schedule projection identity', () => {
  it('is deterministic, derived from both current inputs, and tiny enough for shared imports', () => {
    expect(projection).toEqual(createScheduleProjectionRevision(archive, observed));
    expect(projection.revision).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(projection).length).toBeLessThan(128);
    expect(createScheduleProjectionRevision(archive, observed)).toEqual(createScheduleProjectionRevision(structuredClone(archive), structuredClone(observed)));
  });

  it('regenerates for archive corrections and validated newly observed finals, without a manual bump', () => {
    const root = mkdtempSync(join(tmpdir(), 'nba-schedule-revision-'));
    try {
      cpSync('src/data', root, { recursive: true });
      const readRevision = () => JSON.parse(readFileSync(join(root, 'schedule-projection-revision.json'), 'utf8'));
      generateStoredArchives(root); expect(readRevision()).toEqual(projection);
      const corrected = structuredClone(archive);
      Object.assign(corrected.dates[0].games[0], { arenaName: 'Verified corrected arena' });
      writeFileSync(join(root, 'schedule-2025-26.json'), JSON.stringify(corrected));
      generateStoredArchives(root); const correctedRevision = readRevision();
      expect(correctedRevision.revision).not.toBe(projection.revision);
      const observedAt = '2026-10-02T00:00:00Z';
      const projected = projectOfficialRecoverySchedule({ leagueSchedule: { seasonYear: '2026-27', gameDates: [{ games: [{
        gameId: '0022600001', gameStatus: 3, gameCode: '20261001/DENMIN', gameDateTimeUTC: '2026-10-01T23:00:00Z',
        homeTeam: { teamId: 1610612750, teamTricode: 'MIN', score: 112 }, awayTeam: { teamId: 1610612743, teamTricode: 'DEN', score: 96 },
      }] }] } }, { expectedSeason: '2026-27', now: observedAt, source: { url: OFFICIAL_RECOVERY_SCHEDULE_URL, sha256: 'a'.repeat(64), observedAt } });
      if (projected.status !== 'ready') throw new Error('Invalid observed fixture');
      writeObservedFinals(join(root, 'observed-final-games'), [{ version: 1, game: projected.games[0], source: projected.source }]);
      generateStoredArchives(root); const observedRevision = readRevision();
      expect(observedRevision.revision).not.toBe(correctedRevision.revision);
      rmSync(join(root, 'schedule-projection-revision.json'));
      generateStoredArchives(root); expect(readRevision()).toEqual(observedRevision);
      // A failed validation must not publish a fresh trusted cache identity.
      const boxFile = join(root, 'recovered-player-boxes/0042500173.json');
      const box = JSON.parse(readFileSync(boxFile, 'utf8')); box.players[0].points++;
      writeFileSync(boxFile, JSON.stringify(box));
      expect(() => generateStoredArchives(root)).toThrow(); expect(readRevision()).toEqual(observedRevision);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
