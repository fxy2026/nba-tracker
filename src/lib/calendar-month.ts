import { monthDateKeys } from './date-navigation';
export interface CalendarGame { gameId:string;homeTricode:string;awayTricode:string;gameStatus:number;homeScore:number;awayScore:number; }
export interface CalendarDay { date:string;gameCount:number;games:CalendarGame[]; }
export function normalizeCalendarMonth(payload:unknown, month:string): CalendarDay[] | null {
  if(!payload||typeof payload!=='object'||!('data'in payload)||!Array.isArray(payload.data)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return null;
  const [year,number]=month.split('-').map(Number);const dates=new Set(monthDateKeys(year,number-1));const seen=new Set<string>();
  for(const row of payload.data){
    if(!row||typeof row!=='object'||!dates.has(row.date)||seen.has(row.date)||!Number.isSafeInteger(row.gameCount)||row.gameCount<0||!Array.isArray(row.games)||row.games.length!==row.gameCount)return null;
    seen.add(row.date);
    if(!row.games.every((game:unknown)=>{if(!game||typeof game!=='object')return false;const g=game as Record<string,unknown>;return typeof g.gameId==='string'&&/^\d{10}$/.test(g.gameId)&&typeof g.homeTricode==='string'&&typeof g.awayTricode==='string'&&[1,2,3].includes(g.gameStatus as number)&&['homeScore','awayScore'].every(key=>typeof g[key]==='number'&&Number.isFinite(g[key])&&(g[key] as number)>=0);} ))return null;
  }
  return payload.data as CalendarDay[];
}
