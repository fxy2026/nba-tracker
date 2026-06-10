// NBA Official CDN API — completely free, no key needed
// Data source: cdn.nba.com

import { playerHeadshotUrl } from "@/lib/teamUrls";

const CDN_BASE = "https://cdn.nba.com/static/json";
const HEADERS: HeadersInit = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  Referer: "https://www.nba.com/",
};

// ========== Types ==========

export interface NbaTeam {
  teamId: number;
  teamTricode: string;
  teamName: string;
  teamCity: string;
  teamSlug: string;
  score: number;
  wins: number;
  losses: number;
  seed: number;
  periods?: PeriodScore[];
}

// Featured performer per team from the live scoreboard feed — each team's top
// player with PTS/REB/AST. personId is 0 until the game tips off.
export interface GameLeader {
  personId: number;
  name: string;
  teamTricode: string;
  points: number;
  rebounds: number;
  assists: number;
}

// Game-high scorer entries from the cached schedule (finished games on past
// dates). Multiple entries when tied; points only — no rebounds/assists here.
export interface PointsLeader {
  personId: number;
  firstName: string;
  lastName: string;
  teamId: number;
  teamTricode: string;
  points: number;
}

export interface NbaGame {
  gameId: string;
  gameCode: string;
  gameStatus: number; // 1=scheduled, 2=in progress, 3=final
  gameStatusText: string;
  homeTeam: NbaTeam;
  awayTeam: NbaTeam;
  gameEt: string;
  gameTimeUTC: string;
  seriesText?: string;
  ifNecessary?: boolean;
  gameLeaders?: { homeLeaders?: GameLeader; awayLeaders?: GameLeader };
}

export interface PlayerStats {
  personId: number;
  name: string;
  nameI: string;
  position: string;
  jerseyNum: string;
  starter: string; // "1" or "0"
  oncourt: string;
  played: string;
  statistics: {
    minutes: string;
    points: number;
    reboundsTotal: number;
    reboundsOffensive: number;
    reboundsDefensive: number;
    assists: number;
    steals: number;
    blocks: number;
    turnovers: number;
    foulsPersonal: number;
    fieldGoalsMade: number;
    fieldGoalsAttempted: number;
    fieldGoalsPercentage: number;
    threePointersMade: number;
    threePointersAttempted: number;
    threePointersPercentage: number;
    freeThrowsMade: number;
    freeThrowsAttempted: number;
    freeThrowsPercentage: number;
    plusMinusPoints: number;
  };
}

export interface PeriodScore {
  period: number;
  periodType: string;
  score: number;
}

export interface BoxScoreTeam {
  teamId: number;
  teamTricode: string;
  teamName: string;
  teamCity: string;
  score: number;
  players: PlayerStats[];
  statistics: Record<string, number>;
  periods: PeriodScore[];
}

export interface BoxScore {
  gameId: string;
  gameCode: string;
  gameStatus: number;
  gameStatusText: string;
  gameTimeUTC: string;
  arena: { arenaName: string; arenaCity: string; arenaState: string };
  homeTeam: BoxScoreTeam;
  awayTeam: BoxScoreTeam;
}

export interface ShotAction {
  personId: number;
  playerNameI: string;
  teamTricode: string;
  period: number;
  clock: string;
  actionType: string;
  subType: string;
  shotResult: string;
  x: number;
  y: number;
  shotDistance: number;
  description: string;
}

export interface ScheduleGame {
  gameId: string;
  gameStatus: number;
  gameStatusText: string;
  gameCode: string;
  gameDateTimeUTC: string;
  homeTeam: {
    teamId: number;
    teamTricode: string;
    teamName: string;
    teamCity: string;
    teamSlug: string;
    score: number;
    wins: number;
    losses: number;
    seed: number;
    periods?: PeriodScore[];
  };
  awayTeam: {
    teamId: number;
    teamTricode: string;
    teamName: string;
    teamCity: string;
    teamSlug: string;
    score: number;
    wins: number;
    losses: number;
    seed: number;
    periods?: PeriodScore[];
  };
  seriesText?: string;
  ifNecessary?: boolean;
  // Today's games (live scoreboard): per-team featured leaders w/ PTS+REB+AST.
  gameLeaders?: { homeLeaders?: GameLeader; awayLeaders?: GameLeader };
  // Past finished games (schedule cache): game-high scorer(s), points only.
  pointsLeaders?: PointsLeader[];
}

export interface ScheduleDate {
  gameDate: string;
  games: ScheduleGame[];
}

// ========== API Functions ==========

