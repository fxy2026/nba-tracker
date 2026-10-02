import {TEAM_META} from './teams';
export interface StandingsTeamRecord {tricode:string;teamId:number;teamName:string;teamCity:string;wins:number;losses:number}
export interface ParsedStandings {teams:StandingsTeamRecord[]; archivedSeason:string|null}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const count=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
/** Unknown/malformed rows are failures, not a fabricated empty standings table. */
export function parseStandingsResponse(raw:unknown):ParsedStandings|null{
 if(!object(raw)||!Array.isArray(raw.data)||raw.data.length>30||!(raw.archived===undefined||typeof raw.archived==='boolean'))return null;
 if(raw.archived===true&&(typeof raw.season!=='string'||!/^\d{4}-\d{2}$/.test(raw.season)))return null;
 const seen=new Set<string>();const teams:StandingsTeamRecord[]=[];
 for(const row of raw.data){
  if(!object(row)||typeof row.tricode!=='string'||!Object.hasOwn(TEAM_META,row.tricode)||seen.has(row.tricode)||
    row.teamId!==TEAM_META[row.tricode].teamId||typeof row.teamName!=='string'||!row.teamName.trim()||typeof row.teamCity!=='string'||!row.teamCity.trim()||
    !count(row.wins)||!count(row.losses)||!Number.isSafeInteger(row.wins+row.losses))return null;
  seen.add(row.tricode);
  if(row.wins+row.losses>0)teams.push(row as unknown as StandingsTeamRecord);
 }
 teams.sort((a,b)=>b.wins/(b.wins+b.losses)-a.wins/(a.wins+a.losses));
 return {teams,archivedSeason:raw.archived===true?raw.season as string:null};
}
