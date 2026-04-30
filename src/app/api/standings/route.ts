import { NextResponse } from "next/server";
import { getFullSchedule } from "@/lib/api";

interface TeamRecord {
  tricode: string;
  teamId: number;
  teamName: string;
  teamCity: string;
  wins: number;
  losses: number;
}

// In-memory standings cache — avoids re-parsing 11MB schedule on every request
let standingsCache: { data: TeamRecord[]; ts: number } | null = null;
const STANDINGS_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    if (standingsCache && Date.now() - standingsCache.ts < STANDINGS_TTL) {
      return NextResponse.json({ data: standingsCache.data }, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
      });
    }

    const dates = await getFullSchedule();
    const teamMap: Record<string, TeamRecord> = {};

    for (const gd of dates) {
      for (const g of gd.games) {
        if (g.gameStatus !== 3) continue;
        // Only count regular season games (gameId starts with "002")
        if (!g.gameId.startsWith("002")) continue;
        const h = g.homeTeam;
        const a = g.awayTeam;
        if (!teamMap[h.teamTricode])
          teamMap[h.teamTricode] = { tricode: h.teamTricode, teamId: h.teamId, teamName: h.teamName, teamCity: h.teamCity, wins: 0, losses: 0 };
        if (!teamMap[a.teamTricode])
          teamMap[a.teamTricode] = { tricode: a.teamTricode, teamId: a.teamId, teamName: a.teamName, teamCity: a.teamCity, wins: 0, losses: 0 };
        if (h.score > a.score) {
          teamMap[h.teamTricode].wins++;
          teamMap[a.teamTricode].losses++;
        } else {
          teamMap[a.teamTricode].wins++;
          teamMap[h.teamTricode].losses++;
        }
      }
    }

    const teams = Object.values(teamMap).sort((a, b) => {
      const wa = a.wins / (a.wins + a.losses || 1);
      const wb = b.wins / (b.wins + b.losses || 1);
      return wb - wa;
    });

    standingsCache = { data: teams, ts: Date.now() };
    return NextResponse.json({ data: teams }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to compute standings" }, { status: 500 });
  }
}
