import { offsetCalendarDate } from './calendar-date';
export function explicitTimeZone(value: string | null | undefined): string | undefined {
  if (!value || value.length > 100) return undefined;
  try { return new Intl.DateTimeFormat('en-US',{timeZone:value}).resolvedOptions().timeZone; }
  catch { return undefined; }
}
export function homeDateUrl(date: string, timeZone?: string): string {
  try { offsetCalendarDate(date,0); } catch { return '/'; }
  const query = new URLSearchParams({date});
  const tz = explicitTimeZone(timeZone); if(tz) query.set('tz',tz);
  return `/?${query}`;
}
export function calendarSeason(year: number, month: number): string {
  const start = month >= 9 ? year : year-1;
  return `${start}-${String((start+1)%100).padStart(2,'0')}`;
}
export function monthDateKeys(year: number, month: number): string[] {
  const count = new Date(Date.UTC(year,month+1,0)).getUTCDate();
  return Array.from({length:count},(_,i)=>`${year}-${String(month+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`);
}
