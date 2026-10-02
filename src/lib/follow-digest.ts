// Data layer for the personalized "follow" digest. Pure, schedule-driven team
// helpers (no external calls). Numbers mirror /standings (computeStandingsRows +
// per-conference rank) so a followed team's record/streak/rank match the table.
import type { ScheduleDate, ScheduleGame, BoxScore } from "@/lib/api";
import type { DigestGame, TeamDigest, PlayerLine } from "@/lib/follow-digest-types";
import { TEAM_META } from "@/lib/teams";
import { isCountedSeason, scheduleForSeason, gameSeasonKey } from "@/lib/games";
import { currentSeason } from "@/lib/constants";
import { minutesFromIso } from "@/lib/game-stats";
import { computeStandingsRows, type StandingsRow } from "@/lib/standings-splits";
import { SEASON_SNAPSHOT, type SeasonSnapshot, type SnapshotGame } from "@/lib/season-snapshot";

function seasonOf(gameId: string): string | null {
  const key = gameSeasonKey(gameId);
  if (key === null) return null;
  const year = 2000 + Number(key);
  return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
}

/** Build a DigestGame for a finished/live game from the followed team's POV. */
function scoredGame(g: ScheduleGame, isHome: boolean): DigestGame {
  const team = isHome ? g.homeTeam : g.awayTeam;
  const opp = isHome ? g.awayTeam : g.homeTeam;
  return {
    gameId: g.gameId,
    season: seasonOf(g.gameId),
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
    season: seasonOf(g.gameId),
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
function findTeamGames(schedule: ScheduleDate[], tricode: string, now = Date.now()): TeamGames {
  let last: { utc: string; game: DigestGame } | null = null;
  let next: { utc: string; game: DigestGame } | null = null;

  const seen = new Set<string>();
  for (const gd of schedule) {
    for (const g of gd.games) {
      // Skip exhibitions (preseason + all-star) so the digest matches real
      // results — mirrors getRecentForm's filtering on the team pages.
      if (!isCountedSeason(g.gameId)) continue;
      const isHome = g.homeTeam.teamTricode === tricode;
      const isAway = g.awayTeam.teamTricode === tricode;
      if (!isHome && !isAway) continue;

      const utc = g.gameDateTimeUTC;
      const instant = Date.parse(utc);
      if (!Number.isFinite(instant) || seen.has(g.gameId)) continue;
      seen.add(g.gameId);
      if ((g.gameStatus === 3 || g.gameStatus === 2) && instant <= now) {
        const home = g.homeTeam.score;
        const away = g.awayTeam.score;
        if (!Number.isSafeInteger(home) || !Number.isSafeInteger(away) || home < 0 || away < 0 || (g.gameStatus === 3 && home === away)) continue;
        // Finished or live — track the most recent by tip-off time.
        if (!last || utc.localeCompare(last.utc) > 0) {
          last = { utc, game: scoredGame(g, isHome) };
        }
      } else if (g.gameStatus === 1 && instant >= now && !g.ifNecessary && !/tbd/i.test(g.gameStatusText || "")) {
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
  now = Date.now(),
): string[] {
  const games: { utc: string; gameId: string }[] = [];
  for (const gd of schedule) {
    for (const g of gd.games) {
      if (!isCountedSeason(g.gameId) || g.gameStatus !== 3) continue;
      if (g.homeTeam.teamTricode !== tricode && g.awayTeam.teamTricode !== tricode) continue;
      const instant = Date.parse(g.gameDateTimeUTC);
      if (!Number.isFinite(instant) || instant > now || games.some((x) => x.gameId === g.gameId)) continue;
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
    season: seasonOf(box.gameId),
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
      season: seasonOf(g.gameId),
      status: 3,
      // Legacy timestamp retained for contract compatibility. Render the
      // explicit calendarDate: this snapshot does not contain a tip-off time.
      dateUTC: `${g.gameDate}T12:00:00Z`,
      calendarDate: g.gameDate,
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

/** Current regular-season record/rank/streak are independent of the latest
 * available match. Before current results exist, preserve the explicit archived
 * snapshot record; never merge it into current standings. */
export function buildTeamDigests(
  schedule: ScheduleDate[],
  tricodes: string[],
  snapshot: SeasonSnapshot | null = SEASON_SNAPSHOT,
  season = currentSeason(),
  now = Date.now(),
): TeamDigest[] {
  const seenGames = new Set<string>();
  const current = scheduleForSeason(schedule, season).map((day) => ({ ...day, games: day.games.filter((game) => {
    if (seenGames.has(game.gameId)) return false;
    const instant = Date.parse(game.gameDateTimeUTC);
    if (!Number.isFinite(instant) || instant > now) return false;
    if (game.gameStatus === 3 && (!Number.isSafeInteger(game.homeTeam.score) || !Number.isSafeInteger(game.awayTeam.score) || game.homeTeam.score < 0 || game.awayTeam.score < 0 || game.homeTeam.score === game.awayTeam.score)) return false;
    seenGames.add(game.gameId);
    return true;
  }) }));
  const rows = computeStandingsRows(current);
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
    const { last, next } = findTeamGames(schedule, tricode, now);
    const snapTeam =
      !row && snapshot
        ? (snapshot.teams.find((t) => t.tricode === tricode) ?? null)
        : null;

    const digest: TeamDigest = {
      tricode,
      teamId: meta.teamId,
      city: meta.city,
      name: meta.name,
      primaryColor: meta.primaryColor,
      conference: meta.conference,
      wins: row?.wins ?? snapTeam?.wins ?? null,
      losses: row?.losses ?? snapTeam?.losses ?? null,
      recordSeason: row ? season : snapTeam && snapshot ? snapshot.season : null,
      conferenceRank: row && row.wins + row.losses > 0 ? ranks.get(tricode) ?? null : null,
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
export function teamNextGame(schedule: ScheduleDate[], tricode: string, now = Date.now()): DigestGame | null {
  return findTeamGames(schedule, tricode, now).next;
}
