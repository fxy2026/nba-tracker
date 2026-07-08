import { SEASON_SNAPSHOT, type SeasonSnapshot, type SnapshotGame } from "./season-snapshot";
import { isRegular, isPlayoff } from "./games";

export interface RecapGame {
  gameId: string;
  gameDate: string;
  homeTricode: string;
  homeTeamId: number;
  homeScore: number;
  awayTricode: string;
  awayTeamId: number;
  awayScore: number;
  margin: number;
  total: number;
}

export interface ExtremeGame extends RecapGame {
  /** the metric value that makes this game the record holder */
  value: number;
}

export interface FinalsResult {
  champion: string;
  championTricode: string;
  championTeamId: number;
  runnerUp: string;
  runnerUpTricode: string;
  runnerUpTeamId: number;
  seriesText: string;
  games: RecapGame[];
}

export interface SeasonRecordExtremes {
  highestTeamScore: ExtremeGame | null;
  lowestTeamScore: ExtremeGame | null;
  largestMargin: ExtremeGame | null;
  highestCombined: ExtremeGame | null;
  totalGames: number;
}

export interface SeasonBestGames {
  closest: RecapGame[];
  highestScoring: RecapGame[];
}

function fullName(snapshot: SeasonSnapshot, tricode: string): string {
  const t = snapshot.teams.find((x) => x.tricode === tricode);
  return t ? `${t.teamCity} ${t.teamName}` : tricode;
}

function teamIdFor(snapshot: SeasonSnapshot, tricode: string): number {
  return snapshot.teams.find((x) => x.tricode === tricode)?.teamId ?? 0;
}

function toRecapGame(g: SnapshotGame): RecapGame {
  return {
    gameId: g.gameId,
    gameDate: g.gameDate,
    homeTricode: g.homeTricode,
    homeTeamId: g.homeTeamId,
    homeScore: g.homeScore,
    awayTricode: g.awayTricode,
    awayTeamId: g.awayTeamId,
    awayScore: g.awayScore,
    margin: Math.abs(g.homeScore - g.awayScore),
    total: g.homeScore + g.awayScore,
  };
}

// Round 4 of the playoffs = the Finals. NBA encodes the round in charAt(7).
function isFinalsGame(gameId: string): boolean {
  return isPlayoff(gameId) && gameId.charAt(7) === "4";
}

function countedGames(snapshot: SeasonSnapshot): RecapGame[] {
  return snapshot.finishedGames
    .filter((g) => isRegular(g.gameId) || isPlayoff(g.gameId))
    .map(toRecapGame);
}

export function finalsResult(snapshot: SeasonSnapshot = SEASON_SNAPSHOT): FinalsResult {
  const games = snapshot.finishedGames
    .filter((g) => isFinalsGame(g.gameId))
    .map(toRecapGame)
    .sort((a, b) => a.gameDate.localeCompare(b.gameDate) || a.gameId.localeCompare(b.gameId));

  const wins: Record<string, number> = {};
  for (const g of games) {
    const winner = g.homeScore > g.awayScore ? g.homeTricode : g.awayTricode;
    wins[winner] = (wins[winner] || 0) + 1;
  }
  const ranked = Object.entries(wins).sort((a, b) => b[1] - a[1]);
  const championTricode = ranked[0]?.[0] ?? "";
  const runnerUpTricode = ranked[1]?.[0] ?? "";
  const championWins = ranked[0]?.[1] ?? 0;
  const runnerUpWins = ranked[1]?.[1] ?? 0;

  return {
    champion: championTricode ? fullName(snapshot, championTricode) : "",
    championTricode,
    championTeamId: teamIdFor(snapshot, championTricode),
    runnerUp: runnerUpTricode ? fullName(snapshot, runnerUpTricode) : "",
    runnerUpTricode,
    runnerUpTeamId: teamIdFor(snapshot, runnerUpTricode),
    seriesText: games.length > 0 ? `${championWins}-${runnerUpWins}` : "",
    games,
  };
}

export function seasonRecordExtremes(snapshot: SeasonSnapshot = SEASON_SNAPSHOT): SeasonRecordExtremes {
  const games = countedGames(snapshot);
  if (games.length === 0) {
    return { highestTeamScore: null, lowestTeamScore: null, largestMargin: null, highestCombined: null, totalGames: 0 };
  }
  const withValue = (g: RecapGame, value: number): ExtremeGame => ({ ...g, value });
  let highest = withValue(games[0], Math.max(games[0].homeScore, games[0].awayScore));
  let lowest = withValue(games[0], Math.min(games[0].homeScore, games[0].awayScore));
  let margin = withValue(games[0], games[0].margin);
  let combined = withValue(games[0], games[0].total);
  for (const g of games) {
    const hi = Math.max(g.homeScore, g.awayScore);
    const lo = Math.min(g.homeScore, g.awayScore);
    if (hi > highest.value) highest = withValue(g, hi);
    if (lo < lowest.value) lowest = withValue(g, lo);
    if (g.margin > margin.value) margin = withValue(g, g.margin);
    if (g.total > combined.value) combined = withValue(g, g.total);
  }
  return { highestTeamScore: highest, lowestTeamScore: lowest, largestMargin: margin, highestCombined: combined, totalGames: games.length };
}

export function seasonBestGames(snapshot: SeasonSnapshot = SEASON_SNAPSHOT): SeasonBestGames {
  const games = countedGames(snapshot);
  const closest = [...games].sort((a, b) => a.margin - b.margin || b.total - a.total).slice(0, 5);
  const highestScoring = [...games].sort((a, b) => b.total - a.total).slice(0, 5);
  return { closest, highestScoring };
}