// Get today's scoreboard (live data, refreshes frequently)
export async function getTodayScoreboard(): Promise<NbaGame[]> {
  const res = await fetch(
    `${CDN_BASE}/liveData/scoreboard/todaysScoreboard_00.json`,
    { headers: HEADERS, next: { revalidate: 30 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const games: NbaGame[] = data.scoreboard?.games || [];
  // Filter out "if necessary" playoff games that are no longer needed.
  // These show up with ifNecessary=true, gameStatus=1, and gameStatusText="TBD"
  // even after the series is decided — they are ghost games and should not display.
  return games.filter((g) => !(g.ifNecessary === true && g.gameStatus === 1 && /tbd/i.test(g.gameStatusText || "")));
}

// In-memory cache for the 11MB schedule — extended TTL + stale-while-revalidate
let scheduleCache: { data: ScheduleDate[]; ts: number } | null = null;
const SCHEDULE_TTL = 2 * 60 * 60 * 1000; // 2 hours (data changes infrequently)
let scheduleInflight: Promise<ScheduleDate[]> | null = null;
let scheduleRevalidating = false;

// Age of the in-memory schedule cache, in ms. Returns null if no cache yet.
// Used to render "Updated X ago" badges on cache-backed pages.
export function getScheduleAge(): number | null {
  return scheduleCache ? Date.now() - scheduleCache.ts : null;
}

// fetch wrapper with N retries and exponential backoff. Cold-start failures
// against cdn.nba.com used to silently leave callers with `[]`; this gives
// transient 5xx / DNS errors a real chance to succeed.
async function fetchWithRetry(
  url: string,
  init: RequestInit & { next?: { revalidate?: number } } = {},
  retries = 2,
  baseDelay = 200
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      // Retry on 5xx only — 4xx is a programmer error, don't hammer the API.
      if (res.ok || res.status < 500 || attempt === retries) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
      if (attempt === retries) throw err;
    }
    await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, attempt)));
  }
  throw lastErr;
}

export async function getFullSchedule(): Promise<ScheduleDate[]> {
  // Serve from cache immediately if available (even if stale)
  if (scheduleCache) {
    if (Date.now() - scheduleCache.ts > SCHEDULE_TTL && !scheduleRevalidating) {
      scheduleRevalidating = true;
      fetchScheduleInBackground();
    }
    return scheduleCache.data;
  }
  // Cold start: dedup concurrent callers behind a single fetch promise.
  if (!scheduleInflight) scheduleInflight = fetchScheduleBlocking();
  return scheduleInflight;
}

async function fetchScheduleBlocking(): Promise<ScheduleDate[]> {
  try {
    const res = await fetchWithRetry(
      `${CDN_BASE}/staticData/scheduleLeagueV2.json`,
      { headers: HEADERS, next: { revalidate: 7200 } }
    );
    if (!res.ok) {
      console.error(`schedule fetch failed: HTTP ${res.status}`);
      return scheduleCache?.data || [];
    }
    const data = await res.json();
    const dates = data.leagueSchedule?.gameDates || [];
    scheduleCache = { data: dates, ts: Date.now() };
    return dates;
  } catch (err) {
    console.error("schedule fetch error:", err);
    return scheduleCache?.data || [];
  } finally {
    scheduleInflight = null;
  }
}

function fetchScheduleInBackground() {
  fetchWithRetry(`${CDN_BASE}/staticData/scheduleLeagueV2.json`, { headers: HEADERS, next: { revalidate: 7200 } })
    .then((res) => res.ok ? res.json() : null)
    .then((data) => {
      if (data) {
        const dates = data.leagueSchedule?.gameDates || [];
        scheduleCache = { data: dates, ts: Date.now() };
      }
    })
    .catch((err) => console.error("schedule revalidate error:", err))
    .finally(() => { scheduleRevalidating = false; });
}

// Get games for a specific date from the schedule
export async function getGamesByDate(dateStr: string): Promise<ScheduleGame[]> {
  const schedule = await getFullSchedule();
  // dateStr format: "2026-04-25", schedule uses "04/25/2026 00:00:00"
  const [year, month, day] = dateStr.split("-");
  const scheduleDate = `${month}/${day}/${year}`;

  for (const gd of schedule) {
    if (gd.gameDate.startsWith(scheduleDate)) {
      // Filter out unplayed "if necessary" playoff games (ghost games from
      // series that ended early — they remain on the schedule as TBD placeholders).
      return gd.games.filter((g) => !(g.ifNecessary === true && g.gameStatus === 1 && /tbd/i.test(g.gameStatusText || "")));
    }
  }
  return [];
}

// Box score / play-by-play in-memory cache.
// Final games (gameStatus === 3) never change — pinned indefinitely (up to LRU cap).
// Live games revalidated by Next's fetch cache TTL (30s / 60s).
// Cap prevents unbounded growth on long-running lambdas; LRU via Map insertion order.
const GAME_CACHE_MAX = 200;
const boxScoreCache = new Map<string, BoxScore>();
const pbpCache = new Map<string, ShotAction[]>();

