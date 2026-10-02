import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import finals from '../data/recovered-player-boxes/0042500405.json';
import firstRound from '../data/recovered-player-boxes/0042500155.json';
import type { RecoveredPlayerBox } from './recovered-player-box';
import { TEAM_META } from './teams';
import { diagnoseMembershipResponse, MEMBERSHIP_TARGETS } from './recovery-membership-evidence';
import { createRecoveryMembershipClient } from './recovery-membership-client';
import { runMembershipDiagnostic } from './recovery-membership-run';

const refs = { '0042500405': finals, '0042500155': firstRound } as unknown as Record<string, RecoveredPlayerBox>;
const expiry = '2026-10-03T00:00:00Z';
const teamId = (home: boolean) => home ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' : 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
// Synthetic response derived from fixed, independently reviewed local rows.
// This is not a captured availability/lineups response or an identity bridge.
function body(id = '0042500405') {
  const box = refs[id];
  const side = (home: boolean) => box.players.filter(p => p.team === box[home ? 'home' : 'away']).map(p => ({
    player_id: p.providerPlayerId ?? '11111111-1111-4111-8111-111111111111',
    name: p.name, min_played: p.minutes, played: true, starter: p.starter,
  }));
  const team = (home: boolean) => { const row = TEAM_META[box[home ? 'home' : 'away']]; return { team_id: teamId(home), name: `${row.city} ${row.name}` }; };
  return { data: { game: { game_id: id, match_id: box.providerMatchId, game_date: box.gameDate, season_year: 2025, postseason: true, home: team(true), away: team(false) }, home: side(true), away: side(false) }, meta: { availability_available: true, data_type: 'post_game_participation', players_unassigned: 0 } };
}
const client = (fetcher: typeof fetch, maxRequests = 3) => createRecoveryMembershipClient({ apiKey: 'TEST_ONLY_NOT_A_REAL_KEY', maxRequests, expiresAt: expiry, fetcher });
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-02T20:30:00Z')); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it('retains exact safe players and real rounded-zero participation without claiming promotion', () => {
  const result = diagnoseMembershipResponse(body(), 'availability', refs['0042500405']);
  expect(result).toMatchObject({ status: 'comparison-complete', diagnosticOnly: true, officialPromotion: false, gameBinding: 'matched', counts: { home: 9, away: 12, reference: 21 } });
  if ('players' in result) expect(result.players).toContainEqual(expect.objectContaining({ name: 'Jeremy Sochan', expectedTeam: 'NYK', minutesRounded: 0, played: true, referenceMatch: 'name-and-side' }));
});
it('absence of a rounded-zero player is missing evidence, never DNP', () => {
  const raw = body(); raw.data.away = raw.data.away.filter(p => p.name !== 'Jeremy Sochan');
  const result = diagnoseMembershipResponse(raw, 'availability', refs['0042500405']);
  expect(result).toMatchObject({ missingReferencePlayers: [expect.objectContaining({ name: 'Jeremy Sochan', team: 'NYK', minutesRounded: 0 })] });
  expect(result.issues).toContain('missing-reference-players'); expect(JSON.stringify(result)).not.toContain('played":false');
});
it.each(['game_id', 'match_id', 'game_date', 'season_year', 'postseason', 'home'])('reports mismatched game field %s without trusting sides', field => {
  const raw = body(); Reflect.set(raw.data.game, field, field === 'season_year' ? 2026 : 'WRONG');
  expect(diagnoseMembershipResponse(raw, 'availability', refs['0042500405'])).toMatchObject({ gameBinding: 'missing-or-mismatched', issues: expect.arrayContaining(['game-identity-unconfirmed']) });
});
it('preserves safe returned bindings and shows the exact mismatched field', () => {
  const raw = body(); raw.data.game.game_date = '2026-06-14'; raw.data.game.season_year = 2026;
  raw.data.game.home.name = 'New York Knicks';
  const result = diagnoseMembershipResponse(raw, 'availability', refs['0042500405']);
  expect(result).toMatchObject({ returnedBinding: {
    fields: { gameId: { value: '0042500405', state: 'valid' }, gameDate: { value: '2026-06-14', state: 'valid' }, seasonYear: { value: 2026 }, home: { name: { value: 'New York Knicks' }, teamId: { value: teamId(true) } } },
    checks: { gameId: 'matched', gameDate: 'mismatched', seasonYear: 'mismatched', homeName: 'mismatched' },
  } });
});
it('malformed binding values expose fixed kinds without unknown strings', () => {
  const raw = body(); Reflect.deleteProperty(raw.data.game, 'game_date');
  Reflect.set(raw.data.game, 'season_year', Infinity); Reflect.set(raw.data.game, 'postseason', null);
  raw.data.game.home.name = 'secret-not-a-known-team'; raw.data.game.home.team_id = 'bbs_private_key';
  const result = diagnoseMembershipResponse(raw, 'availability', refs['0042500405']);
  expect(result).toMatchObject({ returnedBinding: { fields: {
    gameDate: { value: null, state: 'missing', kind: 'missing' }, seasonYear: { value: null, state: 'invalid', kind: 'number' },
    postseason: { value: null, state: 'null' }, home: { name: { value: null, state: 'invalid' }, teamId: { value: null, state: 'invalid' } },
  } } });
  expect(JSON.stringify(result)).not.toContain('secret-not-a-known-team'); expect(JSON.stringify(result)).not.toContain('bbs_private_key');
});
it('invalid calendar values stay unavailable and malformed sides retain safe game bindings', () => {
  const raw = body(); raw.data.game.game_date = '2026-02-30'; Reflect.set(raw.data, 'away', {});
  expect(diagnoseMembershipResponse(raw, 'availability', refs['0042500405'])).toMatchObject({
    shape: { away: { kind: 'object', count: null } }, returnedBinding: { fields: { gameId: { value: '0042500405' }, gameDate: { value: null, state: 'invalid' } } },
  });
});
it('case-only name comparison remains explicitly separate from an identity alias', () => {
  const raw = body(); raw.data.home[0].name = raw.data.home[0].name.toUpperCase();
  const result = diagnoseMembershipResponse(raw, 'availability', refs['0042500405']);
  if ('players' in result) expect(result.players[0]).toMatchObject({ nameComparison: 'case-or-accent-only', identityAliasEstablished: false });
});
it.each(['availability_available', 'data_type', 'players_unassigned'])('does not silently accept unknown metadata %s', field => {
  const raw = body(); Reflect.deleteProperty(raw.meta, field);
  expect(diagnoseMembershipResponse(raw, 'availability', refs['0042500405']).status).toBe('differences-or-unavailable');
});
it('preserves a positive unassigned count and flags it', () => {
  const raw = body(); raw.meta.players_unassigned = 2;
  expect(diagnoseMembershipResponse(raw, 'availability', refs['0042500405'])).toMatchObject({ playersUnassigned: 2, issues: expect.arrayContaining(['unassigned-players']) });
});
it('never aliases the quarantined Drew record to the official Jrue player', () => {
  const raw = body('0042500155'); const p = raw.data.away.find(p => p.name === 'Jrue Holiday')!;
  p.name = 'Drew Doughty'; p.player_id = 'bcc566fc-5452-4681-ab41-b042fae11e53';
  const result = diagnoseMembershipResponse(raw, 'availability', refs['0042500155']);
  expect(result).toMatchObject({ issues: expect.arrayContaining(['quarantined-player-identity', 'missing-reference-players']), missingReferencePlayers: [expect.objectContaining({ name: 'Jrue Holiday', team: 'POR' })] });
  if ('players' in result) expect(result.players).toContainEqual(expect.objectContaining({ name: 'Drew Doughty', quarantined: true, referenceMatch: 'not-found', identityMatch: 'unknown' }));
});
it('even a correct Jrue name cannot validate the blocked UUID or invent an official provider ID', () => {
  const raw = body('0042500155'); raw.data.away.find(p => p.name === 'Jrue Holiday')!.player_id = 'bcc566fc-5452-4681-ab41-b042fae11e53';
  const result = diagnoseMembershipResponse(raw, 'availability', refs['0042500155']);
  expect(result.issues).toContain('quarantined-player-identity');
  if ('players' in result) expect(result.players).toContainEqual(expect.objectContaining({ name: 'Jrue Holiday', identityMatch: 'independent-official-row', quarantined: true }));
  expect(refs['0042500155'].players.find(p => p.name === 'Jrue Holiday')?.providerPlayerId).toBeNull();
});
it.each(['duplicate', 'cross-side', 'swapped-name', 'wrong-side'])('flags %s identity disagreement', kind => {
  const raw = body();
  if (kind === 'duplicate') raw.data.home.push({ ...raw.data.home[0] });
  if (kind === 'cross-side') raw.data.away.push({ ...raw.data.home[0] });
  if (kind === 'swapped-name') raw.data.home[0].name = raw.data.home[1].name;
  if (kind === 'wrong-side') raw.data.away.push(raw.data.home.shift()!);
  expect(diagnoseMembershipResponse(raw, 'availability', refs['0042500405']).status).toBe('differences-or-unavailable');
});
it('lineups remain request-bound roster evidence and never claim played coverage', () => {
  const raw = body('0042500155'); Reflect.deleteProperty(raw.data, 'game'); Reflect.deleteProperty(raw, 'meta');
  Reflect.set(raw.data.away[0], 'player_id', null);
  const result = diagnoseMembershipResponse(raw, 'lineups', refs['0042500155']);
  expect(result).toMatchObject({ gameBinding: 'request-only', meaning: 'lineup-roster-not-played-coverage', officialPromotion: false });
  if ('players' in result) expect(result.players.every(p => p.played === null && p.minutesRounded === null)).toBe(true);
});
it.each([null, [], {}, { data: {} }, { data: { home: Array(31).fill({}), away: [] } }])('rejects malformed/oversized envelopes without echoing them', raw => {
  expect(diagnoseMembershipResponse(raw, 'availability', refs['0042500405']).status).toBe('malformed-envelope');
});
it.each(['bbs_private_key', 'https://evil.test', 'Authorization: secret', 'Name\nsecret', 'a'.repeat(81)])('does not emit unsafe player strings %s', unsafe => {
  const raw = body(); raw.data.home[0].name = unsafe;
  Reflect.set(raw, 'headers', { 'x-api-key': unsafe }); Reflect.set(raw.meta, 'message', unsafe);
  const result = diagnoseMembershipResponse(raw, 'availability', refs['0042500405']);
  expect(JSON.stringify(result)).not.toContain(unsafe); expect(result.issues).toContain('unsafe-or-missing-player-name');
});

