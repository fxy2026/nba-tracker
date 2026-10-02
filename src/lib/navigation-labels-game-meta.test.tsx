import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach,expect,it,vi} from 'vitest';
import en from '@/locales/en';
import zh from '@/locales/zh';
import type {BoxScoreTeam} from '@/lib/api';
const state=vi.hoisted(()=>({locale:'en'}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()})}));
vi.mock('@/components/LocaleProvider',()=>({useLocale:()=>({locale:state.locale,t:state.locale==='zh'?zh:en})}));
import DateNav from '@/components/DateNav';
import GameMeta from '@/app/game/[id]/_components/GameMeta';
const originalTZ=process.env.TZ;
afterEach(()=>{if(originalTZ===undefined)delete process.env.TZ;else process.env.TZ=originalTZ;});
it.each(['UTC','Pacific/Kiritimati','America/New_York'])('date chips match locale while retaining calendar date in%s',tz=>{
 process.env.TZ=tz;state.locale='en';let html=renderToStaticMarkup(createElement(DateNav,{selectedDate:'2026-10-02',timeZone:'America/New_York'}));expect(html).toContain('Fri');expect(html).not.toContain('周五');expect(html).toContain('10/2');
 state.locale='zh';html=renderToStaticMarkup(createElement(DateNav,{selectedDate:'2026-10-02',timeZone:'America/New_York'}));expect(html).toContain('周五');expect(html).not.toContain('Fri');expect(html).toContain('10/2');
});
const team=(teamTricode:string,score:number,periods:number)=>({teamTricode,score,periods:Array.from({length:periods},()=>({})),players:[{played:'1',starter:'0',statistics:{points:12,freeThrowsAttempted:4}},{played:'1',starter:'1',statistics:{points:20,freeThrowsAttempted:5}},{played:'0',starter:'0',statistics:{points:99,freeThrowsAttempted:99}}]}) as unknown as BoxScoreTeam;
it.each([4,5,6])('regulation/OT preserves real totals without fictional pace (%s periods)',periods=>{
 for(const t of [en,zh]){const html=renderToStaticMarkup(createElement(GameMeta,{homeTeam:team('DET',126,periods),awayTeam:team('MEM',110,periods),t}));expect(html).toContain('236');expect(html).toContain(t.gameDetail.totalPoints);expect(html).toContain(t.gameDetail.benchPoints);expect(html).toContain(t.gameDetail.freeThrowAtt);expect(html).not.toContain(t.gameDetail.estPace);expect(html).not.toContain('99');}
});
