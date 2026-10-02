import { describe, expect, it, vi } from 'vitest';
import sample from './fixtures/provider-snapshot-storage-sample.json';
import fullArchive from '../data/schedule-2025-26.json';
import verifiedSample from '../data/recovered-player-boxes/0042500164.json';
import resolvedSample from '../data/recovered-player-boxes/0042500155.json';
import { planRecoveryReplay, type RecoveryReplayInput, type RecoveryReplayArchives } from './recovery-replay-plan';
import type { ProviderBasicSnapshot } from './provider-player-normalizer';
import type { RecoveredPlayerBox } from './recovered-player-box';
import { OFFICIAL_RECOVERY_SCHEDULE_URL, projectOfficialRecoverySchedule } from './recovery-official-schedule';
import { TEAM_META } from './teams';

const now = Date.parse('2026-10-25T12:00:00Z');
const old = () => structuredClone(sample) as ProviderBasicSnapshot;
const empty = (): RecoveryReplayArchives => ({ generic: {}, verified: {}, quarantined: {}, observed: {} });
function archive(...rows: ProviderBasicSnapshot[]) {
  return { seasonYear: '2025', dates: [{ games: rows.map(({ game }) => ({
    gameId: game.nbaGameId, gameStatus: 3,
    gameCode: `${game.gameDate.replaceAll('-', '')}/${game.away.tricode}${game.home.tricode}`,
    homeTeam: { teamId: TEAM_META[game.home.tricode].teamId, teamTricode: game.home.tricode, score: game.home.score },
    awayTeam: { teamId: TEAM_META[game.away.tricode].teamId, teamTricode: game.away.tricode, score: game.away.score },
  })) }] };
}
// Synthetic current-season identity paired with an existing normalized player
// fixture. This is validation coverage, never evidence of a real 2026-27 game.
function current(id = '0022600001', uuid = '11111111-1111-4111-8111-111111111111') {
  const row = old();
  Object.assign(row.game, { nbaGameId: id, providerMatchId: uuid, season: '2026-27', gameDate: '2026-10-23' });
  const observedAt = '2026-10-24T08:00:00Z';
  const result = projectOfficialRecoverySchedule({ leagueSchedule: { seasonYear: row.game.season, gameDates: [{ games: [{
    ...archive(row).dates[0].games[0], gameDateTimeUTC: '2026-10-24T00:30:00Z',
  }] }] } }, { expectedSeason: row.game.season, now: observedAt, source: { url: OFFICIAL_RECOVERY_SCHEDULE_URL, sha256: 'a'.repeat(64), observedAt } });
  if (result.status !== 'ready') throw Error('Invalid synthetic official fixture');
  return { row, observation: { version: 1 as const, game: result.games[0], source: result.source } };
}
function input(): RecoveryReplayInput {
  return { pending: { snapshots: [old()], observations: [] }, latest: empty(), schedule: archive(old()), now };
}
function expectFailure(value: RecoveryReplayInput, reason: string) {
  expect(planRecoveryReplay(value)).toEqual({ ok: false, reason });
}

