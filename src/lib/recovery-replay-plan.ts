import { buildStoredSnapshotIndex, assertObservedIdentityReferences } from '../../scripts/recovery/snapshot-store';
import type { readStoredArchives } from '../../scripts/recovery/snapshot-store';
import { canonicalIdentity, validateObservedFinalGame, type ObservedFinalGame } from './observed-final-game';
import { validateProviderPlayerSnapshot } from './provider-player-snapshot';
import { isQuarantinedProviderIdentity } from './provider-identity-quarantine';
import type { ProviderBasicSnapshot, ProviderPlayerLine } from './provider-player-normalizer';
import type { RecoveryManifestGame } from './recovery-manifest';
import { TEAM_META } from './teams';

export type RecoveryReplayArchives = ReturnType<typeof readStoredArchives>;
export interface RecoveryReplayInput {
  /** The caller has verified the bundle hashes, original run ID and base SHA. */
  pending: { snapshots: readonly unknown[]; observations: readonly unknown[] };
  /** Must come from readStoredArchives at the fresh, exact master commit. This
   * includes verification of stronger, quarantine and resolved-original history. */
  latest: RecoveryReplayArchives;
  schedule: unknown;
  now: number;
}
export type RecoveryReplayAddition =
  | { path: `src/data/provider-player-boxes/${string}.json`; kind: 'snapshot'; gameId: string; value: ProviderBasicSnapshot }
  | { path: `src/data/observed-final-games/${string}.json`; kind: 'observation'; gameId: string; value: ObservedFinalGame };
export type RecoveryReplayIdentical = Pick<RecoveryReplayAddition, 'path' | 'kind' | 'gameId'>;
export type RecoveryReplayFailure = 'invalid-batch' | 'invalid-latest' | 'invalid-schedule'
  | 'protected-game' | 'same-id-conflict' | 'provider-id-conflict' | 'missing-official-identity' | 'official-identity-conflict';
export type RecoveryReplayPlan = { ok: true; additions: RecoveryReplayAddition[]; identical: RecoveryReplayIdentical[] }
  | { ok: false; reason: RecoveryReplayFailure };

const fields: readonly (keyof ProviderPlayerLine)[] = ['providerPlayerId','name','team','minutesRounded','points','rebounds','assists','fieldGoalsMade','fieldGoalsAttempted','threePointersMade','threePointersAttempted','freeThrowsMade','freeThrowsAttempted','offensiveRebounds','defensiveRebounds','steals','blocks','turnovers','fouls','plusMinus','starter'];
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const same = (a: unknown, b: unknown) => canonicalIdentity(a) === canonicalIdentity(b);
function jsonData(value: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype || Reflect.ownKeys(value).length !== value.length + 1) return false;
    for (let i = 0; i < value.length; i++) {
      const entry = Object.getOwnPropertyDescriptor(value, String(i));
      if (!entry || !('value' in entry) || !jsonData(entry.value, depth + 1)) return false;
    }
    return true;
  }
  return record(value) && Reflect.ownKeys(value).every(key => {
    const entry = Object.getOwnPropertyDescriptor(value, key)!;
    return typeof key === 'string' && 'value' in entry && jsonData(entry.value, depth + 1);
  });
}
const reject = (reason: RecoveryReplayFailure): RecoveryReplayPlan => ({ ok: false, reason });

function snapshot(raw: unknown): ProviderBasicSnapshot | null {
  if (!jsonData(raw)) return null;
  const valid = validateProviderPlayerSnapshot(raw);
  if (!valid || valid.players.length > 100) return null;
  const ids = new Set<string>();
  for (const player of valid.players) {
    if (player.name.length > 120 || /[\u0000-\u001f\u007f]/.test(player.name)
      || isQuarantinedProviderIdentity(player.providerPlayerId, player.name)) return null;
    if (player.providerPlayerId !== null) {
      const id = player.providerPlayerId.toLowerCase();
      if (ids.has(id)) return null;
      ids.add(id);
    }
  }
  // Only the existing normalized player contract may leave the bundle. Unknown
  // fields are refused, not silently stripped into a different saved snapshot.
  const value = { ...valid, players: valid.players.map(player => Object.fromEntries(fields.map(key => [key, player[key]])) as unknown as ProviderPlayerLine) };
  return same(raw, value) ? value : null;
}

function sameGame(a: RecoveryManifestGame, b: ObservedFinalGame['game']) {
  return a.nbaGameId === b.nbaGameId && a.season === b.season && a.gameDate === b.gameDate
    && a.home.tricode === b.home.tricode && a.away.tricode === b.away.tricode
    && a.home.score === b.home.score && a.away.score === b.away.score;
}
function matchesArchive(game: RecoveryManifestGame | ObservedFinalGame['game'], raw: Record<string, unknown>) {
  return raw.gameId === game.nbaGameId && raw.gameStatus === 3
    && raw.gameCode === `${game.gameDate.replaceAll('-', '')}/${game.away.tricode}${game.home.tricode}`
    && record(raw.homeTeam) && record(raw.awayTeam)
    && raw.homeTeam.teamId === TEAM_META[game.home.tricode].teamId && raw.awayTeam.teamId === TEAM_META[game.away.tricode].teamId
    && raw.homeTeam.teamTricode === game.home.tricode && raw.awayTeam.teamTricode === game.away.tricode
    && raw.homeTeam.score === game.home.score && raw.awayTeam.score === game.away.score;
}

