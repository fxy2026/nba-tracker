// Data layer for the personalized "follow" digest. Pure, schedule-driven team
// helpers (no external calls) plus playergamelog parsing helpers shared by the
// /api/follow-digest route. Numbers mirror /standings (computeStandingsRows +
// per-conference rank) so a followed team's record/streak/rank match the table.
import type { ScheduleDate, ScheduleGame, BoxScore } from "@/lib/api";
import type { DigestGame, TeamDigest, PlayerLine } from "@/lib/follow-digest-types";
import { TEAM_META } from "@/lib/teams";
import { isCountedSeason } from "@/lib/games";
import { minutesFromIso } from "@/lib/game-stats";
import { computeStandingsRows, type StandingsRow } from "@/lib/standings-splits";

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
 * A team's most recent FINISHED game (status 3 only — a live game has no
 * complete box line). Used to derive a followed player's last line from the
 * CDN box score, since stats.nba.com playergamelog is blackholed from Vercel.
 */
export function teamLastFinishedGame(schedule: ScheduleDate[], tricode: string): DigestGame | null {
  let best: { utc: string; game: DigestGame } | null = null;
  for (const gd of schedule) {
    for (const g of gd.games) {
      if (!isCountedSeason(g.gameId) || g.gameStatus !== 3) continue;
      const isHome = g.homeTeam.teamTricode === tricode;
      const isAway = g.awayTeam.teamTricode === tricode;
      if (!isHome && !isAway) continue;
      const utc = g.gameDateTimeUTC;
      if (!best || utc.localeCompare(best.utc) > 0) {
        best = { utc, game: scoredGame(g, isHome) };
      }
    }
  }
  return best?.game ?? null;
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
 * Build a TeamDigest for each followed tricode from the cached schedule.
 * record/streak/rank come from computeStandingsRows so they match /standings;
 * lastGame is the most recent finished/live game, nextGame the soonest upcoming
 * (null in the offseason). Unknown tricodes are skipped.
 */
export function buildTeamDigests(schedule: ScheduleDate[], tricodes: string[]): TeamDigest[] {
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
    digests.push({
      tricode,
      teamId: meta.teamId,
      city: meta.city,
      name: meta.name,
      primaryColor: meta.primaryColor,
      conference: meta.conference,
      wins: row?.wins ?? 0,
      losses: row?.losses ?? 0,
      conferenceRank: ranks.get(tricode) ?? null,
      streak: row?.streak ?? "",
      lastGame: last,
      nextGame: next,
    });
  }
  return digests;
}

/** A followed player's team's next scheduled game (null in the offseason). */
export function teamNextGame(schedule: ScheduleDate[], tricode: string): DigestGame | null {
  return findTeamGames(schedule, tricode).next;
}

// ── playergamelog parsing ──────────────────────────────────────────────────
// Mirrors /player/[id]/gamelog's header-driven parse: resultSets[0] carries
// parallel `headers` + `rowSet`, so columns are resolved by name, not position.

const PARSE_MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

// GAME_DATE looks like "APR 09, 2026" — parse manually so we don't depend on
// engine-specific Date string parsing. Returns epoch ms for ordering, or null.
function gameDateMs(s: string): number | null {
  const m = /^([A-Z]{3})\s+(\d{1,2}),\s*(\d{4})$/i.exec(s.trim());
  if (m) {
    const mo = PARSE_MONTHS[m[1].toUpperCase()];
    if (mo != null) return new Date(Number(m[3]), mo, Number(m[2])).getTime();
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * Parse a playergamelog response into the most recent game's PlayerLine, or
 * null when the payload is empty/malformed. Resilient: any shape error → null.
 */
export function parseLatestPlayerLine(data: unknown): PlayerLine | null {
  const rs = (data as { resultSets?: { headers?: string[]; rowSet?: unknown[][] }[] })
    ?.resultSets?.[0];
  if (!Array.isArray(rs?.headers) || !Array.isArray(rs?.rowSet) || rs.rowSet.length === 0) {
    return null;
  }
  const headers = rs.headers;
  const col = (name: string) => headers.indexOf(name);
  // playergamelog uses mixed-case "Game_ID" — accept both casings.
  const gi = col("Game_ID") >= 0 ? col("Game_ID") : col("GAME_ID");
  const di = col("GAME_DATE");
  const mi = col("MATCHUP");
  if (gi < 0 || di < 0 || mi < 0) return null;

  const num = (row: unknown[], i: number) => (i >= 0 && typeof row[i] === "number" ? (row[i] as number) : 0);
  const idx = {
    wl: col("WL"), min: col("MIN"), pts: col("PTS"), reb: col("REB"), ast: col("AST"),
    stl: col("STL"), blk: col("BLK"), fgm: col("FGM"), fga: col("FGA"),
    fg3m: col("FG3M"), fg3a: col("FG3A"),
  };

  // playergamelog returns rows most-recent-first, but don't trust order — pick
  // the row with the latest parsed GAME_DATE so we always surface the newest.
  let best: { ms: number; row: unknown[] } | null = null;
  for (const row of rs.rowSet) {
    if (!row[gi]) continue;
    const ms = gameDateMs(String(row[di] ?? ""));
    if (ms == null) continue;
    if (!best || ms > best.ms) best = { ms, row };
  }
  if (!best) return null;

  const row = best.row;
  const matchup = String(row[mi] ?? "");
  const opponent = matchup.split(" ").pop() || "";
  return {
    gameId: String(row[gi]),
    dateUTC: new Date(best.ms).toISOString(),
    opponentTricode: opponent,
    home: matchup.includes(" vs"),
    win: idx.wl >= 0 && String(row[idx.wl] ?? "") === "W",
    min: num(row, idx.min),
    pts: num(row, idx.pts),
    reb: num(row, idx.reb),
    ast: num(row, idx.ast),
    stl: num(row, idx.stl),
    blk: num(row, idx.blk),
    fgm: num(row, idx.fgm),
    fga: num(row, idx.fga),
    tpm: num(row, idx.fg3m),
    tpa: num(row, idx.fg3a),
  };
}
