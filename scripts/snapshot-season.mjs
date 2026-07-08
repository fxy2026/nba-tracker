// One-shot freeze of the 2025-26 season before the CDN schedule doc rolls to
// 2026-27 (historically mid-August). Output feeds /api/standings and the
// follow digest as offseason fallback data. Run: node scripts/snapshot-season.mjs
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FEED = "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  Referer: "https://www.nba.com/",
};
const EXPECTED_SEASON_YEAR = "2025";
const SEASON = "2025-26";

function fail(msg) {
  console.error(`snapshot-season: ${msg}`);
  process.exit(1);
}

function isoDate(gameDate) {
  const [month, day, year] = gameDate.split(" ")[0].split("/");
  return `${year}-${month}-${day}`;
}

const res = await fetch(FEED, { headers: HEADERS });
if (!res.ok) fail(`feed fetch failed: HTTP ${res.status}`);
const data = await res.json();

const league = data.leagueSchedule;
if (!league) fail("feed has no leagueSchedule");
const startYear = String(league.seasonYear).slice(0, 4);
if (startYear !== EXPECTED_SEASON_YEAR) {
  fail(
    `seasonYear is "${league.seasonYear}" (startYear "${startYear}"), expected "${EXPECTED_SEASON_YEAR}" — the feed already rolled over, this snapshot can no longer be taken`,
  );
}

const teamMap = new Map();
const finishedGames = [];

for (const gd of league.gameDates ?? []) {
  for (const g of gd.games ?? []) {
    if (g.gameStatus !== 3) continue;
    finishedGames.push({
      gameId: g.gameId,
      gameDate: isoDate(gd.gameDate),
      homeTricode: g.homeTeam.teamTricode,
      homeTeamId: g.homeTeam.teamId,
      homeScore: g.homeTeam.score,
      awayTricode: g.awayTeam.teamTricode,
      awayTeamId: g.awayTeam.teamId,
      awayScore: g.awayTeam.score,
    });
    if (!g.gameId.startsWith("002")) continue;
    for (const side of [g.homeTeam, g.awayTeam]) {
      if (!teamMap.has(side.teamTricode)) {
        teamMap.set(side.teamTricode, {
          tricode: side.teamTricode,
          teamId: side.teamId,
          teamName: side.teamName,
          teamCity: side.teamCity,
          wins: 0,
          losses: 0,
        });
      }
    }
    const home = teamMap.get(g.homeTeam.teamTricode);
    const away = teamMap.get(g.awayTeam.teamTricode);
    if (g.homeTeam.score > g.awayTeam.score) {
      home.wins++;
      away.losses++;
    } else {
      away.wins++;
      home.losses++;
    }
  }
}

if (finishedGames.length === 0) fail("zero finished games in the feed — nothing to snapshot");

finishedGames.sort((a, b) => a.gameDate.localeCompare(b.gameDate));
const teams = [...teamMap.values()].sort((a, b) => {
  const wa = a.wins / (a.wins + a.losses || 1);
  const wb = b.wins / (b.wins + b.losses || 1);
  return wb - wa;
});

const snapshot = { season: SEASON, generatedAt: new Date().toISOString(), teams, finishedGames };

const outPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "data",
  "season-2025-26-final.json",
);
writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + "\n");

const count = (prefix) => finishedGames.filter((g) => g.gameId.startsWith(prefix)).length;
console.log(`wrote ${outPath}`);
console.log(`teams: ${teams.length}`);
console.log(
  `finished games: ${finishedGames.length} (regular ${count("002")}, playoffs ${count("004")}, play-in ${count("005")}, preseason ${count("001")}, all-star ${count("003")})`,
);
console.log(`top of table: ${teams[0].tricode} ${teams[0].wins}-${teams[0].losses}`);
const lastGame = finishedGames[finishedGames.length - 1];
console.log(`last game: ${lastGame.gameId} on ${lastGame.gameDate} (${lastGame.awayTricode} @ ${lastGame.homeTricode})`);
