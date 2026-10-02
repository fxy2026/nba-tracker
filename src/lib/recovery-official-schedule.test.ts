import { expect, it } from 'vitest';
import archive from '../data/schedule-2025-26.json';
import { OFFICIAL_RECOVERY_SCHEDULE_URL, projectOfficialRecoverySchedule, type OfficialScheduleSource } from './recovery-official-schedule';

const now = '2026-10-24T08:00:00Z';
const source: OfficialScheduleSource = { url: OFFICIAL_RECOVERY_SCHEDULE_URL, sha256: 'a'.repeat(64), observedAt: now };
// Synthetic new-season envelope, using the established official field shapes.
function game() {
  return { gameId: '0022600001', gameStatus: 3, gameCode: '20261023/NYKSAS', gameDateTimeUTC: '2026-10-24T00:30:00Z',
    homeTeam: { teamId: 1610612759, teamTricode: 'SAS', score: 90 }, awayTeam: { teamId: 1610612752, teamTricode: 'NYK', score: 94 } };
}
const envelope = (games: unknown[] = [game()]) => ({ leagueSchedule: { seasonYear: '2026-27', gameDates: [{ games }] } });
const project = (raw: unknown, observedAt = now, expectedSeason = '2026-27') => projectOfficialRecoverySchedule(raw, { expectedSeason, now, source: { ...source, observedAt } });

