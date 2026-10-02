import { officialScheduleSeasonYear, type OfficialScheduleResult } from './recovery-official-schedule';
import type { ObservedFinalGame } from './observed-final-game';
import { canonicalIdentity, validateObservedFinalGame } from './observed-final-game';
import { selectRecoveryTargets } from './recovery-target-selection';
import type { RecoveryTarget } from './recovery-candidates';

export type ObservedRetries = Record<string, { retryAfter: string; reason: string }>;
export const OBSERVED_FAILURE_COOLDOWN_MS = 48 * 60 * 60 * 1000;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function readObservedRetries(raw: unknown): ObservedRetries {
  if (raw === undefined) return {};
  if (!record(raw) || Object.keys(raw).length > 10_000) throw new Error('Invalid observed-game retry state');
  const result: ObservedRetries = {};
  for (const [id, entry] of Object.entries(raw)) {
    if (!/^00[245]\d{7}$/.test(id) || !record(entry) || Object.keys(entry).sort().join(',') !== 'reason,retryAfter'
      || typeof entry.retryAfter !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(entry.retryAfter)
      || !Number.isFinite(Date.parse(entry.retryAfter)) || new Date(entry.retryAfter).toISOString() !== entry.retryAfter
      || typeof entry.reason !== 'string' || !/^[a-z][a-z0-9-]{0,119}$/.test(entry.reason)) throw new Error('Invalid observed-game retry entry');
    result[id] = { retryAfter: entry.retryAfter, reason: entry.reason };
  }
  return result;
}

const target = (row: ObservedFinalGame): RecoveryTarget => ({ nbaGameId: row.game.nbaGameId, season: row.game.season,
  gameDate: row.game.gameDate, lookupDates: row.game.lookupDates,
  home: { tricode: row.game.home.tricode, score: row.game.home.score }, away: { tricode: row.game.away.tricode, score: row.game.away.score } });

/** Current known finals precede observed older-season work, then legacy backfill.
 * Discovery failure never removes previously persisted, validated identities. */
export function planCurrentRecovery(input: {
  archive: unknown; observed: Readonly<Record<string, ObservedFinalGame>>; discovery: OfficialScheduleResult;
  currentSeason: string; existingIds: ReadonlySet<string>; historicalCursor: string | null;
  retries: ObservedRetries; now: string;
}) {
  const now = Date.parse(input.now);
  if (!Number.isFinite(now) || officialScheduleSeasonYear(input.currentSeason) === null) throw new Error('Invalid recovery queue context');
  const pool = new Map<string, ObservedFinalGame>(), conflicts = new Set<string>();
  for (const [id, raw] of Object.entries(input.observed)) {
    const value = validateObservedFinalGame(raw, now);
    if (!value || id !== value.game.nbaGameId) throw new Error('Invalid prior observed identity');
    pool.set(id, value);
  }
  if (input.discovery.status === 'ready' || input.discovery.status === 'empty') {
    if (input.discovery.season !== input.currentSeason) throw new Error('Discovery season mismatch');
    for (const game of input.discovery.games) {
      const value = validateObservedFinalGame({ version: 1, game, source: input.discovery.source }, now);
      if (!value) throw new Error('Invalid projected discovery');
      const prior = pool.get(game.nbaGameId);
      if (prior && canonicalIdentity(prior.game) !== canonicalIdentity(game)) conflicts.add(game.nbaGameId);
      else if (!prior) pool.set(game.nbaGameId, value);
    }
  }
  const identityOwners = new Map<string, Set<string>>();
  const keys = (value: ObservedFinalGame) => value.game.lookupDates.map(date => `${date}|${value.game.home.tricode}|${value.game.away.tricode}|${value.game.home.score}|${value.game.away.score}`);
  for (const [id, value] of pool) for (const key of keys(value)) { const owners = identityOwners.get(key) ?? new Set<string>(); owners.add(id); identityOwners.set(key, owners); }
  const eligible = [...pool.values()].filter(value => !input.existingIds.has(value.game.nbaGameId) && !conflicts.has(value.game.nbaGameId)
    && (!input.retries[value.game.nbaGameId] || Date.parse(input.retries[value.game.nbaGameId].retryAfter) <= now)
    && keys(value).every(key => identityOwners.get(key)!.size === 1));
  eligible.sort((a,b) => Number(b.game.season === input.currentSeason) - Number(a.game.season === input.currentSeason)
    || b.game.season.localeCompare(a.game.season) || b.game.gameDate.localeCompare(a.game.gameDate) || b.game.nbaGameId.localeCompare(a.game.nbaGameId));
  const chosen = eligible.slice(0,20);
  const historical = selectRecoveryTargets(input.archive, new Set([...input.existingIds, ...pool.keys()]), input.historicalCursor, 20).slice(0,20-chosen.length);
  return { targets: [...chosen.map(target), ...historical], observations: chosen, newObservationCount: chosen.filter(value => !Object.hasOwn(input.observed,value.game.nbaGameId)).length,
    observedIds: new Set(pool.keys()), historicalIds: new Set(historical.map(game=>game.nbaGameId)), conflicts: [...conflicts] };
}

export function updateObservedRetries(prior: ObservedRetries, result: { accepted: { game: { nbaGameId: string } }[]; rejected: {gameId:string;reason:string}[]; interrupted?: boolean; cursor?: string | null }, observedIds: ReadonlySet<string>, existingIds: ReadonlySet<string>, now: string): ObservedRetries {
  const at = Date.parse(now); if (!Number.isFinite(at)) throw new Error('Invalid retry time');
  const saved = new Set([...existingIds,...result.accepted.map(row=>row.game.nbaGameId)]);
  const next = Object.fromEntries(Object.entries(readObservedRetries(prior)).filter(([id])=>observedIds.has(id)&&!saved.has(id)));
  for (const [index, rejected] of result.rejected.entries()) {
    if (!observedIds.has(rejected.gameId) || saved.has(rejected.gameId) || (result.interrupted && index === result.rejected.length-1 && rejected.gameId !== result.cursor)) continue;
    if (!/^[a-z][a-z0-9-]{0,119}$/.test(rejected.reason)) throw new Error('Invalid classified retry reason');
    next[rejected.gameId] = { retryAfter: new Date(at + OBSERVED_FAILURE_COOLDOWN_MS).toISOString(), reason: rejected.reason };
  }
  return next;
}
