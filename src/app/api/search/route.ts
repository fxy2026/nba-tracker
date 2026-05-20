import { NextResponse } from "next/server";
import { getPlayerIndex } from "@/lib/api";
import { expandQuery } from "@/lib/playerAliases";
import { TEAM_META } from "@/lib/teams";
import { ALL_TIME_LEADERS } from "@/lib/allTimeLeaders";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase().slice(0, 100);

  if (!q || q.length < 2) {
    return NextResponse.json({ data: [] });
  }

  try {
    const players = await Promise.race([
      getPlayerIndex(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 6000)),
    ]);

    // Expand colloquial / Chinese nicknames into matchable name fragments.
    const queries = expandQuery(q);

    // Team-name search: queries like "Lakers" or "湖人 center" should match
    // every player on that team. Collect matching team tricodes.
    const matchedTeams = new Set<string>();
    for (const [tri, meta] of Object.entries(TEAM_META)) {
      const haystack = `${meta.city} ${meta.name} ${tri}`.toLowerCase();
      if (queries.some((qq) => haystack.includes(qq))) matchedTeams.add(tri);
    }

    const results = players
      .filter((p) => {
        const full = `${p.firstName} ${p.lastName}`.toLowerCase();
        const reversed = `${p.lastName} ${p.firstName}`.toLowerCase();
        const last = p.lastName.toLowerCase();
        if (queries.some((qq) => full.includes(qq) || reversed.includes(qq) || last.includes(qq))) return true;
        // Team-name path: include players from matched teams.
        if (matchedTeams.has(p.teamAbbr)) return true;
        return false;
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

    // Also search retired legends — lets queries like "Jordan" or "Kobe"
    // resolve. Only those with a verified personId (so they have a real
    // headshot + /legends/[id] page).
    const legendResults = ALL_TIME_LEADERS
      .filter((p) => !p.active && p.personId > 0)
      .filter((p) => {
        const full = p.name.toLowerCase();
        const last = p.name.split(" ").slice(-1)[0].toLowerCase();
        return queries.some((qq) => full.includes(qq) || last.includes(qq));
      })
      .slice(0, 10)
      .map((p) => {
        const [firstName, ...rest] = p.name.split(" ");
        const team = TEAM_META[p.team];
        return {
          personId: p.personId,
          firstName,
          lastName: rest.join(" "),
          teamAbbr: p.team,
          teamId: team?.teamId ?? 0,
          teamName: team?.name ?? "",
          teamCity: team?.city ?? "",
          jersey: "",
          position: "",
          pts: p.ppg,
          reb: p.rpg,
          ast: p.apg,
          isLegend: true as const,
        };
      });

    return NextResponse.json({ data: [...results, ...legendResults] }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
