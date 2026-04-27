import { NextRequest, NextResponse } from "next/server";

const BDL_BASE = "https://api.balldontlie.io/v1";

export async function GET(request: NextRequest) {
  const playerName = request.nextUrl.searchParams.get("player");
  const teamAbbr = request.nextUrl.searchParams.get("team");

  if (!playerName) {
    return NextResponse.json({ data: [] });
  }

  const apiKey = process.env.BALLDONTLIE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ data: [] });
  }

  try {
    // First, search for the player to get their BDL player ID
    const searchRes = await fetch(
      `${BDL_BASE}/players?search=${encodeURIComponent(playerName)}&per_page=5`,
      {
        headers: { Authorization: apiKey },
        next: { revalidate: 86400 },
      }
    );
    if (!searchRes.ok) return NextResponse.json({ data: [] });
    const searchData = await searchRes.json();
    const players = searchData.data || [];

    if (players.length === 0) return NextResponse.json({ data: [] });

    // Match player by name and team
    const match = players.find((p: { first_name: string; last_name: string; team?: { abbreviation: string } }) =>
      teamAbbr ? p.team?.abbreviation === teamAbbr : true
    ) || players[0];

    // Get contracts for the player's team
    const teamId = match.team?.id;
    if (!teamId) return NextResponse.json({ data: [] });

    const contractRes = await fetch(
      `${BDL_BASE}/contracts/teams?team_id=${teamId}`,
      {
        headers: { Authorization: apiKey },
        next: { revalidate: 86400 },
      }
    );
    if (!contractRes.ok) return NextResponse.json({ data: [] });
    const contractData = await contractRes.json();
    const allContracts = contractData.data || [];

    // Filter contracts for this specific player
    const playerContracts = allContracts
      .filter((c: { player_id: number; player?: { id: number } }) =>
        c.player_id === match.id || c.player?.id === match.id
      )
      .map((c: { season: number; base_salary: number; cap_hit: number }) => ({
        season: c.season,
        base_salary: c.base_salary || 0,
        cap_hit: c.cap_hit || 0,
      }))
      .sort((a: { season: number }, b: { season: number }) => b.season - a.season);

    return NextResponse.json({ data: playerContracts });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
