import { NextResponse } from "next/server";
import { getPlayerIndex } from "@/lib/api";

export async function GET() {
  try {
    const players = await getPlayerIndex();
    // Trim to the union of fields the two consumers (quiz, awards-race) read —
    // the full 22-field index roughly doubles the payload for nothing.
    const data = players.map((p) => ({
      personId: p.personId,
      firstName: p.firstName,
      lastName: p.lastName,
      teamAbbr: p.teamAbbr,
      position: p.position,
      pts: p.pts,
      reb: p.reb,
      ast: p.ast,
      draftYear: p.draftYear,
      fromYear: p.fromYear,
      toYear: p.toYear,
    }));
    return NextResponse.json({ data }, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to load player index" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