it('preserves exact final identity, official gameCode date and distinct UTC date without raw feed fields', () => {
  const raw = envelope(); Reflect.set(raw, 'unusedMessage', 'RAW_SECRET');
  const result = project(raw);
  expect(result).toEqual({ status: 'ready', season: '2026-27', source, games: [{
    nbaGameId: '0022600001', season: '2026-27', phase: 'regular', gameCode: '20261023/NYKSAS', gameDate: '2026-10-23',
    gameDateTimeUTC: '2026-10-24T00:30:00Z', utcDate: '2026-10-24', lookupDates: ['2026-10-23', '2026-10-24'],
    home: { teamId: 1610612759, tricode: 'SAS', score: 90 }, away: { teamId: 1610612752, tricode: 'NYK', score: 94 },
  }] });
  expect(JSON.stringify(result)).not.toContain('RAW_SECRET');
});
it.each([['0042600401', 'playoffs'], ['0052600101', 'play-in']])('accepts supported canonical phase %s', (id, phase) => {
  expect(project(envelope([{ ...game(), gameId: id }]))).toMatchObject({ status: 'ready', games: [{ phase }] });
});
it('preserves genuine numeric zero without coercing or guessing a score', () => {
  const row = game(); row.homeTeam.score = 0;
  expect(project(envelope([row]))).toMatchObject({ status: 'ready', games: [{ home: { score: 0 } }] });
});
it.each(['0012600001', '0032600001', '0062600001'])('excludes unsupported phase %s without assigning its teams', gameId => {
  expect(project(envelope([{ gameId, gameStatus: 3 }]))).toMatchObject({ status: 'empty', games: [] });
});
it.each([1, 2])('excludes nonfinal status %s without inventing placeholder teams', gameStatus => {
  expect(project(envelope([{ gameId: '0022600001', gameStatus }]))).toMatchObject({ status: 'empty', games: [] });
});
it('excludes a future-dated final instead of publishing it', () => {
  expect(project(envelope([{ ...game(), gameDateTimeUTC: '2026-10-24T09:00:00Z' }]))).toMatchObject({ status: 'empty', games: [] });
});
it.each([{ gameDates: [] }, { gameDates: [{ games: [] }] }])('valid empty date/game arrays remain successful empty', ({ gameDates }) => {
  expect(project({ leagueSchedule: { seasonYear: '2026-27', gameDates } })).toMatchObject({ status: 'empty', games: [] });
});
it.each([undefined, null, {}, { leagueSchedule: null }])('distinguishes a missing envelope from empty', raw => expect(project(raw).status).toBe('missing'));
it.each([[], { leagueSchedule: [] }, { leagueSchedule: { seasonYear: '2026-27' } }, { leagueSchedule: { seasonYear: '2026', gameDates: [] } }, { leagueSchedule: { seasonYear: '2026-28', gameDates: [] } }])('malformed data cannot become empty', raw => expect(project(raw).status).toBe('malformed'));
it('does not relabel the known archived 2025 season as a fresh 2026 season', () => {
  // This is a reconstructed envelope around existing local archive rows,
  // not a captured current official response.
  expect(project({ leagueSchedule: { seasonYear: '2025-26', gameDates: archive.dates } })).toMatchObject({ status: 'wrong-season', returnedSeason: '2025-26' });
  expect(project({ leagueSchedule: { seasonYear: '2026-27', gameDates: [{ games: [archive.dates[0].games[0]] }] } })).toMatchObject({ status: 'wrong-season', reason: 'game-id-season-mismatch' });
  expect(project(archive).status).toBe('missing');
});
it.each(['2026-10-23T07:59:59Z', '2026-10-22T08:00:00Z'])('rejects stale observation %s', observedAt => expect(project(envelope(), observedAt).status).toBe('stale'));
it('accepts the exact 24h freshness boundary and rejects future observation', () => {
  expect(project(envelope(), '2026-10-23T08:00:00Z').status).toBe('ready');
  expect(project(envelope(), '2026-10-24T08:00:01Z').status).toBe('malformed');
});
it.each(['20261032/NYKSAS', '20260230/NYKSAS', '20251023/NYKSAS', '20261021/NYKSAS', '20261023/SASNYK'])('rejects impossible or conflicting final gameCode %s', gameCode => {
  expect(project(envelope([{ ...game(), gameCode }])).status).toBe('malformed');
});
it.each(['2026-02-30T00:00:00Z', '2026-10-24T00:30:00-04:00', '', '2028-10-24T00:00:00Z'])('rejects invalid UTC timestamp %s', gameDateTimeUTC => {
  expect(project(envelope([{ ...game(), gameDateTimeUTC }])).status).toBe('malformed');
});
it.each(['0042600421', '0042600501', '0042600400', '0052600001', '0052600291', '0022600000', '002260001', 'fake'])('rejects invalid final NBA ID %s', gameId => {
  expect(project(envelope([{ ...game(), gameId }])).status).toBe('malformed');
});
it.each([null, '3', 0, 4])('does not silently treat unknown status %s as empty', gameStatus => {
  expect(project(envelope([{ ...game(), gameStatus }])).status).toBe('malformed');
});
it.each([null, '90', NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])('rejects malformed final score %s', score => {
  const row = game(); Reflect.set(row.homeTeam, 'score', score);
  expect(project(envelope([row])).status).toBe('malformed');
});
it.each(['wrong-id', 'unknown-team', 'same-team', 'tied-score'])('rejects contradictory final teams/scores: %s', kind => {
  const row = game();
  if (kind === 'wrong-id') row.homeTeam.teamId = row.awayTeam.teamId;
  if (kind === 'unknown-team') row.homeTeam.teamTricode = 'XXX';
  if (kind === 'same-team') row.homeTeam = { ...row.awayTeam, score: 90 };
  if (kind === 'tied-score') row.homeTeam.score = row.awayTeam.score;
  expect(project(envelope([row])).status).toBe('malformed');
});
it('fails closed on duplicate IDs, including final versus scheduled duplicates', () => {
  expect(project(envelope([game(), game()]))).toMatchObject({ status: 'malformed', reason: 'duplicate-game-id' });
  expect(project(envelope([game(), { gameId: game().gameId, gameStatus: 1 }])).status).toBe('malformed');
});
it('rejects two IDs claiming the same date/team identity, even with changed scores', () => {
  const other = game(); other.gameId = '0022600002'; other.homeTeam.score = 99;
  expect(project(envelope([game(), other]))).toMatchObject({ status: 'malformed', reason: 'conflicting-game-identity' });
});
it('preserves consecutive games with distinct lookup identities and rejects a score/date collision', () => {
  const first = { ...game(), gameCode: '20261022/NYKSAS', gameDateTimeUTC: '2026-10-23T00:30:00Z' };
  const second = game(); second.gameId = '0022600002'; second.homeTeam.score = 99;
  expect(project(envelope([first, second]))).toMatchObject({ status: 'ready', games: [expect.any(Object), expect.any(Object)] });
  second.homeTeam.score = 90;
  expect(project(envelope([first, second]))).toMatchObject({ status: 'malformed', reason: 'conflicting-game-identity' });
});
it('rejects prototypes, array holes and accessors without executing them', () => {
  let accessed = false;
  const getter = Object.defineProperty({}, 'leagueSchedule', { get() { accessed = true; throw Error(); } });
  expect(project(getter).status).toBe('malformed'); expect(accessed).toBe(false);
  expect(project(Object.create(envelope())).status).toBe('malformed');
  expect(project(envelope(Array(1))).status).toBe('malformed');
});
