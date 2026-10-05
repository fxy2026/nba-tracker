import { validCalendarDate, validTimeZone } from './planned-fixtures';
import { createZonedCalendarDate } from './zoned-calendar-date';
import { TEAM_META } from './teams';

/** Provider-native scores are deliberately not ScheduleGame/NbaGame records. */
export interface EspnScoreTeam {
  id: string;
  name: string;
  abbreviation: string;
  tricode: string | null;
  score: number | null;
}
export interface EspnScoreGame {
  source: 'espn';
  eventId: string;
  key: string;
  tipoffUTC: string;
  seasonYear: number;
  seasonType: 1 | 2 | 3;
  status: 'scheduled' | 'live' | 'final' | 'postponed' | 'canceled';
  statusText: string;
  home: EspnScoreTeam;
  away: EspnScoreTeam;
  sourceUrl: string | null;
}
export interface EspnScoreboardView {
  source: 'espn';
  state: 'ready' | 'unavailable';
  date: string;
  timeZone: string;
  retrievedAtUTC: string;
  games: EspnScoreGame[];
}
export const ESPN_TEAM_TRICODES: Record<string, string> = {
  '1': 'ATL', '2': 'BOS', '17': 'BKN', '30': 'CHA', '4': 'CHI', '5': 'CLE', '6': 'DAL', '7': 'DEN',
  '8': 'DET', '9': 'GSW', '10': 'HOU', '11': 'IND', '12': 'LAC', '13': 'LAL', '29': 'MEM', '14': 'MIA',
  '15': 'MIL', '16': 'MIN', '3': 'NOP', '18': 'NYK', '25': 'OKC', '19': 'ORL', '20': 'PHI', '21': 'PHX',
  '22': 'POR', '23': 'SAC', '24': 'SAS', '28': 'TOR', '26': 'UTA', '27': 'WAS',
};
export function validEspnGameUrl(value: unknown, id: string): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'www.espn.com' && !url.port && !url.username && !url.password
      && !url.search && !url.hash && new RegExp(`^/nba/game/_/gameId/${id}(?:/[a-z0-9-]+)?$`).test(url.pathname);
  } catch { return false; }
}
export function normalizeEspnScoreboardView(value: unknown, date: string, timeZone: string): EspnScoreboardView | null {
  if (!value || typeof value !== 'object' || !validCalendarDate(date) || !validTimeZone(timeZone)) return null;
  const v = value as EspnScoreboardView;
  if (v.source !== 'espn' || !['ready', 'unavailable'].includes(v.state) || v.date !== date || v.timeZone !== timeZone
    || !Array.isArray(v.games) || v.games.length > 50 || !Number.isFinite(Date.parse(v.retrievedAtUTC))
    || (v.state === 'unavailable' && v.games.length > 0)) return null;
  const keys = new Set<string>(), localDate = createZonedCalendarDate(timeZone);
  for (const game of v.games) {
    if (!game || game.source !== 'espn' || !/^\d{1,15}$/.test(game.eventId) || game.key !== `espn:${game.eventId}` || keys.has(game.key)
      || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(game.tipoffUTC) || !Number.isFinite(Date.parse(game.tipoffUTC)) || localDate(game.tipoffUTC) !== date
      || !Number.isInteger(game.seasonYear) || ![1, 2, 3].includes(game.seasonType)
      || !['scheduled', 'live', 'final', 'postponed', 'canceled'].includes(game.status) || typeof game.statusText !== 'string' || game.statusText.length > 150
      || (game.sourceUrl !== null && !validEspnGameUrl(game.sourceUrl, game.eventId))) return null;
    if (!game.home || !game.away || game.home.id === game.away.id) return null;
    for (const team of [game.home, game.away]) {
      if (!/^\d{1,15}$/.test(team.id) || typeof team.name !== 'string' || !team.name.trim() || team.name.length > 100
        || typeof team.abbreviation !== 'string' || !team.abbreviation || team.abbreviation.length > 15
        || team.tricode !== (ESPN_TEAM_TRICODES[team.id] ?? null) || (team.tricode !== null && !Object.hasOwn(TEAM_META, team.tricode))
        || (['live', 'final'].includes(game.status) ? !Number.isInteger(team.score) || team.score! < 0 || team.score! > 1000 : team.score !== null)) return null;
    }
    keys.add(game.key);
  }
  return v;
}
