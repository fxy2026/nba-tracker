import {isValidElement,type ReactNode}from'react';
import {renderToStaticMarkup}from'react-dom/server';
import{beforeEach,afterEach,expect,it,vi}from'vitest';
import{getTranslations}from'@/locales';
const runtime=vi.hoisted(()=>({values:[] as unknown[],cursor:0,effects:[] as {run:()=>void|(()=>void);deps:unknown[]}[],locale:'en'}));
vi.mock('react',async original=>({...await original<typeof import('react')>(),useState:(initial:unknown)=>{const index=runtime.cursor++;if(!(index in runtime.values))runtime.values[index]=typeof initial==='function'?initial():initial;return[runtime.values[index],(value:unknown)=>runtime.values[index]=typeof value==='function'?value(runtime.values[index]):value];},useEffect:(run:()=>void|(()=>void),deps:unknown[])=>runtime.effects.push({run,deps})}));
vi.mock('@/components/LocaleProvider',()=>({useLocale:()=>({locale:runtime.locale,t:getTranslations(runtime.locale as 'en'|'zh')})}));
vi.mock('@/lib/timezone',()=>({localTz:()=> 'UTC'}));
vi.mock('@/components/RelatedPages',()=>({default:()=>null}));
import Page from '@/app/calendar/page';
function render(){runtime.cursor=0;runtime.effects=[];const tree=Page();return{tree,html:renderToStaticMarkup(tree)};}
function buttons(node:ReactNode):{[key:string]:unknown}[]{if(Array.isArray(node))return node.flatMap(buttons);if(!isValidElement<Record<string,unknown>>(node))return[];return[...(node.type==='button'?[node.props]:[]),...buttons(node.props.children as ReactNode),...buttons(node.props.action as ReactNode)];}
const effect=()=>runtime.effects.find(e=>e.deps.length===6)!.run();
const settle=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
const payload=(date:string)=>({data:[{date,gameCount:1,games:[{gameId:'0022500001',homeTricode:'BOS',awayTricode:'NYK',gameStatus:3,homeScore:100,awayScore:90}]}]});
beforeEach(()=>{runtime.values=[];runtime.locale='en';vi.useFakeTimers();vi.setSystemTime(new Date('2026-03-01T12:00Z'));vi.stubGlobal('fetch',vi.fn());});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it.each(['en','zh'])('native date links and month controls are labeled %s',async locale=>{
 runtime.locale=locale;vi.mocked(fetch).mockResolvedValue({ok:true,json:async()=>payload('2026-03-03')} as Response);
 render();runtime.effects[0].run();render();effect();await settle();const{html}=render();expect(html).toContain('2025-26');expect(html).toContain(locale==='zh'?'上个月':'Previous month');expect(html).toContain('href="/?date=2026-03-03"');expect(html).not.toContain(locale==='zh'?'全明星赛':'All-Star Break');
});
it('month changes immediately hide previous summary and late responses cannot overwrite newer month',async()=>{
 let finishOld!:(r:Response)=>void;vi.mocked(fetch).mockImplementationOnce(()=>new Promise(resolve=>finishOld=resolve)).mockResolvedValueOnce({ok:true,json:async()=>payload('2026-04-02')} as Response);
 render();runtime.effects[0].run();let view=render();const cleanup=effect();const next=buttons(view.tree).find(b=>b['aria-label']==='Next month')!;(next.onClick as ()=>void)();view=render();expect(view.html).not.toContain('2026-03-03');if(typeof cleanup==='function')cleanup();effect();await settle();finishOld({ok:true,json:async()=>payload('2026-03-03')} as Response);await settle();view=render();expect(view.html).toContain('2026-04-02');expect(view.html).not.toContain('2026-03-03');
});
it('failed next month never retains old counts and retry recovers same month',async()=>{
 vi.mocked(fetch).mockResolvedValueOnce({ok:true,json:async()=>payload('2026-03-03')} as Response).mockResolvedValueOnce({ok:false} as Response).mockResolvedValueOnce({ok:true,json:async()=>payload('2026-04-02')} as Response);
 render();runtime.effects[0].run();render();effect();await settle();let view=render();(buttons(view.tree).find(b=>b['aria-label']==='Next month')!.onClick as ()=>void)();render();effect();await settle();view=render();expect(view.html).toContain('role="alert"');expect(view.html).not.toContain('2026-03-03');(buttons(view.tree).find(b=>b.children==='Retry')!.onClick as ()=>void)();render();effect();await settle();expect(render().html).not.toContain('role="alert"');expect(render().html).toContain('2026-04-02');
});
