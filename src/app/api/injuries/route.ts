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

function unavailable(status: 500 | 502) {
  return NextResponse.json({ data: [] }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const res = await fetch(ESPN_INJURIES, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          next: { revalidate: 1800 },
          signal: controller.signal,
        });
        if (controller.signal.aborted || !res.ok) {
          void res.body?.cancel().catch(() => {});
          return unavailable(502);
        }

        const json = await res.json();
        // Never validate or publish a late body after the deadline won.
        if (controller.signal.aborted || !isValidInjuryFeed(json)) return unavailable(502);
        return NextResponse.json({ data: json.injuries }, {
          headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" },
        });
      })(),
      // One budget for headers and body, including transports that ignore abort.
      new Promise<Response>((resolve) => {
        timeout = setTimeout(() => {
          controller.abort();
          resolve(unavailable(500));
        }, 5000);
      }),
    ]);
  } catch {
    return unavailable(500);
  } finally {
    clearTimeout(timeout);
  }
}
