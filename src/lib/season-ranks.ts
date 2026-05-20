import { getFullSchedule } from "./api";

export interface SeasonRank {
  totalPoints: number;
  totalPointsRank: number;
  margin: number;
  marginRank: number;
  closeRank: number;
  totalGames: number;
}

let cache: { ranks: Map<string, SeasonRank>; ts: number } | null = null;
let inflight: Promise<Map<string, SeasonRank>> | null = null;
const TTL = 60 * 60 * 1000;

async function build(): Promise<Map<string, SeasonRank>> {
  const schedule = await getFullSchedule();
  const finals: { gameId: string; total: number; margin: number }[] = [];
  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus !== 3) continue;
      const total = g.homeTeam.score + g.awayTeam.score;
      if (total === 0) continue; // guard against placeholder rows
      const margin = Math.abs(g.homeTeam.score - g.awayTeam.score);
      finals.push({ gameId: g.gameId, total, margin });
    }
  }

  const byTotal = [...finals].sort((a, b) => b.total - a.total);
  const byMargin = [...finals].sort((a, b) => b.margin - a.margin);
  const byClose = [...finals].sort((a, b) => a.margin - b.margin);

  // Dense rank — games with the same total share the same rank. Without this,
  // a three-way tie at "#1 highest" would silently demote two of them to #2/#3.
  function denseRanks<T>(sorted: T[], key: (x: T) => number, idOf: (x: T) => string) {
    const out = new Map<string, number>();
    let rank = 0;
    let prev: number | null = null;
    for (const item of sorted) {
      const v = key(item);
      if (v !== prev) {
        rank += 1;
        prev = v;
      }
      out.set(idOf(item), rank);
    }
    return out;
  }

  const totalRanks = denseRanks(byTotal, (g) => g.total, (g) => g.gameId);
  const marginRanks = denseRanks(byMargin, (g) => g.margin, (g) => g.gameId);
  const closeRanks = denseRanks(byClose, (g) => g.margin, (g) => g.gameId);

  const out = new Map<string, SeasonRank>();
  for (const g of finals) {
    out.set(g.gameId, {
      totalPoints: g.total,
      totalPointsRank: totalRanks.get(g.gameId)!,
      margin: g.margin,
      marginRank: marginRanks.get(g.gameId)!,
      closeRank: closeRanks.get(g.gameId)!,
      totalGames: finals.length,
    });
  }
  return out;
}

export async function getSeasonRank(gameId: string): Promise<SeasonRank | null> {
  if (cache && Date.now() - cache.ts < TTL) {
    return cache.ranks.get(gameId) ?? null;
  }
  if (!inflight) {
    inflight = (async () => {
      try {
        const ranks = await build();
        cache = { ranks, ts: Date.now() };
        return ranks;
      } finally {
        inflight = null;
      }
    })();
  }
  const ranks = await inflight;
  return ranks.get(gameId) ?? null;
}
