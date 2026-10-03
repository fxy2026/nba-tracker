import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { collegeSourceLabel } from './college-source';
const state=vi.hoisted(()=>({locale:'en', players:[] as Record<string,unknown>[], failed:false}));
vi.mock('@/lib/locale',()=>({getLocale:async()=>state.locale}));
vi.mock('@/lib/api',()=>({getPlayerIndexSnapshot:async()=>{if(state.failed)throw Error('offline');return{players:state.players,provenance:{source:'bundled-archive',season:'2025-26',stale:true,retrievedAt:null}};}}));
vi.mock('@/components/PlayerHeadshot',()=>({default:()=>null}));
import Page from '@/app/by-college/page';
const player=(id:number,college:unknown,pts:unknown=10)=>({personId:id,firstName:'Player',lastName:String(id),teamAbbr:'DEN',college,pts,reb:2,ast:3});
beforeEach(()=>{state.locale='en';state.players=[];state.failed=false;});
it.each(['',' ','-',' — ','N/A','null','unknown',null,undefined])('unknown label %s does not become a school',value=>expect(collegeSourceLabel(value)).toBeNull());
it.each(['Duke','Real Madrid','NBA G League Ignite','Washington Wizards'])('preserves original mixed source %s',label=>expect(collegeSourceLabel(label)).toBe(label));
it.each(['en','zh'])('labels mixed sources and archived roster honestly (%s)',async locale=>{
 state.locale=locale;state.players=[player(1,'Duke'),player(2,'Real Madrid'),player(3,'Washington Wizards'),player(4,'-')];
 const html=renderToStaticMarkup(await Page());expect(html).toContain('2025-26');expect(html).toContain('Real Madrid');expect(html).toContain('Washington Wizards');expect(html).toContain(locale==='en'?'3 background groups':'3 个来源分组');expect(html).toContain(locale==='en'?'1 players have unspecified backgrounds':'1 名球员的来源未注明');expect(html).not.toContain(locale==='en'?'schools represented':'所院校');expect(html).not.toContain(locale==='en'?' active':'现役');expect(html).not.toContain('last season');
});
it('true zero participates in the mean; unknown statistics remain unavailable without crashing',async()=>{
 state.players=[player(1,'Duke',10),player(2,'Duke',0),{...player(3,'Duke',null),reb:null,ast:null},player(4,'Other',null)];
 const html=renderToStaticMarkup(await Page());expect(html).toContain('5.0');expect(html).toContain('—');expect(html).not.toContain('NaN');expect(html).not.toContain('undefined');
});
it('all unknown backgrounds have zero groups and an explicit excluded count',async()=>{state.players=[player(1,'-'),player(2,null)];const html=renderToStaticMarkup(await Page());expect(html).toContain('0 background groups');expect(html).toContain('2 players have unspecified backgrounds');});
it('source failure renders the existing explicit unavailable state',async()=>{state.failed=true;expect(renderToStaticMarkup(await Page())).toContain('Could not load player index');});
