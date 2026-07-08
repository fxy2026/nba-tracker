// Data layer for the personalized "follow" digest. Pure, schedule-driven team
// helpers (no external calls). Numbers mirror /standings (computeStandingsRows +
// per-conference rank) so a followed team's record/streak/rank match the table.
import type { ScheduleDate, ScheduleGame, BoxScore } from "@/lib/api";
import type { DigestGame, TeamDigest, PlayerLine } from "@/lib/follow-digest-types";
import { TEAM_META } from "@/lib/teams";
import { isCountedSeason } from "@/lib/games";
import { minutesFromIso } from "@/lib/game-stats";
import { computeStandingsRows, type StandingsRow } from "@/lib/standings-splits";
import { SEASON_SNAPSHOT, type SeasonSnapshot, type SnapshotGame } from "@/lib/season-snapshot";

/** Build a DigestGame for a finished/live game from the followed team's POV. */
function scoredGame(g: ScheduleGame, isHome: boolean): DigestGame {
  const team = isHome ? g.homeTeam : g.awayTeam;
  const opp = isHome ? g.awayTeam : g.homeTeam;
  return {
    gameId: g.gameId,
    status: g.gameStatus as 1 | 2 | 3,
    dateUTC: g.gameDateTimeUTC,
    home: isHome,
    opponentTricode: opp.teamTricode,
    opponentName: opp.teamName,
    opponentTeamId: opp.teamId,
    teamScore: team.score,
    oppScore: opp.score,
    win: team.score > opp.score,
  };
}

/** Build a DigestGame for an upcoming scheduled game (no scores yet). */
function upcomingGame(g: ScheduleGame, isHome: boolean): DigestGame {
  const opp = isHome ? g.awayTeam : g.homeTeam;
  return {
    gameId: g.gameId,
    status: g.gameStatus as 1 | 2 | 3,
    dateUTC: g.gameDateTimeUTC,
    home: isHome,
    opponentTricode: opp.teamTricode,
    opponentName: opp.teamName,
    opponentTeamId: opp.teamId,
  };
}

interface TeamGames {
  /** Most recent finished/live game involving the team, or null. */
  last: DigestGame | null;
  /** Nearest future scheduled game (status 1), or null in the offseason. */
  next: DigestGame | null;
}

/** Find a team's most-recent result and nearest upcoming game in one schedule pass. */
function findTeamGames(schedule: ScheduleDate[], tricode: string): TeamGames {
  let last: { utc: string; game: DigestGame } | null = null;
  let next: { utc: string; game: DigestGame } | null = null;

  for (const gd of schedule) {
    for (const g of gd.games) {
      // Skip exhibitions (preseason + all-star) so the digest matches real
      // results — mirrors getRecentForm's filtering on the team pages.
      if (!isCountedSeason(g.gameId)) continue;
      const isHome = g.homeTeam.teamTricode === tricode;
      const isAway = g.awayTeam.teamTricode === tricode;
      if (!isHome && !isAway) continue;

      const utc = g.gameDateTimeUTC;
      if (g.gameStatus === 3 || g.gameStatus === 2) {
        // Finished or live — track the most recent by tip-off time.
        if (!last || utc.localeCompare(last.utc) > 0) {
          last = { utc, game: scoredGame(g, isHome) };
        }
      } else if (g.gameStatus === 1) {
        // Scheduled — track the soonest by tip-off time.
        if (!next || utc.localeCompare(next.utc) < 0) {
          next = { utc, game: upcomingGame(g, isHome) };
        }
      }
    }
  }

  return { last: last?.game ?? null, next: next?.game ?? null };
}

/**
 * A team's most recent N finished games (status 3), newest-first. Used to find
 * a followed player's most recent APPEARANCE — the literal last team game may
 * be one the player rested/DNP'd or pre-dated a trade to the team.
 */
export function teamRecentFinishedGameIds(
  schedule: ScheduleDate[],
  tricode: string,
  n: number,
): string[] {
  const games: { utc: string; gameId: string }[] = [];
  for (const gd of schedule) {
    for (const g of gd.games) {
      if (!isCountedSeason(g.gameId) || g.gameStatus !== 3) continue;
      if (g.homeTeam.teamTricode !== tricode && g.awayTeam.teamTricode !== tricode) continue;
      games.push({ utc: g.gameDateTimeUTC, gameId: g.gameId });
    }
  }
  games.sort((a, b) => b.utc.localeCompare(a.utc));
  return games.slice(0, n).map((g) => g.gameId);
}

/**
 * Extract a player's box line from a CDN box score (cdn.nba.com — reachable
 * from Vercel, unlike playergamelog). Returns null when the player didn't
 * appear or logged no minutes (DNP).
 */
