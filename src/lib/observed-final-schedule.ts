import { TEAM_META } from './teams';
import { validateObservedFinalGame } from './observed-final-game';

// Minimal structural shape keeps build tools independent of API imports and generated JSON.
interface ObservedScheduleTeam { teamId:number; teamTricode:string; teamName:string; teamCity:string; teamSlug:string; score:number; wins?:number; losses?:number; seed?:number }
interface ObservedScheduleGame { gameId:string; gameStatus:number; gameStatusText:string; gameCode:string; gameDateTimeUTC:string; homeTeam:ObservedScheduleTeam; awayTeam:ObservedScheduleTeam }
interface ObservedScheduleDate { gameDate:string; games:ObservedScheduleGame[] }

export function observedFinalsToSchedule(records: unknown): ObservedScheduleDate[] {
  if (!records || typeof records !== 'object' || Array.isArray(records)) throw new Error('Invalid observed schedule index');
  const days = new Map<string, ObservedScheduleGame[]>();
  for (const [id, raw] of Object.entries(records)) {
    const value = validateObservedFinalGame(raw);
    if (!value || value.game.nbaGameId !== id) throw new Error('Invalid observed schedule identity');
    const game = value.game;
    const team = (side: typeof game.home) => ({ teamId: side.teamId, teamTricode: side.tricode,
      teamCity: TEAM_META[side.tricode].city, teamName: TEAM_META[side.tricode].name, teamSlug: '', score: side.score });
    const games = days.get(game.gameDate) ?? [];
    games.push({ gameId: id, gameStatus: 3, gameStatusText: 'Final', gameCode: game.gameCode,
      gameDateTimeUTC: game.gameDateTimeUTC, homeTeam: team(game.home), awayTeam: team(game.away) });
    days.set(game.gameDate, games);
  }
  return [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, games]) => ({
    gameDate: `${date.slice(5,7)}/${date.slice(8,10)}/${date.slice(0,4)} 00:00:00`,
    games: games.sort((a,b) => a.gameDateTimeUTC.localeCompare(b.gameDateTimeUTC) || a.gameId.localeCompare(b.gameId)),
  }));
}

/** Live/baked existing identities win. Stored final IDs fill only missing games,
 * including a missing game on a date that already exists in the live feed. */
export function mergeObservedFinalSchedule(existing: ObservedScheduleDate[], stored: ObservedScheduleDate[]): ObservedScheduleDate[] {
  if (!stored.length) return existing;
  const seen = new Set(existing.flatMap(day => day.games.map(game => game.gameId)));
  const byDate = new Map<string, ObservedScheduleDate>();
  for (const day of existing) { const key=day.gameDate.slice(0,10), prior=byDate.get(key); if(prior)prior.games.push(...day.games);else byDate.set(key,{...day,games:[...day.games]}); }
  for (const day of stored) {
    const key = day.gameDate.slice(0,10), target = byDate.get(key) ?? { ...day, games: [] };
    for (const game of day.games) if (!seen.has(game.gameId)) { target.games.push(game); seen.add(game.gameId); }
    if (target.games.length) byDate.set(key, target);
  }
  return [...byDate.values()].sort((a,b) => Date.parse(a.gameDate) - Date.parse(b.gameDate));
}
