import type { ScheduleDate } from './api';
import type { PlannedFixture } from './planned-fixtures';
import { monthDateKeys } from './date-navigation';
export interface HeatmapDay {date:string;display:string;weekday:number;games:number;finished:number;isFuture:boolean;}
export function buildScheduleHeatmap(schedule:ScheduleDate[],now=new Date()) {
  const todayStr=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const counts=new Map<string,{games:number;finished:number}>();const seen=new Set<string>();
  for(const day of schedule){
    const match=/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/.exec(day.gameDate);if(!match)continue;
    const [,m,d,y]=match;const key=`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    const stamp=new Date(`${key}T00:00:00Z`);if(!Number.isFinite(stamp.getTime())||stamp.toISOString().slice(0,10)!==key)continue;
    for(const game of day.games){
      if(seen.has(game.gameId)||(game.gameStatus===1&&(game.ifNecessary||/tbd/i.test(game.gameStatusText??''))))continue;
      seen.add(game.gameId);const value=counts.get(key)??{games:0,finished:0};value.games++;if(game.gameStatus===3)value.finished++;counts.set(key,value);
    }
  }
  return heatmapFromCounts(counts, todayStr);
}

export function buildPlannedScheduleHeatmap(fixtures: readonly PlannedFixture[], now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const counts = new Map<string, { games: number; finished: number }>();
  for (const fixture of new Map(fixtures.map(f => [f.key, f])).values()) {
    const value = counts.get(fixture.dateET) ?? { games: 0, finished: 0 };
    value.games++; counts.set(fixture.dateET, value);
  }
  return heatmapFromCounts(counts, today);
}

function heatmapFromCounts(counts: Map<string, {games:number;finished:number}>, todayStr: string) {
  const byMonth=new Map<string,HeatmapDay[]>();
  for(const month of [...new Set([...counts.keys()].map(date=>date.slice(0,7)))].sort()){
    const[y,m]=month.split('-').map(Number);
    byMonth.set(month,monthDateKeys(y,m-1).map(date=>({date,display:`${m}/${Number(date.slice(8))}`,weekday:new Date(`${date}T00:00:00Z`).getUTCDay(),...(counts.get(date)??{games:0,finished:0}),isFuture:date>todayStr})));
  }
  const values=[...counts.values()];return{byMonth,totalGames:values.reduce((sum,d)=>sum+d.games,0),finishedGames:values.reduce((sum,d)=>sum+d.finished,0),maxGames:Math.max(0,...values.map(d=>d.games)),totalDays:counts.size,todayStr};
}
