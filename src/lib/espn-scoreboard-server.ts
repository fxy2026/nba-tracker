import 'server-only';
import { offsetCalendarDate } from './calendar-date';
import { validCalendarDate, validTimeZone } from './planned-fixtures';
import { createZonedCalendarDate } from './zoned-calendar-date';
import { ESPN_TEAM_TRICODES, validEspnGameUrl, normalizeEspnScoreboardView, type EspnScoreGame, type EspnScoreTeam, type EspnScoreboardView } from './espn-scoreboard';

const ET = 'America/New_York';
const MAX_BYTES = 2 * 1024 * 1024;
/** Find calendar boundaries, rather than assuming every day lasts 24 hours.
 * Lower-bound search also handles zones whose DST transition skips midnight. */
export function localDayUtcWindow(date: string, timeZone: string): { start: number; end: number; datesET: string[] } {
  if (!validCalendarDate(date) || !validTimeZone(timeZone) || date < '1900-01-01' || date > '2200-12-30') throw new RangeError('Invalid scoreboard date');
  const localDate = createZonedCalendarDate(timeZone), center = Date.parse(`${date}T00:00:00Z`);
  const boundary = (key: string) => {
    let low = center - 48 * 3600000, high = center + 72 * 3600000;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (localDate(new Date(middle).toISOString()) < key) low = middle + 1; else high = middle;
    }
    return low;
  };
  const start = boundary(date), end = boundary(offsetCalendarDate(date, 1));
  const datesET: string[] = [], etDate = createZonedCalendarDate(ET);
  if (start < end) {
    const last = etDate(new Date(end - 1).toISOString());
    for (let key = etDate(new Date(start).toISOString()); key <= last; key = offsetCalendarDate(key, 1)) {
      if (datesET.length >= 3) throw new RangeError('Unbounded scoreboard window');
      datesET.push(key);
    }
  }
  return { start, end, datesET };
}
function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(value: unknown, max: number): value is string { return typeof value === 'string' && !!value.trim() && value.length <= max; }
function parseGame(value: unknown): EspnScoreGame | null {
  const event = record(value), season = record(event?.season), status = record(event?.status), type = record(status?.type);
  if (!event || !text(event.id, 15) || !/^\d+$/.test(event.id) || !text(event.date, 40) || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(event.date) || !Number.isFinite(Date.parse(event.date))
    || !season || !Number.isInteger(season.year) || Number(season.year) < 1900 || Number(season.year) > 2201 || ![1, 2, 3].includes(Number(season.type)) || typeof season.type !== 'number'
    || !type || !Array.isArray(event.competitions) || event.competitions.length !== 1) return null;
  let state: EspnScoreGame['status'];
  if (type.name === 'STATUS_FINAL' && type.state === 'post' && type.completed === true) state = 'final';
  else if (type.state === 'in' && type.completed === false) state = 'live';
  else if (type.name === 'STATUS_SCHEDULED' && type.state === 'pre' && type.completed === false) state = 'scheduled';
  else if (type.name === 'STATUS_POSTPONED') state = 'postponed';
  else if (type.name === 'STATUS_CANCELED') state = 'canceled';
  else return null;
  const competition = record(event.competitions[0]);
  if (!competition || competition.id !== event.id || !Array.isArray(competition.competitors) || competition.competitors.length !== 2) return null;
  const competitors = competition.competitors.map(record);
  function team(side: 'home' | 'away'): EspnScoreTeam | null {
    const candidates = competitors.filter(c => c?.homeAway === side);
    if (candidates.length !== 1) return null;
    const competitor = candidates[0]!, t = record(competitor.team);
    if (!t || !text(t.id, 15) || !/^\d+$/.test(t.id) || competitor.id !== t.id || !text(t.displayName, 100) || !text(t.abbreviation, 15)) return null;
    const score = ['live', 'final'].includes(state) ? typeof competitor.score === 'string' && /^\d{1,4}$/.test(competitor.score) ? Number(competitor.score) : NaN : null;
    if (score !== null && (!Number.isInteger(score) || score > 1000)) return null;
    return { id: t.id, name: t.displayName, abbreviation: t.abbreviation, tricode: ESPN_TEAM_TRICODES[t.id] ?? null, score };
  }
  const home = team('home'), away = team('away');
  if (!home || !away || home.id === away.id) return null;
  const links = Array.isArray(event.links) ? event.links.map(record) : [];
  const sourceUrl = links.find(link => Array.isArray(link?.rel) && link.rel.includes('summary') && validEspnGameUrl(link.href, event.id as string))?.href as string | undefined;
  const statusText = text(type.shortDetail, 150) ? type.shortDetail : state;
  return { source: 'espn', eventId: event.id, key: `espn:${event.id}`, tipoffUTC: new Date(event.date).toISOString(), seasonYear: Number(season.year), seasonType: season.type as 1 | 2 | 3, status: state, statusText, home, away, sourceUrl: sourceUrl ?? null };
}
/** Reject an incomplete or malformed payload, rather than advertising it as a
 * valid empty/partial day. Every returned event must belong to the queried ET date. */
