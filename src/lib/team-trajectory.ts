// Per-team season trajectory: walk every finished regular-season game in
// chronological order and emit a running point after each game (cumulative
// record, win pct, cumulative point differential, rolling last-10 net). 100%
// computed from the cached schedule — no external fetch. Mirrors the
// gameStatus===3 + isRegular filtering used by computeStandingsRows.
import type { ScheduleDate } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";
import { isRegular } from "@/lib/games";

export interface TrajectoryPoint {
  /** 1-based game number for this team (x-axis). */
  game: number;
  wins: number;
  losses: number;
  /** wins / gamesPlayed, 0..1. */
  winPct: number;
  /** Cumulative point differential (points for − points against). */
  pointDiff: number;
  /** Net point margin over the last 10 games (or fewer early on). */
  last10Net: number;
}

export interface TeamTrajectory {
  tricode: string;
  teamId: number;
  name: string;
  city: string;
  conference: "East" | "West";
  primaryColor: string;
  points: TrajectoryPoint[];
}

const LAST_N = 10;

/** Build a per-team running series (all 30 teams from TEAM_META, even those
 *  without a finished game yet — they get an empty `points` array). */
export function computeTrajectories(schedule: ScheduleDate[]): TeamTrajectory[] {
  // Flatten finished regular-season games, then sort chronologically so the
  // running totals advance in real game order regardless of schedule grouping.
  const games: {
    utc: string;
    homeTri: string;
    awayTri: string;
    homeScore: number;
    awayScore: number;
  }[] = [];

  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus !== 3) continue;
      if (!isRegular(g.gameId)) continue;
      games.push({
        utc: g.gameDateTimeUTC,
        homeTri: g.homeTeam.teamTricode,
        awayTri: g.awayTeam.teamTricode,
        homeScore: g.homeTeam.score,
        awayScore: g.awayTeam.score,
      });
    }
  }
  games.sort((a, b) => a.utc.localeCompare(b.utc));

  // Running accumulators per team.
  interface Acc {
    wins: number;
    losses: number;
    pointDiff: number;
    /** Per-game net margin, in chronological order — last 10 feed last10Net. */
    margins: number[];
    points: TrajectoryPoint[];
  }
  const acc = new Map<string, Acc>();
  const get = (tri: string): Acc => {
    let a = acc.get(tri);
    if (!a) {
      a = { wins: 0, losses: 0, pointDiff: 0, margins: [], points: [] };
      acc.set(tri, a);
    }
    return a;
  };

  const advance = (tri: string, won: boolean, margin: number) => {
    const a = get(tri);
    if (won) a.wins++;
    else a.losses++;
    a.pointDiff += margin;
    a.margins.push(margin);
    const recent = a.margins.slice(-LAST_N);
    const last10Net = recent.reduce((s, m) => s + m, 0);
    const gp = a.wins + a.losses;
    a.points.push({
      game: gp,
      wins: a.wins,
      losses: a.losses,
      winPct: gp > 0 ? a.wins / gp : 0,
      pointDiff: a.pointDiff,
      last10Net,
    });
  };

  for (const g of games) {
    const homeWon = g.homeScore > g.awayScore;
    const margin = g.homeScore - g.awayScore;
    // Only NBA tricodes in TEAM_META; defensively skip exhibition entrants.
    if (TEAM_META[g.homeTri]) advance(g.homeTri, homeWon, margin);
    if (TEAM_META[g.awayTri]) advance(g.awayTri, !homeWon, -margin);
  }

  const out: TeamTrajectory[] = [];
  for (const meta of Object.values(TEAM_META)) {
    const a = acc.get(meta.tricode);
    out.push({
      tricode: meta.tricode,
      teamId: meta.teamId,
      name: meta.name,
      city: meta.city,
      conference: meta.conference,
      primaryColor: meta.primaryColor,
      points: a ? a.points : [],
    });
  }
  // Order by current win pct, then wins, then point diff — a deterministic
  // ordering so legend / overlap stacking is stable across renders.
  out.sort((x, y) => {
    const px = x.points.at(-1);
    const py = y.points.at(-1);
    const wx = px ? px.winPct : 0;
    const wy = py ? py.winPct : 0;
    const winsX = px ? px.wins : 0;
    const winsY = py ? py.wins : 0;
    const diffX = px ? px.pointDiff : 0;
    const diffY = py ? py.pointDiff : 0;
    return wy - wx || winsY - winsX || diffY - diffX;
  });
  return out;
}

/** Largest game count any team has reached — drives the chart x-domain. */
export function maxGamesPlayed(trajectories: TeamTrajectory[]): number {
  let max = 0;
  for (const t of trajectories) {
    const last = t.points.at(-1);
    if (last && last.game > max) max = last.game;
  }
  return max;
}
