import { NextResponse } from "next/server";
import { getPlayerIndex } from "@/lib/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase().slice(0, 100); // Cap length

  if (!q || q.length < 2) {
    return NextResponse.json({ data: [] });
  }

  try {
    const players = await getPlayerIndex();
    const results = players
      .filter((p) => {
        const full = `${p.firstName} ${p.lastName}`.toLowerCase();
        const reversed = `${p.lastName} ${p.firstName}`.toLowerCase();
        return full.includes(q) || reversed.includes(q) || p.lastName.toLowerCase().includes(q);
      })
      .slice(0, 20)
      .map((p) => ({
        personId: p.personId,
        firstName: p.firstName,
        lastName: p.lastName,
        teamAbbr: p.teamAbbr,
        teamId: p.teamId,
        teamName: p.teamName,
        teamCity: p.teamCity,
        jersey: p.jersey,
        position: p.position,
        pts: p.pts,
        reb: p.reb,
        ast: p.ast,
      }));

    return NextResponse.json({ data: results }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
