import { projectOfficialRecoverySchedule, type OfficialFinishedGame, type OfficialScheduleSource } from './recovery-official-schedule';

export interface ObservedFinalGame { version: 1; game: OfficialFinishedGame; source: OfficialScheduleSource }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  && Reflect.ownKeys(value).every(key => typeof key === 'string' && 'value' in Object.getOwnPropertyDescriptor(value, key)!);
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).sort().join(',') === keys.sort().join(',');
export const canonicalIdentity = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);

/** Persisted observed finals do not expire with a network cache. Validate using
 * their actual observation instant, while rejecting future capture metadata. */
export function validateObservedFinalGame(raw: unknown, now = Date.now()): ObservedFinalGame | null {
  try {
    if (!record(raw) || !exact(raw, ['version','game','source']) || raw.version !== 1 || !record(raw.game) || !record(raw.source)
      || !exact(raw.source, ['url','sha256','observedAt']) || typeof raw.source.observedAt !== 'string'
      || !Number.isFinite(now) || Date.parse(raw.source.observedAt) > now) return null;
    const game = raw.game;
    if (!exact(game, ['nbaGameId','season','phase','gameCode','gameDate','gameDateTimeUTC','utcDate','lookupDates','home','away'])
      || typeof game.season !== 'string' || !record(game.home) || !record(game.away)
      || !exact(game.home, ['teamId','tricode','score']) || !exact(game.away, ['teamId','tricode','score'])) return null;
    const projected = projectOfficialRecoverySchedule({ leagueSchedule: { seasonYear: game.season, gameDates: [{ games: [{
      gameId: game.nbaGameId, gameStatus: 3, gameCode: game.gameCode, gameDateTimeUTC: game.gameDateTimeUTC,
      homeTeam: { teamId: game.home.teamId, teamTricode: game.home.tricode, score: game.home.score },
      awayTeam: { teamId: game.away.teamId, teamTricode: game.away.tricode, score: game.away.score },
    }] }] } }, { expectedSeason: game.season, now: raw.source.observedAt, source: raw.source as unknown as OfficialScheduleSource });
    if (projected.status !== 'ready' || projected.games.length !== 1 || canonicalIdentity(projected.games[0]) !== canonicalIdentity(game)) return null;
    return { version: 1, game: projected.games[0], source: projected.source };
  } catch { return null; }
}

export function planObservedFinalAdditions(existing: Readonly<Record<string, ObservedFinalGame>>, incoming: readonly ObservedFinalGame[], now = Date.now()) {
  if (incoming.length > 20) throw new Error('Official observation batch exceeds target cap');
  const additions: ObservedFinalGame[] = [], conflicts: string[] = [], seen = new Set<string>();
  for (const raw of incoming) {
    const value = validateObservedFinalGame(raw, now);
    if (!value || seen.has(value.game.nbaGameId)) throw new Error('Invalid official observation batch');
    const id = value.game.nbaGameId; seen.add(id);
    const prior = existing[id];
    if (prior) { if (canonicalIdentity(prior.game) !== canonicalIdentity(value.game)) conflicts.push(id); }
    else additions.push(value);
  }
  return { additions, conflicts };
}