describe('data-only replay preflight', () => {
  it('adds an archived 2025-26 snapshot without inventing an official observation', () => {
    const request = input(), before = structuredClone(request);
    expect(planRecoveryReplay(request)).toEqual({ ok: true, additions: [{
      kind: 'snapshot', gameId: sample.game.nbaGameId, path: `src/data/provider-player-boxes/${sample.game.nbaGameId}.json`, value: sample,
    }], identical: [] });
    expect(request).toEqual(before);
  });
  it('accepts paired new-season official and player data, and only fixed data paths', () => {
    const { row, observation } = current();
    const result = planRecoveryReplay({ ...input(), pending: { snapshots: [row], observations: [observation] } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.additions.map(value => [value.kind, value.path])).toEqual([
      ['observation', 'src/data/observed-final-games/0022600001.json'], ['snapshot', 'src/data/provider-player-boxes/0022600001.json'],
    ]);
    expect(JSON.stringify(result)).not.toMatch(/cursor|recovery-state|\.github|scripts\//);
  });
  it('accepts an official-only batch without inventing players', () => {
    const { observation } = current();
    const result = planRecoveryReplay({ ...input(), pending: { snapshots: [], observations: [observation] } });
    expect(result).toMatchObject({ ok: true, additions: [{ kind: 'observation', value: observation }], identical: [] });
    if (result.ok) expect(result.additions).toHaveLength(1);
  });
  it('uses an existing official observation for a new snapshot', () => {
    const { row, observation } = current(), request = input();
    request.pending.snapshots = [row]; request.latest.observed[row.game.nbaGameId] = observation;
    expect(planRecoveryReplay(request)).toMatchObject({ ok: true, additions: [{ kind: 'snapshot' }] });
  });
  it('skips full canonically identical records regardless of object key order', () => {
    const { row, observation } = current(), request = input();
    request.pending = { snapshots: [row], observations: [observation] };
    request.latest.generic[row.game.nbaGameId] = { ...row, game: { ...row.game } };
    request.latest.observed[row.game.nbaGameId] = { source: observation.source, game: observation.game, version: 1 };
    const result = planRecoveryReplay(request);
    expect(result).toMatchObject({ ok: true, additions: [], identical: [{ kind: 'observation' }, { kind: 'snapshot' }] });
  });
  it.each(['retrievedAt', 'minutes', 'observedAt', 'sourceHash', 'utcTime'])('refuses same-ID value/provenance differences: %s', field => {
    const { row, observation } = current(), request = input();
    request.pending = { snapshots: [row], observations: [observation] };
    request.latest.generic[row.game.nbaGameId] = structuredClone(row);
    request.latest.observed[row.game.nbaGameId] = structuredClone(observation);
    if (field === 'retrievedAt') request.latest.generic[row.game.nbaGameId].retrievedAt = '2026-10-02T14:12:04Z';
    if (field === 'minutes') request.latest.generic[row.game.nbaGameId].players[0].minutesRounded!++;
    if (field === 'observedAt') request.latest.observed[row.game.nbaGameId].source.observedAt = '2026-10-24T09:00:00Z';
    if (field === 'sourceHash') request.latest.observed[row.game.nbaGameId].source.sha256 = 'b'.repeat(64);
    if (field === 'utcTime') request.latest.observed[row.game.nbaGameId].game.gameDateTimeUTC = '2026-10-24T00:35:00Z';
    expectFailure(request, 'same-id-conflict');
  });
  it.each(['verified', 'quarantined', 'resolved'])('refuses protected historical game: %s', kind => {
    const request = input();
    if (kind === 'verified') request.latest.verified[sample.game.nbaGameId] = verifiedSample as RecoveredPlayerBox;
    if (kind === 'quarantined') request.latest.quarantined[sample.game.nbaGameId] = old();
    if (kind === 'resolved') {
      const row = old(); row.game.nbaGameId = resolvedSample.gameId;
      request.pending.snapshots = [row];
      request.latest.verified[resolvedSample.gameId] = resolvedSample as RecoveredPlayerBox;
    }
    expectFailure(request, 'protected-game');
  });
  it('does not add an official tuple for a protected game', () => {
    const { observation } = current(), request = input(), protectedRow = current().row;
    request.pending = { snapshots: [], observations: [observation] };
    request.latest.quarantined[protectedRow.game.nbaGameId] = protectedRow;
    expectFailure(request, 'protected-game');
  });
  it.each(['generic', 'verified', 'quarantined'])('refuses case-insensitive UUID ownership collision with %s', kind => {
    const { row, observation } = current(), request = input();
    row.game.providerMatchId = sample.game.providerMatchId;
    request.pending = { snapshots: [row], observations: [observation] };
    if (kind === 'generic') request.latest.generic[sample.game.nbaGameId] = old();
    if (kind === 'quarantined') request.latest.quarantined[sample.game.nbaGameId] = old();
    if (kind === 'verified') request.latest.verified[sample.game.nbaGameId] = { ...verifiedSample, providerMatchId: sample.game.providerMatchId.toUpperCase() } as RecoveredPlayerBox;
    expectFailure(request, 'provider-id-conflict');
  });
  it('refuses duplicate match ownership inside incoming batch', () => {
    const a = current(), b = current('0022600002');
    expectFailure({ ...input(), pending: { snapshots: [a.row, b.row], observations: [] } }, 'provider-id-conflict');
  });
  it.each(['absent', 'nonlegacy-archive'])('requires a typed official reference for new-season snapshots: %s', kind => {
    const request = input(), { row } = current(); request.pending.snapshots = [row];
    if (kind === 'nonlegacy-archive') request.schedule = { ...archive(row), seasonYear: '2026' };
    expectFailure(request, kind === 'absent' ? 'missing-official-identity' : 'invalid-schedule');
  });
  it('refuses a historical snapshot absent from the supplied archive', () => {
    expectFailure({ ...input(), schedule: archive() }, 'missing-official-identity');
  });
  it.each(['score', 'teams', 'date'])('refuses paired official mismatch: %s', kind => {
    const { row, observation } = current(), request = input();
    if (kind === 'score') observation.game.home.score++;
    if (kind === 'teams') { const home = row.game.home; row.game.home = row.game.away; row.game.away = home; }
    if (kind === 'date') row.game.gameDate = '2026-10-22';
    request.pending = { snapshots: [row], observations: [observation] };
    expectFailure(request, 'official-identity-conflict');
  });
  it.each(['score', 'teamId', 'tricode', 'date', 'not-final'])('refuses an archive reference mismatch: %s', kind => {
    const request = input(), schedule = archive(old()), game = schedule.dates[0].games[0];
    if (kind === 'score') game.homeTeam.score++;
    if (kind === 'teamId') game.homeTeam.teamId = 1610612759;
    if (kind === 'tricode') game.homeTeam.teamTricode = 'SAS';
    if (kind === 'date') game.gameCode = '20260424/DENMIN';
    if (kind === 'not-final') game.gameStatus = 2;
    request.schedule = schedule; expectFailure(request, 'official-identity-conflict');
  });
  it('rejects a new official observation that conflicts with an already saved player snapshot', () => {
    const { row, observation } = current(), request = input();
    request.latest.generic[row.game.nbaGameId] = row; observation.game.home.score++;
    request.pending = { snapshots: [], observations: [observation] };
    expectFailure(request, 'official-identity-conflict');
  });
  it('refuses assigning a different NBA ID to the same official game code', () => {
    const a = current(), b = current('0022600002'), request = input();
    request.latest.observed[a.row.game.nbaGameId] = a.observation;
    request.pending = { snapshots: [], observations: [b.observation] };
    expectFailure(request, 'official-identity-conflict');
  });
  it.each(['points', 'extra-top', 'extra-player', 'blocked-id', 'blocked-name', 'duplicate-player', 'invalid-game'])('refuses an unvalidated snapshot: %s', kind => {
    const request = input(), row = old();
    if (kind === 'points') row.players[0].points++;
    if (kind === 'extra-top') Reflect.set(row, 'raw', 'DO_NOT_EXPORT');
    if (kind === 'extra-player') Reflect.set(row.players[0], 'headers', 'DO_NOT_EXPORT');
    if (kind === 'blocked-id') row.players[0].providerPlayerId = 'bcc566fc-5452-4681-ab41-b042fae11e53';
    if (kind === 'blocked-name') row.players[0].name = 'Drew Doughty';
    if (kind === 'duplicate-player') row.players[1].providerPlayerId = row.players[0].providerPlayerId;
    if (kind === 'invalid-game') row.game.nbaGameId = '../../evil';
    request.pending.snapshots = [row]; expectFailure(request, 'invalid-batch');
  });
  it.each(['empty', 'duplicate-snapshot', 'duplicate-observation', 'snapshot-cap', 'observation-cap', 'invalid-observation', 'clock'])('refuses invalid entire batch: %s', kind => {
    const request = input(), { observation } = current();
    if (kind === 'empty') request.pending.snapshots = [];
    if (kind === 'duplicate-snapshot') request.pending.snapshots = [old(), old()];
    if (kind === 'duplicate-observation') request.pending.observations = [observation, observation];
    if (kind === 'snapshot-cap') request.pending.snapshots = Array(21).fill(old());
    if (kind === 'observation-cap') request.pending.observations = Array(21).fill(observation);
    if (kind === 'invalid-observation') request.pending.observations = [{ ...observation, raw: 'DO_NOT_EXPORT' }];
    if (kind === 'clock') request.now = NaN;
    expectFailure(request, 'invalid-batch');
  });
  it('returns no additions or skips when a later record conflicts', () => {
    const request = input(), { observation } = current();
    request.pending.observations = [observation];
    request.latest.generic[sample.game.nbaGameId] = old(); request.latest.generic[sample.game.nbaGameId].retrievedAt = '2026-10-03T00:00:00Z';
    expectFailure(request, 'same-id-conflict');
  });
  it('rejects malformed or overlapping latest archives and duplicated reference IDs', () => {
    const bad = input(); bad.latest.generic[sample.game.nbaGameId] = old(); bad.latest.quarantined[sample.game.nbaGameId] = old();
    expectFailure(bad, 'invalid-latest');
    const invalid = input(); invalid.latest.generic[sample.game.nbaGameId] = { ...old(), players: [] };
    expectFailure(invalid, 'invalid-latest');
    const duplicate = input(); duplicate.schedule = archive(old(), old()); expectFailure(duplicate, 'invalid-schedule');
  });
  it('accepts the real complete legacy archive including its unsupported synthetic IDs', () => {
    expect(planRecoveryReplay({ ...input(), schedule: fullArchive })).toMatchObject({ ok: true, additions: [{ kind: 'snapshot' }] });
    const synthetic = old(); synthetic.game.nbaGameId = '9401810012';
    expectFailure({ ...input(), schedule: fullArchive, pending: { snapshots: [synthetic], observations: [] } }, 'invalid-batch');
  });
  it('refuses non-JSON fields, holes and accessors without executing them', () => {
    const withUndefined = old(); Reflect.set(withUndefined.players[0], 'unknown', undefined);
    expectFailure({ ...input(), pending: { snapshots: [withUndefined], observations: [] } }, 'invalid-batch');
    const withGetter = old(), getter = vi.fn(() => 'DO_NOT_EXPORT');
    Object.defineProperty(withGetter, 'retrievedAt', { get: getter });
    expectFailure({ ...input(), pending: { snapshots: [withGetter], observations: [] } }, 'invalid-batch');
    expect(getter).not.toHaveBeenCalled();
    const withHole = old(); delete withHole.players[0];
    expectFailure({ ...input(), pending: { snapshots: [withHole], observations: [] } }, 'invalid-batch');
  });
  it('uses only the injected instant, with no ambient clock or fetch', () => {
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => { throw Error('Ambient clock forbidden'); });
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw Error('Network forbidden'); });
    try { expect(planRecoveryReplay(input()).ok).toBe(true); expect(clock).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled(); }
    finally { clock.mockRestore(); fetcher.mockRestore(); }
  });
});