export function playerLineFromBoxScore(box: BoxScore, personId: number): PlayerLine | null {
  const homeP = box.homeTeam.players.find((p) => p.personId === personId);
  const onHome = !!homeP;
  const player = homeP ?? box.awayTeam.players.find((p) => p.personId === personId);
  if (!player) return null;
  const myTeam = onHome ? box.homeTeam : box.awayTeam;
  const oppTeam = onHome ? box.awayTeam : box.homeTeam;
  const min = minutesFromIso(player.statistics.minutes);
  if (min <= 0) return null; // DNP
  const s = player.statistics;
  return {
    gameId: box.gameId,
    dateUTC: box.gameTimeUTC,
    opponentTricode: oppTeam.teamTricode,
    home: onHome,
    win: myTeam.score > oppTeam.score,
    min: Math.round(min),
    pts: s.points,
    reb: s.reboundsTotal,
    ast: s.assists,
    stl: s.steals,
    blk: s.blocks,
    fgm: s.fieldGoalsMade,
    fga: s.fieldGoalsAttempted,
    tpm: s.threePointersMade,
    tpa: s.threePointersAttempted,
  };
}

/**
 * Per-conference rank for every team, matching /standings: filter the
 * pct-sorted standings rows by conference, then 1-based index within that list.
 */
function conferenceRanks(rows: StandingsRow[]): Map<string, number> {
  const ranks = new Map<string, number>();
  for (const conf of ["East", "West"] as const) {
    rows
      .filter((r) => r.conference === conf)
      .forEach((r, i) => ranks.set(r.tricode, i + 1));
  }
  return ranks;
}

/**
 * Most recent archived game involving the team, mapped into the DigestGame
 * shape. Snapshot finishedGames are chronological, so scan from the end.
 */
function snapshotLastGame(games: SnapshotGame[], tricode: string): DigestGame | null {
  for (let i = games.length - 1; i >= 0; i--) {
    const g = games[i];
    if (!isCountedSeason(g.gameId)) continue;
    const isHome = g.homeTricode === tricode;
    if (!isHome && g.awayTricode !== tricode) continue;
    const oppTricode = isHome ? g.awayTricode : g.homeTricode;
    const teamScore = isHome ? g.homeScore : g.awayScore;
    const oppScore = isHome ? g.awayScore : g.homeScore;
    return {
      gameId: g.gameId,
      status: 3,
      // Noon UTC keeps the snapshot's ET calendar date intact when clients
      // render it in any timezone from UTC-11 to UTC+11 (dates, not tip times).
      dateUTC: `${g.gameDate}T12:00:00Z`,
      home: isHome,
      opponentTricode: oppTricode,
      opponentName: TEAM_META[oppTricode]?.name ?? oppTricode,
      opponentTeamId: isHome ? g.awayTeamId : g.homeTeamId,
      teamScore,
      oppScore,
      win: teamScore > oppScore,
    };
  }
  return null;
}

/**
 * Build a TeamDigest for each followed tricode from the cached schedule.
 * record/streak/rank come from computeStandingsRows so they match /standings;
 * lastGame is the most recent finished/live game, nextGame the soonest upcoming
 * (null in the offseason). Unknown tricodes are skipped. When the feed has zero
 * finished/live games for the team (offseason rollover: the CDN doc only holds
 * the new season), record + lastGame fall back to the season-final snapshot and
 * the digest is marked archived; nextGame stays live — a rolled feed
 * legitimately carries next season's scheduled games.
 */
export function buildTeamDigests(
  schedule: ScheduleDate[],
  tricodes: string[],
  snapshot: SeasonSnapshot | null = SEASON_SNAPSHOT,
): TeamDigest[] {
  const rows = computeStandingsRows(schedule);
  const byTricode = new Map(rows.map((r) => [r.tricode, r]));
  const ranks = conferenceRanks(rows);

  const digests: TeamDigest[] = [];
  const seen = new Set<string>();
  for (const raw of tricodes) {
    const tricode = raw.trim().toUpperCase();
    const meta = TEAM_META[tricode];
    if (!meta || seen.has(tricode)) continue; // unknown or duplicate
    seen.add(tricode);

    const row = byTricode.get(tricode);
    const { last, next } = findTeamGames(schedule, tricode);
    const snapTeam =
      !row && !last && snapshot
        ? (snapshot.teams.find((t) => t.tricode === tricode) ?? null)
        : null;

    const digest: TeamDigest = {
      tricode,
      teamId: meta.teamId,
      city: meta.city,
      name: meta.name,
      primaryColor: meta.primaryColor,
      conference: meta.conference,
      wins: row?.wins ?? snapTeam?.wins ?? 0,
      losses: row?.losses ?? snapTeam?.losses ?? 0,
      conferenceRank: ranks.get(tricode) ?? null,
      streak: row?.streak ?? "",
      lastGame: last ?? (snapTeam && snapshot ? snapshotLastGame(snapshot.finishedGames, tricode) : null),
      nextGame: next,
    };
    if (snapTeam) digest.archived = true;
    digests.push(digest);
  }
  return digests;
}

/** A followed player's team's next scheduled game (null in the offseason). */
export function teamNextGame(schedule: ScheduleDate[], tricode: string): DigestGame | null {
  return findTeamGames(schedule, tricode).next;
}
