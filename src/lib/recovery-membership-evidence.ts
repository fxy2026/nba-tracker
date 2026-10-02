import { TEAM_META } from './teams';
import { isQuarantinedProviderIdentity } from './provider-identity-quarantine';
import type { RecoveredPlayerBox } from './recovered-player-box';

export type MembershipKind = 'availability' | 'lineups';
export const MEMBERSHIP_REQUEST_LIMIT = 2;
export const MEMBERSHIP_TARGETS = [
  { kind: 'availability', gameId: '0042500155' },
  { kind: 'lineups', gameId: '0042500155' },
] as const;
export function isMembershipRequest(kind: unknown, id: unknown): boolean {
  return MEMBERSHIP_TARGETS.some(target => target.kind === kind && target.gameId === id);
}
// Preserve the original evidence parser for the completed Finals reference.
// This does not authorize another transport request for that game.
function isSupportedMembershipEvidence(kind: unknown, id: unknown): boolean {
  return (kind === 'availability' && (id === '0042500405' || id === '0042500155')) ||
    (kind === 'lineups' && id === '0042500155');
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null) &&
  Reflect.ownKeys(v).every(k => typeof k === 'string' && 'value' in Object.getOwnPropertyDescriptor(v, k)!);
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const count = (v: unknown, max = 100): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max;
const name = (v: unknown): string | null => typeof v === 'string' && v.length <= 80 && /^[\p{L}\p{M} .’'\-]+$/u.test(v) && /\p{L}/u.test(v) ? v.trim() : null;
const normalize = (v: string) => v.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
const flag = (v: unknown) => v === true ? 'true' : v === false ? 'false' : v === undefined ? 'missing' : 'invalid';
const kindOf = (v: unknown) => v === undefined ? 'missing' : v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
function projected<T>(v: unknown, parse: (value: unknown) => T | null) {
  const value = parse(v);
  return { value, state: v === undefined ? 'missing' : v === null ? 'null' : value === null ? 'invalid' : 'valid', kind: kindOf(v) };
}
function projectBinding(raw: unknown, reference: RecoveredPlayerBox) {
  const game = object(raw) ? raw : {};
  const safeUuid = (v: unknown) => uuid(v) ? v.toLowerCase() : null;
  const knownTeams = new Set(Object.entries(TEAM_META).flatMap(([code, team]) => [code, `${team.city} ${team.name}`]));
  const side = (value: unknown) => {
    const row = object(value) ? value : {};
    return { kind: kindOf(value), teamId: projected(row.team_id, safeUuid),
      name: projected(row.name, v => typeof v === 'string' && knownTeams.has(v) ? v : null) };
  };
  const fields = {
    kind: kindOf(raw),
    gameId: projected(game.game_id, v => typeof v === 'string' && /^00[1-6]\d{7}$/.test(v) ? v : null),
    matchId: projected(game.match_id, safeUuid),
    gameDate: projected(game.game_date, v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v ? v : null),
    seasonYear: projected(game.season_year, v => typeof v === 'number' && Number.isSafeInteger(v) && v >= 1946 && v <= 2200 ? v : null),
    postseason: projected(game.postseason, v => typeof v === 'boolean' ? v : null),
    home: side(game.home), away: side(game.away),
  };
  const compare = (value: unknown, expected: unknown) => value === null ? 'unavailable' : value === expected ? 'matched' : 'mismatched';
  const checks = {
    gameId: compare(fields.gameId.value, reference.gameId), matchId: compare(fields.matchId.value, reference.providerMatchId),
    gameDate: compare(fields.gameDate.value, reference.gameDate), seasonYear: compare(fields.seasonYear.value, 2025),
    postseason: compare(fields.postseason.value, true),
    homeName: compare(fields.home.name.value, `${TEAM_META[reference.home].city} ${TEAM_META[reference.home].name}`),
    awayName: compare(fields.away.name.value, `${TEAM_META[reference.away].city} ${TEAM_META[reference.away].name}`),
    distinctTeamIds: fields.home.teamId.value === null || fields.away.teamId.value === null ? 'unavailable' :
      fields.home.teamId.value === fields.away.teamId.value ? 'mismatched' : 'matched',
  };
  return { fields, checks };
}
export function isMembershipReference(box: RecoveredPlayerBox): boolean {
  const expected = box.gameId === '0042500405'
    ? ['2026-06-13', 'SAS', 'NYK', 90, 94, '36043727-3dc2-4601-9138-5da8f10703c0', 21]
    : box.gameId === '0042500155'
      ? ['2026-04-28', 'SAS', 'POR', 114, 95, '2e7d2e6a-dfc0-44fa-8c55-ac3162aba730', 28] : null;
  return !!expected && box.season === '2025-26' &&
    [box.gameDate, box.home, box.away, box.homeScore, box.awayScore, box.providerMatchId, box.players.length].every((v, i) => v === expected[i]) &&
    box.players.every(p => name(p.name) !== null && [box.home, box.away].includes(p.team));
}

/** Diagnostic only. Never supplies a recovered snapshot, identity alias or DNP. */
export function diagnoseMembershipResponse(raw: unknown, kind: MembershipKind, reference: RecoveredPlayerBox) {
  if (!isSupportedMembershipEvidence(kind, reference.gameId) || !isMembershipReference(reference)) throw new Error('Invalid fixed membership reference');
  const issues = new Set<string>();
  const base = { kind, gameId: reference.gameId, diagnosticOnly: true, officialPromotion: false,
    expectedBinding: { gameId: reference.gameId, matchId: reference.providerMatchId, gameDate: reference.gameDate,
      seasonYear: 2025, postseason: true, home: reference.home, away: reference.away } } as const;
  const source = object(raw) ? raw : {};
  const sourceData = object(source.data) ? source.data : {};
  const shape = { envelope: kindOf(raw), data: kindOf(source.data), meta: kindOf(source.meta),
    home: { kind: kindOf(sourceData.home), count: Array.isArray(sourceData.home) ? sourceData.home.length : null },
    away: { kind: kindOf(sourceData.away), count: Array.isArray(sourceData.away) ? sourceData.away.length : null } };
  if (!object(raw) || !object(raw.data)) return { ...base, shape, status: 'malformed-envelope', issues: ['invalid-envelope'] };
  if (raw.error != null) return { ...base, status: 'provider-error', issues: ['provider-error-envelope'] };
  const data = raw.data, meta = object(raw.meta) ? raw.meta : {};
  const returnedBinding = kind === 'availability' ? projectBinding(data.game, reference) : null;
  if (!Array.isArray(data.home) || !Array.isArray(data.away) || data.home.length > 30 || data.away.length > 30) {
    return { ...base, shape, returnedBinding, status: 'malformed-envelope', issues: ['invalid-or-oversized-side-arrays'] };
  }
  let gameBinding = 'request-only';
  if (kind === 'availability') {
    gameBinding = Object.values(returnedBinding!.checks).every(value => value === 'matched') ? 'matched' : 'missing-or-mismatched';
    if (gameBinding !== 'matched') issues.add('game-identity-unconfirmed');
    if (meta.availability_available !== true) issues.add('availability-not-confirmed');
    if (meta.data_type !== 'post_game_participation') issues.add('unexpected-data-type');
    if (!count(meta.players_unassigned, 60)) issues.add('unknown-unassigned-count');
    else if (meta.players_unassigned !== 0) issues.add('unassigned-players');
  }
  const identities = new Map<string, string>();
  const names = new Set<string>();
  const matchedNames = new Set<string>();
  const players = (['home', 'away'] as const).flatMap(side => {
    const expectedTeam = reference[side];
    return (data[side] as unknown[]).map((value, index) => {
      const row = object(value) ? value : {};
      const playerName = name(row.name), id = uuid(row.player_id) ? row.player_id.toLowerCase() : null;
      if (!playerName) issues.add('unsafe-or-missing-player-name');
      if (!id) issues.add(row.player_id === null ? 'unbridged-player-id' : 'invalid-player-id');
      if (id && identities.has(id)) issues.add(identities.get(id) === side ? 'duplicate-player-id' : 'cross-side-player-id');
      if (id) identities.set(id, side);
      if (playerName && names.has(normalize(playerName))) issues.add('duplicate-player-name');
      if (playerName) names.add(normalize(playerName));
      const original = playerName ? reference.players.find(p => normalize(p.name) === normalize(playerName)) : undefined;
      const referenceMatch = !original ? 'not-found' : original.team === expectedTeam ? 'name-and-side' : 'wrong-side';
      if (referenceMatch !== 'name-and-side') issues.add(referenceMatch === 'wrong-side' ? 'reference-side-mismatch' : 'unknown-reference-name');
      else matchedNames.add(normalize(original!.name));
      const identityMatch = !original ? 'unknown' : original.providerPlayerId == null ? 'independent-official-row' :
        id === original.providerPlayerId.toLowerCase() ? 'same' : 'different';
      if (identityMatch === 'different') issues.add('reference-player-id-mismatch');
      if (identityMatch === 'independent-official-row') issues.add('official-row-provider-identity-unverified');
      if (id && reference.players.some(p => p.providerPlayerId?.toLowerCase() === id && (!playerName || normalize(p.name) !== normalize(playerName)))) issues.add('uuid-name-conflict');
      const quarantined = isQuarantinedProviderIdentity(id, playerName);
      if (quarantined) issues.add('quarantined-player-identity');
      const minutesRounded = kind === 'availability' && count(row.min_played) ? row.min_played : null;
      const played = kind === 'availability' && typeof row.played === 'boolean' ? row.played : null;
      const starter = typeof row.starter === 'boolean' ? row.starter : null;
      if (kind === 'availability' && (minutesRounded === null || played !== true)) issues.add('participation-not-confirmed');
      if (original && kind === 'availability' && minutesRounded !== original.minutes) issues.add('reference-rounded-minutes-differ');
      if (original && starter !== null && starter !== original.starter) issues.add('reference-starter-differs');
      if (starter === null) issues.add('unknown-starter');
      if (row.starter !== null && typeof row.starter !== 'boolean') issues.add('invalid-starter');
      return { side, expectedTeam, index, providerPlayerId: id, name: playerName, minutesRounded, played, starter,
        referenceName: original?.name ?? null, nameComparison: !original ? 'none' : playerName === original.name ? 'exact' : 'case-or-accent-only',
        identityAliasEstablished: false, referenceMatch, identityMatch, quarantined };
    });
  });
  const missingReferencePlayers = reference.players.filter(p => !matchedNames.has(normalize(p.name)))
    .map(p => ({ name: p.name, team: p.team, minutesRounded: p.minutes }));
  if (missingReferencePlayers.length) issues.add('missing-reference-players');
  return { ...base, shape, status: issues.size ? 'differences-or-unavailable' : 'comparison-complete', gameBinding, returnedBinding,
    meaning: kind === 'availability' ? 'post-game-participation-not-dnp-classification' : 'lineup-roster-not-played-coverage',
    availability: flag(meta.availability_available), playersUnassigned: count(meta.players_unassigned, 60) ? meta.players_unassigned : null,
    counts: { home: data.home.length, away: data.away.length, reference: reference.players.length },
    issues: [...issues], players, missingReferencePlayers };
}
