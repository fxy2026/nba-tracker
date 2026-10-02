import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {expect,it}from'vitest';
import {explicitTimeZone,homeDateUrl,calendarSeason,monthDateKeys}from'./date-navigation';
import {dateInTz}from'./timezone';
import {buildScheduleHeatmap}from'./schedule-heatmap';
import {normalizeCalendarMonth}from'./calendar-month';
import type{ScheduleDate}from'./api';
import ScheduleEmptyNavigation from '@/components/ScheduleEmptyNavigation';
it.each(['America/New_York','Asia/Shanghai','Pacific/Kiritimati','UTC'])('validates supported IANA timezone %s',tz=>expect(explicitTimeZone(tz)).toBe(tz));
it.each(['bad-zone','javascript:alert(1)','',null,undefined])('invalid timezone falls back without reflecting %s',tz=>expect(explicitTimeZone(tz)).toBeUndefined());
it('date links preserve explicit timezone but do not persist preferences',()=>{
 expect(homeDateUrl('2026-03-01','America/New_York')).toBe('/?date=2026-03-01&tz=America%2FNew_York');expect(homeDateUrl('2026-03-01')).toBe('/?date=2026-03-01');expect(homeDateUrl('2026-02-30','UTC')).toBe('/');
});
it('selected timezone preserves date meaning across DST and UTC+14',()=>{
 const instant=new Date('2026-03-08T04:30:00Z');expect(dateInTz(instant,'America/New_York')).toBe('2026-03-07');expect(dateInTz(instant,'Asia/Shanghai')).toBe('2026-03-08');expect(dateInTz(instant,'Pacific/Kiritimati')).toBe('2026-03-08');
});
it('season follows viewed month and leap years preserve all calendar keys',()=>{
 expect(calendarSeason(2026,2)).toBe('2025-26');expect(calendarSeason(2026,9)).toBe('2026-27');expect(monthDateKeys(2024,1)).toHaveLength(29);expect(monthDateKeys(2026,1)).toHaveLength(28);
});
it.each([true,false])('empty navigation retains ET date context in both languages %s',isZh=>{
 const html=renderToStaticMarkup(createElement(ScheduleEmptyNavigation,{date:'2026-03-02',timeZone:'America/New_York',isZh,navigation:{availableFrom:'2026-03-01',availableThrough:'2026-03-03',latestFinalDate:'2026-03-01',nextScheduledDate:'2026-03-03'}}));expect(html.match(/tz=America%2FNew_York/g)).toHaveLength(2);
});
const game=(id:string,status=3)=>({gameId:id,gameStatus:status,gameStatusText:status===3?'Final':'Scheduled'});
it('heatmap fills March2 so March3 stays in its real weekday slot; dedupes games',()=>{
 const result=buildScheduleHeatmap([{gameDate:'03/01/2026 00:00:00',games:[game('0022600001')]},{gameDate:'03/03/2026 00:00:00',games:[game('0022600002'),game('0022600002')]}] as ScheduleDate[],new Date('2026-03-04T00:00Z'));
 const days=result.byMonth.get('2026-03')!;expect(days).toHaveLength(31);expect(days[0]).toMatchObject({date:'2026-03-01',weekday:0,games:1});expect(days[1]).toMatchObject({date:'2026-03-02',weekday:1,games:0});expect(days[2]).toMatchObject({date:'2026-03-03',weekday:2,games:1});expect(result.totalGames).toBe(2);expect(result.totalDays).toBe(2);
});
it('bad dates and conditional TBD games cannot fabricate heatmap counts',()=>{
 const result=buildScheduleHeatmap([{gameDate:'02/30/2026',games:[game('0022600001')]},{gameDate:'03/03/2026',games:[{...game('0042600001',1),ifNecessary:true,gameStatusText:'TBD'}]}] as ScheduleDate[]);expect(result.totalGames).toBe(0);expect(result.byMonth.size).toBe(0);
});
it('calendar payload belongs to the requested month and has truthful counts',()=>{
 expect(normalizeCalendarMonth({data:[]},'2026-03')).toEqual([]);expect(normalizeCalendarMonth({data:[{date:'2026-04-01',gameCount:0,games:[]}]},'2026-03')).toBeNull();expect(normalizeCalendarMonth({data:[{date:'2026-03-01',gameCount:2,games:[]}]},'2026-03')).toBeNull();expect(normalizeCalendarMonth(null,'2026-03')).toBeNull();
});
