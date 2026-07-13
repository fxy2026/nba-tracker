import { NextResponse } from "next/server";
import { STATS_HEADERS, STATS_BASE } from "@/lib/statsProxy";

// TEMPORARY diagnostic route — maps which NBA data endpoints are reachable
// from Vercel's egress after the 2026-07 cdn.nba.com Akamai block. Fixed URL
// list (no user input), first 300 bytes only. Remove once the schedule
// fallback lands.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CDN_HEADERS: HeadersInit = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  Referer: "https://www.nba.com/",
};

const PROBES: { name: string; url: string; headers: HeadersInit }[] = [
  {
    name: "cdn-scoreboard",
    url: "https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json",
    headers: CDN_HEADERS,
  },
  {
    name: "cdn-schedule",
    url: "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json",
    headers: CDN_HEADERS,
  },
  {
    name: "cdn-boxscore",
    url: "https://cdn.nba.com/static/json/liveData/boxscore/boxscore_0042500401.json",
    headers: CDN_HEADERS,
  },
  {
    name: "cdn-playerindex",
    url: "https://cdn.nba.com/static/json/staticData/playerIndex.json",
    headers: CDN_HEADERS,
  },
  {
    name: "stats-schedule",
    url: `${STATS_BASE}/scheduleleaguev2?LeagueID=00&Season=2025-26`,
    headers: STATS_HEADERS,
  },
  {
    name: "stats-scoreboardv2",
    url: `${STATS_BASE}/scoreboardv2?GameDate=2026-06-19&LeagueID=00&DayOffset=0`,
    headers: STATS_HEADERS,
  },
  {
    name: "stats-scoreboardv3",
    url: `${STATS_BASE}/scoreboardv3?GameDate=2026-06-19&LeagueID=00`,
    headers: STATS_HEADERS,
  },
  {
    name: "stats-boxscorev3",
    url: `${STATS_BASE}/boxscoretraditionalv3?GameID=0042500401&StartPeriod=1&EndPeriod=10&StartRange=0&EndRange=28800&RangeType=0`,
    headers: STATS_HEADERS,
  },
  {
    name: "stats-pbpv3",
    url: `${STATS_BASE}/playbyplayv3?GameID=0042500401&StartPeriod=1&EndPeriod=10`,
    headers: STATS_HEADERS,
  },
  {
    name: "stats-playerindex",
    url: `${STATS_BASE}/playerindex?College=&Country=&DraftPick=&DraftRound=&DraftYear=&Height=&Historical=1&LeagueID=00&Season=2025-26&SeasonType=Regular%20Season&TeamID=0&Weight=`,
    headers: STATS_HEADERS,
  },
  {
    name: "espn-scoreboard",
    url: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=20260619",
    headers: {},
  },
  {
    name: "stats-leaguegamelog",
    url: `${STATS_BASE}/leaguegamelog?Counter=1000&DateFrom=&DateTo=&Direction=DESC&LeagueID=00&PlayerOrTeam=T&Season=2025-26&SeasonType=Regular%20Season&Sorter=DATE`,
    headers: STATS_HEADERS,
  },
  {
    name: "stats-pbpv2",
    url: `${STATS_BASE}/playbyplayv2?GameID=0042500401&StartPeriod=1&EndPeriod=10`,
    headers: STATS_HEADERS,
  },
  {
    name: "stats-boxscorev2",
    url: `${STATS_BASE}/boxscoretraditionalv2?GameID=0042500401&StartPeriod=1&EndPeriod=10&StartRange=0&EndRange=28800&RangeType=0`,
    headers: STATS_HEADERS,
  },
  {
    name: "stats-boxsummaryv2",
    url: `${STATS_BASE}/boxscoresummaryv2?GameID=0042500401`,
    headers: STATS_HEADERS,
  },
  {
    name: "stats-teamgamelogs",
    url: `${STATS_BASE}/teamgamelogs?LeagueID=00&Season=2025-26&SeasonType=Regular%20Season`,
    headers: STATS_HEADERS,
  },
  {
    name: "stats-commonteamroster",
    url: `${STATS_BASE}/commonteamroster?LeagueID=00&Season=2025-26&TeamID=1610612747`,
    headers: STATS_HEADERS,
  },
  {
    name: "stats-shotchartdetail",
    url: `${STATS_BASE}/shotchartdetail?PlayerID=0&TeamID=0&GameID=0042500404&ContextMeasure=FGA&Season=2025-26&SeasonType=Playoffs&LeagueID=00&LastNGames=0&Month=0&OpponentTeamID=0&Period=0&VsDivision=&VsConference=&SeasonSegment=&RookieYear=&Position=&PlayerPosition=&Outcome=&Location=&GameSegment=&DateFrom=&DateTo=&ClutchTime=&AheadBehind=&PointDiff=&RangeType=0&StartPeriod=1&EndPeriod=10&StartRange=0&EndRange=28800`,
    headers: STATS_HEADERS,
  },
  {
    name: "stats-leagueleaders-ctl",
    url: `${STATS_BASE}/leagueleaders?LeagueID=00&PerMode=PerGame&Scope=S&Season=2025-26&SeasonType=Regular%20Season&StatCategory=REB&ActiveFlag=`,
    headers: STATS_HEADERS,
  },
];

async function probe(p: { name: string; url: string; headers: HeadersInit }) {
  const started = Date.now();
  try {
    const res = await fetch(p.url, {
      headers: p.headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    let head = "";
    if (res.body) {
      const reader = res.body.getReader();
      const { value } = await reader.read();
      await reader.cancel().catch(() => {});
      head = new TextDecoder()
        .decode(value ?? new Uint8Array())
        .replace(/\s+/g, " ")
        .slice(0, 160);
    }
    return { name: p.name, status: res.status, ms: Date.now() - started, head };
  } catch (err) {
    return { name: p.name, status: 0, ms: Date.now() - started, head: String(err).slice(0, 120) };
  }
}

export async function GET() {
  const results = await Promise.all(PROBES.map(probe));
  return NextResponse.json(results, { headers: { "Cache-Control": "no-store" } });
}