export function parseEspnScoreboard(value: unknown, dateET: string): EspnScoreGame[] | null {
  const body = record(value);
  if (!body || !Array.isArray(body.events) || body.events.length > 50) return null;
  const etDate = createZonedCalendarDate(ET), games = new Map<string, EspnScoreGame>();
  for (const event of body.events) {
    const game = parseGame(event);
    if (!game || etDate(game.tipoffUTC) !== dateET) return null;
    const previous = games.get(game.key);
    if (previous && JSON.stringify(previous) !== JSON.stringify(game)) return null;
    games.set(game.key, game);
  }
  return [...games.values()];
}
async function loadDate(dateET: string, signal: AbortSignal): Promise<EspnScoreGame[]> {
  // Ordinary public GET; no credentials, alternate hosts, or anti-bot retries.
  const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateET.replaceAll('-', '')}&limit=100`, {
    headers: { Accept: 'application/json' }, cache: 'no-store', redirect: 'error', signal,
  });
  if (!response.ok || Number(response.headers.get('content-length')) > MAX_BYTES || !response.body) throw new Error('ESPN unavailable');
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (signal.aborted) throw new Error('ESPN deadline');
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) throw new Error('ESPN response too large');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const games = parseEspnScoreboard(JSON.parse(new TextDecoder().decode(bytes)), dateET);
  if (!games) throw new Error('Invalid ESPN scoreboard');
  return games;
}
export async function getEspnDailyScoreboard(date: string, timeZone: string, canonicalDatesET: string[] = [], parentSignal?: AbortSignal): Promise<EspnScoreboardView> {
  const base = { source: 'espn' as const, date, timeZone, retrievedAtUTC: new Date().toISOString() };
  const unavailable: EspnScoreboardView = { ...base, state: 'unavailable', games: [] };
  if (parentSignal?.aborted) return unavailable;
  const controller = new AbortController(), abort = () => controller.abort();
  parentSignal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 5000);
  try {
    const { start, end, datesET } = localDayUtcWindow(date, timeZone);
    const dates = datesET.filter(key => !canonicalDatesET.includes(key));
    const all = await Promise.all(dates.map(key => loadDate(key, controller.signal)));
    if (controller.signal.aborted) return unavailable;
    const games = all.flat().filter(game => Date.parse(game.tipoffUTC) >= start && Date.parse(game.tipoffUTC) < end).sort((a, b) => a.tipoffUTC.localeCompare(b.tipoffUTC) || a.eventId.localeCompare(b.eventId));
    return normalizeEspnScoreboardView({ ...base, state: 'ready', games }, date, timeZone) ?? unavailable;
  } catch { controller.abort(); return unavailable; }
  finally { clearTimeout(timer); parentSignal?.removeEventListener('abort', abort); }
}
