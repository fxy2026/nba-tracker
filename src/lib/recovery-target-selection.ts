import { TEAM_META } from "./teams";
import type { RecoveryTarget } from "./recovery-candidates";
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
function playoffRound(gameId:string):number|null {
  if(!gameId.startsWith('004'))return 0;
  if(!/^0042500[1-4][0-7][1-7]$/.test(gameId))return null;
  const round=Number(gameId[7]);
  return Number(gameId[8])<2**(4-round)?round:null;
}
const score=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;

// Controlled backfill from the already bundled2025-26 schedule only. No live
// season crawl or guessed synthetic-ID mapping. The generated target list is
// explicit and bounded before the provider client sees it.
export function selectRecoveryTargets(raw:unknown,existingIds:ReadonlySet<string>,cursor:string|null,maxGames=20):RecoveryTarget[]{
  if(!object(raw)||!Array.isArray(raw.dates)||!Number.isSafeInteger(maxGames)||maxGames<1||maxGames>20)throw new Error('Invalid recovery target source');
  const targets:RecoveryTarget[]=[],seen=new Set<string>();
  for(const day of raw.dates){
    if(!object(day)||!Array.isArray(day.games))throw new Error('Invalid schedule group');
    for(const g of day.games){
      if(!object(g)||g.gameStatus!==3||typeof g.gameId!=='string'||!/^00[1245]25\d{5}$/.test(g.gameId))continue;
      if(playoffRound(g.gameId)===null)continue;
      if(seen.has(g.gameId))throw new Error('Duplicate recovery game identity');seen.add(g.gameId);
      if(!object(g.homeTeam)||!object(g.awayTeam)||typeof g.homeTeam.teamTricode!=='string'||typeof g.awayTeam.teamTricode!=='string'||!Object.hasOwn(TEAM_META,g.homeTeam.teamTricode)||!Object.hasOwn(TEAM_META,g.awayTeam.teamTricode)||g.homeTeam.teamTricode===g.awayTeam.teamTricode||!score(g.homeTeam.score)||!score(g.awayTeam.score)||g.homeTeam.score===g.awayTeam.score||typeof g.gameCode!=='string'||typeof g.gameDateTimeUTC!=='string')continue;
      const stamp=g.gameCode.split('/')[0];if(!/^\d{8}$/.test(stamp))continue;
      const gameDate=`${stamp.slice(0,4)}-${stamp.slice(4,6)}-${stamp.slice(6,8)}`;
      const utc=Date.parse(g.gameDateTimeUTC);if(!validDate(gameDate)||!Number.isFinite(utc))continue;
      const utcDate=new Date(utc).toISOString().slice(0,10);
      if(Math.abs(Date.parse(utcDate)-Date.parse(gameDate))>86400000)continue;
      targets.push({nbaGameId:g.gameId,season:'2025-26',gameDate,home:{tricode:g.homeTeam.teamTricode,score:g.homeTeam.score},away:{tricode:g.awayTeam.teamTricode,score:g.awayTeam.score},lookupDates:[...new Set([gameDate,utcDate])]});
    }
  }
  // User priority: Finals, conference finals, second/first rounds, then other games.
  // Within each tier retain deterministic newest-date/id order; the cursor walks
  // this complete order so unavailable playoff targets cannot starve all others.
  targets.sort((a,b)=>(playoffRound(b.nbaGameId)??0)-(playoffRound(a.nbaGameId)??0)||b.gameDate.localeCompare(a.gameDate)||b.nbaGameId.localeCompare(a.nbaGameId));
  const cursorIndex=cursor?targets.findIndex(g=>g.nbaGameId===cursor):-1;
  const ordered=cursorIndex<0?targets:[...targets.slice(cursorIndex+1),...targets.slice(0,cursorIndex+1)];
  const identities=new Map<string,Set<string>>();
  const keys=(g:RecoveryTarget)=>g.lookupDates.map(d=>`${d}|${g.home.tricode}|${g.away.tricode}|${g.home.score}|${g.away.score}`);
  for(const g of targets)for(const key of keys(g)){const ids=identities.get(key)??new Set<string>();ids.add(g.nbaGameId);identities.set(key,ids);}
  // Adjacent-day lookup must not steal another local game's identity when
  // the same matchup/final score repeats across overlapping date windows.
  return ordered.filter(g=>!existingIds.has(g.nbaGameId)&&keys(g).every(key=>identities.get(key)!.size===1)).slice(0,maxGames);
}
