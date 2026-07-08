import { NextResponse } from "next/server";

const ESPN_INJURIES =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries";

interface ESPNInjuryTeam {
  displayName: string;
  injuries: unknown[];
}

// Consumers key off team displayName + the injuries array; an unexpected ESPN
// body would otherwise be cached as "no injuries" for 30 minutes.
function isValidInjuryFeed(json: unknown): json is { injuries: ESPNInjuryTeam[] } {
  if (typeof json !== "object" || json === null) return false;
  const teams = (json as { injuries?: unknown }).injuries;
  if (!Array.isArray(teams)) return false;
  return teams.every((team) => {
    if (typeof team !== "object" || team === null) return false;
    const t = team as { displayName?: unknown; injuries?: unknown };
    return typeof t.displayName === "string"
      && Array.isArray(t.injuries)
      && t.injuries.every((i) => typeof i === "object" && i !== null);
  });
}

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(ESPN_INJURIES, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      next: { revalidate: 1800 },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ data: [] }, { status: 502 });
    }

    const json = await res.json();
    if (!isValidInjuryFeed(json)) {
      return NextResponse.json({ data: [] }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ data: json.injuries }, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  } catch {
    return NextResponse.json({ data: [] }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
