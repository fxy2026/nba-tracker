import type { ScheduleDate } from "./api";
import { isRegular } from "./games";

export interface TeamSplit {
  tricode: string;
  teamId: number;
  homeW: number;
  homeL: number;
  roadW: number;
  roadL: number;
  homePct: number;
  roadPct: number;
  diff: number;
}

export function computeHomeRoadSplits(schedule: ScheduleDate[]): TeamSplit[] {
  const map = new Map<string, { tricode: string; teamId: number; homeW: number; homeL: number; roadW: number; roadL: number }>();
  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus !== 3) continue;
      if (!isRegular(g.gameId)) continue;
      const homeWon = g.homeTeam.score > g.awayTeam.score;
      const h = map.get(g.homeTeam.teamTricode) || { tricode: g.homeTeam.teamTricode, teamId: g.homeTeam.teamId, homeW: 0, homeL: 0, roadW: 0, roadL: 0 };
      const a = map.get(g.awayTeam.teamTricode) || { tricode: g.awayTeam.teamTricode, teamId: g.awayTeam.teamId, homeW: 0, homeL: 0, roadW: 0, roadL: 0 };
      if (homeWon) { h.homeW++; a.roadL++; } else { h.homeL++; a.roadW++; }
      map.set(g.homeTeam.teamTricode, h);
      map.set(g.awayTeam.teamTricode, a);
    }
  }

  const out: TeamSplit[] = [];
  for (const r of map.values()) {
    const homeTotal = r.homeW + r.homeL;
    const roadTotal = r.roadW + r.roadL;
    const homePct = homeTotal > 0 ? r.homeW / homeTotal : 0;
    const roadPct = roadTotal > 0 ? r.roadW / roadTotal : 0;
    out.push({ ...r, homePct, roadPct, diff: homePct - roadPct });
  }
  return out;
}

/** Signed home win rate minus road win rate, in percentage points. */
export function formatHomeRoadDifference(diff: number, isZh = false): string {
  const rounded = (diff * 100).toFixed(1);
  const value = Number(rounded) === 0 ? "0.0" : rounded;
  return `${Number(value) > 0 ? "+" : ""}${value} ${isZh ? "百分点" : "pp"}`;
}
