import type { PlayerIndexProvenance } from "./player-index-provenance";

// Shared NBA data contracts. Keep this module type-only.
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
  position?: string | null;
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
  arena: { arenaName: string; arenaCity: string; arenaState?: string | null };
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

// Scoring events can be valid even when spatial tracking is unavailable.
export type ScoringShot = Omit<ShotAction, "x" | "y" | "shotDistance"> & { shotDistance?: number; x?: number; y?: number };

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
    wins?: number;
    losses?: number;
    seed?: number;
    periods?: PeriodScore[];
  };
  awayTeam: {
    teamId: number;
    teamTricode: string;
    teamName: string;
    teamCity: string;
    teamSlug: string;
    score: number;
    wins?: number;
    losses?: number;
    seed?: number;
    periods?: PeriodScore[];
  };
  seriesText?: string;
  ifNecessary?: boolean;
  // Today's games (live scoreboard): per-team featured leaders w/ PTS+REB+AST.
  gameLeaders?: { homeLeaders?: GameLeader; awayLeaders?: GameLeader };
  // Past finished games (schedule cache): game-high scorer(s), points only.
  pointsLeaders?: PointsLeader[];
  // Declared (not just cast-through) because the game-page pre-game preview
  // renders the venue — the slim projection would otherwise drop it.
  arenaName?: string;
  arenaCity?: string;
}

export interface ScheduleDate {
  gameDate: string;
  games: ScheduleGame[];
}

// Raw feed rows are the declared shape plus dozens of undeclared keys
// (broadcasters, gameLabel, weekNumber, ...) — modeled as open records so
// projection call sites and test fixtures need no casts.
export type RawScheduleTeam = ScheduleGame["homeTeam"] & Record<string, unknown>;
export type RawScheduleGame = Omit<ScheduleGame, "homeTeam" | "awayTeam" | "pointsLeaders"> & {
  homeTeam: RawScheduleTeam;
  awayTeam: RawScheduleTeam;
  pointsLeaders?: (PointsLeader & Record<string, unknown>)[];
} & Record<string, unknown>;
export interface RawScheduleDate {
  gameDate: string;
  games: RawScheduleGame[];
  [key: string]: unknown;
}

export interface PlayByPlaySnapshot { shots: ShotAction[]; available: boolean; stale: boolean; }

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

export interface PlayerIndexSnapshot {
  players: PlayerInfo[];
  provenance: PlayerIndexProvenance;
}
