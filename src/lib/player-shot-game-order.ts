import { offsetCalendarDate } from './calendar-date';
export interface DatedShotGame { gameId:string;date:string; }
const months=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
export function parseShotGameDate(raw:unknown):string|null {
 if(typeof raw!=='string')return null;let date:string;
 const iso=/^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.000)?Z?)?$/.exec(raw);
 const named=/^([A-Za-z]{3}) (\d{1,2}), (\d{4})$/.exec(raw);
 const numeric=/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: 00:00:00)?$/.exec(raw);
 if(iso)date=iso[1];
 else if(named){const month=months.indexOf(named[1].toUpperCase())+1;if(!month)return null;date=`${named[3]}-${String(month).padStart(2,'0')}-${named[2].padStart(2,'0')}`;}
 else if(numeric)date=`${numeric[3]}-${numeric[1].padStart(2,'0')}-${numeric[2].padStart(2,'0')}`;
 else return null;
 try{return offsetCalendarDate(date,0);}catch{return null;}
}
export function orderUniqueShotGames(rows:DatedShotGame[]):string[]|null {
 const dates=new Map<string,string>();
 for(const row of rows){if(!/^\d{10}$/.test(row.gameId)||parseShotGameDate(row.date)!==row.date)return null;const prior=dates.get(row.gameId);if(prior&&prior!==row.date)return null;dates.set(row.gameId,row.date);}
 return [...dates].sort(([aId,aDate],[bId,bDate])=>aDate.localeCompare(bDate)||aId.localeCompare(bId)).map(([id])=>id);
}
