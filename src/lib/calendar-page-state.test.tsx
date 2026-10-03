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

function elements(node:ReactNode):Record<string,unknown>[]{
 if(Array.isArray(node))return node.flatMap(elements);
 if(!isValidElement<Record<string,unknown>>(node))return[];
 return[node.props,...elements(node.props.children as ReactNode),...elements(node.props.action as ReactNode)];
}
it.each(['en','zh'])('compact %s calendar cells keep full date navigation and desktop game previews',async locale=>{
 runtime.locale=locale;
 const game=payload('2026-03-03').data[0].games[0];
 const games=Array.from({length:15},(_,index)=>({...game,gameId:String(225000001+index).padStart(10,'0')}));
 vi.mocked(fetch).mockResolvedValue({ok:true,json:async()=>({data:[{date:'2026-03-03',gameCount:15,games}]})} as Response);
 render();runtime.effects[0].run();render();effect();await settle();
 const view=render();
 const link=elements(view.tree).find(node=>node.href==='/?date=2026-03-03')!;
 expect(link['aria-label']).toBe(`2026-03-03 · 15 ${locale==='zh'?'场已列比赛':'listed games'}`);
 expect(link.className).toContain('min-w-0');
 expect(link.className).toContain('text-center sm:text-left');
 const children=elements(link.children as ReactNode);
 const compact=children.find(node=>String(node.className).includes('sm:hidden'))!;
 expect(compact.className).toContain('whitespace-nowrap');
 expect(compact['aria-hidden']).toBe('true');
 expect(compact.children).toEqual([15,locale==='zh'?'场':'']);
 const desktop=children.find(node=>node.className==='hidden sm:block')!;
 const preview=renderToStaticMarkup(desktop.children as ReactNode);
 expect(preview).toContain('NYK');expect(preview).toContain('BOS');expect(preview).toContain('90');expect(preview).toContain('100');expect(preview).toContain('+13');
 expect(view.html).toContain(locale==='zh'?'点击日期查看当天全部比赛':'Tap a date for all games');
 for(const label of locale==='zh'?['上个月','下个月']:['Previous month','Next month']){
  const control=buttons(view.tree).find(button=>button['aria-label']===label)!;
  expect(control.className).toContain('min-h-[44px]');expect(control.className).toContain('min-w-[44px]');
 }
});
it.each(['en','zh'])('month navigation keeps Today reachable and restores the current month in %s',locale=>{
 runtime.locale=locale;
 let view=render();
 const next=buttons(view.tree).find(button=>button['aria-label']===(locale==='zh'?'下个月':'Next month'))!;
 (next.onClick as ()=>void)();view=render();
 expect(elements(view.tree).some(node=>String(node.className).includes('max-w-full flex-wrap'))).toBe(true);
 const today=buttons(view.tree).find(button=>button.children===(locale==='zh'?'今天':'Today'))!;
 expect(today).toBeDefined();expect(today.className).toContain('min-h-[44px]');
 (today.onClick as ()=>void)();view=render();
 expect(buttons(view.tree).some(button=>button.children===(locale==='zh'?'今天':'Today'))).toBe(false);
 expect(view.html).toContain(locale==='zh'?'2026年3月':'March 2026');
});
