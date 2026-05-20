import { NextResponse } from "next/server";
import { getPlayerIndex } from "@/lib/api";
import { expandQuery } from "@/lib/playerAliases";
import { TEAM_META } from "@/lib/teams";
import { ALL_TIME_LEADERS } from "@/lib/allTimeLeaders";
import { ICONIC_SEASONS } from "@/lib/iconicSeasons";
import { getAccolades } from "@/lib/playerAccolades";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase().slice(0, 100);
  const id = searchParams.get("id")?.trim().slice(0, 50);

  // Lookup-by-id path — used by /compare to rehydrate the two selected
  // players from URL state (?p1=&p2=). Returns a single PlayerData-shaped
  // entry or null. Format: "893" (legend/active personId) or "893-1995"
  // (iconic-season composite id).
  if (id) {
    if (id.includes("-")) {
      const season = ICONIC_SEASONS.find((s) => s.id === id);
      if (season) {
        const [firstName, ...rest] = season.name.split(" ");
        const team = TEAM_META[season.team];
        return NextResponse.json({
          data: {
            personId: season.personId,
            firstName,
            lastName: rest.join(" "),
            teamAbbr: season.team,
            teamId: team?.teamId ?? 0,
            teamName: team?.name ?? "",
            teamCity: team?.city ?? "",
            jersey: "",
            position: "",
            pts: season.ppg,
            reb: season.rpg,
            ast: season.apg,
            spg: season.spg,
            bpg: season.bpg,
            fgPct: season.fgPct,
            tpPct: season.tpPct,
            ftPct: season.ftPct,
            playoffPpg: season.playoffPpg,
            playoffRpg: season.playoffRpg,
            playoffApg: season.playoffApg,
            playoffGp: season.playoffGp,
            isIconicSeason: true,
            iconicId: season.id,
            season: season.season,
            seasonYear: season.seasonYear,
            styles: season.styles,
            story: season.story,
            storyZh: season.storyZh,
            mvp: season.mvp,
            champion: season.champion,
            finalsMvp: season.finalsMvp,
            dpoy: season.dpoy,
            scoringTitle: season.scoringTitle,
            accolades: getAccolades(season.personId) ?? undefined,
          },
        }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
      }
    }
    const numId = parseInt(id, 10);
    if (!isNaN(numId)) {
      // Legend?
      const legend = ALL_TIME_LEADERS.find((p) => p.personId === numId && !p.active);
      if (legend) {
        const [firstName, ...rest] = legend.name.split(" ");
        const team = TEAM_META[legend.team];
        return NextResponse.json({
          data: {
            personId: legend.personId,
            firstName,
            lastName: rest.join(" "),
            teamAbbr: legend.team,
            teamId: team?.teamId ?? 0,
            teamName: team?.name ?? "",
            teamCity: team?.city ?? "",
            jersey: "",
            position: "",
            pts: legend.ppg,
            reb: legend.rpg,
            ast: legend.apg,
            isLegend: true,
            accolades: getAccolades(legend.personId) ?? undefined,
          },
        }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
      }
      // Active?
      try {
        const players = await getPlayerIndex();
        const active = players.find((p) => p.personId === numId);
        if (active) {
          return NextResponse.json({
            data: {
              personId: active.personId,
              firstName: active.firstName,
              lastName: active.lastName,
              teamAbbr: active.teamAbbr,
              teamId: active.teamId,
              teamName: active.teamName,
              teamCity: active.teamCity,
              jersey: active.jersey,
              position: active.position,
              pts: active.pts,
              reb: active.reb,
              ast: active.ast,
              accolades: getAccolades(active.personId) ?? undefined,
            },
          }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
        }
      } catch { /* fall through */ }
    }
    return NextResponse.json({ data: null }, { headers: { "Cache-Control": "no-store" } });
  }

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
        accolades: getAccolades(p.personId) ?? undefined,
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
          accolades: getAccolades(p.personId) ?? undefined,
        };
      });

    // Iconic single-season snapshots — queries like "2016 lebron", "curry
    // 2015", "1996 jordan" or just "harden" (after seeing the entry) resolve
    // to a specific historic campaign with its trophy + narrative metadata.
    // Match by name OR season year OR season string.
    const lowerQ = q.toLowerCase();
    const queryNum = parseInt(q, 10);
    const seasonResults = ICONIC_SEASONS
      .filter((s) => {
        const full = s.name.toLowerCase();
        const last = s.name.split(" ").slice(-1)[0].toLowerCase();
        const nameMatches = queries.some((qq) => full.includes(qq) || last.includes(qq));
        const yearMatches = !isNaN(queryNum) && (queryNum === s.seasonYear || queryNum === s.seasonYear + 1);
        const seasonStrMatches = s.season.includes(lowerQ);
        return nameMatches || yearMatches || seasonStrMatches;
      })
      .slice(0, 10)
      .map((s) => {
        const [firstName, ...rest] = s.name.split(" ");
        const team = TEAM_META[s.team];
        return {
          // composite id so two seasons of the same player don't collide
          personId: s.personId,
          firstName,
          lastName: rest.join(" "),
          teamAbbr: s.team,
          teamId: team?.teamId ?? 0,
          teamName: team?.name ?? "",
          teamCity: team?.city ?? "",
          jersey: "",
          position: "",
          pts: s.ppg,
          reb: s.rpg,
          ast: s.apg,
          spg: s.spg,
          bpg: s.bpg,
          fgPct: s.fgPct,
          tpPct: s.tpPct,
          ftPct: s.ftPct,
          // Playoff per-game from the same season
          playoffPpg: s.playoffPpg,
          playoffRpg: s.playoffRpg,
          playoffApg: s.playoffApg,
          playoffGp: s.playoffGp,
          isIconicSeason: true as const,
          iconicId: s.id,
          season: s.season,
          seasonYear: s.seasonYear,
          styles: s.styles,
          story: s.story,
          storyZh: s.storyZh,
          mvp: s.mvp,
          champion: s.champion,
          finalsMvp: s.finalsMvp,
          dpoy: s.dpoy,
          scoringTitle: s.scoringTitle,
          accolades: getAccolades(s.personId) ?? undefined,
        };
      });

    return NextResponse.json({ data: [...results, ...legendResults, ...seasonResults] }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
