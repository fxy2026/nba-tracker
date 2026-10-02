import type { CareerSeasonRow } from './player-career-data';
export interface CareerShootingRates { source:'nba-career-totals'; FG_PCT:number|null; FG3_PCT:number|null; FT_PCT:number|null; }
export function normalizeCareerShooting(raw:unknown): CareerShootingRates|null {
 if(!raw||typeof raw!=='object')return null;const r=raw as Record<string,unknown>;
 if(r.source!=='nba-career-totals'||!['FG_PCT','FG3_PCT','FT_PCT'].every(k=>r[k]===null||(typeof r[k]==='number'&&Number.isFinite(r[k])&&(r[k] as number)>=0&&(r[k] as number)<=1)))return null;
 return {source:'nba-career-totals',FG_PCT:r.FG_PCT as number|null,FG3_PCT:r.FG3_PCT as number|null,FT_PCT:r.FT_PCT as number|null};
}
// Same existing playercareerstats response; no extra endpoint/request. Provider
// aggregate percentages avoid guessing attempts from rounded season averages.
export function parseCareerShootingTable(raw:unknown,playerId:number):CareerShootingRates|null {
 if(!raw||typeof raw!=='object')return null;const table=raw as {headers?:unknown;rowSet?:unknown};
 if(!Array.isArray(table.headers)||!table.headers.every(h=>typeof h==='string')||new Set(table.headers).size!==table.headers.length||!Array.isArray(table.rowSet)||table.rowSet.length!==1)return null;
 const headers=table.headers;
 const required=['PLAYER_ID','GP','FG_PCT','FG3_PCT','FT_PCT','FGA','FG3A','FTA'];if(!required.every(h=>headers.includes(h)))return null;
 const row=table.rowSet[0];if(!Array.isArray(row)||row.length<headers.length)return null;
 const value=(key:string)=>row[headers.indexOf(key)];
 if(value('PLAYER_ID')!==playerId||!Number.isSafeInteger(value('GP'))||value('GP')<=0)return null;
 const out:Record<string,unknown>={source:'nba-career-totals'};
 for(const [pct,attempt]of [['FG_PCT','FGA'],['FG3_PCT','FG3A'],['FT_PCT','FTA']]){
  const attempts=value(attempt),rate=value(pct);if(typeof attempts!=='number'||!Number.isFinite(attempts)||attempts<0)return null;
  if(!(rate===null||(typeof rate==='number'&&Number.isFinite(rate)&&rate>=0&&rate<=1)))return null;
  out[pct]=attempts===0?null:rate;
 }
 return normalizeCareerShooting(out);
}
// Preserve all displayed team-split rows, but never count TOT plus its teams
// twice in career arithmetic. Ambiguous duplicate totals/teams fail closed.
export function careerAggregationRows(rows:CareerSeasonRow[]):CareerSeasonRow[]|null {
 const years=new Map<string,CareerSeasonRow[]>();for(const row of rows){const group=years.get(row.SEASON_ID)??[];group.push(row);years.set(row.SEASON_ID,group);}
 const result:CareerSeasonRow[]=[];
 for(const [,group]of [...years].sort(([a],[b])=>a.localeCompare(b))){
  const total=group.filter(row=>row.TEAM_ABBREVIATION==='TOT');if(total.length>1)return null;
  if(total.length===1){result.push(total[0]);continue;}
  if(new Set(group.map(row=>row.TEAM_ABBREVIATION)).size!==group.length)return null;
  result.push(...group);
 }
 return result;
}
