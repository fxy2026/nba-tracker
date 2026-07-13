import { NextRequest, NextResponse } from "next/server";
import { projectScheduleDates } from "@/lib/api";

// TEMPORARY diagnostic route — Vercel-side relay to the Wayback Machine,
// used to recover archived cdn.nba.com JSON (blocked from every network we
// control since 2026-07, but Vercel can reach web.archive.org). Fixed target
// map + validated params; remove once the schedule snapshot is baked in.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TARGETS: Record<string, (id: string) => string | null> = {
  schedule: () => "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json",
  playerindex: () => "https://cdn.nba.com/static/json/staticData/playerIndex.json",
  scoreboard: () => "https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json",
  boxscore: (id) => (/^\d{10}$/.test(id) ? `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${id}.json` : null),
  pbp: (id) => (/^\d{10}$/.test(id) ? `https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_${id}.json` : null),
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const mode = q.get("mode") || "cdx";
  const file = q.get("file") || "schedule";
  const id = q.get("id") || "";
  const target = TARGETS[file]?.(id);
  if (!target) return NextResponse.json({ error: "bad file/id" }, { status: 400 });

  if (mode === "cdx") {
    const from = q.get("from") || "";
    const to = q.get("to") || "";
    const collapse = q.get("collapse") || "";
    let cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(target)}&output=text&fl=timestamp,statuscode,length`;
    if (/^\d{4,14}$/.test(from)) cdxUrl += `&from=${from}`;
    if (/^\d{4,14}$/.test(to)) cdxUrl += `&to=${to}`;
    if (/^timestamp:\d{1,2}$/.test(collapse)) cdxUrl += `&collapse=${collapse}`;
    else cdxUrl += "&limit=-25";
    const res = await fetch(cdxUrl, { cache: "no-store", signal: AbortSignal.timeout(30000) });
    return new NextResponse(await res.text(), {
      status: res.status,
      headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
    });
  }

  const ts = q.get("ts") || "";
  if (!/^\d{4,14}$/.test(ts)) return NextResponse.json({ error: "ts required" }, { status: 400 });
  const snapUrl = `https://web.archive.org/web/${ts}id_/${target}`;
  const res = await fetch(snapUrl, { cache: "no-store", signal: AbortSignal.timeout(50000) });
  if (!res.ok) return NextResponse.json({ error: `wayback ${res.status}` }, { status: 502 });
  const data = await res.json();

  if (file === "schedule") {
    // Project the 11MB feed down to the slim shape so the response fits.
    const raw = (data.leagueSchedule?.gameDates || []) as Parameters<typeof projectScheduleDates>[0];
    return NextResponse.json(
      {
        seasonYear: String(data.leagueSchedule?.seasonYear ?? ""),
        gameDates: raw.length,
        dates: projectScheduleDates(raw),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