/** Pure preflight only. No filesystem, clock, network, state/cursor or writes.
 * Even one conflict returns no additions. The caller writes only a successful
 * complete plan, in its fresh worktree, after checking validator-code closure. */
export function planRecoveryReplay(input: RecoveryReplayInput): RecoveryReplayPlan {
  try {
    const { pending, latest, schedule, now } = input;
    if (!Number.isFinite(now) || !Array.isArray(pending.snapshots) || !Array.isArray(pending.observations)
      || pending.snapshots.length > 20 || pending.observations.length > 20
      || pending.snapshots.length + pending.observations.length < 1) return reject('invalid-batch');
    if (!record(latest.generic) || !record(latest.verified) || !record(latest.quarantined) || !record(latest.observed)) return reject('invalid-latest');
    let index: ReturnType<typeof buildStoredSnapshotIndex>;
    try {
      index = buildStoredSnapshotIndex(latest.generic, latest.verified, latest.quarantined);
      for (const [id, value] of Object.entries(latest.generic)) if (validateProviderPlayerSnapshot(value)?.game.nbaGameId !== id) return reject('invalid-latest');
      for (const [id, value] of Object.entries(latest.observed)) if (validateObservedFinalGame(value, now)?.game.nbaGameId !== id) return reject('invalid-latest');
    } catch { return reject('invalid-latest'); }
    if (!record(schedule) || schedule.seasonYear !== '2025' || !Array.isArray(schedule.dates)) return reject('invalid-schedule');
    // The trusted legacy archive also contains nine-prefixed synthetic IDs.
    // Retain them as references; only validated canonical incoming IDs can be replayed.
    const archived = new Map<string, Record<string, unknown>>();
    for (const day of schedule.dates) {
      if (!record(day) || !Array.isArray(day.games)) return reject('invalid-schedule');
      for (const game of day.games) {
        if (!record(game) || typeof game.gameId !== 'string' || !/^\d{10}$/.test(game.gameId) || archived.has(game.gameId)) return reject('invalid-schedule');
        archived.set(game.gameId, game);
      }
    }
    const snapshots: ProviderBasicSnapshot[] = [], observations: ObservedFinalGame[] = [];
    const snapshotIds = new Set<string>(), observationIds = new Set<string>(), incomingOwners = new Set<string>();
    for (const raw of pending.snapshots) {
      const value = snapshot(raw);
      if (!value || snapshotIds.has(value.game.nbaGameId)) return reject('invalid-batch');
      const uuid = value.game.providerMatchId.toLowerCase();
      if (incomingOwners.has(uuid)) return reject('provider-id-conflict');
      snapshotIds.add(value.game.nbaGameId); incomingOwners.add(uuid); snapshots.push(value);
    }
    for (const raw of pending.observations) {
      const value = jsonData(raw) ? validateObservedFinalGame(raw, now) : null;
      if (!value || observationIds.has(value.game.nbaGameId) || !same(raw, value)) return reject('invalid-batch');
      observationIds.add(value.game.nbaGameId); observations.push(value);
    }
    const additions: RecoveryReplayAddition[] = [], identical: RecoveryReplayIdentical[] = [];
    const observed = { ...latest.observed };
    for (const value of observations) {
      const gameId = value.game.nbaGameId;
      if (index.protectedIds.has(gameId)) return reject('protected-game');
      const path = `src/data/observed-final-games/${gameId}.json` as const;
      if (observed[gameId]) {
        if (!same(observed[gameId], value)) return reject('same-id-conflict');
        identical.push({ path, kind: 'observation', gameId });
      } else {
        observed[gameId] = value; additions.push({ path, kind: 'observation', gameId, value });
      }
    }
    for (const value of snapshots) {
      const gameId = value.game.nbaGameId, owner = index.existingMatches.get(value.game.providerMatchId.toLowerCase());
      if (index.protectedIds.has(gameId)) return reject('protected-game');
      if (owner !== undefined && owner !== gameId) return reject('provider-id-conflict');
      const prior = latest.generic[gameId], path = `src/data/provider-player-boxes/${gameId}.json` as const;
      if (prior) {
        if (!same(prior, value)) return reject('same-id-conflict');
        identical.push({ path, kind: 'snapshot', gameId });
      } else additions.push({ path, kind: 'snapshot', gameId, value });
      const official = observed[gameId], reference = archived.get(gameId);
      // New seasons need an actual saved/paired typed official observation. The
      // historical 2025-26 archive is the only legacy reference exception.
      if (!official && !(value.game.season === '2025-26' && reference)) return reject('missing-official-identity');
      if ((official && !sameGame(value.game, official.game)) || (reference && !matchesArchive(value.game, reference))) return reject('official-identity-conflict');
    }
    try {
      assertObservedIdentityReferences(observed, schedule, { ...latest.generic, ...Object.fromEntries(snapshots.map(value => [value.game.nbaGameId, value])) });
    } catch { return reject('official-identity-conflict'); }
    for (const value of observations) {
      const reference = archived.get(value.game.nbaGameId);
      if (reference && !matchesArchive(value.game, reference)) return reject('official-identity-conflict');
      if (Object.values(observed).some(other => other.game.nbaGameId !== value.game.nbaGameId && other.game.gameCode === value.game.gameCode)
        || [...archived.values()].some(other => other.gameId !== value.game.nbaGameId && other.gameCode === value.game.gameCode)) return reject('official-identity-conflict');
    }
    return { ok: true, additions, identical };
  } catch { return reject('invalid-batch'); }
}
