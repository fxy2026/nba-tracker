// NBA Official CDN API — completely free, no key needed
// Data source: cdn.nba.com

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
  };
  seriesText?: string;
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
  return data.scoreboard?.games || [];
}

// In-memory cache for the 11MB schedule — extended TTL + stale-while-revalidate
let scheduleCache: { data: ScheduleDate[]; ts: number } | null = null;
const SCHEDULE_TTL = 2 * 60 * 60 * 1000; // 2 hours (data changes infrequently)
let scheduleFetching = false;

export async function getFullSchedule(): Promise<ScheduleDate[]> {
  // Serve from cache immediately if available (even if stale)
  if (scheduleCache) {
    // Background revalidate if past TTL
    if (Date.now() - scheduleCache.ts > SCHEDULE_TTL && !scheduleFetching) {
      scheduleFetching = true;
      fetchScheduleInBackground();
    }
    return scheduleCache.data;
  }
  // Cold start: must fetch
  return fetchScheduleBlocking();
}

async function fetchScheduleBlocking(): Promise<ScheduleDate[]> {
  try {
    const res = await fetch(
      `${CDN_BASE}/staticData/scheduleLeagueV2.json`,
      { headers: HEADERS, next: { revalidate: 7200 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const dates = data.leagueSchedule?.gameDates || [];
    scheduleCache = { data: dates, ts: Date.now() };
    return dates;
  } catch {
    return scheduleCache?.data || [];
  }
}

function fetchScheduleInBackground() {
  fetch(`${CDN_BASE}/staticData/scheduleLeagueV2.json`, { headers: HEADERS, next: { revalidate: 7200 } })
    .then((res) => res.ok ? res.json() : null)
    .then((data) => {
      if (data) {
        const dates = data.leagueSchedule?.gameDates || [];
        scheduleCache = { data: dates, ts: Date.now() };
      }
    })
    .catch(() => {})
    .finally(() => { scheduleFetching = false; });
}

// Get games for a specific date from the schedule
export async function getGamesByDate(dateStr: string): Promise<ScheduleGame[]> {
  const schedule = await getFullSchedule();
  // dateStr format: "2026-04-25", schedule uses "04/25/2026 00:00:00"
  const [year, month, day] = dateStr.split("-");
  const scheduleDate = `${month}/${day}/${year}`;

  for (const gd of schedule) {
    if (gd.gameDate.startsWith(scheduleDate)) {
      return gd.games;
    }
  }
  return [];
}

// Get box score for a specific game
export async function getBoxScore(gameId: string): Promise<BoxScore | null> {
  const res = await fetch(
    `${CDN_BASE}/liveData/boxscore/boxscore_${gameId}.json`,
    { headers: HEADERS, next: { revalidate: 30 } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.game || null;
}

// Get play-by-play (for shot chart)
export async function getPlayByPlay(gameId: string): Promise<ShotAction[]> {
  const res = await fetch(
    `${CDN_BASE}/liveData/playbyplay/playbyplay_${gameId}.json`,
    { headers: HEADERS, next: { revalidate: 60 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const actions = data.game?.actions || [];
  return actions
    .filter((a: Record<string, unknown>) => a.shotResult)
    .map((a: Record<string, unknown>) => ({
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
    }));
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
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${personId}.png`;
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

// Team logo URL from team ID
export function getTeamLogoUrl(teamId: number): string {
  return `https://cdn.nba.com/logos/nba/${teamId}/global/L/logo.svg`;
}

// Team logo URL from tricode
export function getTeamLogoByTricode(tricode: string): string {
  const teamIdMap: Record<string, number> = {
    ATL: 1610612737, BOS: 1610612738, BKN: 1610612751, CHA: 1610612766,
    CHI: 1610612741, CLE: 1610612739, DAL: 1610612742, DEN: 1610612743,
    DET: 1610612765, GSW: 1610612744, HOU: 1610612745, IND: 1610612754,
    LAC: 1610612746, LAL: 1610612747, MEM: 1610612763, MIA: 1610612748,
    MIL: 1610612749, MIN: 1610612750, NOP: 1610612740, NYK: 1610612752,
    OKC: 1610612760, ORL: 1610612753, PHI: 1610612755, PHX: 1610612756,
    POR: 1610612757, SAC: 1610612758, SAS: 1610612759, TOR: 1610612761,
    UTA: 1610612762, WAS: 1610612764,
  };
  const id = teamIdMap[tricode];
  return id ? getTeamLogoUrl(id) : "";
}

// Get game status display
export function getGameStatusDisplay(status: number, statusText: string): string {
  const text = statusText.trim();
  if (status === 3) return "Final";
  if (status === 2) return text || "Live";
  return text || "Scheduled";
}
