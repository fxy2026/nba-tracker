import type { ScheduleDate, ScheduleGame } from "./api";
import { isRegular } from "./games";
import { offsetCalendarDate } from "./calendar-date";

/** Require a full recent-form window; this is a sufficiency rule, not validation of accuracy. */
export const MIN_PREDICTION_GAMES = 10;
interface TeamForm { wins: number; losses: number; last10Pct: number; pf: number; pa: number; pd: number; power: number }
type FormGame = { won: boolean; pf: number; pa: number; date: string };
type Base = { game: ScheduleGame; date: string; homeSamples: number; awaySamples: number };
export type PredictedGame = Base & ({ qualified: false } | {
  qualified: true; homeForm: TeamForm; awayForm: TeamForm; predictedWinner: "home" | "away";
  edgeScore: number; spread: number;
});
function dateKey(value: string): string | null {
  const [m, d, y] = value.split(" ")[0].split("/");
  if (!m || !d || !y) return null;
  try { return offsetCalendarDate(`${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`, 0); } catch { return null; }
}
function form(games: FormGame[]): TeamForm {
  const sorted = [...games].sort((a,b) => b.date.localeCompare(a.date));
  const wins = sorted.filter(g => g.won).length;
  const last10 = sorted.slice(0,10);
  const last10Pct = last10.filter(g => g.won).length / last10.length;
  const pf = last10.reduce((s,g) => s+g.pf,0) / last10.length;
  const pa = last10.reduce((s,g) => s+g.pa,0) / last10.length;
  const pd = pf-pa;
  const pdScore = Math.min(Math.max((pd+15)/30,0),1);
  return { wins, losses: sorted.length-wins, last10Pct, pf, pa, pd, power: wins/sorted.length*0.35+last10Pct*0.35+pdScore*0.3 };
}
/** Caller supplies the current-season schedule, including its existing upcoming game types. */
export function buildPredictions(schedule: ScheduleDate[], today: string): PredictedGame[] {
  const cutoff = offsetCalendarDate(today,7);
  const finished = new Map<string, FormGame[]>();
  const seen = new Set<string>();
  for (const gd of schedule) {
    const date = dateKey(gd.gameDate);
    if (!date || date > today) continue;
    for (const g of gd.games) {
      if (seen.has(g.gameId) || g.gameStatus !== 3 || !isRegular(g.gameId)) continue;
      const h=g.homeTeam, a=g.awayTeam;
      if (h.teamTricode===a.teamTricode || ![h.score,a.score].every(s => Number.isSafeInteger(s) && s>=0) || h.score===a.score) continue;
      seen.add(g.gameId);
      for (const [tri,pf,pa] of [[h.teamTricode,h.score,a.score],[a.teamTricode,a.score,h.score]] as const) {
        const rows=finished.get(tri)??[]; rows.push({ date,won:pf>pa,pf,pa }); finished.set(tri,rows);
      }
    }
  }
  const predictions: PredictedGame[]=[];
  const upcomingSeen=new Set<string>();
  for (const gd of schedule) {
    const date=dateKey(gd.gameDate); if (!date || date<today || date>cutoff) continue;
    for (const game of gd.games) {
      if (game.gameStatus!==1 || upcomingSeen.has(game.gameId)) continue;
      upcomingSeen.add(game.gameId);
      const home=finished.get(game.homeTeam.teamTricode)??[], away=finished.get(game.awayTeam.teamTricode)??[];
      const base={game,date,homeSamples:home.length,awaySamples:away.length};
      if (home.length<MIN_PREDICTION_GAMES || away.length<MIN_PREDICTION_GAMES) { predictions.push({...base,qualified:false}); continue; }
      const homeForm=form(home), awayForm=form(away);
      const diff=homeForm.power+0.05-awayForm.power;
      predictions.push({...base,qualified:true,homeForm,awayForm,predictedWinner:diff>=0?"home":"away",
        edgeScore:Math.min(0.95,Math.max(0.51,0.5+Math.abs(diff)*1.2)),spread:Math.round((diff*25+(diff>=0?3:-3))*2)/2});
    }
  }
  return predictions.sort((a,b)=>a.date.localeCompare(b.date)).slice(0,20);
}
