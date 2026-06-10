// One-pass standings computation over the cached schedule: overall record plus
// the Hupu-style situational splits (home/road/division, points for/against,
// current streak) so /standings can show everything in a single table.
import type { ScheduleDate } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";
import { isRegular, winPct } from "@/lib/games";

export interface StandingsRow {
  tricode: string;
  teamId: number;
  teamName: string;
  teamCity: string;
  conference: "East" | "West";
  division: string;
  wins: number;
  losses: number;
  pct: number;
  homeW: number;
  homeL: number;
  roadW: number;
  roadL: number;
  divW: number;
  divL: number;
  /** Per-game points scored / allowed; diff = ppg − oppg. */
  ppg: number;
  oppg: number;
  diff: number;
  /** Current run, e.g. "W4" / "L2"; "" before any finished game. */
  streak: string;
}

interface Acc {
  tricode: string;
  teamId: number;
  teamName: string;
  teamCity: string;
  wins: number;
  losses: number;
  homeW: number;
  homeL: number;
  roadW: number;
  roadL: number;
  divW: number;
  divL: number;
  pf: number;
  pa: number;
  // (UTC datetime, won) per game — sorted afterwards to derive the streak.
  results: [string, boolean][];
}

export function computeStandingsRows(schedule: ScheduleDate[]): StandingsRow[] {
  const map = new Map<string, Acc>();
  const acc = (t: { teamTricode: string; teamId: number; teamName: string; teamCity: string }): Acc => {
    let a = map.get(t.teamTricode);
    if (!a) {
      a = { tricode: t.teamTricode, teamId: t.teamId, teamName: t.teamName, teamCity: t.teamCity, wins: 0, losses: 0, homeW: 0, homeL: 0, roadW: 0, roadL: 0, divW: 0, divL: 0, pf: 0, pa: 0, results: [] };
      map.set(t.teamTricode, a);
    }
    return a;
  };

  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus !== 3) continue;
      if (!isRegular(g.gameId)) continue; // regular season only
      const h = acc(g.homeTeam);
      const a = acc(g.awayTeam);
      const homeWon = g.homeTeam.score > g.awayTeam.score;

      if (homeWon) { h.wins++; h.homeW++; a.losses++; a.roadL++; }
      else { a.wins++; a.roadW++; h.losses++; h.homeL++; }

      h.pf += g.homeTeam.score; h.pa += g.awayTeam.score;
      a.pf += g.awayTeam.score; a.pa += g.homeTeam.score;

      const hMeta = TEAM_META[h.tricode];
      const aMeta = TEAM_META[a.tricode];
      if (hMeta && aMeta && hMeta.division === aMeta.division) {
        if (homeWon) { h.divW++; a.divL++; }
        else { a.divW++; h.divL++; }
      }

      h.results.push([g.gameDateTimeUTC, homeWon]);
      a.results.push([g.gameDateTimeUTC, !homeWon]);
    }
  }

  if (map.size === 0) return [];

  // Pad teams without a finished game yet so early-season tables stay complete.
  for (const meta of Object.values(TEAM_META)) {
    if (!map.has(meta.tricode)) {
      map.set(meta.tricode, { tricode: meta.tricode, teamId: meta.teamId, teamName: meta.name, teamCity: meta.city, wins: 0, losses: 0, homeW: 0, homeL: 0, roadW: 0, roadL: 0, divW: 0, divL: 0, pf: 0, pa: 0, results: [] });
    }
  }

  const rows: StandingsRow[] = [];
  for (const a of map.values()) {
    const meta = TEAM_META[a.tricode];
    if (!meta) continue; // skip non-NBA entrants defensively
    const gp = a.wins + a.losses;
    const ppg = gp > 0 ? a.pf / gp : 0;
    const oppg = gp > 0 ? a.pa / gp : 0;

    a.results.sort((x, y) => y[0].localeCompare(x[0])); // most recent first
    let streak = "";
    if (a.results.length > 0) {
      const latest = a.results[0][1];
      let n = 0;
      for (const [, won] of a.results) {
        if (won === latest) n++;
        else break;
      }
      streak = `${latest ? "W" : "L"}${n}`;
    }

    rows.push({
      tricode: a.tricode,
      teamId: a.teamId,
      teamName: a.teamName,
      teamCity: a.teamCity,
      conference: meta.conference,
      division: meta.division,
      wins: a.wins,
      losses: a.losses,
      pct: winPct(a.wins, a.losses),
      homeW: a.homeW,
      homeL: a.homeL,
      roadW: a.roadW,
      roadL: a.roadL,
      divW: a.divW,
      divL: a.divL,
      ppg,
      oppg,
      diff: ppg - oppg,
      streak,
    });
  }

  return rows.sort((x, y) => y.pct - x.pct || y.wins - x.wins);
}

/** Games behind the conference leader, formatted Hupu-style ("-" for the leader). */
export function gamesBehind(leader: StandingsRow, team: StandingsRow): string {
  if (leader.tricode === team.tricode) return "-";
  return (((leader.wins - leader.losses) - (team.wins - team.losses)) / 2).toFixed(1);
}
