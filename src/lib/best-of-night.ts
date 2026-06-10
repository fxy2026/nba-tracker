// Player of the Night — server-side ranking of the latest completed slate.
// Walks back from today (ET) through the cached schedule to find the most
// recent game day whose games have all gone final, pulls the cached box
// scores, and grades every line via the shared Game Score helpers.

import { formatDate, getBoxScore, getGamesByDate, type ScheduleGame } from "@/lib/api";
import { isCountedSeason } from "@/lib/games";
import { gameScore, minutesFromIso, scoreToGrade } from "@/lib/game-stats";

export interface NightPerformer {
  personId: number;
  name: string;
  teamTricode: string;
  teamScore: number;
  oppTricode: string;
  oppScore: number;
  won: boolean;
  gameId: string;
  grade: number;
  gameScore: number;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
}

export interface GameNight {
  /** ET game day, ISO yyyy-mm-dd (NBA schedule dates are Eastern) */
  date: string;
  /** Final games on the slate that fed the ranking */
  gamesCount: number;
  /** Ranked best-first, capped at the caller's limit */
  performers: NightPerformer[];
}

// How far back to look for a completed slate (covers off days / break gaps)
const MAX_LOOKBACK_DAYS = 7;

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Most recent game days whose slates are done, newest first. A past day
// qualifies once nothing is still live (postponed games keep gameStatus 1
// forever and shouldn't block the night); today only qualifies once every
// game has gone final.
async function findCompletedGameDays(count: number): Promise<{ date: string; finals: ScheduleGame[] }[]> {
  const today = formatDate(new Date());
  const found: { date: string; finals: ScheduleGame[] }[] = [];
  for (let back = 0; back <= MAX_LOOKBACK_DAYS && found.length < count; back++) {
    const date = shiftDate(today, -back);
    const games = (await getGamesByDate(date)).filter((g) => isCountedSeason(g.gameId));
    if (games.length === 0) continue;
    const finals = games.filter((g) => g.gameStatus === 3);
    if (finals.length === 0) continue;
    if (games.some((g) => g.gameStatus === 2)) continue;
    if (date === today && finals.length < games.length) continue;
    found.push({ date, finals });
  }
  return found;
}

async function gradeNight(date: string, finals: ScheduleGame[], limit: number): Promise<GameNight> {
  const boxes = await Promise.all(finals.map((g) => getBoxScore(g.gameId).catch(() => null)));
  const performers: NightPerformer[] = [];
  for (const box of boxes) {
    if (!box || box.gameStatus !== 3) continue;
    const sides = [
      { team: box.homeTeam, opp: box.awayTeam },
      { team: box.awayTeam, opp: box.homeTeam },
    ];
    for (const { team, opp } of sides) {
      for (const p of team.players) {
        if (p.played !== "1") continue;
        const minutes = minutesFromIso(p.statistics.minutes);
        if (minutes <= 0) continue;
        const gs = gameScore(p.statistics);
        performers.push({
          personId: p.personId,
          name: p.name,
          teamTricode: team.teamTricode,
          teamScore: team.score,
          oppTricode: opp.teamTricode,
          oppScore: opp.score,
          won: team.score > opp.score,
          gameId: box.gameId,
          grade: scoreToGrade(gs, minutes),
          gameScore: Math.round(gs * 10) / 10,
          minutes: Math.round(minutes),
          points: p.statistics.points,
          rebounds: p.statistics.reboundsTotal,
          assists: p.statistics.assists,
          steals: p.statistics.steals,
          blocks: p.statistics.blocks,
          fieldGoalsMade: p.statistics.fieldGoalsMade,
          fieldGoalsAttempted: p.statistics.fieldGoalsAttempted,
          threePointersMade: p.statistics.threePointersMade,
        });
      }
    }
  }
  // Rank: grade first (it already regresses short stints toward 5.0), winners
  // break grade ties (the media-vote "win bonus"), raw Game Score the rest.
  performers.sort(
    (a, b) => b.grade - a.grade || Number(b.won) - Number(a.won) || b.gameScore - a.gameScore
  );
  return { date, gamesCount: finals.length, performers: performers.slice(0, limit) };
}

// Top performers for the latest `nights` completed game days, newest first.
// Nights are graded sequentially so a cold cache doesn't fan out 30+ box-score
// fetches at once; final box scores pin in the api.ts LRU afterwards.
export async function getRecentNights(nights = 3, limit = 10): Promise<GameNight[]> {
  const days = await findCompletedGameDays(nights);
  const out: GameNight[] = [];
  for (const day of days) out.push(await gradeNight(day.date, day.finals, limit));
  return out;
}

// The single Player of the Night — feeds the home page widget.
export async function getPlayerOfTheNight(): Promise<{ date: string; performer: NightPerformer } | null> {
  const [night] = await getRecentNights(1, 1);
  if (!night || night.performers.length === 0) return null;
  return { date: night.date, performer: night.performers[0] };
}
