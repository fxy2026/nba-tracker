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

export async function GET() {
  try {
    const dates = await getFullSchedule();
    const teamMap: Record<string, TeamRecord> = {};

    for (const gd of dates) {
      for (const g of gd.games) {
        if (g.gameStatus !== 3) continue;
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

    return NextResponse.json({ data: teams });
  } catch {
    return NextResponse.json({ error: "Failed to compute standings" }, { status: 500 });
  }
}