it('performs only the three fixed calls, returns bounded evidence, and leaves references unchanged', async () => {
  const prior = JSON.stringify(refs);
  const fetcher = vi.fn(async (url: string | URL | Request) => new Response(JSON.stringify(body(String(url).includes('0042500155') ? '0042500155' : '0042500405'))));
  const c = client(fetcher); const result = await runMembershipDiagnostic(refs, c);
  expect(result.requests).toBe(3); expect(result.results).toHaveLength(3); expect(JSON.stringify(refs)).toBe(prior);
  expect(fetcher.mock.calls.map(c => String(c[0]))).toEqual(MEMBERSHIP_TARGETS.map(t => `https://api.bigballsdata.com/v1/nba/games/${t.gameId}/${t.kind}`));
  expect(JSON.stringify(result)).not.toContain('TEST_ONLY'); expect(vi.getTimerCount()).toBe(0);
});
it.each([0, 4, 230, NaN, 1.5])('rejects client allowance %s before requests', maxRequests => {
  const fetcher = vi.fn(); expect(() => client(fetcher, maxRequests)).toThrow(); expect(fetcher).not.toHaveBeenCalled();
});
it('rejects unknown paths and repeat calls without spending another request', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify(body()))); const c = client(fetcher);
  expect((await c.get('lineups', '0042500405')).ok).toBe(false);
  await c.get('availability', '0042500405'); expect((await c.get('availability', '0042500405')).ok).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(1); expect(c.requestsMade).toBe(1);
});
it.each([403, 429, 500])('stops after HTTP%s without reading or logging an error body', async status => {
  const text = vi.fn(async () => 'secret/raw upstream error');
  const fetcher = vi.fn(async () => ({ status, headers: new Headers(), text }) as unknown as Response);
  const result = await runMembershipDiagnostic(refs, client(fetcher));
  expect(result.requests).toBe(1); expect(fetcher).toHaveBeenCalledTimes(1); expect(text).not.toHaveBeenCalled();
  expect(result.results[0]).toMatchObject({ ok: false, httpStatus: status }); expect(JSON.stringify(result)).not.toContain('secret');
});
it('stops a HTTP200 plan_required envelope and omits its message', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: { code: 'plan_required', message: 'secret-url-or-key' } })));
  const result = await runMembershipDiagnostic(refs, client(fetcher)); expect(result.requests).toBe(1);
  expect(result.results[0]).toMatchObject({ ok: false, code: 'plan_required' }); expect(JSON.stringify(result)).not.toContain('secret-url-or-key');
});
it('never resets a smaller client budget and does not call an extra route', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify(body())));
  const result = await runMembershipDiagnostic(refs, client(fetcher, 1)); expect(result.requests).toBe(1); expect(fetcher).toHaveBeenCalledTimes(1);
});
it('stops immediately on a malformed successful body', async () => {
  const fetcher = vi.fn(async () => new Response('{}')); const result = await runMembershipDiagnostic(refs, client(fetcher));
  expect(result.requests).toBe(1); expect(fetcher).toHaveBeenCalledTimes(1);
});
it('noncooperative body cannot commit after timeout, and timers are cleaned', async () => {
  let resolve!: (text: string) => void;
  const text = new Promise<string>(r => { resolve = r; });
  const fetcher = vi.fn(async () => ({ status: 200, headers: new Headers(), text: () => text }) as Response);
  const c = client(fetcher); const pending = c.get('availability', '0042500405');
  await vi.advanceTimersByTimeAsync(8000); expect(await pending).toMatchObject({ ok: false, reason: 'provider-request-failed' });
  resolve(JSON.stringify(body())); await Promise.resolve();
  expect((await c.get('availability', '0042500155')).ok).toBe(false); expect(fetcher).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
});
it('stops before midnight without resetting allowance', async () => {
  vi.setSystemTime(new Date('2026-10-02T23:59:59Z'));
  const fetcher = vi.fn(async () => { vi.setSystemTime(new Date(expiry)); return new Response(JSON.stringify(body())); });
  const result = await runMembershipDiagnostic(refs, client(fetcher)); expect(result.requests).toBe(1); expect(result.results[0]).toMatchObject({ ok: false, reason: 'deadline-exhausted' });
});
it('fixed references are verified before any request', async () => {
  const fetcher = vi.fn(); const bad = structuredClone(refs); bad['0042500155'].away = 'NYK';
  await expect(runMembershipDiagnostic(bad, client(fetcher))).rejects.toThrow('reference'); expect(fetcher).not.toHaveBeenCalled();
});