function lruSet<V>(cache: Map<string, V>, key: string, value: V): void {
  // Refresh insertion order so this entry is most-recently used.
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  // Evict oldest if over cap.
  while (cache.size > GAME_CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export async function getBoxScore(gameId: string): Promise<BoxScore | null> {
  const cached = boxScoreCache.get(gameId);
  if (cached && cached.gameStatus === 3) return cached;
  const res = await fetch(
    `${CDN_BASE}/liveData/boxscore/boxscore_${gameId}.json`,
    { headers: HEADERS, next: { revalidate: 30 } }
  );
  if (!res.ok) return cached ?? null;
  const data = await res.json();
  const game: BoxScore | null = data.game || null;
  if (game) lruSet(boxScoreCache, gameId, game);
  return game;
}

// Map raw PBP actions to the slim shot shape — shared with the game page,
// which already holds raw actions and derives shots instead of re-downloading.
export function extractShots(actions: Record<string, unknown>[]): ShotAction[] {
  return actions
    .filter((a) => a.shotResult)
    .map((a) => ({
      personId: a.personId,
      playerNameI: a.playerNameI,
      teamTricode: a.teamTricode,
      period: a.period,
      clock: a.clock,
      actionType: a.actionType,
      subType: a.subType,
      shotResult: a.shotResult,
      x: a.x,
      y: a.y,
      shotDistance: a.shotDistance,
      description: a.description,
    })) as ShotAction[];
}

// Get play-by-play (for shot chart)
export async function getPlayByPlay(gameId: string): Promise<ShotAction[]> {
  const cached = pbpCache.get(gameId);
  // Final-game check piggybacks on box score cache (cheap lookup).
  if (cached && boxScoreCache.get(gameId)?.gameStatus === 3) return cached;
  const res = await fetch(
    `${CDN_BASE}/liveData/playbyplay/playbyplay_${gameId}.json`,
    { headers: HEADERS, next: { revalidate: 60 } }
  );
  if (!res.ok) return cached ?? [];
  const data = await res.json();
  const shots = extractShots(data.game?.actions || []);
  lruSet(pbpCache, gameId, shots);
  return shots;
}

// Player info types
export interface PlayerInfo {
  personId: number;
  lastName: string;
  firstName: string;
  slug: string;
  teamId: number;
  teamAbbr: string;
  teamCity: string;
  teamName: string;
  jersey: string;
  position: string;
  height: string;
  weight: string;
  college: string;
  country: string;
  draftYear: number | null;
  draftRound: number | null;
  draftNumber: number | null;
  fromYear: string;
  toYear: string;
  pts: number;
  reb: number;
  ast: number;
}

// Get player index (all active players with basic info) — cached permanently until server restart
let playerIndexCache: PlayerInfo[] | null = null;
let playerIndexInflight: Promise<PlayerInfo[]> | null = null;

export async function getPlayerIndex(): Promise<PlayerInfo[]> {
  if (playerIndexCache) return playerIndexCache;
  // Deduplicate: if a fetch is already in-flight, all callers share the same promise
  if (playerIndexInflight) return playerIndexInflight;
  playerIndexInflight = fetchPlayerIndex();
  return playerIndexInflight;
}

async function fetchPlayerIndex(): Promise<PlayerInfo[]> {
  try {
    const res = await fetch(
      `${CDN_BASE}/staticData/playerIndex.json`,
      { headers: HEADERS, next: { revalidate: 86400 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const rs = data.resultSets?.[0];
    if (!rs) return [];
    const players = rs.rowSet.map((r: (string | number | null)[]) => ({
      personId: r[0] as number,
      lastName: r[1] as string,
      firstName: r[2] as string,
      slug: r[3] as string,
      teamId: r[4] as number,
      teamAbbr: r[9] as string,
      teamCity: r[7] as string,
      teamName: r[8] as string,
      jersey: r[10] as string,
      position: r[11] as string,
      height: r[12] as string,
      weight: r[13] as string,
      college: r[14] as string,
      country: r[15] as string,
      draftYear: r[16] as number | null,
      draftRound: r[17] as number | null,
      draftNumber: r[18] as number | null,
      fromYear: r[20] as string,
      toYear: r[21] as string,
      pts: r[22] as number,
      reb: r[23] as number,
      ast: r[24] as number,
    }));
    playerIndexCache = players;
    return players;
  } finally {
    playerIndexInflight = null;
  }
}

export async function getPlayerInfo(personId: number): Promise<PlayerInfo | null> {
  const players = await getPlayerIndex();
  return players.find((p) => p.personId === personId) || null;
}

// Player headshot URL
export function getPlayerHeadshotUrl(personId: number): string {
  return playerHeadshotUrl(personId);
}

// ========== Helpers ==========

// Format date in US/Eastern timezone (NBA schedule uses ET dates)
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Convert UTC time to Beijing time display string
export function toBeijingTime(utcStr: string): string {
  if (!utcStr) return "";
  const d = new Date(utcStr);
  return d.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Parse NBA minutes format "PT33M50.00S" to "33:50"
export function parseMinutes(min: string): string {
  if (!min || min === "PT00M00.00S") return "-";
  const match = min.match(/PT(\d+)M([\d.]+)S/);
  if (!match) return min;
  const m = match[1];
  const s = Math.floor(parseFloat(match[2]));
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Get game status display
export function getGameStatusDisplay(status: number, statusText: string): string {
  const text = statusText.trim();
  if (status === 3) return "Final";
  if (status === 2) return text || "Live";
  return text || "Scheduled";
}
