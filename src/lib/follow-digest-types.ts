// Shared contract for the personalized "follow" digest, consumed by the home
// FollowStrip and the /favorites dashboard. The /api/follow-digest route
// produces it from the schedule cache + playergamelog + player index.

/** One game in a team's digest — finished (scores present) or upcoming. */
export interface DigestGame {
  gameId: string;
  /** 1 = scheduled, 2 = live, 3 = final */
  status: 1 | 2 | 3;
  dateUTC: string;
  /** true when the followed team plays at home */
  home: boolean;
  opponentTricode: string;
  opponentName: string;
  opponentTeamId: number;
  /** finished/live only */
  teamScore?: number;
  oppScore?: number;
  /** finished/live only — followed team is winning/won */
  win?: boolean;
}

export interface TeamDigest {
  tricode: string;
  teamId: number;
  city: string;
  name: string;
  /** TEAM_META.primaryColor — for the accent wash */
  primaryColor: string;
  conference: "East" | "West";
  wins: number;
  losses: number;
  /** 1-based conference rank, when computable */
  conferenceRank: number | null;
  /** e.g. "W3" / "L2" / "" */
  streak: string;
  lastGame: DigestGame | null;
  nextGame: DigestGame | null;
}

export interface PlayerLine {
  gameId: string;
  dateUTC: string;
  opponentTricode: string;
  home: boolean;
  win: boolean;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
}

export interface PlayerDigest {
  personId: number;
  name: string;
  teamTricode: string;
  teamId: number;
  /** most recent game's box line (playergamelog), null if unavailable */
  lastLine: PlayerLine | null;
  /** the player's team's next scheduled game, null in offseason */
  nextGame: DigestGame | null;
  /** season per-game averages from the player index, when available */
  seasonAvg: { pts: number; reb: number; ast: number } | null;
}

export interface FollowDigest {
  teams: TeamDigest[];
  players: PlayerDigest[];
}
